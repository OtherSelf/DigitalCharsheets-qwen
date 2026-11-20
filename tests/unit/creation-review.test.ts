import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearCreationReview,
  finishCreationReview,
  isCreationReview,
  startCreationReview,
} from '@/games/shared/creation-review';

/**
 * Режим проверки импортированного листа — состояние вкладки, а не листа.
 * Здесь контракт стора: включение по id, фиксация, сброс и переживание
 * жёсткого перехода (отметка хранится в sessionStorage вкладки).
 */
describe('режим проверки выборов', () => {
  afterEach(() => clearCreationReview());

  it('включается по id листа и снимается фиксацией', () => {
    expect(isCreationReview('char-1')).toBe(false);
    startCreationReview('char-1');
    expect(isCreationReview('char-1')).toBe(true);
    finishCreationReview('char-1');
    expect(isCreationReview('char-1')).toBe(false);
  });

  it('не задевает другие листы', () => {
    startCreationReview('char-1');
    expect(isCreationReview('char-2')).toBe(false);
    finishCreationReview('char-2');
    expect(isCreationReview('char-1')).toBe(true);
  });

  it('clearCreationReview снимает все отметки (для тестов)', () => {
    startCreationReview('a');
    startCreationReview('b');
    clearCreationReview();
    expect(isCreationReview('a')).toBe(false);
    expect(isCreationReview('b')).toBe(false);
  });
});

/**
 * Переход из диалога импорта на страницу листа может стать полной
 * перезагрузкой документа: тогда память модуля обнуляется, а отметка должна
 * остаться. Перезагрузку модуля здесь изображает `vi.resetModules()`.
 */
describe('режим проверки переживает жёсткий переход', () => {
  function fakeSessionStorage(): Storage {
    const data = new Map<string, string>();
    return {
      get length() {
        return data.size;
      },
      key: (index: number) => [...data.keys()][index] ?? null,
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
      clear: () => data.clear(),
    } as Storage;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('сохраняет отметку в sessionStorage и снимает её фиксацией', async () => {
    vi.stubGlobal('window', { sessionStorage: fakeSessionStorage() });
    vi.resetModules();

    const before = await import('@/games/shared/creation-review');
    before.startCreationReview('char-hard-nav');

    // Новый экземпляр модуля — как после перезагрузки документа.
    vi.resetModules();
    const after = await import('@/games/shared/creation-review');
    expect(after.isCreationReview('char-hard-nav')).toBe(true);

    after.finishCreationReview('char-hard-nav');
    vi.resetModules();
    const refreshed = await import('@/games/shared/creation-review');
    expect(refreshed.isCreationReview('char-hard-nav')).toBe(false);
  });

  it('без window (серверный рендер) работает в памяти и не падает', async () => {
    vi.resetModules();
    const review = await import('@/games/shared/creation-review');
    review.startCreationReview('char-ssr');
    expect(review.isCreationReview('char-ssr')).toBe(true);
    review.clearCreationReview();
    expect(review.isCreationReview('char-ssr')).toBe(false);
  });
});
