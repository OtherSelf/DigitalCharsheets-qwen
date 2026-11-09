import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
} from './helpers';

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
  it('сохраняет персонажа в отдельный файл data/users/<uid>/characters/<id>.json', () => {
    const character = makeDndCharacter({ id: 'char-a', userId: uid });
    saveCharacterToServer(uid, character);

    const file = path.join(
      userPaths(dataDir, uid).charactersDir,
      'char-a.json',
    );
    expect(fs.existsSync(file)).toBe(true);
    expect(readJson(file)).toEqual(character);
    // Человекочитаемый JSON (отступ 2)
    expect(fs.readFileSync(file, 'utf8')).toContain('\n  "id"');
  });

  it('getCharactersFromServer на пустом каталоге возвращает [] и создаёт каталоги', () => {
    const characters = getCharactersFromServer('user-new');

    expect(characters).toEqual([]);
    expect(
      fs.existsSync(path.join(dataDir, 'users', 'user-new', 'characters')),
    ).toBe(true);
  });

  it('читает все сохранённые листы', () => {
    saveCharactersToServer(uid, [
      makeDndCharacter({ id: 'a', userId: uid, name: 'Alpha' }),
      makeDhCharacter({ id: 'b', userId: uid, name: 'Beta' }),
    ]);

    const characters = getCharactersFromServer(uid);
    expect(characters.map((c) => c.id).sort()).toEqual(['a', 'b']);
  });

  it('пропускает битые JSON-файлы, но отдаёт остальные', () => {
    // битый файл — ожидаемая ситуация, лог нам не нужен
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    saveCharacterToServer(uid, makeDndCharacter({ id: 'good', userId: uid }));
    const charsDir = userPaths(dataDir, uid).charactersDir;
    fs.writeFileSync(path.join(charsDir, 'broken.json'), '{ not json');
    fs.writeFileSync(path.join(charsDir, 'notes.txt'), 'ignored');

    const characters = getCharactersFromServer(uid);
    expect(characters).toHaveLength(1);
    expect(characters[0].id).toBe('good');
    errorSpy.mockRestore();
  });

  it('обновляет только переданные поля и возвращает результат', () => {
    saveCharacterToServer(uid, makeDndCharacter({ id: 'upd', userId: uid }));

    const updated = updateCharacterOnServer(uid, 'upd', {
      name: 'Renamed',
      level: 7,
    });

    expect(updated).not.toBeNull();
    expect(updated?.name).toBe('Renamed');
    expect(updated && 'level' in updated ? updated.level : undefined).toBe(7);

    const onDisk = getCharactersFromServer(uid).find((c) => c.id === 'upd');
    expect(onDisk?.name).toBe('Renamed');
  });

  it('дописывает userId владельца, если лист пришёл без него (миграция/импорт)', () => {
    const ownerless = makeDndCharacter({ id: 'ownerless', name: 'No Owner' });
    delete (ownerless as any).userId;

    // saveCharacterToServer пишет объект как есть, поэтому кладём файл напрямую.
    const charsDir = userPaths(dataDir, uid).charactersDir;
    fs.mkdirSync(charsDir, { recursive: true });
    const file = path.join(charsDir, 'ownerless.json');
    fs.writeFileSync(file, JSON.stringify(ownerless), 'utf8');
    expect(readJson(file).userId).toBeUndefined();

    updateCharacterOnServer(uid, 'ownerless', { name: 'Owned' });

    expect(readJson(file).userId).toBe(uid);
  });

  it('update несуществующего персонажа возвращает null', () => {
    expect(updateCharacterOnServer(uid, 'missing', { name: 'X' })).toBeNull();
  });

  it('удаляет файл персонажа и сообщает об отсутствии при повторе', () => {
    saveCharacterToServer(uid, makeDndCharacter({ id: 'del', userId: uid }));

    expect(deleteCharacterFromServer(uid, 'del')).toBe(true);
    expect(
      fs.existsSync(
        path.join(userPaths(dataDir, uid).charactersDir, 'del.json'),
      ),
    ).toBe(false);
    expect(deleteCharacterFromServer(uid, 'del')).toBe(false);
  });

  it('userFolderExists видит только созданные каталоги', () => {
    expect(userFolderExists('user-nobody')).toBe(false);
    createUserFolder('user-someone', 'someone', 'Someone');
    expect(userFolderExists('user-someone')).toBe(true);
  });

  it('createUserFolder пишет user.json и не перезаписывает существующий', () => {
    createUserFolder('user-keep', 'keep', 'Keep');
    const userFile = userPaths(dataDir, 'user-keep').userFile;
    expect(readJson(userFile)).toMatchObject({
      username: 'keep',
      displayName: 'Keep',
    });

    createUserFolder('user-keep', 'changed', 'Changed');
    expect(readJson(userFile).username).toBe('keep');
  });

  it('изоляция: данные пишутся в DCS_DATA_DIR, если он задан', () => {
    const character = makeDndCharacter({ id: 'isolated', userId: uid });
    saveCharacterToServer(uid, character);

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
  it('пишет через временный файл+rename и не оставляет .tmp после успеха', () => {
    saveCharacterToServer(uid, makeDndCharacter({ id: 'atomic', userId: uid }));
    updateCharacterOnServer(uid, 'atomic', { name: 'Atomic Renamed' });

    const charsDir = userPaths(dataDir, uid).charactersDir;
    expect(fs.readdirSync(charsDir)).toEqual(['atomic.json']);
    expect(readJson(path.join(charsDir, 'atomic.json')).name).toBe(
      'Atomic Renamed',
    );
  });

  it('если rename падает — файл листа остаётся прежним (не обрезанным)', () => {
    saveCharacterToServer(
      uid,
      makeDndCharacter({ id: 'safe', userId: uid, name: 'Before' }),
    );
    const charsDir = userPaths(dataDir, uid).charactersDir;

    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw Object.assign(new Error('disk error'), { code: 'EIO' });
    });
    try {
      expect(() =>
        updateCharacterOnServer(uid, 'safe', { name: 'After' }),
      ).toThrow();
    } finally {
      renameSpy.mockRestore();
    }

    // Временный файл убран, оригинал не тронут.
    expect(fs.readdirSync(charsDir)).toEqual(['safe.json']);
    expect(readJson(path.join(charsDir, 'safe.json')).name).toBe('Before');
  });

  it('битый JSON — ошибка (500), а не молчаливая перезапись файла', () => {
    const charsDir = userPaths(dataDir, uid).charactersDir;
    fs.mkdirSync(charsDir, { recursive: true });
    const file = path.join(charsDir, 'broken-update.json');
    fs.writeFileSync(file, '{ "id": "broken-update", "name": ');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      updateCharacterOnServer(uid, 'broken-update', { name: 'X' }),
    ).toThrow();
    errorSpy.mockRestore();

    // Файл остался как был — данные можно восстановить руками.
    expect(fs.readFileSync(file, 'utf8')).toBe(
      '{ "id": "broken-update", "name": ',
    );
  });

  // ─── защита от запоздавших записей (__page/__seq) ────────────────────────
  it('отбрасывает запоздавшую запись с меньшим seq', () => {
    saveCharacterToServer(
      uid,
      makeDndCharacter({ id: 'race', userId: uid, name: 'Start' }),
    );

    const newer = updateCharacterOnServer(
      uid,
      'race',
      { name: 'Newest' },
      { writeToken: { page: 'page-1', seq: 5 } },
    );
    expect(newer?.name).toBe('Newest');

    // Старый PUT «прилетел» после нового — на диске должно остаться новое.
    const stale = updateCharacterOnServer(
      uid,
      'race',
      { name: 'Old' },
      { writeToken: { page: 'page-1', seq: 4 } },
    );
    expect(stale?.name).toBe('Newest');

    const onDisk = getCharactersFromServer(uid).find((c) => c.id === 'race');
    expect(onDisk?.name).toBe('Newest');
  });

  it('принимает повтор с тем же seq (идемпотентная досылка keepalive)', () => {
    saveCharacterToServer(uid, makeDndCharacter({ id: 'idem', userId: uid }));

    updateCharacterOnServer(
      uid,
      'idem',
      { name: 'Once' },
      { writeToken: { page: 'p', seq: 2 } },
    );
    const again = updateCharacterOnServer(
      uid,
      'idem',
      { name: 'Once' },
      { writeToken: { page: 'p', seq: 2 } },
    );
    expect(again?.name).toBe('Once');
  });

  it('независимые загрузки страниц не блокируют друг друга', () => {
    saveCharacterToServer(uid, makeDndCharacter({ id: 'tabs', userId: uid }));

    updateCharacterOnServer(
      uid,
      'tabs',
      { name: 'TabA' },
      { writeToken: { page: 'A', seq: 9 } },
    );
    const fromOtherTab = updateCharacterOnServer(
      uid,
      'tabs',
      { name: 'TabB' },
      { writeToken: { page: 'B', seq: 1 } },
    );
    expect(fromOtherTab?.name).toBe('TabB');
  });
});
