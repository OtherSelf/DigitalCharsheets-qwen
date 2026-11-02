import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createUserFolder,
  deleteCharacterFromServer,
  getCharactersFromServer,
  saveCharacterToServer,
  saveCharactersToServer,
  updateCharacterOnServer,
  userFolderExists,
} from '@/lib/server-storage';
import { makeDndCharacter, makeDhCharacter, readJson, removeDir, useTempDataDir, userPaths } from '../helpers';

let dataDir: string;
const uid = 'user-storage';

beforeEach(() => {
  dataDir = useTempDataDir();
});

afterEach(() => {
  removeDir(dataDir);
});

describe('server-storage (файловое хранилище листов)', () => {
  it('сохраняет персонажа в отдельный файл data/<uid>/characters/<id>.json', () => {
    const character = makeDndCharacter({ id: 'char-a', userId: uid });
    saveCharacterToServer(uid, character);

    const file = path.join(userPaths(dataDir, uid).charactersDir, 'char-a.json');
    expect(fs.existsSync(file)).toBe(true);
    expect(readJson(file)).toEqual(character);
    // Человекочитаемый JSON (отступ 2)
    expect(fs.readFileSync(file, 'utf8')).toContain('\n  "id"');
  });

  it('getCharactersFromServer на пустом каталоге возвращает [] и создаёт каталоги', () => {
    const characters = getCharactersFromServer('user-new');

    expect(characters).toEqual([]);
    expect(fs.existsSync(path.join(dataDir, 'user-new', 'characters'))).toBe(true);
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

    const updated = updateCharacterOnServer(uid, 'upd', { name: 'Renamed', level: 7 });

    expect(updated).not.toBeNull();
    expect(updated?.name).toBe('Renamed');
    expect(updated && 'level' in updated ? updated.level : undefined).toBe(7);

    const onDisk = getCharactersFromServer(uid).find((c) => c.id === 'upd');
    expect(onDisk?.name).toBe('Renamed');
  });

  it('update несуществующего персонажа возвращает null', () => {
    expect(updateCharacterOnServer(uid, 'missing', { name: 'X' })).toBeNull();
  });

  it('удаляет файл персонажа и сообщает об отсутствии при повторе', () => {
    saveCharacterToServer(uid, makeDndCharacter({ id: 'del', userId: uid }));

    expect(deleteCharacterFromServer(uid, 'del')).toBe(true);
    expect(fs.existsSync(path.join(userPaths(dataDir, uid).charactersDir, 'del.json'))).toBe(false);
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
    expect(readJson(userFile)).toMatchObject({ username: 'keep', displayName: 'Keep' });

    createUserFolder('user-keep', 'changed', 'Changed');
    expect(readJson(userFile).username).toBe('keep');
  });

  it('изоляция: данные пишутся в DCS_DATA_DIR, если он задан', () => {
    const character = makeDndCharacter({ id: 'isolated', userId: uid });
    saveCharacterToServer(uid, character);

    const inTemp = path.join(dataDir, uid, 'characters', 'isolated.json');
    expect(fs.existsSync(inTemp)).toBe(true);
    // в каталоге проекта ничего не появилось
    expect(fs.existsSync(path.join(process.cwd(), 'data', uid))).toBe(false);
  });
});
