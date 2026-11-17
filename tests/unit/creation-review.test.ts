import { afterEach, describe, expect, it } from 'vitest';

import {
  clearCreationReview,
  finishCreationReview,
  isCreationReview,
  startCreationReview,
} from '@/games/shared/creation-review';

/**
 * Режим проверки импортированного листа — состояние вкладки, а не листа
 * (D1). Здесь только контракт стора: включение по id, фиксация, сброс.
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
