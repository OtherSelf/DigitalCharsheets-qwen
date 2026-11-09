import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig } from '@playwright/test';
import { dhCharacter, dndCharacter, VISUAL_RECOVERY_PHRASE } from './fixtures';
import { STATE_FILE, type VisualState, type VisualUser } from './state';

/**
 * Один раз на прогон:
 *   1. проверяет, что сервер отвечает;
 *   2. создаёт (или переиспользует) аккаунт `visual-tests`;
 *   3. выставляет recovery phrase (чтобы не всплывало модальное окно);
 *   4. удаляет старые тестовые листы и создаёт два свежих (D&D и Dark Heresy);
 *   5. пишет id и пользователя в .visual-state.json для тестов.
 *
 * Благодаря фиксированному username uid тоже фиксированный, а значит
 * localStorage-сессия и данные совпадают от прогона к прогону.
 */

const USERNAME = 'visual-tests';
const PASSWORD = 'visual-pass-1234';
const DISPLAY_NAME = 'Visual Tester';

async function requestJson<T>(
  baseURL: string,
  pathname: string,
  init?: RequestInit,
): Promise<{ status: number; body: T; headers: Headers }> {
  const response = await fetch(`${baseURL}${pathname}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
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
  return { status: response.status, body: body as T, headers: response.headers };
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

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL =
    process.env.DCS_VISUAL_BASE_URL ||
    config.projects[0]?.use?.baseURL ||
    'http://127.0.0.1:3000';

  await waitForServer(baseURL);

  // Регистрация теперь отдельным роутом; 409 значит, что аккаунт уже есть
  // (прогон против постоянного --base-url) — это нормально, дальше логинимся.
  const registration = await requestJson<{
    success: boolean;
    user?: VisualUser;
    error?: string;
  }>(baseURL, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: USERNAME,
      password: PASSWORD,
      displayName: DISPLAY_NAME,
      recoveryPhrase: VISUAL_RECOVERY_PHRASE,
    }),
  });
  if (registration.status !== 200 && registration.status !== 409) {
    throw new Error(
      `Не удалось зарегистрировать визуальный аккаунт: HTTP ${registration.status} ` +
        JSON.stringify(registration.body),
    );
  }

  const auth = await requestJson<{
    success: boolean;
    isNewUser?: boolean;
    user?: VisualUser;
    error?: string;
  }>(baseURL, '/api/auth', {
    method: 'POST',
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });

  if (auth.status !== 200 || !auth.body.success || !auth.body.user) {
    throw new Error(
      `Не удалось войти визуальным аккаунтом: HTTP ${auth.status} ${JSON.stringify(auth.body)}`,
    );
  }

  // Сессия теперь cookie: сырые fetch в global-setup не хранят cookie jar,
  // поэтому таскаем её вручную.
  const sessionCookie = (auth.headers.get('set-cookie') || '').split(';')[0];
  if (!sessionCookie) {
    throw new Error('Не удалось получить сессионную cookie при входе');
  }
  const authed = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { ...(init.headers || {}), cookie: sessionCookie },
  });

  let user = auth.body.user;

  // Recovery phrase нужен, чтобы RecoveryModal не открывался поверх страниц.
  // Новый аккаунт получает её при регистрации; для старого — доставляем.
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
        `Не удалось сохранить recovery phrase: HTTP ${phrase.status} ${JSON.stringify(phrase.body)}`,
      );
    }

    const relogin = await requestJson<{ success: boolean; user?: VisualUser; error?: string }>(
      baseURL,
      '/api/auth',
      {
        method: 'POST',
        body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
      },
    );
    if (relogin.status !== 200 || !relogin.body.user) {
      throw new Error(
        `Не удалось перелогиниться: HTTP ${relogin.status} ${JSON.stringify(relogin.body)}`,
      );
    }
    user = relogin.body.user;
  }

  // Чистим листы от предыдущего прогона, чтобы дашборд был детерминированным.
  const existing = await requestJson<Array<{ id: string }>>(
    baseURL,
    '/api/characters',
    authed(),
  );
  if (existing.status === 200 && Array.isArray(existing.body)) {
    for (const character of existing.body) {
      await fetch(`${baseURL}/api/characters/${encodeURIComponent(character.id)}`, {
        method: 'DELETE',
        headers: { cookie: sessionCookie },
        signal: AbortSignal.timeout(10_000),
      }).catch(() => undefined);
    }
  }

  const create = async (fixture: object, label: string): Promise<string> => {
    const created = await requestJson<{ id?: string; error?: string }>(
      baseURL,
      '/api/characters',
      authed({
        method: 'POST',
        body: JSON.stringify(fixture),
      }),
    );
    if (created.status !== 201 || !created.body.id) {
      throw new Error(
        `Не удалось создать персонажа (${label}): HTTP ${created.status} ` +
          JSON.stringify(created.body),
      );
    }
    return created.body.id;
  };

  const dndId = await create(dndCharacter, 'D&D');
  const dhId = await create(dhCharacter, 'Dark Heresy');

  const state: VisualState = {
    baseURL,
    username: USERNAME,
    password: PASSWORD,
    user: { ...user, hasRecoveryPhrase: true },
    dndId,
    dhId,
  };

  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');

  console.log(
    `[visual] baseURL=${baseURL} user=${user.uid} dnd=${dndId} dh=${dhId}`,
  );
}
