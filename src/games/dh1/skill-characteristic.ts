import { splitSkillName } from '@/games/shared/skill-name';

import {
  DARK_HERESY_CORE_STATS,
  type CharacteristicCode,
  type Skill,
} from './types';

/**
 * ─── LANDMARK: SKILL CHARACTERISTIC ────────────────────────────────────────
 * Характеристика умения: поле `characteristic` у новых строк и разбор старого
 * суффикса названия `(Инт)` для показа. Модуль общий для секции умений и
 * Excel-экспорта, чтобы оба читали значение одинаково и не расходились.
 *
 * На чтении листа данные не переписываются: суффикс — только отображение.
 */

/** Коды характеристик в порядке бумажного листа: подписи — в словаре. */
export const CHARACTERISTICS: readonly CharacteristicCode[] =
  DARK_HERESY_CORE_STATS;

/**
 * Аббревиатуры, которыми характеристику писали в названии умения: русские и
 * английские сокращения, с точкой и без. Значение — код из `stats`.
 */
export const ABBR_TO_CODE: Record<string, CharacteristicCode> = {
  WS: 'weaponSkill',
  НР: 'weaponSkill',
  ББ: 'weaponSkill',
  BS: 'ballisticSkill',
  НС: 'ballisticSkill',
  ДБ: 'ballisticSkill',
  S: 'strength',
  С: 'strength',
  СЛ: 'strength',
  T: 'toughness',
  Вын: 'toughness',
  'Вын.': 'toughness',
  СТ: 'toughness',
  Ag: 'agility',
  AG: 'agility',
  Agi: 'agility',
  Лов: 'agility',
  'Лов.': 'agility',
  ЛВ: 'agility',
  Int: 'intelligence',
  INT: 'intelligence',
  Инт: 'intelligence',
  'Инт.': 'intelligence',
  ИН: 'intelligence',
  ИНТ: 'intelligence',
  Per: 'perception',
  PER: 'perception',
  Вос: 'perception',
  'Вос.': 'perception',
  ВП: 'perception',
  WP: 'willpower',
  СВ: 'willpower',
  Fel: 'fellowship',
  FEL: 'fellowship',
  Общ: 'fellowship',
  'Общ.': 'fellowship',
  ОБ: 'fellowship',
};

/**
 * Аббревиатура для колонки «Хар.». Ключ собирается из кода: характеристик
 * девять, и таблица подписей повторяла бы список кодов.
 */
export function characteristicLabel(
  code: string,
  t: (key: string) => string,
): string {
  const key = `dh1.${code}Abbr`;
  const text = t(key);
  return text === key ? code : text;
}

export interface ResolvedSkillCharacteristic {
  /** Название без суффикса, если суффикс — подпись характеристики. */
  name: string;
  /** Код из поля или из суффикса; null — характеристики нет. */
  code: CharacteristicCode | null;
  /** Текст в скобках в конце названия, если он похож на аббревиатуру. */
  suffix: string | null;
  /** Код выведен из названия, а не взят из поля. */
  fromName: boolean;
}

/**
 * Характеристика умения для показа: сначала поле, затем суффикс названия.
 * Неизвестный суффикс (`(Инв)`) кодом не считается — его показывают текстом.
 */
export function resolveSkillCharacteristic(
  skill: Pick<Skill, 'name' | 'characteristic'>,
): ResolvedSkillCharacteristic {
  const { name, suffix } = splitSkillName(skill.name);
  const stored = skill.characteristic as string | undefined;
  const parsed = suffix ? ABBR_TO_CODE[suffix] : undefined;
  // Код из файла может оказаться незнакомым (лист другой редакции): тип
  // доверяем полю, а подпись для неизвестного кода вернёт сам код.
  const code = (stored ?? parsed ?? null) as CharacteristicCode | null;
  return { name, code, suffix, fromName: !stored && Boolean(code) };
}

/**
 * Переносит характеристику из суффикса названия в поле — один раз, когда
 * игрок открывает правку секции. Неизвестный суффикс остаётся в названии:
 * угадывать код нельзя, а терять текст тем более.
 */
export function materializeSkills(skills: readonly Skill[]): Skill[] {
  return skills.map((skill) => {
    const { name, suffix } = splitSkillName(skill.name);
    const parsed = suffix ? ABBR_TO_CODE[suffix] : undefined;
    const code = skill.characteristic ?? parsed;
    if (!code || !suffix) return skill;
    return { ...skill, name, characteristic: code };
  });
}
