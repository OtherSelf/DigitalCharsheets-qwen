/**
 * POST /api/auth, register, exists, logout и PUT profile: успешные и
 * ошибочные ответы, cookie и битый JSON. uid берётся только из сессии.
 */

import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as existsRoute } from '@/app/api/auth/exists/route';
import { POST as logoutRoute } from '@/app/api/auth/logout/route';
import { PUT as profileRoute } from '@/app/api/auth/profile/route';
import { POST as registerRoute } from '@/app/api/auth/register/route';
import { POST as loginRoute } from '@/app/api/auth/route';
import { GET as charactersGet } from '@/app/api/characters/route';
import { isUid } from '@/lib/ids';
import {
  isRecoveryPhraseHash,
  recoveryPhraseMatches,
} from '@/lib/security/phrase';
import { resetAuthRateLimits } from '@/lib/security/rate-limit';
import { resetWriteSeqGuard } from '@/lib/server-storage';

import {
  loginIndexPath,
  readJson,
  removeDir,
  sessionHeaders,
  userPaths,
  useTempDataDir,
} from '@tests/support';
import { loginAs, registerAs, TEST_PASSWORD } from '@tests/support/api-auth';
import { json, req } from '@tests/support/http';

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
  resetWriteSeqGuard();
  // Лимитер auth-роутов переживает тест (синглтон), поэтому его история
  // сбрасывается вместе с каталогом данных.
  resetAuthRateLimits();
});

afterEach(() => {
  removeDir(dataDir);
  resetWriteSeqGuard();
});

describe('POST /api/auth/register', () => {
  it('создаёт аккаунт с uid, recovery-фразой и сессией', async () => {
    const { res, body, uid, cookie } = await registerAs(
      'api-user',
      'test-pass-1234',
      'API',
    );

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ success: true, isNewUser: true });
    expect(isUid(uid)).toBe(true);
    expect(body.user.hasRecoveryPhrase).toBe(true);
    expect(cookie).toMatch(/^dcs_session=/);
    expect(res.headers.get('set-cookie')).toMatch(/HttpOnly/);

    // uid не выводится из логина: user.json и индекс указывают на один uid.
    const stored = readJson(userPaths(dataDir, uid).userFile);
    expect(stored.uid).toBe(uid);
    // Фраза лежит хэшем: копия user.json не должна её выдавать.
    expect(isRecoveryPhraseHash(stored.recoveryPhrase)).toBe(true);
    expect(
      recoveryPhraseMatches(
        stored.recoveryPhrase,
        'amber cobalt lantern silver ember frost',
      ),
    ).toBe(true);
    expect(readJson(loginIndexPath(dataDir)).logins['api-user']).toBe(uid);
  });

  it('возвращает 409 на занятый логин и не меняет чужой профиль', async () => {
    const first = await registerAs('occupied', 'test-pass-1234', 'First');
    const second = await registerAs(
      'occupied',
      'test-pass-5678',
      'Second',
      'zulu yankee xray whiskey victor uniform',
    );

    expect(second.res.status).toBe(409);
    expect(second.body).toMatchObject({ success: false, reason: 'exists' });
    expect(readJson(userPaths(dataDir, first.uid).userFile).displayName).toBe(
      'First',
    );
    expect(
      recoveryPhraseMatches(
        readJson(userPaths(dataDir, first.uid).userFile).recoveryPhrase,
        'amber cobalt lantern silver ember frost',
      ),
    ).toBe(true);
  });

  it('валидирует обязательные поля, длину пароля и фразы', async () => {
    const noPassword = await registerRoute(json({ username: 'x' }));
    expect(noPassword.status).toBe(400);

    const shortPassword = await registerRoute(
      json({ username: 'x', password: '123', recoveryPhrase: 'amber cobalt' }),
    );
    expect(shortPassword.status).toBe(400);
    expect((await shortPassword.json()).error).toContain('at least 12');

    const shortPhrase = await registerRoute(
      json({ username: 'x', password: 'test-pass-1234', recoveryPhrase: 'ab' }),
    );
    expect(shortPhrase.status).toBe(400);
    expect((await shortPhrase.json()).error).toContain('Recovery phrase');
  });

  it('отвергает фразу короче политики на регистрации', async () => {
    const res = await registerRoute(
      json({
        username: 'short-phrase',
        password: 'test-pass-1234',
        displayName: 'Short',
        recoveryPhrase: '12345',
      }),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe('invalid_phrase');
    expect(fs.existsSync(path.join(dataDir, 'users'))).toBe(false);
  });

  it('возвращает 400 (а не падает) на битом JSON', async () => {
    const res = await registerRoute(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ broken',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('отклоняет тело больше 16 КиБ', async () => {
    const res = await registerRoute(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'x'.repeat(17 * 1024) }),
      }),
    );
    expect(res.status).toBe(413);
  });
});

describe('POST /api/auth/exists', () => {
  it('отличает существующий логин от свободного и нормализует регистр', async () => {
    await registerAs('Existing.User');

    const found = await existsRoute(json({ username: '  EXISTING.USER  ' }));
    expect(found.status).toBe(200);
    expect(await found.json()).toMatchObject({ success: true, exists: true });

    const missing = await existsRoute(json({ username: 'nobody' }));
    expect(missing.status).toBe(200);
    expect(await missing.json()).toMatchObject({
      success: true,
      exists: false,
    });

    // Оракул перечисления упирается в лимит, а не отвечает бесконечно.
    let limited = 0;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const res = await existsRoute(json({ username: 'probe-login' }));
      if (res.status === 429) {
        expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
        limited += 1;
        break;
      }
      expect(res.status).toBe(200);
    }
    expect(limited).toBe(1);
  });

  it('400 без логина и на битом JSON', async () => {
    const empty = await existsRoute(json({ username: '   ' }));
    expect(empty.status).toBe(400);

    const broken = await existsRoute(
      new Request('http://localhost/api/auth/exists', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ broken',
      }),
    );
    expect(broken.status).toBe(400);
  });
});

describe('POST /api/auth', () => {
  it('не создаёт аккаунт для неизвестного логина и не выдаёт сессию', async () => {
    const res = await loginRoute(
      json({ username: 'unknown', password: 'test-pass-1234' }),
    );

    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(await res.json()).toMatchObject({
      success: false,
      reason: 'invalid_credentials',
    });
    // Свободный логин больше не означает «регистрация первым входом».
    expect(fs.existsSync(path.join(dataDir, 'users'))).toBe(false);
  });

  it('«нет аккаунта» и «неверный пароль» неразличимы (SEC-9)', async () => {
    await loginAs('api-enum', 'test-pass-1234');

    const noAccount = await loginRoute(
      json({ username: 'nobody-here', password: 'test-pass-1234' }),
    );
    const wrongPassword = await loginRoute(
      json({ username: 'api-enum', password: 'wrong-pass-1234' }),
    );

    expect(noAccount.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    // Одинаковые статус, тело и заголовки: по ответу нельзя перечислять логины.
    expect(await noAccount.json()).toEqual(await wrongPassword.json());
    expect(noAccount.headers.get('set-cookie')).toBeNull();
    expect(wrongPassword.headers.get('set-cookie')).toBeNull();
  });

  it('возвращает 401 на неверный пароль', async () => {
    await loginAs('api-user', 'test-pass-1234');
    const res = await loginRoute(
      json({ username: 'api-user', password: 'nope' }),
    );

    expect(res.status).toBe(401);
    expect((await res.json()).success).toBe(false);
  });

  it('валидирует обязательные поля; длину пароля проверяет регистрация', async () => {
    const noPassword = await loginRoute(json({ username: 'x' }));
    expect(noPassword.status).toBe(400);

    const blankUsername = await loginRoute(
      json({ username: '   ', password: 'test-pass-1234' }),
    );
    expect(blankUsername.status).toBe(400);

    // Вход длину пароля не проверяет: короткий пароль — просто неверный,
    // а аккаунта с таким логином нет.
    const shortPassword = await loginRoute(
      json({ username: 'x', password: '123' }),
    );
    expect(shortPassword.status).toBe(401);

    // Политика (12 символов) действует при регистрации.
    const shortOnRegister = await registerRoute(
      json({
        username: 'short-register',
        password: '123',
        displayName: 'Short',
        recoveryPhrase: 'amber cobalt',
      }),
    );
    expect(shortOnRegister.status).toBe(400);
    expect((await shortOnRegister.json()).error).toContain('at least 12');
  });

  it('успешно входит в существующий аккаунт и не создаёт новый', async () => {
    const { uid } = await registerAs(
      'returning',
      'test-pass-1234',
      'Returning',
    );
    const { res, body } = await loginAs('returning', 'test-pass-1234');

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.isNewUser).toBe(false);
    expect(body.user.uid).toBe(uid);
  });

  it('после 10 неудачных попыток вход отвечает 429 с Retry-After', async () => {
    await registerAs('brute-target', TEST_PASSWORD, 'Brute');

    const statuses: number[] = [];
    let retryAfter: string | null = null;
    for (let attempt = 1; attempt <= 11; attempt += 1) {
      const res = await loginRoute(
        json({ username: 'brute-target', password: 'wrong-pass-1234' }),
      );
      statuses.push(res.status);
      if (attempt === 11) retryAfter = res.headers.get('retry-after');
    }

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(401));
    expect(statuses[10]).toBe(429);
    expect(Number(retryAfter)).toBeGreaterThan(0);

    // Пароль не подбирается: верный пароль тоже ждёт окончания окна.
    const correct = await loginRoute(
      json({ username: 'brute-target', password: TEST_PASSWORD }),
    );
    expect(correct.status).toBe(429);
  });

  it('возвращает 400 (а не падает) на битом JSON', async () => {
    const res = await loginRoute(
      new Request('http://localhost/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ broken',
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/logout (SEC-6)', () => {
  it('гасит сессию на сервере и стирает cookie', async () => {
    const { uid, cookie } = await loginAs('logout-user');

    const res = await logoutRoute(
      new Request('http://localhost/api/auth/logout', {
        method: 'POST',
        headers: { cookie },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toMatch(/dcs_session=;/);
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/);

    // Украденная копия cookie после logout больше не работает.
    const after = await charactersGet(
      req('http://localhost/api/characters', 'GET', { cookie }),
    );
    expect(after.status).toBe(401);

    const fresh = await loginAs('logout-user');
    expect(fresh.uid).toBe(uid);
  });
});

describe('PUT /api/auth/profile', () => {
  it('без сессии — 401', async () => {
    const res = await profileRoute(
      json({ newUsername: 'x', newDisplayName: 'X' }),
    );
    expect(res.status).toBe(401);
  });

  it('меняет логин, uid и каталог не меняются', async () => {
    const { uid, cookie } = await loginAs(
      'old-login',
      'test-pass-1234',
      'Name',
    );

    const res = await profileRoute(
      json(
        { newUsername: 'new-login', newDisplayName: 'New Name' },
        await sessionHeaders(uid),
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.uid).toBe(uid);

    expect(readJson(userPaths(dataDir, uid).userFile).username).toBe(
      'new-login',
    );
    expect(readJson(loginIndexPath(dataDir)).logins['new-login']).toBe(uid);

    // Старая cookie продолжает работать: uid не менялся.
    const stillValid = await loginRoute(
      json({ username: 'new-login', password: 'test-pass-1234' }),
    );
    expect(stillValid.status).toBe(200);
    const relogin = await stillValid.json();
    expect(relogin.user.uid).toBe(uid);
    expect(cookie).toContain('dcs_session=');
  });
});
