import { describe, expect, it } from 'vitest';

import { dh1CreationHintsMarkdown } from '@/games/dh1/creation-hints';
import { translations } from '@/lib/i18n';

/**
 * ─── LANDMARK: DH1 CREATION HINTS TESTS ───────────────────────────────────
 * Памятка создания 1e собирается из выборов формы и переводится по ключам
 * словаря. Проверка живёт рядом с редакцией: правка dh2 не может
 * сломать текст dh1, даже если сценарии двух плагинов совпадают.
 */

function translate(lang: 'en' | 'ru') {
  return (key: string): string => translations[lang][key] ?? key;
}

const en = translate('en');
const ru = translate('ru');

describe('dh1: подсказки создания', () => {
  const markdown = dh1CreationHintsMarkdown(
    {
      homeWorld: 'Hive World',
      worldVariant: 'Ganger Scum',
      careerPath: 'Adept',
      divination: 'mutationWithout',
      quirk: 'Hairy Knuckles',
      wounds: 10,
      fatePoints: 1,
    },
    en,
  );

  it('собирает особенности мира, профиль и пакет карьеры', () => {
    expect(markdown).toContain('# Creation hints');
    expect(markdown).toContain('Hive World');
    expect(markdown).toContain('Ganger Scum');
    expect(markdown).toContain('World features');
    expect(markdown).toContain('Starting profile');
    expect(markdown).toContain('Career Path: Adept');
    expect(markdown).toContain('Starting Skills');
    expect(markdown).toContain('Starting Gear');
  });

  it('включает пророчество и причуду', () => {
    expect(markdown).toContain('Divination');
    expect(markdown).toContain('Mutation without, corruption within.');
    expect(markdown).toContain('Quirk');
    expect(markdown).toContain('Hairy Knuckles');
  });

  it('переводит памятку на русский по ключам словаря', () => {
    const localized = dh1CreationHintsMarkdown(
      {
        homeWorld: 'Hive World',
        careerPath: 'Adept',
        divination: 'mutationWithout',
      },
      ru,
    );
    expect(localized).toContain('# Подсказки при создании');
    expect(localized).toContain('Карьерный путь');
    expect(localized).toContain('Пророчество');
  });
});
