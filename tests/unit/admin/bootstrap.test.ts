/**
 * ensureServiceAdmin: генерация служебного админа, файл 0600, занятый
 * логин, идемпотентность старта и список персонажей пользователя для админа.
 */

import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GET as adminCharactersGet } from '@/app/api/admin/users/[uid]/characters/route';
import { ensureServiceAdmin, INITIAL_ADMIN_FILE } from '@/lib/admin-bootstrap';
import { authenticateUser } from '@/lib/server-auth';
import {
  resetWriteSeqGuard,
  saveCharacterToServer,
} from '@/lib/server-storage';
import { runStartupMaintenance } from '@/lib/startup';
import { resolveLogin } from '@/lib/user-index';
import { readStoredUser, USER_SCHEMA_VERSION } from '@/lib/user-schema';

import {
  makeDhCharacter,
  makeDndCharacter,
  readJson,
  removeDir,
  sessionHeaders,
  userPaths,
  useTempDataDir,
} from '@tests/support';
import { get, params, seedAdmin, seedUser } from '@tests/support/admin-flows';

let dataDir: string;

beforeEach(() => {
  dataDir = useTempDataDir();
  resetWriteSeqGuard();
});

afterEach(() => {
  removeDir(dataDir);
  resetWriteSeqGuard();
});

describe('ensureServiceAdmin', () => {
  it('создаёт админа с паролем, ролью admin и файлом учётных данных', () => {
    const result = ensureServiceAdmin();

    expect(result.created).toBe(true);
    expect(result.username).toBe('admin');
    expect(result.password).toBeTruthy();
    expect(result.password!.length).toBeGreaterThanOrEqual(12);

    const uid = resolveLogin('admin');
    expect(uid).toBeTruthy();
    const stored = readStoredUser(uid!)!;
    expect(stored.role).toBe('admin');
    expect(stored.isBlocked).toBe(false);
    expect(stored.mustChangePassword).toBe(true);
    expect(authenticateUser('admin', result.password!).success).toBe(true);

    const file = path.join(dataDir, INITIAL_ADMIN_FILE);
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toContain('Login:       admin');
    expect(content).toContain(`Password:    ${result.password}`);
    expect(content).toContain('/admin');
  });

  it('повторный запуск не создаёт второго админа и не меняет пароль', () => {
    const first = ensureServiceAdmin();
    const second = ensureServiceAdmin();

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);

    const admins = fs
      .readdirSync(path.join(dataDir, 'users'))
      .filter((uid) => readStoredUser(uid)?.role === 'admin');
    expect(admins).toHaveLength(1);
    expect(authenticateUser('admin', first.password!).success).toBe(true);
  });

  it('не занимает чужой логин `admin`, а берёт admin-2', () => {
    const user = seedUser('admin', 'user-pass-1234');

    const result = ensureServiceAdmin();
    expect(result.created).toBe(true);
    expect(result.username).toBe('admin-2');

    // Старый аккаунт не тронут: по-прежнему обычный пользователь.
    expect(readStoredUser(user.uid)?.role).toBe('user');
    expect(authenticateUser('admin', 'user-pass-1234').success).toBe(true);
    expect(authenticateUser('admin-2', result.password!).success).toBe(true);
  });

  it('не трогает установку, где уже есть активный админ', () => {
    const existing = seedAdmin('boss', 'boss-pass-1234');
    const result = ensureServiceAdmin();

    expect(result.created).toBe(false);
    expect(fs.readdirSync(path.join(dataDir, 'users'))).toHaveLength(1);
    expect(readStoredUser(existing.uid)?.username).toBe('boss');
  });

  it('создаёт нового админа, если единственный заблокирован', () => {
    const existing = seedAdmin('blocked-admin', 'blocked-pass-1');
    const paths = userPaths(dataDir, existing.uid);
    const stored = readJson(paths.userFile);
    stored.isBlocked = true;
    stored.blockedAt = new Date().toISOString();
    fs.writeFileSync(paths.userFile, JSON.stringify(stored));

    const result = ensureServiceAdmin();
    expect(result.created).toBe(true);
    expect(result.username).toBe('admin');
    expect(readStoredUser(existing.uid)?.isBlocked).toBe(true);
  });

  it('runStartupMaintenance нормализует профили и создаёт админа', () => {
    const user = seedUser('old-user', 'user-pass-1234');
    const paths = userPaths(dataDir, user.uid);
    const legacy = readJson(paths.userFile);
    legacy.schemaVersion = 2;
    delete legacy.role;
    delete legacy.isBlocked;
    fs.writeFileSync(paths.userFile, JSON.stringify(legacy));

    const report = runStartupMaintenance({ force: true });
    expect(report.profiles).toMatchObject({ total: 1, updated: 1 });
    expect(report.admin?.created).toBe(true);
    expect(readJson(paths.userFile)).toMatchObject({
      schemaVersion: USER_SCHEMA_VERSION,
      role: 'user',
      isBlocked: false,
    });
  });
});

describe('GET /api/admin/users/[uid]/characters', () => {
  it('отдаёт сводку листов D&D и Dark Heresy, 404 на неизвестный uid', async () => {
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

    const res = await adminCharactersGet(
      get(
        `http://localhost/api/admin/users/${user.uid}/characters`,
        sessionHeaders(admin.uid),
      ),
      params(user.uid),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.characters).toHaveLength(2);

    const dnd = body.characters.find(
      (character: { id: string }) => character.id === 'dnd-1',
    );
    // Ядро отдаёт только общие поля и сырой лист: подпись строки собирает
    // плагин слотом `CardSummary`, поэтому `level`/`rank` здесь нет (D7).
    expect(dnd).toMatchObject({ gameSystem: 'Dungeons & Dragons' });
    expect(dnd.sheet).toMatchObject({ level: 3, name: 'Ragnar Testborn' });
    expect(dnd).not.toHaveProperty('level');
    expect(dnd).not.toHaveProperty('rank');
    expect(dnd).not.toHaveProperty('characterClass');
    expect(typeof dnd.updatedAt).toBe('string');

    const dh = body.characters.find(
      (character: { id: string }) => character.id === 'dh-1',
    );
    expect(dh.gameSystem).toBe('Dark Heresy');
    // Ранг есть в листе, но ядро о нём не знает.
    expect(dh.sheet).toHaveProperty('rank');
    expect(dh).not.toHaveProperty('rank');

    const missing = await adminCharactersGet(
      get(
        'http://localhost/api/admin/users/00000000-0000-4000-8000-000000000004/characters',
        sessionHeaders(admin.uid),
      ),
      params('00000000-0000-4000-8000-000000000004'),
    );
    expect(missing.status).toBe(404);
  });

  it('403 обычному пользователю', async () => {
    const user = seedUser();
    const res = await adminCharactersGet(
      get(
        `http://localhost/api/admin/users/${user.uid}/characters`,
        sessionHeaders(user.uid),
      ),
      params(user.uid),
    );
    expect(res.status).toBe(403);
  });
});
