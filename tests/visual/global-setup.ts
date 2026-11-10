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

  const state: VisualStateFile = { baseURL, canonical, workers };

  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');

  console.log(
    `[visual] baseURL=${baseURL} canonical=${canonical.user.uid} ` +
      `воркеров: ${workers.length} ` +
      `(${workers.map((w) => `${w.username}:${w.dndId}/${w.dhId}`).join(', ')})`,
  );
}
