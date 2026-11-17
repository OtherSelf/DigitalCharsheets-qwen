import { describe, expect, it } from 'vitest';

import { createDh1Defaults } from '@/games/dh1/defaults';
import { buildDh1ExcelSections } from '@/games/dh1/excel';
import { buildDh1PortableJson } from '@/games/dh1/export';
import { genderLabel as dh1GenderLabel } from '@/games/dh1/gender';
import { dh1History } from '@/games/dh1/history';
import { normalizeDh1 } from '@/games/dh1/normalize';
import { dh1CharacterSchema } from '@/games/dh1/schema';
import { DH1_SCHEMA_VERSION } from '@/games/dh1/schema-version';
import type { DH1Character } from '@/games/dh1/types';
import { createDh2Defaults } from '@/games/dh2/defaults';
import { DH2E_BACKGROUNDS } from '@/games/dh2/dh2e-data';
import { genderLabel as dh2GenderLabel } from '@/games/dh2/gender';
import { dh2History } from '@/games/dh2/history';
import { normalizeDh2 } from '@/games/dh2/normalize';
import { dh2CharacterSchema } from '@/games/dh2/schema';
import { DH2_SCHEMA_VERSION } from '@/games/dh2/schema-version';
import { getGameModule } from '@/games/registry';
import type { GameExportConfig } from '@/games/types';
import { formatHistoryValue } from '@/lib/history-labels';

/**
 * ─── LANDMARK: DH GENDER TESTS ─────────────────────────────────────────────
 * Пол хранится каноническим кодом (D3): старые подписи обеих локалей
 * переводятся, неизвестный текст не теряется, повторная нормализация лист не
 * меняет. Подпись для игрока — только через i18n, сырой код наружу не идёт.
 */

const EXPORT_ALL: GameExportConfig = {
  includeBasicInfo: true,
  includeStats: true,
  includeCombat: true,
  includeEquipment: true,
  includeInventory: true,
  includeSpells: true,
  includeNarrative: true,
  includeProgression: true,
  includeCompanions: true,
  includeQuestLog: true,
  includeCustomHouseRules: true,
};

function t(key: string): string {
  return key;
}

function dh1Raw(gender: unknown) {
  return { identity: { gender } };
}

function dh2Raw(gender: unknown) {
  return { gender };
}

describe('DH1: миграция пола в канонический код', () => {
  it('переводит подписи RU/EN и сокращения', () => {
    const cases: [string, string][] = [
      ['Мужской', 'male'],
      ['Мужчина', 'male'],
      ['М', 'male'],
      ['Male', 'male'],
      ['m', 'male'],
      ['Женский', 'female'],
      ['Женщина', 'female'],
      ['Ж', 'female'],
      ['Female', 'female'],
      ['f', 'female'],
      ['Не указан', 'unspecified'],
      ['Не указано', 'unspecified'],
      ['Не определено', 'unspecified'],
      ['Unspecified', 'unspecified'],
    ];
    for (const [source, expected] of cases) {
      const { character } = normalizeDh1(dh1Raw(source));
      expect(character.identity?.gender, source).toBe(expected);
    }
  });

  it('оставляет код как есть и пустое значение пустым', () => {
    expect(normalizeDh1(dh1Raw('female')).character.identity?.gender).toBe(
      'female',
    );
    expect(normalizeDh1(dh1Raw('')).character.identity?.gender).toBe('');
    expect(normalizeDh1({}).character.identity).toBeUndefined();
  });

  it('неизвестный текст становится unspecified и сохраняется в notes', () => {
    const { character, warnings } = normalizeDh1(dh1Raw('  небинарный  '));
    expect(character.identity?.gender).toBe('unspecified');
    expect(character.notes).toContain('[gender migration] пол: небинарный');
    expect((warnings ?? []).join(' ')).toContain('не распознан');
  });

  it('повторный прогон не дублирует notes и не меняет лист', () => {
    const first = normalizeDh1(dh1Raw('небинарный'));
    const second = normalizeDh1({
      ...(first.character as unknown as Record<string, unknown>),
    });
    expect(second.character.identity?.gender).toBe('unspecified');
    const notes = String(second.character.notes);
    expect(notes.match(/\[gender migration\]/g)).toHaveLength(1);
  });
});

describe('DH2: миграция пола в канонический код', () => {
  it('переводит подписи и оставляет код как есть', () => {
    expect(normalizeDh2(dh2Raw('Женский')).character.gender).toBe('female');
    expect(normalizeDh2(dh2Raw('Male')).character.gender).toBe('male');
    expect(normalizeDh2(dh2Raw('female')).character.gender).toBe('female');
    expect(normalizeDh2(dh2Raw('')).character.gender).toBe('');
    expect(normalizeDh2({}).character.gender).toBe('');
  });

  it('неизвестный текст становится unspecified и сохраняется в notes', () => {
    const { character, warnings } = normalizeDh2(dh2Raw('male-ish'));
    expect(character.gender).toBe('unspecified');
    expect(character.notes).toContain('[gender migration] пол: male-ish');
    expect((warnings ?? []).join(' ')).toContain('не распознан');
  });

  it('повторный прогон идемпотентен', () => {
    const first = normalizeDh2(dh2Raw('небинарный'));
    const second = normalizeDh2({
      ...(first.character as unknown as Record<string, unknown>),
    });
    expect(
      String(second.character.notes).match(/\[gender migration\]/g),
    ).toHaveLength(1);
  });
});

describe('схемы: в данных только код', () => {
  it('dh1 принимает код и отклоняет подпись', () => {
    const draft = createDh1Defaults({ name: 'A', gender: 'female' });
    expect(dh1CharacterSchema.safeParse({ ...draft, id: 'x' }).success).toBe(
      true,
    );
    expect(
      dh1CharacterSchema.safeParse({
        ...draft,
        id: 'x',
        identity: { gender: 'Женский' },
      }).success,
    ).toBe(false);
  });

  it('dh2 принимает код и отклоняет подпись', () => {
    const draft = createDh2Defaults({ name: 'B', gender: 'male' });
    expect(dh2CharacterSchema.safeParse({ ...draft, id: 'y' }).success).toBe(
      true,
    );
    expect(
      dh2CharacterSchema.safeParse({ ...draft, id: 'y', gender: 'Мужской' })
        .success,
    ).toBe(false);
  });
});

describe('пол в создании 2e: замок бэкграунда (D4)', () => {
  it('Адептус Сороритас требует female, остальные бэкграунды пол не задают', () => {
    const sororitas = DH2E_BACKGROUNDS.find(
      (background) => background.id === 'adepta-sororitas',
    );
    expect(sororitas?.genderLock).toBe('female');

    const unconstrained = DH2E_BACKGROUNDS.filter(
      (background) => background.id !== 'adepta-sororitas',
    );
    expect(unconstrained.every((background) => !background.genderLock)).toBe(
      true,
    );
  });
});

describe('версия схемы и отображение', () => {
  it('DH1/DH2 — 5, D&D 5e остаётся 2', () => {
    expect(DH1_SCHEMA_VERSION).toBe(5);
    expect(DH2_SCHEMA_VERSION).toBe(5);
    expect(getGameModule('dnd5e')?.schemaVersion).toBe(2);
  });

  it('подпись берётся из i18n, Excel не показывает код', () => {
    expect(dh1GenderLabel('male', t)).toBe('dh1.genderMale');
    expect(dh1GenderLabel('female', t)).toBe('dh1.genderFemale');
    expect(dh1GenderLabel('unspecified', t)).toBe('dh1.genderUnspecified');
    expect(dh1GenderLabel('', t)).toBe('');
    expect(dh2GenderLabel('female', t)).toBe('dh2.genderFemale');

    const character = {
      ...createDh1Defaults({ name: 'A', gender: 'female' }),
      id: 'sheet-1',
    } as unknown as DH1Character;
    const sections = buildDh1ExcelSections(character, EXPORT_ALL, t);
    const genderRow = sections
      .flatMap((section) => section.rows)
      .find((row) => String(row[0]).trim() === 'dh1.gender');
    expect(genderRow?.[1]).toBe('dh1.genderFemale');
  });

  it('портируемый JSON хранит код, история — подпись', () => {
    const character = {
      ...createDh1Defaults({ name: 'A', gender: 'female' }),
      id: 'sheet-1',
    } as unknown as DH1Character;
    const exported = buildDh1PortableJson(character, EXPORT_ALL) as {
      identity?: { gender?: string };
    };
    expect(exported.identity?.gender).toBe('female');

    expect(
      formatHistoryValue(
        { value: 'female' },
        { config: dh1History, path: 'identity.gender', t },
      ),
    ).toBe('dh1.genderFemale');
    expect(
      formatHistoryValue(
        { value: 'male' },
        { config: dh2History, path: 'gender', t },
      ),
    ).toBe('dh2.genderMale');
    // Неизвестный код не подменяется: лучше показать данные, чем пустоту.
    expect(
      formatHistoryValue(
        { value: 'other' },
        { config: dh2History, path: 'gender', t },
      ),
    ).toBe('other');
  });
});
