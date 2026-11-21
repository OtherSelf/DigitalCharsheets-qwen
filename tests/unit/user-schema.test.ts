import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { newUid } from '@/lib/ids';
import {
  normalizeUserProfiles,
  readStoredUser,
  USER_SCHEMA_VERSION,
} from '@/lib/user-schema';

import {
  loginIndexPath,
  readJson,
  removeDir,
  userPaths,
  useTempDataDir,
} from '@tests/support';

/**
 * Шаблон профиля v4 (src/lib/user-schema.ts).
 *
 * Покрыто: нормализация старого user.json в памяти и на диске (роль,
 * блокировка, даты, schemaVersion, email→username), роль tester и
 * неизвестные роли, идемпотентность startup-проверки, пропуск битых
 * каталогов и отсутствующий passwordHash.
 */

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  removeDir(dataDir);
});

const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

function writeLegacyProfile(uid: string, content: Record<string, unknown>) {
  const paths = userPaths(dataDir, uid);
  fs.mkdirSync(paths.userDir, { recursive: true });
  fs.writeFileSync(paths.userFile, JSON.stringify(content));
  return paths;
}

describe('normalizeUserProfiles', () => {
  it('дополняет профиль v2 ролями, блокировкой и версией схемы', async () => {
    const uid = newUid();
    const createdAt = '2025-01-02T03:04:05.000Z';
    const paths = writeLegacyProfile(uid, {
      schemaVersion: 2,
      uid,
      username: 'Legacy@Example.com',
      displayName: 'Legacy Hero',
      passwordHash: sha256('pass-one-1234'),
      createdAt,
      updatedAt: createdAt,
    });

    const report = await normalizeUserProfiles();
    expect(report.total).toBe(1);
    expect(report.updated).toBe(1);
    expect(report.issues).toEqual([]);

    const stored = readJson(paths.userFile);
    expect(stored).toMatchObject({
      schemaVersion: USER_SCHEMA_VERSION,
      uid,
      // Логин — ключ индекса, поэтому нормализуется в нижний регистр.
      username: 'legacy@example.com',
      displayName: 'Legacy Hero',
      passwordHash: sha256('pass-one-1234'),
      role: 'user',
      isBlocked: false,
      createdAt,
      updatedAt: createdAt,
    });
  });

  it('сохраняет роль tester при миграции v3 → v4', async () => {
    const uid = newUid();
    const paths = writeLegacyProfile(uid, {
      schemaVersion: 3,
      uid,
      username: 'tester',
      displayName: 'Tester',
      passwordHash: sha256('pass-one-1234'),
      role: 'tester',
      isBlocked: false,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });

    const report = await normalizeUserProfiles();
    expect(report.updated).toBe(1);
    expect(report.issues).toEqual([]);

    const stored = readJson(paths.userFile);
    expect(stored.role).toBe('tester');
    expect(stored.schemaVersion).toBe(USER_SCHEMA_VERSION);
    expect((await readStoredUser(uid))?.role).toBe('tester');
  });

  it('неизвестную роль нормализует в user', async () => {
    const uid = newUid();
    const paths = writeLegacyProfile(uid, {
      schemaVersion: 3,
      uid,
      username: 'strange',
      displayName: 'Strange',
      passwordHash: sha256('pass-one-1234'),
      role: 'superuser',
    });

    await normalizeUserProfiles();
    expect(readJson(paths.userFile).role).toBe('user');
  });

  it('читает legacy-поле email как логин и подставляет displayName', async () => {
    const uid = newUid();
    const paths = writeLegacyProfile(uid, {
      schemaVersion: 1,
      email: 'Old@Example.com',
      passwordHash: sha256('pass-one-1234'),
    });

    const report = await normalizeUserProfiles();
    expect(report.updated).toBe(1);

    const stored = readJson(paths.userFile);
    expect(stored.username).toBe('old@example.com');
    expect(stored.displayName).toBe('old');
    expect(stored.role).toBe('user');
    expect(stored.isBlocked).toBe(false);
    expect(stored.schemaVersion).toBe(USER_SCHEMA_VERSION);
    expect(stored.createdAt).toBeTruthy();
    expect(stored.updatedAt).toBe(stored.createdAt);
    // Старое поле не удаляем: это чужие данные, которые мы не теряем.
    expect(stored.email).toBe('Old@Example.com');
  });

  it('сохраняет дату создания из mtime, а не «сегодня»', async () => {
    const uid = newUid();
    const paths = writeLegacyProfile(uid, {
      uid,
      username: 'dated',
      displayName: 'Dated',
      passwordHash: sha256('pass-one-1234'),
    });
    const past = new Date('2024-03-04T05:06:07.000Z');
    fs.utimesSync(paths.userFile, past, past);

    await normalizeUserProfiles();

    const stored = readJson(paths.userFile);
    expect(stored.createdAt).toBe(past.toISOString());
    expect(stored.updatedAt).toBe(past.toISOString());
  });

  it('идемпотентна: второй запуск ничего не переписывает', async () => {
    const uid = newUid();
    writeLegacyProfile(uid, {
      uid,
      username: 'stable',
      displayName: 'Stable',
      passwordHash: sha256('pass-one-1234'),
    });

    expect((await normalizeUserProfiles()).updated).toBe(1);
    const second = await normalizeUserProfiles();
    expect(second.updated).toBe(0);
  });

  it('не понижает schemaVersion более нового профиля', async () => {
    const uid = newUid();
    const futureVersion = USER_SCHEMA_VERSION + 1;
    const paths = writeLegacyProfile(uid, {
      schemaVersion: futureVersion,
      uid,
      username: 'future',
      displayName: 'Future',
      passwordHash: sha256('pass-one-1234'),
      role: 'user',
      isBlocked: false,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });

    // Более свежий инстанс мог дописать поля: понижать версию нельзя.
    const report = await normalizeUserProfiles();
    expect(report.updated).toBe(0);
    expect(readJson(paths.userFile).schemaVersion).toBe(futureVersion);
  });

  it('не выдумывает passwordHash, но сообщает о нём', async () => {
    const uid = newUid();
    const paths = writeLegacyProfile(uid, {
      schemaVersion: USER_SCHEMA_VERSION,
      uid,
      username: 'nopass',
      displayName: 'No Pass',
      role: 'user',
      isBlocked: false,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });

    const report = await normalizeUserProfiles();
    expect(report.updated).toBe(0);
    expect(report.issues.some((issue) => issue.includes('passwordHash'))).toBe(
      true,
    );
    // Пустой хеш не появился — чинить должен администратор.
    expect(readJson(paths.userFile).passwordHash).toBeUndefined();
  });

  it('пропускает битый user.json и каталоги не-UUID', async () => {
    const goodUid = newUid();
    writeLegacyProfile(goodUid, {
      uid: goodUid,
      username: 'good',
      displayName: 'Good',
      passwordHash: sha256('pass-one-1234'),
    });

    const brokenUid = newUid();
    const brokenPaths = userPaths(dataDir, brokenUid);
    fs.mkdirSync(brokenPaths.userDir, { recursive: true });
    fs.writeFileSync(brokenPaths.userFile, '{not json');

    const foreignDir = path.join(dataDir, 'users', 'not-a-uid');
    fs.mkdirSync(foreignDir, { recursive: true });
    fs.writeFileSync(
      path.join(foreignDir, 'user.json'),
      JSON.stringify({ username: 'foreign', passwordHash: 'x' }),
    );

    const report = await normalizeUserProfiles();
    expect(report.total).toBe(1);
    expect(report.updated).toBe(1);
    expect(report.issues.some((issue) => issue.includes(brokenUid))).toBe(true);
    expect(report.issues.some((issue) => issue.includes('not-a-uid'))).toBe(
      true,
    );

    expect(await readStoredUser(brokenUid)).toBeNull();
    expect(await readStoredUser('not-a-uid')).toBeNull();
    expect((await readStoredUser(goodUid))?.username).toBe('good');
  });

  it('readStoredUser нормализует в памяти, не трогая файл', async () => {
    const uid = newUid();
    const paths = writeLegacyProfile(uid, {
      uid,
      username: 'ReadOnly',
      displayName: 'Read Only',
      passwordHash: sha256('pass-one-1234'),
    });
    const before = fs.readFileSync(paths.userFile, 'utf8');

    const user = await readStoredUser(uid);
    expect(user?.username).toBe('readonly');
    expect(user?.role).toBe('user');
    expect(user?.isBlocked).toBe(false);
    expect(fs.readFileSync(paths.userFile, 'utf8')).toBe(before);

    // Индекс при обычном чтении профиля тоже не создаётся.
    expect(fs.existsSync(loginIndexPath(dataDir))).toBe(false);
  });
});
