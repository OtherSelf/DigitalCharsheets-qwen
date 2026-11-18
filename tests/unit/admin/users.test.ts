/**
 * /api/admin/users: список, PATCH полей/пароля/роли/блокировки (сессии сразу
 * мертвы), DELETE с самозащитой и инвариантом «последний админ».
 */

import fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DELETE as adminUserDelete,
  PATCH as adminUserPatch,
} from '@/app/api/admin/users/[uid]/route';
import { GET as adminUsersGet } from '@/app/api/admin/users/route';
import { POST as loginRoute } from '@/app/api/auth/route';
import { GET as sessionRoute } from '@/app/api/auth/session/route';
import { GET as charactersGet } from '@/app/api/characters/route';
import { deleteUserByAdmin, updateUserByAdmin } from '@/lib/admin-users';
import { authenticateUser } from '@/lib/server-auth';
import {
  resetWriteSeqGuard,
  saveCharacterToServer,
} from '@/lib/server-storage';
import { resolveLogin } from '@/lib/user-index';
import { readStoredUser } from '@/lib/user-schema';

import {
  loginIndexPath,
  makeDhCharacter,
  makeDndCharacter,
  readJson,
  removeDir,
  sessionCookie,
  sessionHeaders,
  userPaths,
  useTempDataDir,
} from '@tests/support';
import {
  del,
  get,
  params,
  patch,
  seedAdmin,
  seedUser,
} from '@tests/support/admin-flows';
import { json } from '@tests/support/http';

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
  resetWriteSeqGuard();
});

afterEach(() => {
  removeDir(dataDir);
  resetWriteSeqGuard();
});

describe('GET /api/admin/users', () => {
  it('401 без сессии, 403 обычному пользователю', async () => {
    const anonymous = await adminUsersGet(
      get('http://localhost/api/admin/users'),
    );
    expect(anonymous.status).toBe(401);

    const user = seedUser();
    const forbidden = await adminUsersGet(
      get('http://localhost/api/admin/users', sessionHeaders(user.uid)),
    );
    expect(forbidden.status).toBe(403);
  });

  it('отдаёт пользователей, роли, блокировки и счётчики листов', async () => {
    const admin = seedAdmin();
    const user = seedUser();
    saveCharacterToServer(
      user.uid,
      makeDndCharacter({ userId: user.uid, id: 'dnd-1' }),
    );
    saveCharacterToServer(
      user.uid,
      makeDhCharacter({ userId: user.uid, id: 'dh-1' }),
    );

    const res = await adminUsersGet(
      get('http://localhost/api/admin/users', sessionHeaders(admin.uid)),
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.users).toHaveLength(2);
    expect(body.stats).toEqual({
      totalUsers: 2,
      admins: 1,
      blocked: 0,
      totalCharacters: 2,
    });

    const target = body.users.find(
      (entry: { uid: string }) => entry.uid === user.uid,
    );
    expect(target).toMatchObject({
      username: 'hero',
      role: 'user',
      isBlocked: false,
      characterCount: 2,
    });
    expect(target.lastLoginAt).toBeNull();
  });
});

describe('PATCH /api/admin/users/[uid] (SEC-6)', () => {
  it('смена пароля администратором гасит сессии пользователя', async () => {
    const admin = seedAdmin();
    const user = seedUser();

    // У пользователя есть живая сессия (телефон/браузер). Cookie берём один
    // раз: каждый вызов sessionHeaders заводит новую сессию.
    const userCookie = { cookie: sessionCookie(user.uid) };
    const before = await charactersGet(
      new Request('http://localhost/api/characters', {
        method: 'GET',
        headers: userCookie,
      }),
    );
    expect(before.status).toBe(200);

    const res = await adminUserPatch(
      patch({ password: 'admin-set-pass-1234' }, sessionHeaders(admin.uid)),
      params(user.uid),
    );
    expect(res.status).toBe(200);

    // Старый пароль не действует — и сессии тоже (иначе старый вход жил бы).
    const after = await charactersGet(
      new Request('http://localhost/api/characters', {
        method: 'GET',
        headers: userCookie,
      }),
    );
    expect(after.status).toBe(401);
    expect(authenticateUser('hero', 'admin-set-pass-1234').success).toBe(true);
    expect(authenticateUser('hero', 'user-pass-1234').success).toBe(false);
  });
});

describe('PATCH /api/admin/users/[uid]', () => {
  it('меняет поля, логин и пароль; сессия админа не затрагивается', async () => {
    const admin = seedAdmin();
    const user = seedUser();
    saveCharacterToServer(
      user.uid,
      makeDndCharacter({ userId: user.uid, id: 'dnd-1' }),
    );

    const res = await adminUserPatch(
      patch(
        {
          displayName: '  Renamed Hero  ',
          username: '  Renamed.Login ',
          password: 'new-pass-1234',
          role: 'admin',
        },
        sessionHeaders(admin.uid),
      ),
      params(user.uid),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toMatchObject({
      displayName: 'Renamed Hero',
      username: 'renamed.login',
      role: 'admin',
      characterCount: 1,
    });

    expect(resolveLogin('renamed.login')).toBe(user.uid);
    expect(resolveLogin('hero')).toBeNull();

    const stored = readStoredUser(user.uid)!;
    expect(stored.displayName).toBe('Renamed Hero');
    expect(stored.role).toBe('admin');
    expect(stored.mustChangePassword).toBeUndefined();

    // Новый пароль работает, старый — нет.
    expect(authenticateUser('renamed.login', 'new-pass-1234').success).toBe(
      true,
    );
    expect(authenticateUser('renamed.login', 'user-pass-1234').success).toBe(
      false,
    );
  });

  it('не отдаёт занятый логин (409) и не ломает индекс', async () => {
    const admin = seedAdmin();
    const first = seedUser('first');
    seedUser('second');

    const res = await adminUserPatch(
      patch({ username: 'second' }, sessionHeaders(admin.uid)),
      params(first.uid),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).reason).toBe('username_taken');
    expect(resolveLogin('first')).toBe(first.uid);
  });

  it('блокирует: вход 403, старые cookie и сессия перестают работать', async () => {
    const admin = seedAdmin();
    const user = seedUser();

    const blocked = await adminUserPatch(
      patch({ isBlocked: true }, sessionHeaders(admin.uid)),
      params(user.uid),
    );
    expect(blocked.status).toBe(200);

    const login = await loginRoute(
      json({ username: user.username, password: user.password }),
    );
    expect(login.status).toBe(403);
    const loginBody = await login.json();
    expect(loginBody.reason).toBe('blocked');

    const chars = await charactersGet(
      get('http://localhost/api/characters', sessionHeaders(user.uid)),
    );
    expect(chars.status).toBe(401);

    const session = await sessionRoute(
      get('http://localhost/api/auth/session', sessionHeaders(user.uid)),
    );
    expect(session.status).toBe(401);

    // Разблокировка возвращает доступ.
    const unblocked = await adminUserPatch(
      patch({ isBlocked: false }, sessionHeaders(admin.uid)),
      params(user.uid),
    );
    expect(unblocked.status).toBe(200);
    const charsAgain = await charactersGet(
      get('http://localhost/api/characters', sessionHeaders(user.uid)),
    );
    expect(charsAgain.status).toBe(200);
  });

  it('защищает от действий над собой', async () => {
    const admin = seedAdmin();

    const selfRole = await adminUserPatch(
      patch({ role: 'user' }, sessionHeaders(admin.uid)),
      params(admin.uid),
    );
    expect(selfRole.status).toBe(400);
    expect((await selfRole.json()).reason).toBe('self');

    const selfBlock = await adminUserPatch(
      patch({ isBlocked: true }, sessionHeaders(admin.uid)),
      params(admin.uid),
    );
    expect(selfBlock.status).toBe(400);
    expect((await selfBlock.json()).reason).toBe('self');
  });

  it('нельзя разжаловать/заблокировать последнего админа (защита в слое)', () => {
    const admin = seedAdmin();
    const fakeActor = '00000000-0000-4000-8000-000000000000';

    expect(
      updateUserByAdmin(fakeActor, admin.uid, { role: 'user' }).reason,
    ).toBe('last_admin');
    expect(
      updateUserByAdmin(fakeActor, admin.uid, { isBlocked: true }).reason,
    ).toBe('last_admin');
  });

  it('валидирует поля и существование пользователя', async () => {
    const admin = seedAdmin();

    const missing = await adminUserPatch(
      patch({ displayName: '   ' }, sessionHeaders(admin.uid)),
      params('00000000-0000-4000-8000-000000000001'),
    );
    expect(missing.status).toBe(404);

    const user = seedUser();
    const shortPassword = await adminUserPatch(
      patch({ password: '123' }, sessionHeaders(admin.uid)),
      params(user.uid),
    );
    expect(shortPassword.status).toBe(400);
    expect((await shortPassword.json()).reason).toBe('invalid_input');

    const emptyPatch = await adminUserPatch(
      patch({}, sessionHeaders(admin.uid)),
      params(user.uid),
    );
    expect(emptyPatch.status).toBe(400);

    const badRole = await adminUserPatch(
      patch({ role: 'root' }, sessionHeaders(admin.uid)),
      params(user.uid),
    );
    expect(badRole.status).toBe(400);
  });
});

describe('DELETE /api/admin/users/[uid]', () => {
  it('удаляет чужой аккаунт, индекс и каталог с листами', async () => {
    const admin = seedAdmin();
    const user = seedUser();
    saveCharacterToServer(
      user.uid,
      makeDndCharacter({ userId: user.uid, id: 'dnd-1' }),
    );

    const res = await adminUserDelete(
      del(
        `http://localhost/api/admin/users/${user.uid}`,
        sessionHeaders(admin.uid),
      ),
      params(user.uid),
    );
    expect(res.status).toBe(200);

    expect(fs.existsSync(userPaths(dataDir, user.uid).userDir)).toBe(false);
    expect(resolveLogin(user.username)).toBeNull();
    expect(readJson(loginIndexPath(dataDir)).logins[user.username]).toBe(
      undefined,
    );
  });

  it('не удаляет себя и несуществующего', async () => {
    const admin = seedAdmin();

    const self = await adminUserDelete(
      del(
        `http://localhost/api/admin/users/${admin.uid}`,
        sessionHeaders(admin.uid),
      ),
      params(admin.uid),
    );
    expect(self.status).toBe(400);
    expect((await self.json()).reason).toBe('self');

    const missing = await adminUserDelete(
      del(
        'http://localhost/api/admin/users/00000000-0000-4000-8000-000000000002',
        sessionHeaders(admin.uid),
      ),
      params('00000000-0000-4000-8000-000000000002'),
    );
    expect(missing.status).toBe(404);
  });

  it('нельзя удалить последнего админа (защита в слое)', () => {
    const admin = seedAdmin();
    const fakeActor = '00000000-0000-4000-8000-000000000003';
    expect(deleteUserByAdmin(fakeActor, admin.uid).reason).toBe('last_admin');
  });
});
