import { describe, expect, it } from 'vitest';

import {
  applyCharacterDerive,
  isServerDeriveEnabled,
  SERVER_DERIVE_FLAG,
} from '@/lib/character-derive';

/**
 * ─── LANDMARK: SERVER DERIVE FLAG ─────────────────────────────────────────
 * Пересчёт производных на сервере — за флагом: включение меняет сохранённые
 * данные пользователей, поэтому дефолт выключен, а «непонятное значение»
 * трактуется как выключено.
 */

function dndSheet(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'char-1',
    systemId: 'dnd5e',
    schemaVersion: 2,
    level: 5,
    proficiencyBonus: 99,
    stats: {
      strength: 20,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    savingThrows: [
      { name: 'Strength', proficient: false, value: 0 },
      { name: 'Dexterity', proficient: true, value: 0 },
    ],
    skills: [
      {
        name: 'athletics',
        label: 'Athletics (Str)',
        proficient: false,
        expertise: false,
        value: 0,
      },
    ],
    ...overrides,
  };
}

describe('флаг серверного пересчёта', () => {
  it('по умолчанию выключен', () => {
    expect(isServerDeriveEnabled({})).toBe(false);
    expect(isServerDeriveEnabled({ [SERVER_DERIVE_FLAG]: '0' })).toBe(false);
    expect(isServerDeriveEnabled({ [SERVER_DERIVE_FLAG]: 'yes' })).toBe(false);
  });

  it('включается только явными значениями', () => {
    expect(isServerDeriveEnabled({ [SERVER_DERIVE_FLAG]: '1' })).toBe(true);
    expect(isServerDeriveEnabled({ [SERVER_DERIVE_FLAG]: 'true' })).toBe(true);
  });
});

describe('applyCharacterDerive', () => {
  it('при выключенном флаге возвращает документ как есть', () => {
    const input = dndSheet();
    const output = applyCharacterDerive(input, { env: {} });
    expect(output.proficiencyBonus).toBe(99);
    expect(output).not.toBe(input);
  });

  it('при включённом флаге пересчитывает производные', () => {
    const output = applyCharacterDerive(dndSheet(), {
      env: { [SERVER_DERIVE_FLAG]: '1' },
    });
    expect(output.proficiencyBonus).toBe(3);
    const saves = output.savingThrows as { name: string; value: number }[];
    expect(saves.find((save) => save.name === 'Strength')?.value).toBe(5);
    expect(saves.find((save) => save.name === 'Dexterity')?.value).toBe(3);
    const skills = output.skills as { name: string; value: number }[];
    expect(skills.find((skill) => skill.name === 'athletics')?.value).toBe(5);
  });

  it('не трогает документ неизвестной редакции и не мутирует вход', () => {
    const unknown = dndSheet({ systemId: 'unknown-system' });
    const output = applyCharacterDerive(unknown, {
      env: { [SERVER_DERIVE_FLAG]: '1' },
    });
    expect(output.proficiencyBonus).toBe(99);

    const input = dndSheet();
    const snapshot = JSON.stringify(input);
    applyCharacterDerive(input, { env: { [SERVER_DERIVE_FLAG]: '1' } });
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
