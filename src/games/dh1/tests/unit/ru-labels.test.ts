import { describe, expect, it } from 'vitest';

import dh1En from '@/games/dh1/i18n/en.json';
import dh1Ru from '@/games/dh1/i18n/ru.json';

/**
 * ─── LANDMARK: DH1 RU SHEET LABELS TESTS ─────────────────────────────────
 * Подписи характеристик и их сокращения в RU/EN-словарях 1e сверены с
 * листом персонажа. Тест не даёт молча вернуть старые сокращения (например,
 * «ББ/ДБ/СЛ») или разойтись двум локалям.
 */

const RU_FULL: Record<string, string> = {
  weaponSkill: 'Навык Рукопашной',
  ballisticSkill: 'Навык Стрельбы',
  strength: 'Сила',
  toughness: 'Выносливость',
  agility: 'Ловкость',
  intelligence: 'Интеллект',
  perception: 'Восприятие',
  willpower: 'Сила Воли',
  fellowship: 'Общительность',
  influence: 'Влияние',
};

const RU_ABBR: Record<string, string> = {
  weaponSkill: 'НР',
  ballisticSkill: 'НС',
  strength: 'С',
  toughness: 'Вын.',
  agility: 'Лов.',
  intelligence: 'Инт.',
  perception: 'Вос.',
  willpower: 'СВ',
  fellowship: 'Общ.',
  influence: 'Вл.',
};

const EN_ABBR: Record<string, string> = {
  weaponSkill: 'WS',
  ballisticSkill: 'BS',
  strength: 'S',
  toughness: 'T',
  agility: 'Ag',
  intelligence: 'Int',
  perception: 'Per',
  willpower: 'WP',
  fellowship: 'Fel',
  influence: 'Ifl',
};

describe('dh1: подписи характеристик', () => {
  const prefix = 'dh1';
  const ru = dh1Ru as Record<string, string>;
  const en = dh1En as Record<string, string>;

  it('RU: полные названия из RU-листа', () => {
    for (const [key, value] of Object.entries(RU_FULL)) {
      expect(ru[`${prefix}.${key}`], `${prefix}.${key}`).toBe(value);
    }
  });

  it('RU/EN: сокращения из листа', () => {
    for (const [key, value] of Object.entries(RU_ABBR)) {
      expect(ru[`${prefix}.${key}Abbr`], `ru ${prefix}.${key}`).toBe(value);
    }
    for (const [key, value] of Object.entries(EN_ABBR)) {
      expect(en[`${prefix}.${key}Abbr`], `en ${prefix}.${key}`).toBe(value);
    }
  });

  it('пол: три варианта и подпись сохраняется текстом', () => {
    expect(ru[`${prefix}.genderMale`]).toBe('Мужской');
    expect(ru[`${prefix}.genderFemale`]).toBe('Женский');
    expect(ru[`${prefix}.genderUnspecified`]).toBe('Не определено');
    expect(en[`${prefix}.genderMale`]).toBe('Male');
    expect(en[`${prefix}.genderFemale`]).toBe('Female');
    expect(en[`${prefix}.genderUnspecified`]).toBe('Unspecified');
  });
});
