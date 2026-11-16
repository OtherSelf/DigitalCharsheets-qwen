import { describe, expect, it } from 'vitest';

import dh1En from '@/games/dh1/i18n/en.json';
import dh1Ru from '@/games/dh1/i18n/ru.json';
import dh2En from '@/games/dh2/i18n/en.json';
import dh2Ru from '@/games/dh2/i18n/ru.json';

/**
 * ─── LANDMARK: DH RU SHEET LABELS TESTS ───────────────────────────────────
 * Подписи характеристик и их сокращения в RU-словарях сверены с новым
 * RU-листом DH2e (`books/dh2/ru/.../dh2-sheet-fillable-ru`). Тест не даёт
 * молча вернуть старые «ББ/ДБ/СЛ» или «Навык оружия».
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

describe.each([
  ['dh1', dh1Ru, dh1En],
  ['dh2', dh2Ru, dh2En],
] as const)('%s: подписи характеристик', (prefix, ruJson, enJson) => {
  const ru = ruJson as Record<string, string>;
  const en = enJson as Record<string, string>;

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

  it('DH2: четыре термина из RU-листа', () => {
    if (prefix !== 'dh2') return;
    expect(ru['dh2.aptitudes']).toBe('Склонности');
    expect(ru['dh2.skills']).toBe('Умения');
    expect(ru['dh2.eliteAdvances']).toBe('Элитные улучшения');
    expect(ru['dh2.fatePoints']).toBe('Судьба');
  });

  it('DH2: четыре навыка исправлены по RU-листу', () => {
    if (prefix !== 'dh2') return;
    expect(ru['dh2.catalog.skill.awareness']).toBe('Бдительность');
    expect(ru['dh2.catalog.skill.commerce']).toBe('Коммерция');
    expect(ru['dh2.catalog.skill.scholastic-lore']).toBe('Учёное Знание');
    expect(ru['dh2.catalog.skill.tech-use']).toBe('Техпользование');
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
