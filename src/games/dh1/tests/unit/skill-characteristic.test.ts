import { describe, expect, it } from 'vitest';

import { createDh1Defaults } from '@/games/dh1/defaults';
import dh1En from '@/games/dh1/i18n/en.json';
import dh1Ru from '@/games/dh1/i18n/ru.json';
import { dh1CharacterSchema } from '@/games/dh1/schema';
import {
  characteristicLabel,
  CHARACTERISTICS,
  materializeSkills,
  resolveSkillCharacteristic,
} from '@/games/dh1/skill-characteristic';
import type { DH1Character, Skill } from '@/games/dh1/types';

/**
 * ─── LANDMARK: DH1 SKILL CHARACTERISTIC TESTS ─────────────────────────────
 * Характеристика умения: новое поле `characteristic`, показ старого суффикса
 * названия и перенос суффикса в поле при правке. Проверяем главное свойство —
 * чтение листа ничего не переписывает, а данные не теряются.
 */

const RU: Record<string, string> = dh1Ru;
const EN: Record<string, string> = dh1En;

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'skill-1',
    name: 'Акробатика',
    notes: '',
    type: 'basic',
    training: { skilled: false, plus10: false, plus20: false, plus30: false },
    ...overrides,
  };
}

function translate(dictionary: Record<string, string>) {
  return (key: string) => dictionary[key] ?? key;
}

describe('характеристика умения dh1', () => {
  it('у каждой характеристики есть аббревиатура в обеих локалях', () => {
    for (const code of CHARACTERISTICS) {
      const key = `dh1.${code}Abbr`;
      expect(RU[key], `ru: ${key}`).toBeTruthy();
      expect(EN[key], `en: ${key}`).toBeTruthy();
    }
  });

  it('поле важнее суффикса названия', () => {
    const resolved = resolveSkillCharacteristic(
      skill({ name: 'Акробатика (Инт)', characteristic: 'agility' }),
    );
    expect(resolved).toMatchObject({
      name: 'Акробатика',
      code: 'agility',
      suffix: 'Инт',
      fromName: false,
    });
  });

  it('у старой строки код выводится из суффикса и помечается как «из названия»', () => {
    const resolved = resolveSkillCharacteristic(
      skill({ name: 'Логика (Инт.)' }),
    );
    expect(resolved).toMatchObject({
      name: 'Логика',
      code: 'intelligence',
      suffix: 'Инт.',
      fromName: true,
    });
    expect(characteristicLabel(resolved.code ?? '', translate(RU))).toBe(
      'Инт.',
    );
  });

  it('неизвестный суффикс остаётся текстом, а не выдуманным кодом', () => {
    const resolved = resolveSkillCharacteristic(
      skill({ name: 'Ритуал (Инв)' }),
    );
    expect(resolved).toMatchObject({ code: null, suffix: 'Инв' });
    expect(resolved.name).toBe('Ритуал');
  });

  it('название без суффикса и поля не даёт характеристики', () => {
    expect(resolveSkillCharacteristic(skill())).toMatchObject({
      code: null,
      suffix: null,
      fromName: false,
    });
  });

  it('правка переносит суффикс в поле и очищает имя один раз', () => {
    const source = [
      skill({ id: 'a', name: 'Логика (Инт)' }),
      skill({ id: 'b', name: 'Язык (Низкий Готик)' }),
      skill({ id: 'c', name: 'Ритуал (Инв)' }),
    ];
    const materialized = materializeSkills(source);

    expect(materialized[0]).toMatchObject({
      name: 'Логика',
      characteristic: 'intelligence',
    });
    expect(materialized[1]).toEqual(source[1]);
    expect(materialized[2]).toEqual(source[2]);
    expect(materializeSkills(materialized)).toEqual(materialized);
  });

  it('схема принимает поле и терпит незнакомый код', () => {
    const base = createDh1Defaults();
    const withCharacteristic = dh1CharacterSchema.parse({
      ...base,
      id: 'dh1-skill-field',
      skills: [skill({ characteristic: 'agility' })],
    });

    expect(withCharacteristic.skills?.[0].characteristic).toBe('agility');

    const foreignCode = dh1CharacterSchema.parse({
      ...base,
      id: 'dh1-skill-foreign',
      skills: [skill({ characteristic: 'influence' as never })],
    });
    expect(foreignCode.skills?.[0].characteristic).toBeUndefined();
  });

  it('старый экспорт без поля остаётся валидным', () => {
    const base = createDh1Defaults();
    const parsed: DH1Character = dh1CharacterSchema.parse({
      ...base,
      id: 'dh1-skill-legacy',
      skills: [skill({ name: 'Awareness (Per)' })],
    });
    expect(parsed.skills?.[0].characteristic).toBeUndefined();
  });
});
