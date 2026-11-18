import { describe, expect, it } from 'vitest';

import { createDh1Defaults } from '@/games/dh1/defaults';
import { dh1CharacterSchema } from '@/games/dh1/schema';

/**
 * ─── LANDMARK: DH1 CREATION ───────────────────────────────────────────────
 * Редакционная специфика создания 1-й редакции: обязательного только имя,
 * свои поля листа (карьера, судьба, апгрейды) и отсутствие полей других игр.
 * Сквозной поток «регистрация → POST → экспорт» проверяет хост (D18).
 */

describe('создание DH1: только имя обязательно', () => {
  it('лист создаётся без мира и карьеры, пустые поля остаются пустыми', () => {
    const character = createDh1Defaults({ name: 'Name Only' });

    expect(character.name).toBe('Name Only');
    expect(character.homeWorld).toBe('');
    expect(character.careerPath).toBe('');
    expect(character.characterClass).toBe('');
    expect(character.rank).toBe('');
    expect(character.divination).toBe('');
  });
});

describe('dh1: редакционные поля листа', () => {
  it('системные поля DH1 есть, полей других систем нет', () => {
    const character = createDh1Defaults({ name: 'Lucius Varn' });

    for (const field of [
      'fatePoints',
      'statUpgrades',
      'careerPath',
      'wounds',
    ]) {
      expect(character, `поле ${field} должно быть у DH1`).toHaveProperty(
        field,
      );
    }
    for (const field of ['spells', 'savingThrows', 'spellcastingEntries']) {
      expect(
        character,
        `поле ${field} не должно попадать в DH1`,
      ).not.toHaveProperty(field);
    }
  });

  it('карьера, характеристики и судьба сохраняют значения ввода', () => {
    const character = createDh1Defaults({
      name: 'Lucius Varn',
      careerPath: 'Adept',
      homeWorld: 'Hive World',
      weaponSkill: 31,
      fatePoints: 2,
    });

    expect(character.careerPath).toBe('Adept');
    expect(character.characterClass).toBe('Adept');
    expect(character.homeWorld).toBe('Hive World');
    expect(character.stats.weaponSkill).toBe(31);
    expect(character.fatePoints).toEqual({ current: 2, max: 2 });
    // Influence — поле 2-й редакции, в dh1 его нет.
    expect('influence' in character.stats).toBe(false);
  });

  it('дефолтный лист проходит схему DH1', () => {
    const sheet = dh1CharacterSchema.parse({
      ...createDh1Defaults({ name: 'Lucius Varn', careerPath: 'Adept' }),
      id: 'fixture',
    });

    expect(sheet.id).toBe('fixture');
    expect(sheet.careerPath).toBe('Adept');
    expect(sheet).not.toHaveProperty('spells');
  });
});
