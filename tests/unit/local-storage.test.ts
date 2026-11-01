import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  addLocalCharacter,
  clearLocalUser,
  deleteLocalCharacter,
  getLocalCharacters,
  getLocalUser,
  saveLocalCharacters,
  setLocalUser,
  updateLocalCharacter,
  type LocalUser,
} from '@/lib/local-storage';
import { makeDndCharacter } from '../helpers';

/** Минимальная замена localStorage: node-окружение его не предоставляет. */
class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  get length() {
    return this.store.size;
  }
}

const user: LocalUser = {
  uid: 'user-abc',
  username: 'hero',
  displayName: 'Hero',
  hasRecoveryPhrase: false,
};

beforeAll(() => {
  const globals = globalThis as Record<string, any>;
  globals.localStorage = new MemoryStorage();
  // Модуль проверяет `typeof window === 'undefined'` (SSR-заглушки).
  globals.window = {};
});

afterAll(() => {
  const globals = globalThis as Record<string, any>;
  delete globals.window;
  delete globals.localStorage;
});

beforeEach(() => {
  (globalThis as any).localStorage.clear();
});

describe('local-storage: пользователь', () => {
  it('без window возвращает null (SSR)', () => {
    const globals = globalThis as Record<string, any>;
    const savedWindow = globals.window;
    delete globals.window;
    try {
      expect(getLocalUser()).toBeNull();
      expect(getLocalCharacters()).toEqual([]);
    } finally {
      globals.window = savedWindow;
    }
  });

  it('сохраняет и читает пользователя', () => {
    setLocalUser(user);
    expect(getLocalUser()).toEqual(user);
    expect((globalThis as any).localStorage.getItem('digital_charsheets_user')).toContain('user-abc');
  });

  it('умеет чистить сессию', () => {
    setLocalUser(user);
    clearLocalUser();
    expect(getLocalUser()).toBeNull();
  });

  it('поддерживает legacy-поле email', () => {
    (globalThis as any).localStorage.setItem(
      'digital_charsheets_user',
      JSON.stringify({ uid: 'user-old', email: 'old@mail', displayName: 'Old', hasRecoveryPhrase: true }),
    );

    expect(getLocalUser()).toMatchObject({ uid: 'user-old', username: 'old@mail' });
  });

  it('не падает на пустом хранилище', () => {
    expect(getLocalUser()).toBeNull();
    expect(getLocalCharacters()).toEqual([]);
  });
});

describe('local-storage: персонажи', () => {
  it('сохраняет и читает список листов', () => {
    const characters = [makeDndCharacter({ id: 'x1' }), makeDndCharacter({ id: 'x2' })];
    saveLocalCharacters(characters);
    expect(getLocalCharacters().map((c) => c.id)).toEqual(['x1', 'x2']);
  });

  it('addLocalCharacter генерирует уникальный непустой id', () => {
    const { id: _ignored, ...payload } = makeDndCharacter();

    const first = addLocalCharacter(payload as any);
    const second = addLocalCharacter(payload as any);

    expect(first.id).toBeTruthy();
    expect(second.id).toBeTruthy();
    expect(first.id).not.toBe(second.id);
    expect(getLocalCharacters()).toHaveLength(2);
  });

  it('updateLocalCharacter меняет только нужную запись', () => {
    saveLocalCharacters([makeDndCharacter({ id: 'a', name: 'A' }), makeDndCharacter({ id: 'b', name: 'B' })]);

    updateLocalCharacter('b', { name: 'B2' });

    const characters = getLocalCharacters();
    expect(characters.find((c) => c.id === 'a')?.name).toBe('A');
    expect(characters.find((c) => c.id === 'b')?.name).toBe('B2');
  });

  it('updateLocalCharacter игнорирует неизвестный id', () => {
    saveLocalCharacters([makeDndCharacter({ id: 'a', name: 'A' })]);
    updateLocalCharacter('nope', { name: 'X' });
    expect(getLocalCharacters()[0].name).toBe('A');
  });

  it('deleteLocalCharacter удаляет только совпавший id', () => {
    saveLocalCharacters([makeDndCharacter({ id: 'a' }), makeDndCharacter({ id: 'b' })]);

    deleteLocalCharacter('a');

    expect(getLocalCharacters().map((c) => c.id)).toEqual(['b']);
    deleteLocalCharacter('missing');
    expect(getLocalCharacters()).toHaveLength(1);
  });
});
