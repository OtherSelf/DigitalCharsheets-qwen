/**
 * CRUD /api/characters и path traversal: 401 без сессии, 404 на неизвестный
 * id, отбрасывание запоздавшего PUT, служебные поля не попадают в файл.
 */

import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DELETE as characterDelete,
  PUT as characterPut,
} from '@/app/api/characters/[id]/route';
import {
  GET as charactersGet,
  POST as charactersPost,
} from '@/app/api/characters/route';
import { resetAuthRateLimits } from '@/lib/security/rate-limit';
import { authenticateUser } from '@/lib/server-auth';
import { resetWriteSeqGuard } from '@/lib/server-storage';

import {
  makeCharacter,
  readJson,
  removeDir,
  sessionHeaders,
  userPaths,
  useTempDataDir,
} from '@tests/support';
import { loginAs, registerAs } from '@tests/support/api-auth';
import { json, params, req } from '@tests/support/http';

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

describe('/api/characters', () => {
  it('GET без сессии — 401', async () => {
    const res = await charactersGet(req('http://localhost/api/characters'));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toContain('Unauthorized');
  });

  it('POST без сессии — 401 и ничего не пишет', async () => {
    const res = await charactersPost(json(makeCharacter('dnd5e')));
    expect(res.status).toBe(401);
    expect(fs.existsSync(path.join(dataDir, 'users'))).toBe(false);
  });

  it('POST создаёт персонажа (201) и GET его возвращает', async () => {
    const { uid } = await loginAs('user-api');
    const payload = { ...makeCharacter('dnd5e'), userId: 'чужой-uid' };
    delete (payload as any).id;

    const res = await charactersPost(json(payload, await sessionHeaders(uid)));
    expect(res.status).toBe(201);
    const character = await res.json();
    expect(character.id).toBeTruthy();
    // userId из тела игнорируется — владелец берётся из сессии.
    expect(character.userId).toBe(uid);

    const list = await charactersGet(
      req('http://localhost/api/characters', 'GET', await sessionHeaders(uid)),
    );
    expect(list.status).toBe(200);
    const characters = await list.json();
    expect(characters.map((c: any) => c.id)).toContain(character.id);
  });

  it('PUT обновляет персонажа, неизвестный id даёт 404', async () => {
    const { uid } = await loginAs('user-api');
    const created = await (
      await charactersPost(
        json({ ...makeCharacter('dh1') }, await sessionHeaders(uid)),
      )
    ).json();

    const updated = await characterPut(
      json({ name: 'Updated Vex' }, await sessionHeaders(uid)),
      params(created.id),
    );
    expect(updated.status).toBe(200);
    expect((await updated.json()).name).toBe('Updated Vex');

    const missing = await characterPut(
      json({ name: 'X' }, await sessionHeaders(uid)),
      params('nope'),
    );
    expect(missing.status).toBe(404);
  });

  it('PUT без сессии — 401', async () => {
    const { uid } = await loginAs('user-api');
    const created = await (
      await charactersPost(
        json({ ...makeCharacter('dh1') }, await sessionHeaders(uid)),
      )
    ).json();

    const res = await characterPut(json({ name: 'X' }), params(created.id));
    expect(res.status).toBe(401);
  });

  // ─── порядок правок: __page/__seq ────────────────────────────────────────
  it('PUT отбрасывает запоздавшую правку (не перетирает свежий опыт)', async () => {
    const { uid } = await loginAs('user-api');
    const created = await (
      await charactersPost(
        json(
          { ...makeCharacter('dh1', { experience: 0 }) },
          await sessionHeaders(uid),
        ),
      )
    ).json();

    const fresh = await characterPut(
      json(
        { experience: 500, __page: 'page-x', __seq: 2 },
        await sessionHeaders(uid),
      ),
      params(created.id),
    );
    expect(fresh.status).toBe(200);

    // Такой же запрос, но «старый» (он мог подвиснуть в сети/уехать с keepalive).
    const stale = await characterPut(
      json(
        { experience: 100, __page: 'page-x', __seq: 1 },
        await sessionHeaders(uid),
      ),
      params(created.id),
    );
    expect(stale.status).toBe(200);

    const list = await (
      await charactersGet(
        req(
          'http://localhost/api/characters',
          'GET',
          await sessionHeaders(uid),
        ),
      )
    ).json();
    expect(list.find((c: any) => c.id === created.id).experience).toBe(500);
  });

  it('служебные __page/__seq/userId не попадают в файл листа', async () => {
    const { uid } = await loginAs('user-api');
    const created = await (
      await charactersPost(
        json({ ...makeCharacter('dh1') }, await sessionHeaders(uid)),
      )
    ).json();

    await characterPut(
      json(
        { experience: 7, __page: 'page-y', __seq: 3, userId: 'чужой-uid' },
        await sessionHeaders(uid),
      ),
      params(created.id),
    );

    const list = await (
      await charactersGet(
        req(
          'http://localhost/api/characters',
          'GET',
          await sessionHeaders(uid),
        ),
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
      await charactersPost(
        json({ ...makeCharacter('dh1') }, await sessionHeaders(uid)),
      )
    ).json();

    const empty = await characterPut(
      new Request('http://localhost/api/test', {
        method: 'PUT',
        headers: await sessionHeaders(uid),
      }),
      params(created.id),
    );
    expect(empty.status).toBe(400);

    const broken = await characterPut(
      new Request('http://localhost/api/test', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          ...(await sessionHeaders(uid)),
        },
        body: '{ broken',
      }),
      params(created.id),
    );
    expect(broken.status).toBe(400);
  });

  it('DELETE удаляет персонажа, повторный вызов — 404', async () => {
    const { uid } = await loginAs('user-api');
    const created = await (
      await charactersPost(
        json({ ...makeCharacter('dh1') }, await sessionHeaders(uid)),
      )
    ).json();
    const url = `http://localhost/api/characters/${created.id}`;

    const first = await characterDelete(
      req(url, 'DELETE', await sessionHeaders(uid)),
      params(created.id),
    );
    expect(first.status).toBe(200);

    const second = await characterDelete(
      req(url, 'DELETE', await sessionHeaders(uid)),
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
    const { uid } = await registerAs(username, 'test-pass-1234', username);
    const created = await charactersPost(
      json(
        { ...makeCharacter('dnd5e', { name: `${username} sheet` }) },
        await sessionHeaders(uid),
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
      json(
        { passwordHash: 'pwned', name: 'hijacked-pass-1234' },
        await sessionHeaders(uid),
      ),
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
    const attacker = await registerAs(
      'traversal-attacker',
      'test-pass-1234',
      'A',
    );
    const before = profileOf(victim.uid);

    const res = await characterPut(
      json({ passwordHash: 'pwned' }, await sessionHeaders(attacker.uid)),
      params(`../${victim.uid}/user`),
    );

    expect(res.status).toBe(400);
    expect(profileOf(victim.uid)).toEqual(before);
    // Вход под жертвой старым паролем всё ещё работает.
    expect(
      (await authenticateUser('traversal-victim', 'test-pass-1234')).success,
    ).toBe(true);
  });

  it('DELETE по «../../<uid>/user» не удаляет чужой профиль — 400', async () => {
    const victim = await accountWithSheet('del-victim');
    const attacker = await registerAs('del-attacker', 'test-pass-1234', 'A');

    const res = await characterDelete(
      req(
        'http://localhost/api/characters/x',
        'DELETE',
        await sessionHeaders(attacker.uid),
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
        json({ passwordHash: 'pwned' }, await sessionHeaders(uid)),
        params(id),
      );
      expect({ id, status: put.status }).toEqual({ id, status: 400 });

      const del = await characterDelete(
        req(
          'http://localhost/api/characters/x',
          'DELETE',
          await sessionHeaders(uid),
        ),
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
      json({ passwordHash: 'pwned' }, await sessionHeaders(uid)),
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
