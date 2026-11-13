import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { FullConfig } from '@playwright/test';

import { dhCharacter, dndCharacter, VISUAL_RECOVERY_PHRASE } from './fixtures';
import {
  STATE_FILE,
  type VisualAccount,
  type VisualStateFile,
  type VisualUser,
} from './state';

/**
 * Один раз на прогон:
 *   1. проверяет, что сервер отвечает;
 *   2. сеет аккаунты: canonical `visual-tests` (для снимков, где виден логин)
 *      и по одному изолированному аккаунту на воркер `visual-tests-w1..wN`;
 *   3. в каждом воркер-аккаунте удаляет старые листы и создаёт два свежих
 *      (D&D и Dark Heresy) — данные воркеров не пересекаются, поэтому тесты
 *      можно гонять параллельно;
 *   4. пишет аккаунты и id персонажей в `.visual-state.json`.
 *
 * Изоляция по воркерам, а не по проектам: Playwright распределяет воркеры по
 * файлам сам, и один и тот же аккаунт мог бы одновременно правиться из двух
 * файлов (редактирование секций, массовый редактор) — это давало бы гонки и
 * «мигающие» скриншоты. Фикстуры у всех аккаунтов одинаковые, поэтому
 * картинки от изоляции не зависят.
 */

const PASSWORD = 'visual-pass-1234';
const DISPLAY_NAME = 'Visual Tester';
const CANONICAL_USERNAME = 'visual-tests';
const MAX_SEEDED_WORKERS = 8;

/**
 * ─── LANDMARK: ADMIN VISUAL FIXTURES ────────────────────────────────────────
 * Для снимков /admin нужен детерминированный список пользователей: в отличие
 * от дашборда, он не изолирован по воркерам. Поэтому global-setup пишет три
 * демо-аккаунта напрямую в data-dir временного сервера:
 *   • фиксированные даты создания/входа;
 *   • фиксированные роли и блокировки;
 *   • фиксированные листы персонажей и mtime их файлов.
 *
 * В таблице /admin эти аккаунты отфильтрованы поиском `visual-admin-`, так
 * что воркерские аккаунты и число воркеров на снимок не влияют. Числа в
 * карточках статистики — глобальные, их тест маскирует.
 */
interface AdminDemoCharacter {
  fixture: object;
  id: string;
  updatedAt: string;
}

interface AdminDemoUser {
  username: string;
  displayName: string;
  role: 'admin' | 'user';
  isBlocked: boolean;
  createdAt: string;
  lastLoginAt: string;
  characters: AdminDemoCharacter[];
}

const ADMIN_DEMO_USERS: AdminDemoUser[] = [
  {
    username: 'visual-admin-alice',
    displayName: 'Alice Ashford',
    role: 'user',
    isBlocked: false,
    createdAt: '2025-01-10T10:00:00.000Z',
    lastLoginAt: '2025-04-01T09:30:00.000Z',
    characters: [
      {
        fixture: dndCharacter,
        id: 'visual-admin-alice-dnd',
        updatedAt: '2025-05-01T12:00:00.000Z',
      },
      {
        fixture: dhCharacter,
        id: 'visual-admin-alice-dh',
        updatedAt: '2025-05-02T12:00:00.000Z',
      },
    ],
  },
  {
    username: 'visual-admin-bob',
    displayName: 'Bob Brannigan',
    role: 'user',
    isBlocked: true,
    createdAt: '2025-02-20T11:00:00.000Z',
    lastLoginAt: '2025-04-10T18:00:00.000Z',
    characters: [
      {
        fixture: dndCharacter,
        id: 'visual-admin-bob-dnd',
        updatedAt: '2025-05-03T12:00:00.000Z',
      },
    ],
  },
  {
    username: 'visual-admin-carol',
    displayName: 'Carol Voss',
    role: 'admin',
    isBlocked: false,
    createdAt: '2025-03-05T12:00:00.000Z',
    lastLoginAt: '2025-04-20T08:15:00.000Z',
    characters: [],
  },
];

async function requestJson<T>(
  baseURL: string,
  pathname: string,
  init?: RequestInit,
): Promise<{ status: number; body: T; headers: Headers }> {
  const response = await fetch(`${baseURL}${pathname}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return {
    status: response.status,
    body: body as T,
    headers: response.headers,
  };
}

async function waitForServer(baseURL: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseURL}/login`, {
        signal: AbortSignal.timeout(5_000),
        redirect: 'manual',
      });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Сервер ${baseURL} не отвечает: ${lastError}`);
}

/** Сколько воркеров засеять: env → конфиг Playwright → 1. */
export function resolveWorkerCount(config: FullConfig): number {
  const raw =
    process.env.DCS_VISUAL_WORKERS ??
    (typeof config.workers === 'number' ? config.workers : 1);
  const parsed = Number.parseInt(String(raw), 10);
  const count = Number.isFinite(parsed) ? parsed : 1;
  return Math.min(Math.max(count, 1), MAX_SEEDED_WORKERS);
}

interface SeedOptions {
  /** Создавать ли двух персонажей (canonical нужен только для /settings). */
  withCharacters: boolean;
}

/** Регистрирует/переиспользует аккаунт и (при желании) сеет персонажей. */
async function seedAccount(
  baseURL: string,
  username: string,
  options: SeedOptions,
): Promise<VisualAccount> {
  // Регистрация отдельным роутом; 409 значит, что аккаунт уже есть
  // (прогон против постоянного --base-url) — дальше просто логинимся.
  const registration = await requestJson<{
    success: boolean;
    user?: VisualUser;
    error?: string;
  }>(baseURL, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password: PASSWORD,
      displayName: DISPLAY_NAME,
      recoveryPhrase: VISUAL_RECOVERY_PHRASE,
    }),
  });
  if (registration.status !== 200 && registration.status !== 409) {
    throw new Error(
      `Не удалось зарегистрировать ${username}: HTTP ${registration.status} ` +
        JSON.stringify(registration.body),
    );
  }

  const login = async () => {
    const auth = await requestJson<{
      success: boolean;
      isNewUser?: boolean;
      user?: VisualUser;
      error?: string;
    }>(baseURL, '/api/auth', {
      method: 'POST',
      body: JSON.stringify({ username, password: PASSWORD }),
    });
    if (auth.status !== 200 || !auth.body.success || !auth.body.user) {
      throw new Error(
        `Не удалось войти ${username}: HTTP ${auth.status} ${JSON.stringify(auth.body)}`,
      );
    }
    // Сессия теперь cookie: сырые fetch не хранят cookie jar, таскаем вручную.
    const sessionCookie = (auth.headers.get('set-cookie') || '').split(';')[0];
    if (!sessionCookie) {
      throw new Error(`Не удалось получить сессионную cookie для ${username}`);
    }
    return { user: auth.body.user, sessionCookie };
  };

  let { user, sessionCookie } = await login();
  const authed = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { ...(init.headers || {}), cookie: sessionCookie },
  });

  // Recovery phrase нужен, чтобы RecoveryModal не открывался поверх страниц.
  if (!user.hasRecoveryPhrase) {
    const phrase = await requestJson<{ success: boolean; error?: string }>(
      baseURL,
      '/api/auth/phrase',
      authed({
        method: 'POST',
        body: JSON.stringify({ phrase: VISUAL_RECOVERY_PHRASE }),
      }),
    );
    if (phrase.status !== 200 || !phrase.body.success) {
      throw new Error(
        `Не удалось сохранить recovery phrase (${username}): HTTP ${phrase.status} ` +
          JSON.stringify(phrase.body),
      );
    }
    ({ user, sessionCookie } = await login());
  }

  // Чистим листы от предыдущего прогона, чтобы дашборд был детерминированным.
  const existing = await requestJson<Array<{ id: string }>>(
    baseURL,
    '/api/characters',
    authed(),
  );
  if (existing.status === 200 && Array.isArray(existing.body)) {
    for (const character of existing.body) {
      await fetch(
        `${baseURL}/api/characters/${encodeURIComponent(character.id)}`,
        {
          method: 'DELETE',
          headers: { cookie: sessionCookie },
          signal: AbortSignal.timeout(10_000),
        },
      ).catch(() => undefined);
    }
  }

  const create = async (fixture: object, label: string): Promise<string> => {
    if (!options.withCharacters) return '';
    const created = await requestJson<{ id?: string; error?: string }>(
      baseURL,
      '/api/characters',
      authed({ method: 'POST', body: JSON.stringify(fixture) }),
    );
    if (created.status !== 201 || !created.body.id) {
      throw new Error(
        `Не удалось создать персонажа (${label}, ${username}): HTTP ${created.status} ` +
          JSON.stringify(created.body),
      );
    }
    return created.body.id;
  };

  const dndId = await create(dndCharacter, 'D&D');
  const dhId = await create(dhCharacter, 'Dark Heresy');

  return {
    username,
    password: PASSWORD,
    user: { ...user, hasRecoveryPhrase: true },
    dndId,
    dhId,
  };
}

/** Логин/пароль служебного админа из `<data-dir>/.initial-admin.txt`. */
function readInitialAdminCredentials(
  dataDir: string,
): { username: string; password: string } | null {
  try {
    const text = fs.readFileSync(
      path.join(dataDir, '.initial-admin.txt'),
      'utf8',
    );
    const username = /^Login:\s+(.+)$/m.exec(text)?.[1]?.trim();
    const password = /^Password:\s+(.+)$/m.exec(text)?.[1]?.trim();
    return username && password ? { username, password } : null;
  } catch {
    return null;
  }
}

/**
 * uid по логину — читаем каталог напрямую. Демо-аккаунты для /admin не
 * логинятся (заблокированный bob иначе не смог бы войти), поэтому uid из
 * индекса не годится.
 */
function findUidByUsername(dataDir: string, username: string): string | null {
  const usersDir = path.join(dataDir, 'users');
  const wanted = username.toLowerCase().trim();

  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(usersDir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const raw = JSON.parse(
        fs.readFileSync(path.join(usersDir, entry.name, 'user.json'), 'utf8'),
      ) as { username?: unknown; email?: unknown };
      const login = String(raw.username ?? raw.email ?? '')
        .toLowerCase()
        .trim();
      if (login === wanted) return entry.name;
    } catch {
      // Битый профиль не мешает найти остальные.
    }
  }
  return null;
}

async function signIn(
  baseURL: string,
  username: string,
  password: string,
): Promise<{ user: VisualUser; cookie: string }> {
  const res = await requestJson<{
    success: boolean;
    user?: VisualUser;
    error?: string;
  }>(baseURL, '/api/auth', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (res.status !== 200 || !res.body.success || !res.body.user) {
    throw new Error(
      `Не удалось войти ${username}: HTTP ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie) throw new Error(`Нет сессионной cookie для ${username}`);
  return { user: res.body.user, cookie };
}

/**
 * Демо-пользователь для /admin. Профиль и листы пишутся напрямую в data-dir:
 * публичный API не позволяет задать createdAt/lastLoginAt, а от них зависит
 * детерминизм снимка. Для заблокированного пользователя это ещё и
 * единственный способ засеять листы (вход ему запрещён).
 */
async function ensureAdminDemoUser(
  baseURL: string,
  dataDir: string,
  spec: AdminDemoUser,
): Promise<void> {
  let uid = findUidByUsername(dataDir, spec.username);
  if (!uid) {
    const registration = await requestJson<{
      success: boolean;
      user?: VisualUser;
      error?: string;
    }>(baseURL, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: spec.username,
        password: PASSWORD,
        displayName: spec.displayName,
        recoveryPhrase: VISUAL_RECOVERY_PHRASE,
      }),
    });
    if (registration.status === 200 && registration.body.user) {
      uid = registration.body.user.uid;
    }
  }
  if (!uid) uid = findUidByUsername(dataDir, spec.username);
  if (!uid) {
    throw new Error(`Не удалось завести демо-пользователя ${spec.username}`);
  }

  const profileFile = path.join(dataDir, 'users', uid, 'user.json');
  const profile = JSON.parse(fs.readFileSync(profileFile, 'utf8')) as Record<
    string,
    unknown
  >;
  const next: Record<string, unknown> = {
    ...profile,
    schemaVersion: 4,
    uid,
    username: spec.username,
    displayName: spec.displayName,
    role: spec.role,
    isBlocked: spec.isBlocked,
    createdAt: spec.createdAt,
    updatedAt: spec.createdAt,
    lastLoginAt: spec.lastLoginAt,
    recoveryPhrase: VISUAL_RECOVERY_PHRASE,
  };
  if (spec.isBlocked) next.blockedAt = spec.lastLoginAt;
  else delete next.blockedAt;
  delete next.mustChangePassword;
  fs.writeFileSync(profileFile, JSON.stringify(next, null, 2), 'utf8');

  const charactersDir = path.join(dataDir, 'users', uid, 'characters');
  fs.rmSync(charactersDir, { recursive: true, force: true });
  fs.mkdirSync(charactersDir, { recursive: true });
  for (const character of spec.characters) {
    const file = path.join(charactersDir, `${character.id}.json`);
    fs.writeFileSync(
      file,
      JSON.stringify(
        { ...character.fixture, id: character.id, userId: uid },
        null,
        2,
      ),
      'utf8',
    );
    // mtime задаёт колонку «Updated» в диалоге листов.
    const date = new Date(character.updatedAt);
    fs.utimesSync(file, date, date);
  }
}

/**
 * Подготовить админа и демо-аккаунты для снимков /admin. `null` — нет
 * доступа к data-dir (запуск с --base-url или прямой `playwright test`):
 * админские тесты в этом случае пропускаются, остальная регрессия работает.
 */
async function seedAdminFixtures(
  baseURL: string,
): Promise<VisualAccount | null> {
  const dataDir = process.env.DCS_VISUAL_DATA_DIR;
  if (!dataDir) {
    console.log(
      '[visual] /admin: DCS_VISUAL_DATA_DIR не задан — админские снимки пропущены',
    );
    return null;
  }

  try {
    const credentials = readInitialAdminCredentials(dataDir);
    if (!credentials) {
      throw new Error(`нет файла ${path.join(dataDir, '.initial-admin.txt')}`);
    }

    for (const spec of ADMIN_DEMO_USERS) {
      await ensureAdminDemoUser(baseURL, dataDir, spec);
    }

    const first = await signIn(
      baseURL,
      credentials.username,
      credentials.password,
    );
    let user = first.user;
    if (user.role !== 'admin') {
      throw new Error(`${credentials.username} не администратор`);
    }

    // Иначе RecoveryModal откроется поверх /admin.
    if (!user.hasRecoveryPhrase) {
      const phrase = await requestJson<{ success: boolean; error?: string }>(
        baseURL,
        '/api/auth/phrase',
        {
          method: 'POST',
          headers: { cookie: first.cookie },
          body: JSON.stringify({ phrase: VISUAL_RECOVERY_PHRASE }),
        },
      );
      if (phrase.status !== 200 || !phrase.body.success) {
        throw new Error(
          `не удалось задать recovery phrase админу: HTTP ${phrase.status}`,
        );
      }
      ({ user } = await signIn(
        baseURL,
        credentials.username,
        credentials.password,
      ));
    }

    return {
      username: credentials.username,
      password: credentials.password,
      user: { ...user, hasRecoveryPhrase: true },
      dndId: '',
      dhId: '',
    };
  } catch (error) {
    console.warn(
      '[visual] /admin: не удалось подготовить данные —',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Гостевые ссылки для снимков `/share/*`. Публичная страница не требует
 * логина, поэтому токен можно зафиксировать: он попадает в state и не меняет
 * PNG от прогона к прогону. В `shares.json` лежит только SHA-256, как в
 * приложении.
 */
function seedShareFixtures(workers: VisualAccount[]): void {
  const dataDir = process.env.DCS_VISUAL_DATA_DIR;
  if (!dataDir) {
    console.log(
      '[visual] /share: DCS_VISUAL_DATA_DIR не задан — снимки ссылки пропущены',
    );
    return;
  }

  const shares: Record<
    string,
    {
      uid: string;
      characterId: string;
      createdAt: string;
      expiresAt: null;
      includeHistory: boolean;
    }
  > = {};

  workers.forEach((worker, index) => {
    if (!worker.dndId) return;
    const token = shareTokenFor(index);
    const hash = crypto
      .createHash('sha256')
      .update(token, 'utf8')
      .digest('hex');
    shares[hash] = {
      uid: worker.user.uid,
      characterId: worker.dndId,
      createdAt: '2026-01-10T10:00:00.000Z',
      expiresAt: null,
      includeHistory: false,
    };
    worker.share = { token, characterId: worker.dndId };
  });

  fs.writeFileSync(
    path.join(dataDir, 'shares.json'),
    JSON.stringify({ version: 1, shares }, null, 2),
    'utf8',
  );
}

/** 43 символа base64url, уникальные на воркера. */
function shareTokenFor(index: number): string {
  const prefix = `visualshare${index.toString(36)}`;
  return (prefix + 'A'.repeat(43)).slice(0, 43);
}

/**
 * Детерминированная история для снимков `/character/<id>/history`: фиксированные
 * даты, две сессии, создание, правки характеристик/инвентаря/заметок. Пишем
 * JSONL напрямую в data-dir, чтобы PNG не зависели от текущего времени.
 */
function seedHistoryFixtures(workers: VisualAccount[]): void {
  const dataDir = process.env.DCS_VISUAL_DATA_DIR;
  if (!dataDir) {
    console.log(
      '[visual] /history: DCS_VISUAL_DATA_DIR не задан — снимки истории пропущены',
    );
    return;
  }

  for (const worker of workers) {
    if (!worker.dndId) continue;
    const dir = path.join(dataDir, 'users', worker.user.uid, 'history');
    fs.mkdirSync(dir, { recursive: true });
    const records = [
      {
        v: 1,
        id: 'visual-history-create',
        at: '2026-01-10T17:55:00.000Z',
        source: 'create',
        changes: [],
        summary: { changed: 0, added: 0, removed: 0, bulk: 0 },
      },
      {
        v: 1,
        id: 'visual-history-1',
        at: '2026-01-10T18:00:00.000Z',
        source: 'save',
        changes: [
          {
            kind: 'changed',
            path: 'stats.strength',
            before: { value: 10 },
            after: { value: 12 },
          },
        ],
        summary: { changed: 1, added: 0, removed: 0, bulk: 0 },
      },
      {
        v: 1,
        id: 'visual-history-2',
        at: '2026-01-10T18:05:00.000Z',
        source: 'save',
        changes: [
          {
            kind: 'changed',
            path: 'inventory',
            key: 'visual-sword',
            label: 'Longsword',
            field: 'notes',
            before: { value: '' },
            after: { value: 'Notched after the crypt.' },
          },
          {
            kind: 'added',
            path: 'inventory',
            key: 'visual-potion',
            label: 'Potion of Healing',
            after: {
              value: {
                id: 'visual-potion',
                name: 'Potion of Healing',
                status: 'default',
                notes: '',
              },
            },
          },
        ],
        summary: { changed: 1, added: 1, removed: 0, bulk: 0 },
      },
      {
        v: 1,
        id: 'visual-history-3',
        at: '2026-02-14T19:00:00.000Z',
        source: 'save',
        changes: [
          {
            kind: 'changed',
            path: 'notes',
            before: { value: 'The old road was quiet.' },
            after: { value: 'The old road was quiet. We found the seal.' },
          },
        ],
        summary: { changed: 1, added: 0, removed: 0, bulk: 0 },
      },
    ];
    fs.writeFileSync(
      path.join(dir, `${worker.dndId}.jsonl`),
      `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
      'utf8',
    );
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL =
    process.env.DCS_VISUAL_BASE_URL ||
    config.projects[0]?.use?.baseURL ||
    'http://127.0.0.1:3000';

  await waitForServer(baseURL);

  const workerCount = resolveWorkerCount(config);

  // canonical — фиксированный логин `visual-tests` (виден на /settings),
  // персонажи ему не нужны.
  const canonical = await seedAccount(baseURL, CANONICAL_USERNAME, {
    withCharacters: false,
  });

  const workers: VisualAccount[] = [];
  for (let index = 0; index < workerCount; index += 1) {
    workers.push(
      await seedAccount(baseURL, `${CANONICAL_USERNAME}-w${index + 1}`, {
        withCharacters: true,
      }),
    );
  }

  seedShareFixtures(workers);
  seedHistoryFixtures(workers);

  const admin = await seedAdminFixtures(baseURL);

  const state: VisualStateFile = {
    baseURL,
    canonical,
    workers,
    ...(admin ? { admin } : {}),
  };

  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');

  console.log(
    `[visual] baseURL=${baseURL} canonical=${canonical.user.uid} ` +
      `воркеров: ${workers.length} ` +
      `(${workers.map((w) => `${w.username}:${w.dndId}/${w.dhId}`).join(', ')})` +
      ` admin=${admin ? admin.username : '—'}`,
  );
}
