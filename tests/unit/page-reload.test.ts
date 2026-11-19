import { describe, expect, it } from 'vitest';

import { AUTO_RELOAD_COOLDOWN_MS } from '@/lib/build-guard';
import {
  canAutoReload,
  PAGE_RELOAD_KEY,
  readLastReloadAt,
  rememberReload,
  type ReloadStorage,
} from '@/lib/page-reload';

/** Подделка sessionStorage: поведение проверяем без браузера. */
function fakeStorage(initial: Record<string, string> = {}): ReloadStorage & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe('page-reload / canAutoReload', () => {
  it('первая перезагрузка разрешена, повтор — только после cooldown', () => {
    const now = 1_800_000_000_000;
    expect(canAutoReload(now, null)).toBe(true);
    expect(canAutoReload(now, now - AUTO_RELOAD_COOLDOWN_MS + 1)).toBe(false);
    expect(canAutoReload(now, now - AUTO_RELOAD_COOLDOWN_MS)).toBe(true);
  });

  it('cooldown можно задать меньше для теста', () => {
    expect(canAutoReload(1_000, 900, 100)).toBe(true);
    expect(canAutoReload(1_000, 950, 100)).toBe(false);
  });
});

describe('page-reload / хранилище', () => {
  it('запоминает и читает время перезагрузки', () => {
    const storage = fakeStorage();
    rememberReload(1_234, storage);
    expect(storage.data[PAGE_RELOAD_KEY]).toBe('1234');
    expect(readLastReloadAt(storage)).toBe(1_234);
  });

  it('мусор в хранилище читается как «перезагрузок не было»', () => {
    expect(
      readLastReloadAt(fakeStorage({ [PAGE_RELOAD_KEY]: 'не число' })),
    ).toBeNull();
    expect(readLastReloadAt(fakeStorage())).toBeNull();
  });

  it('без хранилища ничего не падает: читаем null, пишем молча', () => {
    expect(readLastReloadAt(null)).toBeNull();
    expect(() => rememberReload(1, null)).not.toThrow();
  });
});
