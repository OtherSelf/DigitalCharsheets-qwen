import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CHARACTER_SCHEMA_VERSION } from '@/lib/character-version';
import {
  createUserFolder,
  deleteCharacterFromServer,
  getCharactersFromServer,
  resetWriteSeqGuard,
  saveCharactersToServer,
  saveCharacterToServer,
  updateCharacterOnServer,
  userFolderExists,
} from '@/lib/server-storage';

import {
  makeDhCharacter,
  makeDndCharacter,
  readJson,
  removeDir,
  userPaths,
  useTempDataDir,
} from '@tests/support';

/**
 * Файловое хранилище листов (src/lib/server-storage.ts): чтение, запись, удаление,
 * атомарная запись через tmp+rename и защита от запоздавших PUT.
 *
 * Данные: временный DCS_DATA_DIR, у каждого теста свой каталог.
 */

let dataDir: string;
const uid = 'user-storage';

beforeEach(() => {
  dataDir = useTempDataDir();
  resetWriteSeqGuard();
});

afterEach(() => {
  removeDir(dataDir);
  resetWriteSeqGuard();
});

describe('server-storage (файловое хранилище листов)', () => {
  it('сохраняет персонажа в отдельный файл data/users/<uid>/characters/<id>.json', async () => {
    const character = makeDndCharacter({ id: 'char-a', userId: uid });
    await saveCharacterToServer(uid, character);

    const file = path.join(
      userPaths(dataDir, uid).charactersDir,
      'char-a.json',
    );
    expect(fs.existsSync(file)).toBe(true);
    expect(readJson(file)).toEqual({
      ...character,
      systemId: 'dnd5e',
      schemaVersion: CHARACTER_SCHEMA_VERSION,
    });
    // Компактный JSON: без отступов и переводов строк (Q4).
    const raw = fs.readFileSync(file, 'utf8');
    expect(raw).not.toContain('\n');
    expect(JSON.parse(raw)).toMatchObject({ id: 'char-a' });
  });

  it('getCharactersFromServer на пустом каталоге возвращает [] и НЕ создаёт каталоги', async () => {
    const characters = await getCharactersFromServer('user-new');

    expect(characters).toEqual([]);
    // Чтение не оставляет следов на диске: иначе запрос создавал бы каталог
    // для uid, которого нет в данных (SEC-3/3b).
    expect(fs.existsSync(path.join(dataDir, 'users', 'user-new'))).toBe(false);
  });

  it('читает все сохранённые листы', async () => {
    await saveCharactersToServer(uid, [
      makeDndCharacter({ id: 'a', userId: uid, name: 'Alpha' }),
      makeDhCharacter({ id: 'b', userId: uid, name: 'Beta' }),
    ]);

    const characters = await getCharactersFromServer(uid);
    expect(characters.map((c) => c.id).sort()).toEqual(['a', 'b']);
  });

  it('пропускает битые JSON-файлы, но отдаёт остальные', async () => {
    // битый файл — ожидаемая ситуация, лог нам не нужен
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await saveCharacterToServer(
      uid,
      makeDndCharacter({ id: 'good', userId: uid }),
    );
    const charsDir = userPaths(dataDir, uid).charactersDir;
    fs.writeFileSync(path.join(charsDir, 'broken.json'), '{ not json');
    fs.writeFileSync(path.join(charsDir, 'notes.txt'), 'ignored');

    const characters = await getCharactersFromServer(uid);
    expect(characters).toHaveLength(1);
    expect(characters[0].id).toBe('good');
    errorSpy.mockRestore();
  });

  it('обновляет только переданные поля и возвращает результат', async () => {
    await saveCharacterToServer(
      uid,
      makeDndCharacter({ id: 'upd', userId: uid }),
    );

    const updated = await updateCharacterOnServer(uid, 'upd', {
      name: 'Renamed',
      level: 7,
    });

    expect(updated).not.toBeNull();
    expect(updated?.name).toBe('Renamed');
    expect(updated && 'level' in updated ? updated.level : undefined).toBe(7);

    const onDisk = (await getCharactersFromServer(uid)).find(
      (c) => c.id === 'upd',
    );
    expect(onDisk?.name).toBe('Renamed');
  });

  it('дописывает userId владельца, если лист пришёл без него (миграция/импорт)', async () => {
    const ownerless = makeDndCharacter({ id: 'ownerless', name: 'No Owner' });
    delete (ownerless as any).userId;

    // saveCharacterToServer пишет объект как есть, поэтому кладём файл напрямую.
    const charsDir = userPaths(dataDir, uid).charactersDir;
    fs.mkdirSync(charsDir, { recursive: true });
    const file = path.join(charsDir, 'ownerless.json');
    fs.writeFileSync(file, JSON.stringify(ownerless), 'utf8');
    expect(readJson(file).userId).toBeUndefined();

    await updateCharacterOnServer(uid, 'ownerless', { name: 'Owned' });

    expect(readJson(file).userId).toBe(uid);
  });

  it('update несуществующего персонажа возвращает null', async () => {
    expect(
      await updateCharacterOnServer(uid, 'missing', { name: 'X' }),
    ).toBeNull();
  });

  it('удаляет файл персонажа и сообщает об отсутствии при повторе', async () => {
    await saveCharacterToServer(
      uid,
      makeDndCharacter({ id: 'del', userId: uid }),
    );

    expect(await deleteCharacterFromServer(uid, 'del')).toBe(true);
    expect(
      fs.existsSync(
        path.join(userPaths(dataDir, uid).charactersDir, 'del.json'),
      ),
    ).toBe(false);
    expect(await deleteCharacterFromServer(uid, 'del')).toBe(false);
  });

  it('userFolderExists видит только созданные каталоги', async () => {
    expect(await userFolderExists('user-nobody')).toBe(false);
    await createUserFolder('user-someone', 'someone', 'Someone');
    expect(await userFolderExists('user-someone')).toBe(true);
  });

  it('createUserFolder пишет user.json и не перезаписывает существующий', async () => {
    await createUserFolder('user-keep', 'keep', 'Keep');
    const userFile = userPaths(dataDir, 'user-keep').userFile;
    expect(readJson(userFile)).toMatchObject({
      username: 'keep',
      displayName: 'Keep',
    });

    await createUserFolder('user-keep', 'changed', 'Changed');
    expect(readJson(userFile).username).toBe('keep');
  });

  it('изоляция: данные пишутся в DCS_DATA_DIR, если он задан', async () => {
    const character = makeDndCharacter({ id: 'isolated', userId: uid });
    await saveCharacterToServer(uid, character);

    const inTemp = path.join(
      dataDir,
      'users',
      uid,
      'characters',
      'isolated.json',
    );
    expect(fs.existsSync(inTemp)).toBe(true);
    // в каталоге проекта ничего не появилось
    expect(fs.existsSync(path.join(process.cwd(), 'data', 'users', uid))).toBe(
      false,
    );
  });

  // ─── атомарная запись ────────────────────────────────────────────────────
  // Обрыв посреди writeFileSync раньше оставлял обрезанный JSON, и персонаж
  // молча «исчезал» из списка (getCharactersFromServer пропускает битые файлы).
  it('пишет через временный файл+rename и не оставляет .tmp после успеха', async () => {
    await saveCharacterToServer(
      uid,
      makeDndCharacter({ id: 'atomic', userId: uid }),
    );
    await updateCharacterOnServer(uid, 'atomic', { name: 'Atomic Renamed' });

    const charsDir = userPaths(dataDir, uid).charactersDir;
    expect(fs.readdirSync(charsDir)).toEqual(['atomic.json']);
    expect(readJson(path.join(charsDir, 'atomic.json')).name).toBe(
      'Atomic Renamed',
    );
  });

  it('если rename падает — файл листа остаётся прежним (не обрезанным)', async () => {
    await saveCharacterToServer(
      uid,
      makeDndCharacter({ id: 'safe', userId: uid, name: 'Before' }),
    );
    const charsDir = userPaths(dataDir, uid).charactersDir;

    const renameSpy = vi
      .spyOn(fsp, 'rename')
      .mockRejectedValue(
        Object.assign(new Error('disk error'), { code: 'EIO' }),
      );
    try {
      await expect(
        updateCharacterOnServer(uid, 'safe', { name: 'After' }),
      ).rejects.toThrow();
    } finally {
      renameSpy.mockRestore();
    }

    // Временный файл убран, оригинал не тронут.
    expect(fs.readdirSync(charsDir)).toEqual(['safe.json']);
    expect(readJson(path.join(charsDir, 'safe.json')).name).toBe('Before');
  });

  it('битый JSON — ошибка (500), а не молчаливая перезапись файла', async () => {
    const charsDir = userPaths(dataDir, uid).charactersDir;
    fs.mkdirSync(charsDir, { recursive: true });
    const file = path.join(charsDir, 'broken-update.json');
    fs.writeFileSync(file, '{ "id": "broken-update", "name": ');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      updateCharacterOnServer(uid, 'broken-update', { name: 'X' }),
    ).rejects.toThrow();
    errorSpy.mockRestore();

    // Файл остался как был — данные можно восстановить руками.
    expect(fs.readFileSync(file, 'utf8')).toBe(
      '{ "id": "broken-update", "name": ',
    );
  });

  // ─── защита от запоздавших записей (__page/__seq) ────────────────────────
  it('отбрасывает запоздавшую запись с меньшим seq', async () => {
    await saveCharacterToServer(
      uid,
      makeDndCharacter({ id: 'race', userId: uid, name: 'Start' }),
    );

    const newer = await updateCharacterOnServer(
      uid,
      'race',
      { name: 'Newest' },
      { writeToken: { page: 'page-1', seq: 5 } },
    );
    expect(newer?.name).toBe('Newest');

    // Старый PUT «прилетел» после нового — на диске должно остаться новое.
    const stale = await updateCharacterOnServer(
      uid,
      'race',
      { name: 'Old' },
      { writeToken: { page: 'page-1', seq: 4 } },
    );
    expect(stale?.name).toBe('Newest');

    const onDisk = (await getCharactersFromServer(uid)).find(
      (c) => c.id === 'race',
    );
    expect(onDisk?.name).toBe('Newest');
  });

  it('принимает повтор с тем же seq (идемпотентная досылка keepalive)', async () => {
    await saveCharacterToServer(
      uid,
      makeDndCharacter({ id: 'idem', userId: uid }),
    );

    await updateCharacterOnServer(
      uid,
      'idem',
      { name: 'Once' },
      { writeToken: { page: 'p', seq: 2 } },
    );
    const again = await updateCharacterOnServer(
      uid,
      'idem',
      { name: 'Once' },
      { writeToken: { page: 'p', seq: 2 } },
    );
    expect(again?.name).toBe('Once');
  });

  it('независимые загрузки страниц не блокируют друг друга', async () => {
    await saveCharacterToServer(
      uid,
      makeDndCharacter({ id: 'tabs', userId: uid }),
    );

    await updateCharacterOnServer(
      uid,
      'tabs',
      { name: 'TabA' },
      { writeToken: { page: 'A', seq: 9 } },
    );
    const fromOtherTab = await updateCharacterOnServer(
      uid,
      'tabs',
      { name: 'TabB' },
      { writeToken: { page: 'B', seq: 1 } },
    );
    expect(fromOtherTab?.name).toBe('TabB');
  });
});
