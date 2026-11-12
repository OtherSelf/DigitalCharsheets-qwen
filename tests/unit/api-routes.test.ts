import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as existsRoute } from '@/app/api/auth/exists/route';
import { POST as logoutRoute } from '@/app/api/auth/logout/route';
import { POST as phraseRoute } from '@/app/api/auth/phrase/route';
import {
  DELETE as profileDelete,
  PUT as profileRoute,
} from '@/app/api/auth/profile/route';
import { POST as recoverRoute } from '@/app/api/auth/recover/route';
import { POST as recoverUpdateRoute } from '@/app/api/auth/recover/update/route';
import { POST as recoverVerifyRoute } from '@/app/api/auth/recover/verify/route';
import { POST as registerRoute } from '@/app/api/auth/register/route';
import { POST as loginRoute } from '@/app/api/auth/route';
import {
  DELETE as characterDelete,
  PUT as characterPut,
} from '@/app/api/characters/[id]/route';
import {
  GET as charactersGet,
  POST as charactersPost,
} from '@/app/api/characters/route';
import { GET as exportGet } from '@/app/api/export/route';
import { GET as importGet } from '@/app/api/import/route';
import { isUid } from '@/lib/ids';
import {
  isRecoveryPhraseHash,
  recoveryPhraseMatches,
} from '@/lib/security/phrase';
import { resetAuthRateLimits } from '@/lib/security/rate-limit';
import { authenticateUser, setRecoveryPhrase } from '@/lib/server-auth';
import { resetWriteSeqGuard } from '@/lib/server-storage';

import {
  loginIndexPath,
  makeDhCharacter,
  makeDndCharacter,
  readJson,
  removeDir,
  sessionHeaders,
  userPaths,
  useTempDataDir,
} from './helpers';

/**
 * API-роуты Next: POST/GET/PUT/DELETE вызываются как обычные функции с объектом
 * Request — HTTP-сервер не поднимается, сеть не нужна.
 *
 * Покрыто: /api/auth (200/401/400, битый JSON → 500, Set-Cookie), /api/auth/logout,
 * /api/auth/profile (uid из сессии), /api/characters (CRUD, 401 без сессии,
 * 404 на неизвестный id, отбрасывание запоздавшего PUT, __page/__seq не попадают
 * в файл), /api/export, recovery-роуты, легаси /api/import.
 *
 * Сессия: uid больше не приходит в query/body. Запросы авторизуются заголовком
 * `cookie: dcs_session=…` (см. sessionHeaders в helpers).
 */

const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const req = (
  url: string,
  method = 'GET',
  headers: Record<string, string> = {},
) => new Request(url, { method, headers });

const params = (id: string) => ({ params: Promise.resolve({ id }) });

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

/** Войти через /api/auth и вернуть uid, cookie и тело ответа. */
async function loginAs(
  username: string,
  password = '1234',
  displayName?: string,
) {
  // Большинству тестов нужен существующий аккаунт: регистрация теперь
  // отдельным роутом, а /api/auth — только вход.
  const registered = await registerAs(username, password, displayName);
  expect([200, 409]).toContain(registered.res.status);

  const res = await loginRoute(json({ username, password }));
  const body = await res.json();
  const setCookie = res.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0];
  return { res, body, uid: body?.user?.uid as string, cookie };
}

/** Зарегистрировать аккаунт через /api/auth/register. */
async function registerAs(
  username: string,
  password = '1234',
  displayName?: string,
  recoveryPhrase = 'amber cobalt lantern',
) {
  const res = await registerRoute(
    json({ username, password, displayName, recoveryPhrase }),
  );
  const body = await res.json();
  const setCookie = res.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0];
  return { res, body, uid: body?.user?.uid as string, cookie };
}

describe('POST /api/auth/register', () => {
  it('создаёт аккаунт с uid, recovery-фразой и сессией', async () => {
    const { res, body, uid, cookie } = await registerAs(
      'api-user',
      '1234',
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
      recoveryPhraseMatches(stored.recoveryPhrase, 'amber cobalt lantern'),
    ).toBe(true);
    expect(readJson(loginIndexPath(dataDir)).logins['api-user']).toBe(uid);
  });

  it('возвращает 409 на занятый логин и не меняет чужой профиль', async () => {
    const first = await registerAs('occupied', '1234', 'First');
    const second = await registerAs(
      'occupied',
      '5678',
      'Second',
      'zulu yankee',
    );

    expect(second.res.status).toBe(409);
    expect(second.body).toMatchObject({ success: false, reason: 'exists' });
    expect(readJson(userPaths(dataDir, first.uid).userFile).displayName).toBe(
      'First',
    );
    expect(
      recoveryPhraseMatches(
        readJson(userPaths(dataDir, first.uid).userFile).recoveryPhrase,
        'amber cobalt lantern',
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
    expect((await shortPassword.json()).error).toContain('at least 4');

    const shortPhrase = await registerRoute(
      json({ username: 'x', password: '1234', recoveryPhrase: 'ab' }),
    );
    expect(shortPhrase.status).toBe(400);
    expect((await shortPhrase.json()).error).toContain('Recovery phrase');
  });

  it('возвращает 500 (а не падает) на битом JSON', async () => {
    const res = await registerRoute(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ broken',
      }),
    );
    expect(res.status).toBe(500);
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
  });

  it('400 без логина и 500 на битом JSON', async () => {
    const empty = await existsRoute(json({ username: '   ' }));
    expect(empty.status).toBe(400);

    const broken = await existsRoute(
      new Request('http://localhost/api/auth/exists', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ broken',
      }),
    );
    expect(broken.status).toBe(500);
  });
});

describe('POST /api/auth', () => {
  it('не создаёт аккаунт для неизвестного логина — 404', async () => {
    const res = await loginRoute(
      json({ username: 'unknown', password: '1234' }),
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      success: false,
      reason: 'no_account',
    });
    // Свободный логин больше не означает «регистрация первым входом».
    expect(fs.existsSync(path.join(dataDir, 'users'))).toBe(false);
  });

  it('возвращает 401 на неверный пароль', async () => {
    await loginAs('api-user', '1234');
    const res = await loginRoute(
      json({ username: 'api-user', password: 'nope' }),
    );

    expect(res.status).toBe(401);
    expect((await res.json()).success).toBe(false);
  });

  it('валидирует обязательные поля и длину пароля', async () => {
    const noPassword = await loginRoute(json({ username: 'x' }));
    expect(noPassword.status).toBe(400);

    const blankUsername = await loginRoute(
      json({ username: '   ', password: '1234' }),
    );
    expect(blankUsername.status).toBe(400);

    const shortPassword = await loginRoute(
      json({ username: 'x', password: '123' }),
    );
    expect(shortPassword.status).toBe(400);
    expect((await shortPassword.json()).error).toContain('at least 4');
  });

  it('успешно входит в существующий аккаунт и не создаёт новый', async () => {
    const { uid } = await registerAs('returning', '1234', 'Returning');
    const { res, body } = await loginAs('returning', '1234');

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.isNewUser).toBe(false);
    expect(body.user.uid).toBe(uid);
  });

  it('возвращает 500 (а не падает) на битом JSON', async () => {
    const res = await loginRoute(
      new Request('http://localhost/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ broken',
      }),
    );
    expect(res.status).toBe(500);
  });
});

describe('POST /api/auth/logout', () => {
  it('стирает сессионную cookie', async () => {
    const res = await logoutRoute();
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toMatch(/dcs_session=;/);
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/);
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
    const { uid, cookie } = await loginAs('old-login', '1234', 'Name');

    const res = await profileRoute(
      json(
        { newUsername: 'new-login', newDisplayName: 'New Name' },
        sessionHeaders(uid),
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
      json({ username: 'new-login', password: '1234' }),
    );
    expect(stillValid.status).toBe(200);
    const relogin = await stillValid.json();
    expect(relogin.user.uid).toBe(uid);
    expect(cookie).toContain('dcs_session=');
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
    const res = await profileDelete(deleteReq('1234'));
    expect(res.status).toBe(401);
    expect((await res.json()).reason).toBe('unauthorized');
  });

  it('без пароля — 400, аккаунт остаётся на месте', async () => {
    const { uid } = await loginAs('delete-no-pass');

    const res = await profileDelete(deleteReq('', sessionHeaders(uid)));

    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe('invalid_input');
    expect(fs.existsSync(userPaths(dataDir, uid).userFile)).toBe(true);
  });

  it('неверный пароль — 403, аккаунт и листы целы', async () => {
    const { uid } = await loginAs('delete-wrong-pass');
    await charactersPost(json({ ...makeDndCharacter() }, sessionHeaders(uid)));

    const res = await profileDelete(
      deleteReq('not-my-password', sessionHeaders(uid)),
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
    await charactersPost(json({ ...makeDndCharacter() }, sessionHeaders(uid)));

    const res = await profileDelete(deleteReq('1234', sessionHeaders(uid)));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
    expect(res.headers.get('set-cookie')).toMatch(/dcs_session=;/);
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/);

    expect(fs.existsSync(userPaths(dataDir, uid).userDir)).toBe(false);
    expect(
      readJson(loginIndexPath(dataDir)).logins['delete-me'],
    ).toBeUndefined();

    // Вход по старому паролю больше не находит аккаунт.
    const relogin = await loginRoute(
      json({ username: 'delete-me', password: '1234' }),
    );
    expect(relogin.status).toBe(404);
  });

  it('старая cookie после удаления не работает и не воссоздаёт каталог', async () => {
    const { uid } = await loginAs('stale-cookie');
    expect(
      (await profileDelete(deleteReq('1234', sessionHeaders(uid)))).status,
    ).toBe(200);

    // Подпись cookie ещё валидна (30 дней), но профиля уже нет — 401.
    const res = await charactersGet(
      req('http://localhost/api/characters', 'GET', sessionHeaders(uid)),
    );
    expect(res.status).toBe(401);
    // Доступ «по старой сессии» не должен воскресить users/<uid>/characters.
    expect(fs.existsSync(userPaths(dataDir, uid).userDir)).toBe(false);
  });

  it('освобождённый логин можно зарегистрировать заново с новым uid', async () => {
    const { uid: oldUid } = await loginAs('reborn-account');
    await profileDelete(deleteReq('1234', sessionHeaders(oldUid)));

    const again = await registerAs('reborn-account', 'fresh-pass', 'Reborn');

    expect(again.res.status).toBe(200);
    expect(isUid(again.uid)).toBe(true);
    expect(again.uid).not.toBe(oldUid);
  });
});

describe('/api/characters', () => {
  it('GET без сессии — 401', async () => {
    const res = await charactersGet(req('http://localhost/api/characters'));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toContain('Unauthorized');
  });

  it('POST без сессии — 401 и ничего не пишет', async () => {
    const res = await charactersPost(json(makeDndCharacter()));
    expect(res.status).toBe(401);
    expect(fs.existsSync(path.join(dataDir, 'users'))).toBe(false);
  });

  it('POST создаёт персонажа (201) и GET его возвращает', async () => {
    const { uid } = await loginAs('user-api');
    const payload = { ...makeDndCharacter(), userId: 'чужой-uid' };
    delete (payload as any).id;

    const res = await charactersPost(json(payload, sessionHeaders(uid)));
    expect(res.status).toBe(201);
    const character = await res.json();
    expect(character.id).toBeTruthy();
    // userId из тела игнорируется — владелец берётся из сессии.
    expect(character.userId).toBe(uid);

    const list = await charactersGet(
      req('http://localhost/api/characters', 'GET', sessionHeaders(uid)),
    );
    expect(list.status).toBe(200);
    const characters = await list.json();
    expect(characters.map((c: any) => c.id)).toContain(character.id);
  });

  it('PUT обновляет персонажа, неизвестный id даёт 404', async () => {
    const { uid } = await loginAs('user-api');
    const created = await (
      await charactersPost(json({ ...makeDhCharacter() }, sessionHeaders(uid)))
    ).json();

    const updated = await characterPut(
      json({ name: 'Updated Vex' }, sessionHeaders(uid)),
      params(created.id),
    );
    expect(updated.status).toBe(200);
    expect((await updated.json()).name).toBe('Updated Vex');

    const missing = await characterPut(
      json({ name: 'X' }, sessionHeaders(uid)),
      params('nope'),
    );
    expect(missing.status).toBe(404);
  });

  it('PUT без сессии — 401', async () => {
    const { uid } = await loginAs('user-api');
    const created = await (
      await charactersPost(json({ ...makeDhCharacter() }, sessionHeaders(uid)))
    ).json();

    const res = await characterPut(json({ name: 'X' }), params(created.id));
    expect(res.status).toBe(401);
  });

  // ─── порядок правок: __page/__seq ────────────────────────────────────────
  it('PUT отбрасывает запоздавшую правку (не перетирает свежий опыт)', async () => {
    const { uid } = await loginAs('user-api');
    const created = await (
      await charactersPost(
        json({ ...makeDhCharacter({ experience: 0 }) }, sessionHeaders(uid)),
      )
    ).json();

    const fresh = await characterPut(
      json(
        { experience: 500, __page: 'page-x', __seq: 2 },
        sessionHeaders(uid),
      ),
      params(created.id),
    );
    expect(fresh.status).toBe(200);

    // Такой же запрос, но «старый» (он мог подвиснуть в сети/уехать с keepalive).
    const stale = await characterPut(
      json(
        { experience: 100, __page: 'page-x', __seq: 1 },
        sessionHeaders(uid),
      ),
      params(created.id),
    );
    expect(stale.status).toBe(200);

    const list = await (
      await charactersGet(
        req('http://localhost/api/characters', 'GET', sessionHeaders(uid)),
      )
    ).json();
    expect(list.find((c: any) => c.id === created.id).experience).toBe(500);
  });

  it('служебные __page/__seq/userId не попадают в файл листа', async () => {
    const { uid } = await loginAs('user-api');
    const created = await (
      await charactersPost(json({ ...makeDhCharacter() }, sessionHeaders(uid)))
    ).json();

    await characterPut(
      json(
        { experience: 7, __page: 'page-y', __seq: 3, userId: 'чужой-uid' },
        sessionHeaders(uid),
      ),
      params(created.id),
    );

    const list = await (
      await charactersGet(
        req('http://localhost/api/characters', 'GET', sessionHeaders(uid)),
      )
    ).json();
    const saved = list.find((c: any) => c.id === created.id);
    expect(saved.experience).toBe(7);
    expect(saved.__page).toBeUndefined();
    expect(saved.__seq).toBeUndefined();
    expect(saved.userId).toBe(uid);
  });

  it('PUT с пустым/битым телом — 400, а не 500 (keepalive при уходе со страницы)', async () => {
    const { uid } = await loginAs('user-api');
    const created = await (
      await charactersPost(json({ ...makeDhCharacter() }, sessionHeaders(uid)))
    ).json();

    const empty = await characterPut(
      new Request('http://localhost/api/test', {
        method: 'PUT',
        headers: sessionHeaders(uid),
      }),
      params(created.id),
    );
    expect(empty.status).toBe(400);

    const broken = await characterPut(
      new Request('http://localhost/api/test', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', ...sessionHeaders(uid) },
        body: '{ broken',
      }),
      params(created.id),
    );
    expect(broken.status).toBe(400);
  });

  it('DELETE удаляет персонажа, повторный вызов — 404', async () => {
    const { uid } = await loginAs('user-api');
    const created = await (
      await charactersPost(json({ ...makeDhCharacter() }, sessionHeaders(uid)))
    ).json();
    const url = `http://localhost/api/characters/${created.id}`;

    const first = await characterDelete(
      req(url, 'DELETE', sessionHeaders(uid)),
      params(created.id),
    );
    expect(first.status).toBe(200);

    const second = await characterDelete(
      req(url, 'DELETE', sessionHeaders(uid)),
      params(created.id),
    );
    expect(second.status).toBe(404);

    const noSession = await characterDelete(
      req(url, 'DELETE'),
      params(created.id),
    );
    expect(noSession.status).toBe(401);
  });
});

/**
 * SEC-3 / SEC-3b: `id` листа — внешнее значение, из которого строился путь
 * файла. `..%2Fuser` давал собственный `user.json`, `..%2F..%2F<uid>%2Fuser` —
 * чужой, то есть подмену `passwordHash` и захват аккаунта.
 *
 * Next декодирует сегмент URL, поэтому обработчик получает уже `../user` —
 * именно такие значения и передаём в `params`.
 */
describe('path traversal в /api/characters/[id] (SEC-3, SEC-3b)', () => {
  async function accountWithSheet(username: string) {
    const { uid } = await registerAs(username, '1234', username);
    const created = await charactersPost(
      json(
        { ...makeDndCharacter({ name: `${username} sheet` }) },
        sessionHeaders(uid),
      ),
    );
    const sheet = await created.json();
    return { uid, sheetId: sheet.id as string };
  }

  const profileOf = (uid: string) => readJson(userPaths(dataDir, uid).userFile);

  it('PUT по «../user» не перезаписывает свой профиль — 400', async () => {
    const { uid, sheetId } = await accountWithSheet('traversal-self');
    const before = profileOf(uid);

    const res = await characterPut(
      json({ passwordHash: 'pwned', name: 'hijacked' }, sessionHeaders(uid)),
      params('../user'),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe('invalid_id');
    expect(profileOf(uid)).toEqual(before);
    // Ни одной записи не произошло: в каталоге только созданный лист.
    expect(fs.readdirSync(userPaths(dataDir, uid).charactersDir)).toEqual([
      `${sheetId}.json`,
    ]);
  });

  it('PUT по «../../<uid>/user» не меняет чужой профиль — 400', async () => {
    const victim = await accountWithSheet('traversal-victim');
    const attacker = await registerAs('traversal-attacker', '1234', 'A');
    const before = profileOf(victim.uid);

    const res = await characterPut(
      json({ passwordHash: 'pwned' }, sessionHeaders(attacker.uid)),
      params(`../${victim.uid}/user`),
    );

    expect(res.status).toBe(400);
    expect(profileOf(victim.uid)).toEqual(before);
    // Вход под жертвой старым паролем всё ещё работает.
    expect(authenticateUser('traversal-victim', '1234').success).toBe(true);
  });

  it('DELETE по «../../<uid>/user» не удаляет чужой профиль — 400', async () => {
    const victim = await accountWithSheet('del-victim');
    const attacker = await registerAs('del-attacker', '1234', 'A');

    const res = await characterDelete(
      req(
        'http://localhost/api/characters/x',
        'DELETE',
        sessionHeaders(attacker.uid),
      ),
      params(`../${victim.uid}/user`),
    );

    expect(res.status).toBe(400);
    expect(fs.existsSync(userPaths(dataDir, victim.uid).userFile)).toBe(true);
  });

  it('кодированные, абсолютные и «слэш»-варианты id → 400', async () => {
    const { uid } = await accountWithSheet('traversal-variants');

    for (const id of [
      '..%2Fuser',
      '%2e%2e%2fuser',
      '/etc/passwd',
      'a/b',
      '..\\user',
      '..',
      '',
    ]) {
      const put = await characterPut(
        json({ passwordHash: 'pwned' }, sessionHeaders(uid)),
        params(id),
      );
      expect({ id, status: put.status }).toEqual({ id, status: 400 });

      const del = await characterDelete(
        req('http://localhost/api/characters/x', 'DELETE', sessionHeaders(uid)),
        params(id),
      );
      expect({ id, status: del.status }).toEqual({ id, status: 400 });
    }

    // Ничего не создано и не удалено: профиль и каталог листов на месте.
    expect(fs.existsSync(userPaths(dataDir, uid).userFile)).toBe(true);
    expect(fs.existsSync(userPaths(dataDir, uid).charactersDir)).toBe(true);
  });

  it('не создаёт файлов и каталогов вне дерева данных', async () => {
    const { uid } = await accountWithSheet('traversal-outside');
    const usersBefore = fs.readdirSync(path.join(dataDir, 'users')).sort();

    const res = await characterPut(
      json({ passwordHash: 'pwned' }, sessionHeaders(uid)),
      params('../../escaped/characters/pwned'),
    );
    expect(res.status).toBe(400);

    // Каталог data/escaped не появился: traversal не дошёл до mkdir/write.
    expect(fs.existsSync(path.join(dataDir, 'escaped'))).toBe(false);
    expect(fs.readdirSync(path.join(dataDir, 'users')).sort()).toEqual(
      usersBefore,
    );
  });
});

describe('/api/export', () => {
  it('без сессии — 401', async () => {
    const res = await exportGet(req('http://localhost/api/export'));
    expect(res.status).toBe(401);
  });

  it('отдаёт список и одного персонажа, 404 на неизвестный id', async () => {
    const { uid } = await loginAs('user-exp');
    const created = await (
      await charactersPost(json({ ...makeDndCharacter() }, sessionHeaders(uid)))
    ).json();

    const list = await exportGet(
      req('http://localhost/api/export', 'GET', sessionHeaders(uid)),
    );
    expect(list.status).toBe(200);
    expect(Array.isArray(await list.json())).toBe(true);

    const single = await exportGet(
      req(
        `http://localhost/api/export?characterId=${created.id}`,
        'GET',
        sessionHeaders(uid),
      ),
    );
    expect(single.status).toBe(200);
    expect((await single.json()).name).toBe(created.name);

    const missing = await exportGet(
      req(
        'http://localhost/api/export?characterId=nope',
        'GET',
        sessionHeaders(uid),
      ),
    );
    expect(missing.status).toBe(404);
  });

  it('не отдаёт служебные поля (migrated*, userId, Document ID), но сохраняет данные', async () => {
    const { uid } = await loginAs('user-exp');
    const created = await (
      await charactersPost(json({ ...makeDndCharacter() }, sessionHeaders(uid)))
    ).json();

    // Имитируем лист, пришедший из миграции: дописываем провенанс прямо в файл.
    const file = path.join(
      userPaths(dataDir, uid).charactersDir,
      `${created.id}.json`,
    );
    const raw = readJson(file);
    raw.migratedFrom = 'firestore';
    raw.migratedAt = '2026-11-08T19:42:47Z';
    raw.migratedFromUid = '0bopfOtu5uV3zeC1I3rzLygaU5f1';
    raw['Document ID'] = 'users/fb/characterSheets/x';
    fs.writeFileSync(file, JSON.stringify(raw), 'utf8');

    const res = await exportGet(
      req('http://localhost/api/export', 'GET', sessionHeaders(uid)),
    );
    expect(res.status).toBe(200);
    const list = await res.json();
    const item = list.find((c: any) => c.id === created.id);

    expect(item).toBeDefined();
    expect(item.name).toBe(created.name);
    expect(item.userId).toBeUndefined();
    expect(item.migratedFrom).toBeUndefined();
    expect(item.migratedAt).toBeUndefined();
    expect(item.migratedFromUid).toBeUndefined();
    expect(item['Document ID']).toBeUndefined();

    // На диске провенанс остаётся — чистим только на выходе.
    expect(readJson(file).migratedFromUid).toBe('0bopfOtu5uV3zeC1I3rzLygaU5f1');
  });
});

/**
 * RECOVERY (SEC-1, SEC-4): восстановление доступа через API.
 *
 * Флоу: `recover/verify` проверяет фразу ЦЕЛИКОМ и отдаёт одноразовый токен
 * (без Set-Cookie), `recover/update` по этому токену меняет пароль и фразу.
 * Логин в теле `update` ничего не доказывает и не принимается.
 */
describe('recovery-роуты (SEC-1, SEC-4)', () => {
  async function createUser(username = 'recover-api', password = 'pass1') {
    const result = authenticateUser(username, password);
    return result.user!.uid;
  }

  async function userWithPhrase(
    username = 'recover-api',
    phrase = 'amber cobalt lantern',
  ) {
    const uid = await createUser(username);
    expect(setRecoveryPhrase(uid, phrase)).toBe(true);
    return uid;
  }

  const storedPhrase = (uid: string) =>
    readJson(userPaths(dataDir, uid).userFile).recoveryPhrase;

  it('/api/auth/phrase без сессии — 401', async () => {
    await userWithPhrase();
    const res = await phraseRoute(json({ phrase: 'Alpha Beta' }));
    expect(res.status).toBe(401);
  });

  it('/api/auth/phrase сохраняет фразу хэшем текущему пользователю', async () => {
    const uid = await createUser();
    const res = await phraseRoute(
      json({ phrase: 'Alpha Beta' }, sessionHeaders(uid)),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    const stored = storedPhrase(uid);
    expect(isRecoveryPhraseHash(stored)).toBe(true);
    expect(stored).not.toContain('alpha');
    expect(recoveryPhraseMatches(stored, 'alpha beta')).toBe(true);
  });

  it('/api/auth/phrase валидирует поля', async () => {
    const uid = await createUser();
    const res = await phraseRoute(json({}, sessionHeaders(uid)));
    expect(res.status).toBe(400);
  });

  it('recover/verify отдаёт токен, но НЕ ставит сессию', async () => {
    await userWithPhrase();

    const res = await recoverVerifyRoute(
      json({
        username: 'recover-api',
        recoveryPhrase: 'amber cobalt lantern',
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(20);
    // Cookie здесь не появляется: доказана фраза, а не владение сессией.
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('recover/verify требует поля — 400', async () => {
    const noPhrase = await recoverVerifyRoute(
      json({ username: 'recover-api' }),
    );
    expect(noPhrase.status).toBe(400);

    const noUsername = await recoverVerifyRoute(
      json({ recoveryPhrase: 'amber cobalt lantern' }),
    );
    expect(noUsername.status).toBe(400);

    const broken = await recoverVerifyRoute(
      new Request('http://localhost/api/auth/recover/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ broken',
      }),
    );
    expect(broken.status).toBe(400);
  });

  it('recover/verify отклоняет частичную фразу — 400', async () => {
    await userWithPhrase();

    for (const partial of [
      'amber',
      'lantern',
      'amber cobalt',
      'cobalt amber lantern',
    ]) {
      const res = await recoverVerifyRoute(
        json({ username: 'recover-api', recoveryPhrase: partial }),
      );
      expect({ partial, status: res.status }).toEqual({
        partial,
        status: 400,
      });
      expect((await res.json()).reason).toBe('recovery_failed');
    }
  });

  it('recover/verify не падает на "." и "(" — 400, а не 500', async () => {
    await userWithPhrase();

    // Ровно столько попыток, сколько разрешает окно лимита (5 за 15 минут).
    for (const input of ['.', '(', ')', '$&', '*']) {
      const res = await recoverVerifyRoute(
        json({ username: 'recover-api', recoveryPhrase: input }),
      );
      expect({ input, status: res.status }).toEqual({ input, status: 400 });
    }
  });

  it('recover/verify работает с кириллицей', async () => {
    await userWithPhrase('cyrillic-api', 'Синий Кит Фонарь');

    const res = await recoverVerifyRoute(
      json({ username: 'cyrillic-api', recoveryPhrase: 'синий  кит фонарь' }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('recover/verify неотличим для «нет аккаунта» и «неверная фраза»', async () => {
    await userWithPhrase('enum-api');

    const noAccount = await recoverVerifyRoute(
      json({ username: 'nobody-here', recoveryPhrase: 'amber cobalt lantern' }),
    );
    const wrongPhrase = await recoverVerifyRoute(
      json({ username: 'enum-api', recoveryPhrase: 'wrong phrase here' }),
    );

    expect(noAccount.status).toBe(400);
    expect(wrongPhrase.status).toBe(400);
    expect(await noAccount.json()).toEqual(await wrongPhrase.json());
  });

  it('recover/update без токена → 401 и пароль не меняется', async () => {
    const uid = await userWithPhrase();
    const before = readJson(userPaths(dataDir, uid).userFile).passwordHash;

    const res = await recoverUpdateRoute(
      json({
        // Логин ничего не доказывает — раньше этого хватало для захвата.
        username: 'recover-api',
        newPassword: 'pwned-pass',
        newRecoveryPhrase: 'x y z',
      }),
    );

    expect(res.status).toBe(401);
    expect((await res.json()).reason).toBe('invalid_token');
    expect(readJson(userPaths(dataDir, uid).userFile).passwordHash).toBe(
      before,
    );
    expect(authenticateUser('recover-api', 'pwned-pass').success).toBe(false);
  });

  it('recover/update по токену меняет пароль и фразу', async () => {
    const uid = await userWithPhrase();

    const verified = await recoverVerifyRoute(
      json({
        username: 'recover-api',
        recoveryPhrase: 'amber cobalt lantern',
      }),
    );
    const { token } = await verified.json();

    const res = await recoverUpdateRoute(
      json({
        token,
        newPassword: 'fresh-password',
        newRecoveryPhrase: 'new amber cobalt',
      }),
    );
    expect(res.status).toBe(200);
    expect(authenticateUser('recover-api', 'fresh-password').success).toBe(
      true,
    );
    expect(authenticateUser('recover-api', 'pass1').success).toBe(false);
    expect(recoveryPhraseMatches(storedPhrase(uid), 'new amber cobalt')).toBe(
      true,
    );
  });

  it('токен одноразовый: повторный update → 401', async () => {
    await userWithPhrase();

    const verified = await recoverVerifyRoute(
      json({
        username: 'recover-api',
        recoveryPhrase: 'amber cobalt lantern',
      }),
    );
    const { token } = await verified.json();

    const first = await recoverUpdateRoute(
      json({ token, newPassword: 'first-pass' }),
    );
    expect(first.status).toBe(200);

    const second = await recoverUpdateRoute(
      json({ token, newPassword: 'second-pass' }),
    );
    expect(second.status).toBe(401);

    // Второй пароль не применился.
    expect(authenticateUser('recover-api', 'first-pass').success).toBe(true);
    expect(authenticateUser('recover-api', 'second-pass').success).toBe(false);
  });

  it('recover/update валидирует длину пароля и фразы', async () => {
    const uid = await userWithPhrase();
    const { token } = await (
      await recoverVerifyRoute(
        json({
          username: 'recover-api',
          recoveryPhrase: 'amber cobalt lantern',
        }),
      )
    ).json();

    const shortPassword = await recoverUpdateRoute(
      json({ token, newPassword: '123' }),
    );
    expect(shortPassword.status).toBe(400);

    const shortPhrase = await recoverUpdateRoute(
      json({ token, newPassword: '12345', newRecoveryPhrase: 'ab' }),
    );
    expect(shortPhrase.status).toBe(400);

    // Токен не сгорел на неудачных валидациях — им ещё можно воспользоваться.
    const ok = await recoverUpdateRoute(
      json({ token, newPassword: '12345', newRecoveryPhrase: 'gamma delta' }),
    );
    expect(ok.status).toBe(200);
    expect(authenticateUser('recover-api', '12345').success).toBe(true);
    expect(recoveryPhraseMatches(storedPhrase(uid), 'gamma delta')).toBe(true);
  });

  it('legacy /api/auth/recover — только по токену, без слов из листов', async () => {
    const uid = await userWithPhrase('legacy-api');

    const byWords = await recoverRoute(
      json({
        username: 'legacy-api',
        word1: 'ragnar',
        word2: 'testborn',
        word3: 'fighter',
        newPassword: 'fresh-pass',
      }),
    );
    expect(byWords.status).toBe(401);

    const { token } = await (
      await recoverVerifyRoute(
        json({
          username: 'legacy-api',
          recoveryPhrase: 'amber cobalt lantern',
        }),
      )
    ).json();

    const byToken = await recoverRoute(
      json({ token, newPassword: 'fresh-pass' }),
    );
    expect(byToken.status).toBe(200);
    expect(authenticateUser('legacy-api', 'fresh-pass').success).toBe(true);
    // Фраза не менялась: в теле её не было.
    expect(
      recoveryPhraseMatches(storedPhrase(uid), 'amber cobalt lantern'),
    ).toBe(true);
  });

  it('после 5 неудачных попыток recover/verify отвечает 429', async () => {
    await userWithPhrase('limited-api');

    const statuses: number[] = [];
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const res = await recoverVerifyRoute(
        json({ username: 'limited-api', recoveryPhrase: 'wrong phrase' }),
      );
      statuses.push(res.status);
      if (attempt === 6) {
        expect(res.headers.get('retry-after')).toBeTruthy();
      }
    }

    expect(statuses.slice(0, 5)).toEqual([400, 400, 400, 400, 400]);
    expect(statuses[5]).toBe(429);
  });
});

describe('GET /api/import (разовый перенос из Firestore-экспорта)', () => {
  const firestoreRow = (fbUser: string, overrides: Record<string, any>) => ({
    'Document ID': `projects/demo/databases/(default)/documents/users/${fbUser}/characterSheets/doc1`,
    gameSystem: 'Dungeons & Dragons',
    characterClass: '  Rogue  ',
    background: 'Urchin',
    level: 2,
    ...overrides,
  });

  it('404, если файла data/import-source.json нет', async () => {
    const res = await importGet();
    expect(res.status).toBe(404);
    expect((await res.json()).success).toBe(false);
  });

  it('импортирует пользователей и листы обеих систем, затем удаляет файл', async () => {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'import-source.json'),
      JSON.stringify([
        firestoreRow('fbuser1', { name: '  Ragnar  ' }),
        firestoreRow('fbuser1', {
          gameSystem: 'Dark Heresy',
          careerPath: 'Adept',
          homeWorld: 'Hive World',
        }),
        firestoreRow('fbuser2', { level: 4 }),
        firestoreRow('fbuser3', { gameSystem: 'Unknown System' }),
      ]),
    );

    const res = await importGet();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.users).toHaveLength(3);
    // У третьего пользователя единственный лист неизвестной системы — он пропущен.
    expect(body.users[2].charactersImported).toBe(0);
    expect(body.defaultPassword).toBe('1234');

    const index = readJson(loginIndexPath(dataDir));
    for (const user of body.users.filter(
      (u: any) => u.charactersImported > 0,
    )) {
      expect(isUid(user.localUserId)).toBe(true);
      const paths = userPaths(dataDir, user.localUserId);
      expect(fs.existsSync(paths.userFile)).toBe(true);
      expect(readJson(paths.userFile).uid).toBe(user.localUserId);
      expect(index.logins[user.username]).toBe(user.localUserId);

      const files = fs.readdirSync(paths.charactersDir);
      expect(files.length).toBeGreaterThan(0);
      const character = readJson(path.join(paths.charactersDir, files[0]));
      expect(character.userId).toBe(user.localUserId);
      expect(character.gameSystem).toMatch(/Dungeons|Dark Heresy/);
    }

    // Oчистка исходника после успешного импорта
    expect(fs.existsSync(path.join(dataDir, 'import-source.json'))).toBe(false);
  });

  it('отклоняет пустой/невалидный файл', async () => {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'import-source.json'),
      JSON.stringify({ not: 'array' }),
    );

    const res = await importGet();
    expect(res.status).toBe(400);
  });
});
