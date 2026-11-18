import { describe, expect, it } from 'vitest';

import { createDh2Defaults } from '@/games/dh2/defaults';
import { dh2CharacterSchema } from '@/games/dh2/schema';

/**
 * ─── LANDMARK: DH2 CREATION ───────────────────────────────────────────────
 * Редакционная специфика создания 2-й редакции: мир/бэкграунд/роль вместо
 * карьеры, Influence и пси-профиль, отсутствие полей других игр. Сквозной
 * поток «регистрация → POST → экспорт» проверяет хост (D18).
 */

describe('создание DH2: мир, роль и аптитюды в дефолтном листе', () => {
  it('лист создаётся с пустыми миром и ролью, пустые поля остаются пустыми', () => {
    const character = createDh2Defaults({ name: 'Name Only' });

    expect(character.name).toBe('Name Only');
    expect(character.homeWorld).toBe('');
    expect(character.background).toBe('');
    expect(character.role).toBe('');
    expect(character.characterClass).toBe('');
  });
});

describe('dh2: редакционные поля листа', () => {
  it('системные поля DH2 есть, полей других систем нет', () => {
    const character = createDh2Defaults({ name: 'Psyker' });

    for (const field of [
      'fatePoints',
      'statUpgrades',
      'wounds',
      'psy',
      'aptitudes',
      'background',
      'role',
    ]) {
      expect(character, `поле ${field} должно быть у DH2`).toHaveProperty(
        field,
      );
    }
    for (const field of [
      'spells',
      'savingThrows',
      'spellcastingEntries',
      'careerPath',
    ]) {
      expect(
        character,
        `поле ${field} не должно попадать в DH2`,
      ).not.toHaveProperty(field);
    }
  });

  it('Influence, опыт и пси-профиль сохраняют значения ввода', () => {
    const character = createDh2Defaults({
      name: 'Psyker',
      influence: 45,
      experience: 1500,
    });

    expect(character.stats.influence).toBe(45);
    expect(character.experience).toBe(1500);
    expect(character.psy).toEqual({ rating: 0, disciplines: [], powers: [] });
    expect(character.statUpgrades.influence).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('дефолтный лист проходит схему DH2', () => {
    const sheet = dh2CharacterSchema.parse({
      ...createDh2Defaults({ name: 'Psyker' }),
      id: 'fixture',
    });

    expect(sheet.id).toBe('fixture');
    expect(sheet.stats.influence).toBe(30);
    expect(sheet).not.toHaveProperty('careerPath');
  });
});
