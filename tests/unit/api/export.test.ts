/**
 * GET /api/export: только свои листы, 404 на неизвестный id и отсутствие
 * служебных полей (migrated*, userId, Firestore) в выгрузке.
 */

import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as charactersPost } from '@/app/api/characters/route';
import { GET as exportGet } from '@/app/api/export/route';
import { resetAuthRateLimits } from '@/lib/security/rate-limit';
import { resetWriteSeqGuard } from '@/lib/server-storage';

import {
  makeDndCharacter,
  readJson,
  removeDir,
  sessionHeaders,
  userPaths,
  useTempDataDir,
} from '@tests/support';
import { loginAs } from '@tests/support/api-auth';
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

describe('/api/export', () => {
  it('без сессии — 401', async () => {
    const res = await exportGet(req('http://localhost/api/export'));
    expect(res.status).toBe(401);
  });

  it('отдаёт список и одного персонажа, 404 на неизвестный id', async () => {
    const { uid } = await loginAs('user-exp');
    const created = await (
      await charactersPost(
        json({ ...makeDndCharacter() }, await sessionHeaders(uid)),
      )
    ).json();

    const list = await exportGet(
      req('http://localhost/api/export', 'GET', await sessionHeaders(uid)),
    );
    expect(list.status).toBe(200);
    expect(Array.isArray(await list.json())).toBe(true);

    const single = await exportGet(
      req(
        `http://localhost/api/export?characterId=${created.id}`,
        'GET',
        await sessionHeaders(uid),
      ),
    );
    expect(single.status).toBe(200);
    expect((await single.json()).name).toBe(created.name);

    const missing = await exportGet(
      req(
        'http://localhost/api/export?characterId=nope',
        'GET',
        await sessionHeaders(uid),
      ),
    );
    expect(missing.status).toBe(404);
  });

  it('не отдаёт служебные поля (migrated*, userId, Document ID), но сохраняет данные', async () => {
    const { uid } = await loginAs('user-exp');
    const created = await (
      await charactersPost(
        json({ ...makeDndCharacter() }, await sessionHeaders(uid)),
      )
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
      req('http://localhost/api/export', 'GET', await sessionHeaders(uid)),
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
