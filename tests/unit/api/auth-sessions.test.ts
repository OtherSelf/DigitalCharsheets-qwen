/**
 * Сессии: смена пароля и восстановление гасят чужие сессии, logout {all:true}
 * гасит все устройства, DELETE профиля удаляет каталог и индекс.
 */

import fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as logoutRoute } from '@/app/api/auth/logout/route';
import {
  DELETE as profileDelete,
  PUT as profileRoute,
} from '@/app/api/auth/profile/route';
import { POST as recoverUpdateRoute } from '@/app/api/auth/recover/update/route';
import { POST as recoverVerifyRoute } from '@/app/api/auth/recover/verify/route';
import { POST as loginRoute } from '@/app/api/auth/route';
import {
  GET as charactersGet,
  POST as charactersPost,
} from '@/app/api/characters/route';
import { isUid } from '@/lib/ids';
import { resetAuthRateLimits } from '@/lib/security/rate-limit';
import { authenticateUser } from '@/lib/server-auth';
import { resetWriteSeqGuard } from '@/lib/server-storage';

import {
  loginIndexPath,
  makeCharacter,
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

describe('сессии: отзыв и повторная аутентификация (SEC-6)', () => {
  it('смена пароля рвёт чужие сессии и требует текущий пароль', async () => {
    const { cookie } = await loginAs('session-rotate');

    // «Второе устройство»: отдельный вход — отдельный jti.
    const secondLogin = await loginRoute(
      json({ username: 'session-rotate', password: TEST_PASSWORD }),
    );
    const secondCookie = (secondLogin.headers.get('set-cookie') || '').split(
      ';',
    )[0];
    expect(secondCookie).toBeTruthy();

    // Без текущего пароля смена не проходит.
    const noCurrent = await profileRoute(
      json(
        {
          newUsername: 'session-rotate',
          newDisplayName: 'Rotate',
          newPassword: 'rotated-pass-1234',
        },
        { cookie },
      ),
    );
    expect(noCurrent.status).toBe(403);
    expect((await noCurrent.json()).reason).toBe('invalid_password');

    // Неверный текущий пароль — тоже 403.
    const wrongCurrent = await profileRoute(
      json(
        {
          newUsername: 'session-rotate',
          newDisplayName: 'Rotate',
          newPassword: 'rotated-pass-1234',
          currentPassword: 'not-my-pass-1234',
        },
        { cookie },
      ),
    );
    expect(wrongCurrent.status).toBe(403);
    expect(
      (await authenticateUser('session-rotate', TEST_PASSWORD)).success,
    ).toBe(true);

    // Верный текущий пароль — смена проходит.
    const rotated = await profileRoute(
      json(
        {
          newUsername: 'session-rotate',
          newDisplayName: 'Rotate',
          newPassword: 'rotated-pass-1234',
          currentPassword: TEST_PASSWORD,
        },
        { cookie },
      ),
    );
    expect(rotated.status).toBe(200);
    expect(
      (await authenticateUser('session-rotate', 'rotated-pass-1234')).success,
    ).toBe(true);

    // Текущая сессия жива, второе устройство — нет.
    const current = await charactersGet(
      req('http://localhost/api/characters', 'GET', { cookie }),
    );
    expect(current.status).toBe(200);
    const other = await charactersGet(
      req('http://localhost/api/characters', 'GET', { cookie: secondCookie }),
    );
    expect(other.status).toBe(401);
  });

  it('logout {all:true} гасит сессии всех устройств', async () => {
    const { uid, cookie } = await loginAs('logout-all');

    const secondLogin = await loginRoute(
      json({ username: 'logout-all', password: TEST_PASSWORD }),
    );
    const secondCookie = (secondLogin.headers.get('set-cookie') || '').split(
      ';',
    )[0];

    const res = await logoutRoute(json({ all: true }, { cookie }));
    expect(res.status).toBe(200);

    for (const stale of [cookie, secondCookie]) {
      const check = await charactersGet(
        req('http://localhost/api/characters', 'GET', { cookie: stale }),
      );
      expect(check.status).toBe(401);
    }

    // Новый вход по-прежнему возможен.
    const again = await loginAs('logout-all');
    expect(again.uid).toBe(uid);
  });

  it('восстановление доступа гасит все сессии аккаунта', async () => {
    const { uid, cookie } = await loginAs('recover-revoke');
    expect(
      (
        await charactersGet(
          req('http://localhost/api/characters', 'GET', { cookie }),
        )
      ).status,
    ).toBe(200);

    const { token } = await (
      await recoverVerifyRoute(
        json({
          username: 'recover-revoke',
          recoveryPhrase: 'amber cobalt lantern silver ember frost',
        }),
      )
    ).json();
    const reset = await recoverUpdateRoute(
      json({ token, newPassword: 'brand-new-pass-1234' }),
    );
    expect(reset.status).toBe(200);

    // Старая cookie не должна пережить смену пароля.
    const stale = await charactersGet(
      req('http://localhost/api/characters', 'GET', { cookie }),
    );
    expect(stale.status).toBe(401);
    expect(uid).toBeTruthy();
  });
});

describe('DELETE /api/auth/profile', () => {
  const deleteReq = (password: unknown, headers: Record<string, string> = {}) =>
    new Request('http://localhost/api/auth/profile', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ password }),
    });

  it('без сессии — 401 и ничего не удаляет', async () => {
    const res = await profileDelete(deleteReq('test-pass-1234'));
    expect(res.status).toBe(401);
    expect((await res.json()).reason).toBe('unauthorized');
  });

  it('без пароля — 400, аккаунт остаётся на месте', async () => {
    const { uid } = await loginAs('delete-no-pass');

    const res = await profileDelete(deleteReq('', await sessionHeaders(uid)));

    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe('invalid_input');
    expect(fs.existsSync(userPaths(dataDir, uid).userFile)).toBe(true);
  });

  it('неверный пароль — 403, аккаунт и листы целы', async () => {
    const { uid } = await loginAs('delete-wrong-pass');
    await charactersPost(
      json({ ...makeCharacter('dnd5e') }, await sessionHeaders(uid)),
    );

    const res = await profileDelete(
      deleteReq('not-my-password', await sessionHeaders(uid)),
    );

    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe('invalid_password');
    expect(fs.existsSync(userPaths(dataDir, uid).userFile)).toBe(true);
    expect(fs.readdirSync(userPaths(dataDir, uid).charactersDir)).toHaveLength(
      1,
    );
  });

  it('верный пароль — 200, каталог и индекс удалены, cookie стёрта', async () => {
    const { uid } = await loginAs('delete-me');
    await charactersPost(
      json({ ...makeCharacter('dnd5e') }, await sessionHeaders(uid)),
    );

    const res = await profileDelete(
      deleteReq('test-pass-1234', await sessionHeaders(uid)),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
    expect(res.headers.get('set-cookie')).toMatch(/dcs_session=;/);
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/);

    expect(fs.existsSync(userPaths(dataDir, uid).userDir)).toBe(false);
    expect(
      readJson(loginIndexPath(dataDir)).logins['delete-me'],
    ).toBeUndefined();

    // Вход по старому паролю больше не находит аккаунт (и не подсказывает,
    // что его нет: 401 неотличим от неверного пароля).
    const relogin = await loginRoute(
      json({ username: 'delete-me', password: 'test-pass-1234' }),
    );
    expect(relogin.status).toBe(401);
    expect((await relogin.json()).reason).toBe('invalid_credentials');
  });

  it('старая cookie после удаления не работает и не воссоздаёт каталог', async () => {
    const { uid } = await loginAs('stale-cookie');
    expect(
      (
        await profileDelete(
          deleteReq('test-pass-1234', await sessionHeaders(uid)),
        )
      ).status,
    ).toBe(200);

    // Подпись cookie ещё валидна, но записи сессии и профиля уже нет — 401.
    const res = await charactersGet(
      req('http://localhost/api/characters', 'GET', await sessionHeaders(uid)),
    );
    expect(res.status).toBe(401);
    // Доступ «по старой сессии» не должен воскресить users/<uid>/characters.
    expect(fs.existsSync(userPaths(dataDir, uid).userDir)).toBe(false);
  });

  it('освобождённый логин можно зарегистрировать заново с новым uid', async () => {
    const { uid: oldUid } = await loginAs('reborn-account');
    await profileDelete(
      deleteReq('test-pass-1234', await sessionHeaders(oldUid)),
    );

    const again = await registerAs(
      'reborn-account',
      'fresh-pass-1234',
      'Reborn',
    );

    expect(again.res.status).toBe(200);
    expect(isUid(again.uid)).toBe(true);
    expect(again.uid).not.toBe(oldUid);
  });
});
