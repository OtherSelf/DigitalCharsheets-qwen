import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { FullConfig } from '@playwright/test';

import { VISUAL_RECOVERY_PHRASE } from './fixtures';
import {
  STATE_FILE,
  type VisualAccount,
  type VisualStateFile,
  type VisualUser,
} from './state';

/**
 * Один раз на прогон:
 *   1. проверяет, что сервер отвечает;
 *   2. находит фикстуры игр перебором `src/games/<id>/tests/fixtures/visual.ts`;
 *   3. сеет аккаунты: canonical `visual-tests` (для снимков, где виден логин)
 *      и по одному изолированному аккаунту на воркер `visual-tests-w1..wN`;
 *   4. в каждом воркер-аккаунте удаляет старые листы и создаёт по свежему
 *      листу на каждую найденную игру — данные воркеров не пересекаются,
 *      поэтому тесты можно гонять параллельно;
 *   5. пишет аккаунты и id персонажей в `.visual-state.json`.
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
 * ─── LANDMARK: GAME FIXTURE DISCOVERY ───────────────────────────────────────
 * Игровые персонажи для сева больше не импортируются хостом напрямую: каждая
 * игра держит фикстуру в `src/games/<id>/tests/fixtures/visual.ts`, а
 * global-setup находит файлы перебором каталогов. Удаление папки игры (D17)
 * убирает и фикстуру, и её спеки — хост при этом не падает, просто сеет
 * меньше персонажей.
 *
 * Контракт фикстуры: default-экспорт — шаблон персонажа (`{ id, userId }`
 * сервер выдаёт сам). Сегмент игры для `state.characters` берётся из
 * `tests/visual.json` (`nameSegment`) — из того же объявления, что задаёт
 * `dnd`/`dh` в именах эталонов.
 */
export interface GameVisualFixture {
  /** id плагина — папка `src/games/<id>`. */
  pluginId: string;
  /** Сегмент игры в именах PNG и в `state.characters` (`dnd`, `dh`). */
  segment: string;
  /** Шаблон персонажа из default-экспорта фикстуры. */
  character: object;
}

function readJsonField(file: string, field: string): unknown {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<
      string,
      unknown
    >;
    return parsed[field];
  } catch {
    return undefined;
  }
}

/**
 * Импорт TS-фикстуры из global-setup.
 *
 * Node умеет снимать типы с `.ts` сам, поэтому обычно работает нативный
 * `import()`. Если рантайм этого не умеет или файл загружен Playwright как
 * CJS, пробуем `createRequire`: у Playwright зарегистрирован require-хук,
 * который компилирует TS так же, как спеки.
 */
async function importFixtureModule(
  file: string,
): Promise<Record<string, unknown>> {
  const url = pathToFileURL(file).href;
  try {
    return (await import(url)) as Record<string, unknown>;
  } catch (importError) {
    try {
      return createRequire(file)(file) as Record<string, unknown>;
    } catch {
      throw new Error(
        `Не удалось импортировать фикстуру ${path.relative(
          process.cwd(),
          file,
        )}: ${
          importError instanceof Error
            ? importError.message
            : String(importError)
        }`,
      );
    }
  }
}

/** Похоже ли значение на шаблон персонажа, а не на обёртку модуля. */
function isCharacterLike(value: unknown): value is object {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.name === 'string' &&
    (typeof record.gameSystem === 'string' ||
      typeof record.systemId === 'string')
  );
}

/**
 * Достать персонажа из импортированного модуля фикстуры.
 *
 * Форма зависит от того, как рантайм загрузил файл: нативный ESM отдаёт
 * `{ default: character }`, а CJS-интероп может завернуть default ещё раз
 * (`{ default: { __esModule, default: character } }`). Поэтому идём по цепочке
 * `default`, пока значение не станет похоже на персонажа.
 */
function unwrapFixtureCharacter(
  imported: Record<string, unknown>,
): object | null {
  let candidate: unknown = imported.default ?? imported;
  for (let depth = 0; depth < 4; depth += 1) {
    if (isCharacterLike(candidate)) return candidate;
    if (!candidate || typeof candidate !== 'object') return null;
    if (!('default' in (candidate as Record<string, unknown>))) return null;
    candidate = (candidate as Record<string, unknown>).default;
  }
  return isCharacterLike(candidate) ? candidate : null;
}

/**
 * Все игровые фикстуры в порядке реестра плагинов (`plugin.json` → order,
 * затем id). Порядок важен: он задаёт порядок карточек на дашборде и порядок
 * листов в data-dir, а те зафиксированы эталонами.
 */
export async function discoverGameFixtures(
  rootDir: string,
): Promise<GameVisualFixture[]> {
  const gamesDir = path.join(rootDir, 'src', 'games');
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(gamesDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = entries
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const file = path.join(
        gamesDir,
        entry.name,
        'tests',
        'fixtures',
        'visual.ts',
      );
      if (!fs.existsSync(file)) return [];
      const order = readJsonField(
        path.join(gamesDir, entry.name, 'plugin.json'),
        'order',
      );
      return [
        {
          pluginId: entry.name,
          file,
          order: typeof order === 'number' ? order : Number.MAX_SAFE_INTEGER,
        },
      ];
    })
    .sort(
      (a, b) => a.order - b.order || a.pluginId.localeCompare(b.pluginId, 'en'),
    );

  const fixtures: GameVisualFixture[] = [];
  const usedSegments = new Set<string>();
  for (const entry of files) {
    const character = unwrapFixtureCharacter(
      await importFixtureModule(entry.file),
    );
    if (!character) {
      console.warn(
        `[visual] ${entry.pluginId}: в tests/fixtures/visual.ts нет default-экспорта — игра пропущена`,
      );
      continue;
    }
    const declared = readJsonField(
      path.join(gamesDir, entry.pluginId, 'tests', 'visual.json'),
      'nameSegment',
    );
    const segment =
      typeof declared === 'string' && declared ? declared : entry.pluginId;
    if (usedSegments.has(segment)) {
      console.warn(
        `[visual] ${entry.pluginId}: сегмент "${segment}" уже занят другой игрой — игра пропущена`,
      );
      continue;
    }
    usedSegments.add(segment);
    fixtures.push({ pluginId: entry.pluginId, segment, character });
  }
  return fixtures;
}

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
 *
 * Лист задаётся сегментом игры (`dnd`, `dh`), а не объектом фикстуры: тело
 * персонажа берётся из обнаруженных фикстур плагинов. Игр без фикстуры в
 * наборе нет — их листы просто не сеются.
 */
interface AdminDemoCharacter {
  /** Сегмент игры из `state.characters` (`dnd`, `dh`). */
  segment: string;
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
        segment: 'dnd',
        id: 'visual-admin-alice-dnd',
        updatedAt: '2025-05-01T12:00:00.000Z',
      },
      {
        segment: 'dh',
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
        segment: 'dnd',
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
  /** Создавать ли персонажей (canonical нужен только для /settings). */
  withCharacters: boolean;
  /** Обнаруженные фикстуры игр: по листу на каждую (в порядке реестра). */
  fixtures: GameVisualFixture[];
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

  const characters: Record<string, string> = {};
  for (const fixture of options.fixtures) {
    const id = await create(fixture.character, fixture.pluginId);
    if (id) characters[fixture.segment] = id;
  }

  return {
    username,
    password: PASSWORD,
    user: { ...user, hasRecoveryPhrase: true },
    characters,
    dndId: characters.dnd ?? '',
    dhId: characters.dh ?? '',
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
  fixtures: GameVisualFixture[],
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
  const characterBySegment = new Map(
    fixtures.map((fixture) => [fixture.segment, fixture.character]),
  );
  for (const character of spec.characters) {
    const fixture = characterBySegment.get(character.segment);
    // Игры с обнаруженной фикстурой нет (папку удалили) — листа тоже нет.
    if (!fixture) continue;
    const file = path.join(charactersDir, `${character.id}.json`);
    fs.writeFileSync(
      file,
      JSON.stringify({ ...fixture, id: character.id, userId: uid }, null, 2),
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
  fixtures: GameVisualFixture[],
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
      await ensureAdminDemoUser(baseURL, dataDir, spec, fixtures);
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
      characters: {},
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
    const dndId = worker.characters.dnd;
    if (!dndId) return;
    const token = shareTokenFor(index, 'plain');
    const historyToken = shareTokenFor(index, 'history');
    const hash = crypto
      .createHash('sha256')
      .update(token, 'utf8')
      .digest('hex');
    const historyHash = crypto
      .createHash('sha256')
      .update(historyToken, 'utf8')
      .digest('hex');
    shares[hash] = {
      uid: worker.user.uid,
      characterId: dndId,
      createdAt: '2026-01-10T10:00:00.000Z',
      expiresAt: null,
      includeHistory: false,
    };
    shares[historyHash] = {
      uid: worker.user.uid,
      characterId: dndId,
      createdAt: '2026-01-10T10:01:00.000Z',
      expiresAt: null,
      includeHistory: true,
    };
    worker.share = {
      token,
      historyToken,
      characterId: dndId,
    };
  });

  fs.writeFileSync(
    path.join(dataDir, 'shares.json'),
    JSON.stringify({ version: 1, shares }, null, 2),
    'utf8',
  );
}

/** 43 символа base64url, уникальные на воркера. */
function shareTokenFor(index: number, variant: 'plain' | 'history'): string {
  const prefix = `visual${variant}${index.toString(36)}`;
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
    const dndId = worker.characters.dnd;
    if (!dndId) continue;
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
      path.join(dir, `${dndId}.jsonl`),
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
  // `config.rootDir` — это testDir (`tests/visual`), а не корень репозитория:
  // фикстуры же лежат в `src/games`. Поэтому берём каталог конфига.
  const projectRoot = config.configFile
    ? path.dirname(config.configFile)
    : process.cwd();
  const fixtures = await discoverGameFixtures(projectRoot);
  if (fixtures.length === 0) {
    // Хост не обязан падать из-за отсутствия игр: сеять просто нечего.
    console.warn(
      '[visual] не найдено ни одной фикстуры src/games/*/tests/fixtures/visual.ts — ' +
        'листы персонажей не посеяны',
    );
  }

  // canonical — фиксированный логин `visual-tests` (виден на /settings),
  // персонажи ему не нужны.
  const canonical = await seedAccount(baseURL, CANONICAL_USERNAME, {
    withCharacters: false,
    fixtures,
  });

  const workers: VisualAccount[] = [];
  for (let index = 0; index < workerCount; index += 1) {
    workers.push(
      await seedAccount(baseURL, `${CANONICAL_USERNAME}-w${index + 1}`, {
        withCharacters: true,
        fixtures,
      }),
    );
  }

  seedShareFixtures(workers);
  seedHistoryFixtures(workers);

  const admin = await seedAdminFixtures(baseURL, fixtures);

  const state: VisualStateFile = {
    baseURL,
    canonical,
    workers,
    ...(admin ? { admin } : {}),
  };

  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');

  const seeded = fixtures
    .map((fixture) => `${fixture.pluginId}(${fixture.segment})`)
    .join(', ');
  console.log(
    `[visual] baseURL=${baseURL} canonical=${canonical.user.uid} ` +
      `игры: ${seeded} ` +
      `воркеров: ${workers.length} ` +
      `(${workers
        .map(
          (w) =>
            `${w.username}:${Object.entries(w.characters)
              .map(([segment, id]) => `${segment}=${id}`)
              .join('/')}`,
        )
        .join(', ')})` +
      ` admin=${admin ? admin.username : '—'}`,
  );
}
