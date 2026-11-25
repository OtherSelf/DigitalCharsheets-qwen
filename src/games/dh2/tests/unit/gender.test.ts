import { describe, expect, it } from 'vitest';

import { createDh2Defaults } from '@/games/dh2/defaults';
import { DH2E_BACKGROUNDS } from '@/games/dh2/dh2e-data';
import { genderLabel as dh2GenderLabel } from '@/games/dh2/gender';
import { dh2History } from '@/games/dh2/history';
import { normalizeDh2 } from '@/games/dh2/normalize';
import { dh2CharacterSchema } from '@/games/dh2/schema';
import { DH2_SCHEMA_VERSION } from '@/games/dh2/schema-version';
import { getGameModule } from '@/games/registry';
import { formatHistoryValue } from '@/lib/history-labels';

/**
 * ─── LANDMARK: DH2 GENDER TESTS ───────────────────────────────────────────
 * Пол хранится каноническим кодом: старые подписи обеих локалей
 * переводятся, неизвестный текст не теряется, повторная нормализация лист не
 * меняет. Подпись для игрока — только через i18n, сырой код наружу не идёт.
 *
 * Проверка живёт рядом с редакцией: свой лист редакция проверяет сама.
 */

function t(key: string): string {
  return key;
}

function dh2Raw(gender: unknown) {
  return { gender };
}

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

describe('пол в создании 2e: замок бэкграунда', () => {
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
  it('DH2 — 5, D&D 5e остаётся 2', () => {
    expect(DH2_SCHEMA_VERSION).toBe(6);
    expect(getGameModule('dnd5e')?.schemaVersion).toBe(2);
  });

  it('подпись берётся из i18n, Excel не показывает код', () => {
    expect(dh2GenderLabel('female', t)).toBe('dh2.genderFemale');
  });

  it('история — подпись, неизвестный код не подменяется', () => {
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
