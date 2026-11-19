import { describe, expect, it } from 'vitest';

import { createDnd5eDefaults } from '@/games/dnd5e/defaults';
import { dnd5eCharacterSchema } from '@/games/dnd5e/schema';

/**
 * ─── LANDMARK: DND5E CREATION ─────────────────────────────────────────────
 * Редакционная специфика создания D&D 5e: spells/спасброски/списки заклинаний
 * есть, полей Dark Heresy нет. Сквозной поток «регистрация → POST → экспорт»
 * проверяет хост.
 */

describe('dnd5e: редакционные поля листа', () => {
  it('системные поля D&D есть, полей Dark Heresy нет', () => {
    const character = createDnd5eDefaults({ name: 'Seraphina Vael' });

    for (const field of [
      'spells',
      'savingThrows',
      'spellcastingEntries',
      'divineBoons',
    ]) {
      expect(character, `поле ${field} должно быть у D&D`).toHaveProperty(
        field,
      );
    }
    for (const field of ['fatePoints', 'statUpgrades', 'careerPath']) {
      expect(
        character,
        `поле ${field} не должно попадать в D&D`,
      ).not.toHaveProperty(field);
    }
  });

  it('опыт, уровень и характеристики сохраняют значения ввода', () => {
    const character = createDnd5eDefaults({
      name: 'Seraphina Vael',
      experiencePoints: 23000,
      intelligence: 18,
    });

    expect(character.level).toBe(7);
    expect(character.experiencePoints).toBe(23000);
    expect(character.stats.intelligence).toBe(18);
  });

  it('spells и спасброски проходят схему D&D', () => {
    const sheet = dnd5eCharacterSchema.parse({
      ...createDnd5eDefaults({
        name: 'Seraphina Vael',
        experiencePoints: 23000,
        intelligence: 18,
      }),
      id: 'fixture',
      spells: [
        { id: 'spell-1', name: 'Fireball', level: 3, notes: '8d6 fire' },
        { id: 'spell-2', name: 'Shield', level: 1, notes: '+5 AC' },
      ],
    });

    expect(sheet.id).toBe('fixture');
    expect(sheet.level).toBe(7);
    expect(sheet.stats.intelligence).toBe(18);
    expect(sheet.spells).toHaveLength(2);
    expect(sheet.savingThrows).toHaveLength(6);
    expect(sheet).not.toHaveProperty('fatePoints');
  });
});
