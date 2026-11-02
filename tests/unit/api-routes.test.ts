import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as loginRoute } from '@/app/api/auth/route';
import { POST as phraseRoute } from '@/app/api/auth/phrase/route';
import { POST as recoverRoute } from '@/app/api/auth/recover/route';
import { POST as recoverVerifyRoute } from '@/app/api/auth/recover/verify/route';
import { POST as recoverUpdateRoute } from '@/app/api/auth/recover/update/route';
import { GET as charactersGet, POST as charactersPost } from '@/app/api/characters/route';
import { DELETE as characterDelete, PUT as characterPut } from '@/app/api/characters/[id]/route';
import { GET as exportGet } from '@/app/api/export/route';
import { GET as importGet } from '@/app/api/import/route';
import { authenticateUser, generateUserId, setRecoveryPhrase } from '@/lib/server-auth';
import { makeDhCharacter, makeDndCharacter, readJson, removeDir, useTempDataDir, userPaths } from '../helpers';

const json = (body: unknown) =>
  new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const req = (url: string, method = 'GET') => new Request(url, { method });

const params = (id: string) => ({ params: Promise.resolve({ id }) });

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  removeDir(dataDir);
});

describe('POST /api/auth', () => {
  it('регистрирует нового пользователя', async () => {
    const res = await loginRoute(json({ username: 'api-user', password: '1234', displayName: 'API' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ success: true, isNewUser: true });
    expect(body.user.uid).toBe(generateUserId('api-user'));
    expect(body.user.hasRecoveryPhrase).toBe(false);
  });

  it('возвращает 401 на неверный пароль', async () => {
    await loginRoute(json({ username: 'api-user', password: '1234' }));
    const res = await loginRoute(json({ username: 'api-user', password: 'nope' }));

    expect(res.status).toBe(401);
    expect((await res.json()).success).toBe(false);
  });

  it('валидирует обязательные поля и длину пароля', async () => {
    const noPassword = await loginRoute(json({ username: 'x' }));
    expect(noPassword.status).toBe(400);

    const shortPassword = await loginRoute(json({ username: 'x', password: '123' }));
    expect(shortPassword.status).toBe(400);
    expect((await shortPassword.json()).error).toContain('at least 4');
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

describe('/api/characters', () => {
  it('GET без userId — 400', async () => {
    const res = await charactersGet(req('http://localhost/api/characters'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('userId');
  });

  it('POST создаёт персонажа (201) и GET его возвращает', async () => {
    const payload = { ...makeDndCharacter(), userId: 'user-api' };
    delete (payload as any).id;

    const res = await charactersPost(json(payload));
    expect(res.status).toBe(201);
    const character = await res.json();
    expect(character.id).toBeTruthy();
    expect(character.userId).toBe('user-api');

    const list = await charactersGet(req('http://localhost/api/characters?userId=user-api'));
    expect(list.status).toBe(200);
    const characters = await list.json();
    expect(characters.map((c: any) => c.id)).toContain(character.id);
  });

  it('PUT обновляет персонажа, неизвестный id даёт 404', async () => {
    const created = await (await charactersPost(json({ ...makeDhCharacter(), userId: 'user-api' }))).json();

    const updated = await characterPut(
      json({ userId: 'user-api', name: 'Updated Vex' }),
      params(created.id),
    );
    expect(updated.status).toBe(200);
    expect((await updated.json()).name).toBe('Updated Vex');

    const missing = await characterPut(json({ userId: 'user-api', name: 'X' }), params('nope'));
    expect(missing.status).toBe(404);
  });

  it('PUT без userId — 400', async () => {
    const created = await (await charactersPost(json({ ...makeDhCharacter(), userId: 'user-api' }))).json();
    const res = await characterPut(json({ name: 'X' }), params(created.id));
    expect(res.status).toBe(400);
  });

  it('DELETE удаляет персонажа, повторный вызов — 404', async () => {
    const created = await (await charactersPost(json({ ...makeDhCharacter(), userId: 'user-api' }))).json();
    const url = `http://localhost/api/characters/${created.id}?userId=user-api`;

    const first = await characterDelete(req(url, 'DELETE'), params(created.id));
    expect(first.status).toBe(200);

    const second = await characterDelete(req(url, 'DELETE'), params(created.id));
    expect(second.status).toBe(404);
  });
});

describe('/api/export', () => {
  it('требует userId', async () => {
    const res = await exportGet(req('http://localhost/api/export'));
    expect(res.status).toBe(400);
  });

  it('отдаёт список и одного персонажа, 404 на неизвестный id', async () => {
    const created = await (await charactersPost(json({ ...makeDndCharacter(), userId: 'user-exp' }))).json();

    const list = await exportGet(req('http://localhost/api/export?userId=user-exp'));
    expect(list.status).toBe(200);
    expect(Array.isArray(await list.json())).toBe(true);

    const single = await exportGet(
      req(`http://localhost/api/export?userId=user-exp&characterId=${created.id}`),
    );
    expect(single.status).toBe(200);
    expect((await single.json()).name).toBe(created.name);

    const missing = await exportGet(req('http://localhost/api/export?userId=user-exp&characterId=nope'));
    expect(missing.status).toBe(404);
  });
});

describe('recovery-роуты', () => {
  function createUserWithCharacter(username = 'recover-api') {
    const result = authenticateUser(username, 'pass1');
    const uid = result.user!.uid;
    fs.mkdirSync(path.join(userPaths(dataDir, uid).charactersDir), { recursive: true });
    fs.writeFileSync(
      path.join(userPaths(dataDir, uid).charactersDir, 'c.json'),
      JSON.stringify(makeDndCharacter({ id: 'c', userId: uid, name: 'Ragnar Testborn' })),
    );
    return uid;
  }

  it('/api/auth/phrase сохраняет фразу', async () => {
    createUserWithCharacter();
    const res = await phraseRoute(json({ username: 'recover-api', phrase: 'Alpha Beta' }));

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('/api/auth/phrase валидирует поля', async () => {
    const res = await phraseRoute(json({ username: 'recover-api' }));
    expect(res.status).toBe(400);
  });

  it('/api/auth/recover/verify проверяет слова и фразу', async () => {
    const uid = createUserWithCharacter();
    setRecoveryPhrase(uid, 'alpha beta');

    const ok = await recoverVerifyRoute(json({
      username: 'recover-api',
      word1: 'ragnar',
      word2: 'testborn',
      word3: 'fighter',
      recoveryPhraseInput: 'beta',
    }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).success).toBe(true);

    const bad = await recoverVerifyRoute(json({
      username: 'recover-api',
      word1: 'gnome',
      word2: 'testborn',
      word3: 'fighter',
      recoveryPhraseInput: 'beta',
    }));
    expect(bad.status).toBe(400);
  });

  it('/api/auth/recover/reset меняет пароль по словам', async () => {
    const uid = createUserWithCharacter('reset-api');
    setRecoveryPhrase(uid, 'alpha beta');

    const res = await recoverRoute(json({
      username: 'reset-api',
      word1: 'ragnar',
      word2: 'testborn',
      word3: 'fighter',
      newPassword: 'fresh-pass',
    }));
    expect(res.status).toBe(200);

    expect(authenticateUser('reset-api', 'fresh-pass').success).toBe(true);
    expect(authenticateUser('reset-api', 'pass1').success).toBe(false);
  });

  it('/api/auth/recover/update валидирует длину пароля и фразы', async () => {
    createUserWithCharacter('update-api');

    const shortPassword = await recoverUpdateRoute(json({
      username: 'update-api',
      newPassword: '123',
      newRecoveryPhrase: 'alpha beta',
    }));
    expect(shortPassword.status).toBe(400);

    const shortPhrase = await recoverUpdateRoute(json({
      username: 'update-api',
      newPassword: '12345',
      newRecoveryPhrase: 'ab',
    }));
    expect(shortPhrase.status).toBe(400);

    const ok = await recoverUpdateRoute(json({
      username: 'update-api',
      newPassword: '12345',
      newRecoveryPhrase: 'gamma delta',
    }));
    expect(ok.status).toBe(200);
    expect(authenticateUser('update-api', '12345').user?.hasRecoveryPhrase).toBe(true);
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
        firestoreRow('fbuser1', { gameSystem: 'Dark Heresy', careerPath: 'Adept', homeWorld: 'Hive World' }),
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

    for (const user of body.users.filter((u: any) => u.charactersImported > 0)) {
      const dir = path.join(dataDir, user.localUserId);
      expect(fs.existsSync(path.join(dir, 'user.json'))).toBe(true);
      const files = fs.readdirSync(path.join(dir, 'characters'));
      expect(files.length).toBeGreaterThan(0);
      const character = readJson(path.join(dir, 'characters', files[0]));
      expect(character.userId).toBe(user.localUserId);
      expect(character.gameSystem).toMatch(/Dungeons|Dark Heresy/);
    }

    // Oчистка исходника после успешного импорта
    expect(fs.existsSync(path.join(dataDir, 'import-source.json'))).toBe(false);
  });

  it('отклоняет пустой/невалидный файл', async () => {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'import-source.json'), JSON.stringify({ not: 'array' }));

    const res = await importGet();
    expect(res.status).toBe(400);
  });
});
