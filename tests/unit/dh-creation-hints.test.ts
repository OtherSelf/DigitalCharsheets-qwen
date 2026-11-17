import { describe, expect, it } from 'vitest';

import { dh1CreationHintsMarkdown } from '@/games/dh1/creation-hints';
import { dh2CreationHintsMarkdown } from '@/games/dh2/creation-hints';
import {
  CREATION_HINTS_MARKER,
  hasCreationHints,
} from '@/games/shared/creation-hints';
import { translations } from '@/lib/i18n';

function t(lang: 'en' | 'ru') {
  return (key: string): string => translations[lang][key] ?? key;
}

const en = t('en');
const ru = t('ru');

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

  it('оставляет скрытый маркер для авто-открытия заметок', () => {
    expect(markdown).toContain(CREATION_HINTS_MARKER);
    expect(hasCreationHints(markdown)).toBe(true);
    expect(hasCreationHints('обычные заметки')).toBe(false);
    expect(hasCreationHints(undefined)).toBe(false);
  });
});

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
    expect(markdown).toContain('');
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
