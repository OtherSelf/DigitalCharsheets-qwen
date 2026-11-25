import { describe, expect, it } from 'vitest';

import { createDh2Defaults } from '@/games/dh2/defaults';
import dh2En from '@/games/dh2/i18n/en.json';
import dh2Ru from '@/games/dh2/i18n/ru.json';
import { dh2CharacterSchema } from '@/games/dh2/schema';
import {
  characteristicLabel,
  CHARACTERISTICS,
  materializeSkills,
  resolveSkillCharacteristic,
} from '@/games/dh2/skill-characteristic';
import type { DH2Character, Skill } from '@/games/dh2/types';

/**
 * ─── LANDMARK: DH2 SKILL CHARACTERISTIC TESTS ─────────────────────────────
 * Та же механика, что в 1e, плюс `influence`: вторая редакция заменила
 * богатство влиянием, и умения на него ссылаются.
 */

const RU: Record<string, string> = dh2Ru;
const EN: Record<string, string> = dh2En;

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

describe('характеристика умения dh2', () => {
  it('набор кодов включает влияние', () => {
    expect(CHARACTERISTICS).toContain('influence');
    expect(CHARACTERISTICS).toHaveLength(10);
  });

  it('у каждой характеристики есть аббревиатура в обеих локалях', () => {
    for (const code of CHARACTERISTICS) {
      const key = `dh2.${code}Abbr`;
      expect(RU[key], `ru: ${key}`).toBeTruthy();
      expect(EN[key], `en: ${key}`).toBeTruthy();
    }
  });

  it('суффикс влияния распознаётся как код', () => {
    const resolved = resolveSkillCharacteristic(
      skill({ name: 'Дознание (Вл)' }),
    );
    expect(resolved).toMatchObject({
      name: 'Дознание',
      code: 'influence',
      fromName: true,
    });
  });

  it('составное название сохраняет свои скобки', () => {
    const resolved = resolveSkillCharacteristic(
      skill({ name: 'Навигация (Звёздная) (Инт)' }),
    );
    expect(resolved.name).toBe('Навигация (Звёздная)');
    expect(resolved.code).toBe('intelligence');
  });

  it('правка переносит суффикс в поле', () => {
    const [materialized] = materializeSkills([skill({ name: 'Логика (Инт)' })]);
    expect(materialized).toMatchObject({
      name: 'Логика',
      characteristic: 'intelligence',
    });
  });

  it('незнакомый код не валит схему, но и не сохраняется', () => {
    const base = createDh2Defaults();
    const parsed: DH2Character = dh2CharacterSchema.parse({
      ...base,
      id: 'dh2-skill-field',
      skills: [skill({ characteristic: 'psychic' as never })],
    });
    expect(parsed.skills?.[0].characteristic).toBeUndefined();
  });

  it('код влияния переживает разбор схемы', () => {
    const base = createDh2Defaults();
    const parsed: DH2Character = dh2CharacterSchema.parse({
      ...base,
      id: 'dh2-skill-influence',
      skills: [skill({ name: 'Дознание', characteristic: 'influence' })],
    });
    expect(parsed.skills?.[0].characteristic).toBe('influence');
    expect(characteristicLabel('influence', translate(EN))).toBe('Ifl');
  });
});
