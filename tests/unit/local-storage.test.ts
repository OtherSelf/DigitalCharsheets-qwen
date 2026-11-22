import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  clearLocalUser,
  getLocalUser,
  setLocalUser,
  type LocalUser,
} from '@/lib/local-storage';

/**
 * Клиентская сессия в localStorage (src/lib/local-storage.ts).
 *
 * Покрыто: SSR-заглушки без window и логин в digital_charsheets_user (с legacy
 * email). Листы в браузере больше не хранятся — серверное хранилище заменило
 * локальный режим. Вместо браузера — MemoryStorage, объявленный ниже.
 */

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
    } finally {
      globals.window = savedWindow;
    }
  });

  it('сохраняет и читает пользователя', () => {
    setLocalUser(user);
    expect(getLocalUser()).toEqual(user);
    expect(
      (globalThis as any).localStorage.getItem('digital_charsheets_user'),
    ).toContain('user-abc');
  });

  it('умеет чистить сессию', () => {
    setLocalUser(user);
    clearLocalUser();
    expect(getLocalUser()).toBeNull();
  });

  it('поддерживает legacy-поле email', () => {
    (globalThis as any).localStorage.setItem(
      'digital_charsheets_user',
      JSON.stringify({
        uid: 'user-old',
        email: 'old@mail',
        displayName: 'Old',
        hasRecoveryPhrase: true,
      }),
    );

    expect(getLocalUser()).toMatchObject({
      uid: 'user-old',
      username: 'old@mail',
    });
  });

  it('не падает на пустом хранилище', () => {
    expect(getLocalUser()).toBeNull();
  });
});
