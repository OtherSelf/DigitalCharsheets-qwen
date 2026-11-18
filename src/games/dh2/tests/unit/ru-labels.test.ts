import { describe, expect, it } from 'vitest';

import dh2En from '@/games/dh2/i18n/en.json';
import dh2Ru from '@/games/dh2/i18n/ru.json';

/**
 * ─── LANDMARK: DH2 RU SHEET LABELS TESTS ─────────────────────────────────
 * Подписи характеристик, сокращения и термины в RU/EN-словарях 2e сверены с
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

describe('dh2: подписи характеристик', () => {
  const prefix = 'dh2';
  const ru = dh2Ru as Record<string, string>;
  const en = dh2En as Record<string, string>;

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
    expect(ru['dh2.aptitudes']).toBe('Склонности');
    expect(ru['dh2.skills']).toBe('Умения');
    expect(ru['dh2.eliteAdvances']).toBe('Элитные улучшения');
    // D13: счётчик на листе — «Очки судьбы», «Судьба» осталась синонимом
    // для `dh2.fate` (форма создания и порог).
    expect(ru['dh2.fatePoints']).toBe('Очки судьбы');
    expect(ru['dh2.fate']).toBe('Судьба');
  });

  it('DH2: пророчества дословно по таблице 2-9', () => {
    const labels = Object.keys(ru).filter((key) =>
      /^dh2\.catalog\.divination\.d100-\d+$/.test(key),
    );
    expect(labels).toHaveLength(25);
    expect(ru['dh2.catalog.divination.d100-02']).toBe('Верь своему страху.');
    expect(ru['dh2.catalog.divination.d100-02.effect']).toBe(
      'Повысьте Восприятие персонажа на +5 и дайте ему ментальное расстройство Фобия (см. стр. 352).',
    );
  });

  it('DH2: психосилы и дисциплины по RU-книге', () => {
    expect(ru['dh2.catalog.power.winding-fate']).toBe('Виток Судьбы');
    expect(ru['dh2.catalog.power.iron-arm']).toBe('Железная Плоть');
    expect(ru['dh2.catalog.power.assail']).toBe('Швыряние');
    expect(ru['dh2.catalog.discipline.telekinesis']).toBe('Телекинез');
  });

  it('DH2: 19 склонностей и 3 элитных улучшения', () => {
    expect(ru['dh2.catalog.aptitude.defence']).toBe('Защита');
    expect(ru['dh2.catalog.aptitude.offence']).toBe('Нападение');
    expect(ru['dh2.catalog.aptitude.tech']).toBe('Техно');
    expect(ru['dh2.catalog.aptitude.knowledge']).toBe('Познание');
    expect(ru['dh2.catalog.aptitude.fieldcraft']).toBe('Полевое');
    expect(ru['dh2.catalog.aptitude.social']).toBe('Общение');
    expect(ru['dh2.catalog.aptitude.weapon-skill']).toBe('Навык Рукопашной');
    expect(ru['dh2.catalog.elite.inquisitor']).toBe('Инквизитор');
    expect(ru['dh2.catalog.elite.psyker']).toBe('Псайкер');
    expect(ru['dh2.catalog.elite.untouchable']).toBe('Неприкасаемый');
  });

  it('DH2: подсказки 20 талантов, видимых в создании', () => {
    const hints = Object.keys(ru).filter((key) =>
      /^dh2\.catalog\.talent\..+\.hint$/.test(key),
    );
    expect(hints).toHaveLength(20);
    expect(ru['dh2.catalog.talent.catfall']).toBe('Мягкое Приземление');
    expect(ru['dh2.catalog.talent.catfall.hint']).toBe(
      'Уменьшает урон от падения.',
    );
    expect(ru['dh2.catalog.talent.weapon-training']).toBe('Выучка с Оружием');
  });

  it('DH2: четыре навыка исправлены по RU-листу', () => {
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
