import { describe, expect, it } from 'vitest';

import type { PluralKey, TranslationKey } from '@/lib/i18n';

/**
 * `TranslationKey` — единственный источник допустимых ключей `t()`.
 * Проверка опечатки живёт в типах: если `@ts-expect-error` окажется лишним,
 * `tsc` упадёт на «unused '@ts-expect-error'» — это и есть гейт.
 */
describe('TranslationKey', () => {
  it('принимает ключи ядра, плагинов и сгенерированных семейств', () => {
    const host: TranslationKey = 'common.dashboard';
    const plugin: TranslationKey = 'dh1.homeWorld';
    const generated: TranslationKey = 'games.stepGame';

    expect([host, plugin, generated]).toHaveLength(3);
  });

  it('опечатку в ключе ловит tsc', () => {
    // @ts-expect-error — такого ключа нет ни в одном словаре.
    const typo: TranslationKey = 'common.dashbord';
    expect(typo).toContain('dashbord');
  });

  it('база форм числа выводится из ключей `_other`', () => {
    const base: PluralKey = 'common.noteTabLimit';
    // @ts-expect-error — у ключа нет семейства форм числа.
    const notPlural: PluralKey = 'common.dashboard';

    expect(base).toBe('common.noteTabLimit');
    expect(notPlural).toBe('common.dashboard');
  });
});
