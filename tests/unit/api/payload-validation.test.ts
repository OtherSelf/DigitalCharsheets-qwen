/**
 * Валидация payload листа (SEC-10): лишние поля и id из тела не попадают в
 * файл, неверные типы дают 400 со списком полей, а не 500.
 */

import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PUT as characterPut } from '@/app/api/characters/[id]/route';
import { POST as charactersPost } from '@/app/api/characters/route';
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
import { json, params } from '@tests/support/http';

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

/**
 * SEC-10: тело листа — входные данные. Раньше оно писалось как есть (`...body`),
 * поэтому в файл мог попасть любой JSON, а `id` из тела переписывал имя файла.
 * Теперь POST/PUT проверяются схемой редакции, служебные поля отбрасываются,
 * тело ограничено 1 МБ.
 */
describe('валидация payload листа (SEC-10)', () => {
  const sheetFile = (uid: string, id: string) =>
    path.join(userPaths(dataDir, uid).charactersDir, `${id}.json`);

  it('лишние поля и id из тела не попадают в файл', async () => {
    const { uid } = await loginAs('payload-extra');

    const res = await charactersPost(
      json(
        {
          ...makeDndCharacter(),
          id: 'client-chosen-id',
          userId: 'someone-else',
          evil: 'pwned',
          nestedExtra: { deep: true },
        },
        sessionHeaders(uid),
      ),
    );

    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.id).not.toBe('client-chosen-id');
    expect(created.userId).toBe(uid);

    const stored = readJson(sheetFile(uid, created.id));
    expect(stored.evil).toBeUndefined();
    expect(stored.nestedExtra).toBeUndefined();
    expect(stored.userId).toBe(uid);
  });

  it('неверная структура (`stats` строкой) → 400 со списком полей', async () => {
    const { uid } = await loginAs('payload-bad');

    const res = await charactersPost(
      json(
        { ...makeDndCharacter(), stats: 'строка вместо блока' },
        sessionHeaders(uid),
      ),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.reason).toBe('invalid_payload');
    expect(JSON.stringify(body.issues)).toContain('stats');
    // Ничего не записано: валидация идёт до записи файла.
    expect(fs.existsSync(userPaths(dataDir, uid).charactersDir)).toBe(false);
  });

  it('PUT с неверным типом → 400 и файл не меняется', async () => {
    const { uid } = await loginAs('payload-put-bad');
    const created = await (
      await charactersPost(json({ ...makeDndCharacter() }, sessionHeaders(uid)))
    ).json();
    const before = readJson(sheetFile(uid, created.id));

    const res = await characterPut(
      json({ stats: 'строка вместо блока' }, sessionHeaders(uid)),
      params(created.id),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe('invalid_payload');
    expect(readJson(sheetFile(uid, created.id))).toEqual(before);
  });

  it('PUT отбрасывает поля вне схемы и служебные ключи', async () => {
    const { uid } = await loginAs('payload-put-extra');
    const created = await (
      await charactersPost(json({ ...makeDndCharacter() }, sessionHeaders(uid)))
    ).json();

    const res = await characterPut(
      json(
        { name: 'Renamed Sheet', evil: 'pwned', userId: 'someone-else' },
        sessionHeaders(uid),
      ),
      params(created.id),
    );

    expect(res.status).toBe(200);
    const stored = readJson(sheetFile(uid, created.id));
    expect(stored.name).toBe('Renamed Sheet');
    expect(stored.evil).toBeUndefined();
    expect(stored.userId).toBe(uid);
  });

  it('тело больше 1 МБ → 413 (POST и PUT)', async () => {
    const { uid } = await loginAs('payload-huge');
    const huge = 'x'.repeat(1_100_000);

    const post = await charactersPost(
      json({ ...makeDndCharacter(), backstory: huge }, sessionHeaders(uid)),
    );
    expect(post.status).toBe(413);
    expect((await post.json()).reason).toBe('payload_too_large');

    const created = await (
      await charactersPost(json({ ...makeDndCharacter() }, sessionHeaders(uid)))
    ).json();
    const put = await characterPut(
      json({ backstory: huge }, sessionHeaders(uid)),
      params(created.id),
    );
    expect(put.status).toBe(413);
    expect((await put.json()).reason).toBe('payload_too_large');
  });
});

/**
 * SEC-8: публичный импорт из Firestore-экспорта убран из рантайма. Он создавал
 * аккаунты с паролем `1234` без всякой аутентификации и отдавал пароли в
 * ответе. Маршрута нет — Next отвечает `404`; миграция выполняется офлайн.
 */
describe('легаси /api/import удалён (SEC-8)', () => {
  it('маршрута нет в дереве приложения', () => {
    const routeDir = path.join(process.cwd(), 'src', 'app', 'api', 'import');
    expect(fs.existsSync(routeDir)).toBe(false);
  });

  it('сервер не экспортирует createImportedUser', async () => {
    const serverAuth = await import('@/lib/server-auth');
    expect('createImportedUser' in serverAuth).toBe(false);
  });
});
