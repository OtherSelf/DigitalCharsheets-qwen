import { describe, expect, it } from 'vitest';

import { dh2CreationHintsMarkdown } from '@/games/dh2/creation-hints';
import { translations } from '@/lib/i18n';

/**
 * ─── LANDMARK: DH2 CREATION HINTS TESTS ───────────────────────────────────
 * Памятка создания 2e собирается из выборов формы и переводится по ключам
 * словаря. Проверка живёт рядом с редакцией и не зависит от соседней игры.
 */

function translate(lang: 'en' | 'ru') {
  return (key: string): string => translations[lang][key] ?? key;
}

const en = translate('en');
const ru = translate('ru');

describe('dh2: подсказки создания', () => {
  const markdown = dh2CreationHintsMarkdown(
    {
      homeWorld: 'agri-world',
      background: 'mutant',
      role: 'fanatic',
      aptitudes: ['strength', 'fieldcraft', 'leadership'],
      startingChoices: {
        roleTalent: 'deny-the-witch',
        skills: ['athletics', 'deceive'],
        talents: [],
      },
      divination: 'd100-10',
      wounds: 9,
      fatePoints: 2,
    },
    en,
  );

  it('собирает выбранные мир, бэкграунд и роль с бонусами', () => {
    expect(markdown).toContain('# Creation hints');
    expect(markdown).toContain('Agri-World');
    expect(markdown).toContain('Mutant');
    expect(markdown).toContain('Fanatic');
    expect(markdown).toContain('Twisted Flesh');
    expect(markdown).toContain('Death to All Who Oppose Me!');
  });

  it('показывает уже сделанные выборы и стартовые данные', () => {
    expect(markdown).toContain('Chosen Athletics');
    expect(markdown).toContain('Chosen Deceive');
    expect(markdown).toContain('Chosen Deny the Witch');
    expect(markdown).toContain('Amphibious');
    expect(markdown).toContain('Starting Corruption: 10');
    expect(markdown).toContain('Aptitudes');
  });

  it('переводит памятку на русский по ключам словаря', () => {
    const localized = dh2CreationHintsMarkdown(
      {
        homeWorld: 'agri-world',
        background: 'mutant',
        role: 'fanatic',
        aptitudes: ['strength'],
        startingChoices: { skills: [], talents: [], roleTalent: '' },
      },
      ru,
    );
    expect(localized).toContain('# Подсказки при создании');
    expect(localized).toContain('Агро-мир');
    expect(localized).toContain('Мутант');
    expect(localized).toContain('Стартовая Порча: 10');
  });
});
