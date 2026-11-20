/**
 * Минимальные валидные персонажи для тестов хоста.
 *
 * Поля намеренно неполные: хранилище и роуты принимают такой минимум, а
 * конкретный сценарий добавляет нужное через `overrides`. Игровые фикстуры
 * (с содержательными значениями) живут в `src/games/<id>/tests/fixtures/`.
 *
 * `makeCharacter(systemId)` — предпочтительный способ для нового теста: он
 * берёт лист у самого плагина (`createDemo`), поэтому не знает полей игр и
 * не ломается при удалении или добавлении редакции. Старые фабрики конкретных
 * редакций остались ради существующих сценариев и постепенно заменяются
 * (храповик — `GAME_MENTION_ALLOWANCE` в
 * `scripts/tests/check-test-layout.mjs`).
 */

import { getGamePlugin, listGamePlugins } from '@/games/registry';
import type { SystemId } from '@/games/types';

/**
 * Валидный лист любой зарегистрированной редакции: поля берутся из
 * `createDemo()` плагина, хост добавляет только служебные `id`/`userId`.
 *
 * @throws если такого плагина нет в сборке — тест должен падать явно, а не
 *   проверять пустой объект
 */
export function makeCharacter(
  systemId: string,
  overrides: Record<string, any> = {},
): any {
  const entry = getGamePlugin(systemId as SystemId);
  if (!entry) {
    throw new Error(`makeCharacter: нет плагина ${systemId} в сборке`);
  }
  return {
    ...entry.module.createDemo(),
    id: `${systemId}-fixture`,
    userId: 'user-test',
    systemId,
    ...overrides,
  };
}

/** Незамысловатый D&D-персонаж — минимум, который принимает хранилище. */
export function makeDndCharacter(overrides: Record<string, any> = {}): any {
  return {
    id: 'dnd-1',
    userId: 'user-test',
    gameSystem: 'Dungeons & Dragons',
    name: 'Ragnar Testborn',
    characterClass: 'Fighter',
    level: 3,
    race: 'Human',
    background: 'Soldier',
    alignment: 'Lawful Good',
    proficiencyBonus: 2,
    stats: {
      strength: 16,
      dexterity: 12,
      constitution: 14,
      intelligence: 10,
      wisdom: 11,
      charisma: 9,
    },
    hitPoints: { current: 24, max: 28 },
    armorClass: 17,
    skills: [],
    equipment: [],
    inventory: [],
    spells: [],
    questLog: [],
    customHouseRules: [],
    ...overrides,
  };
}

/** Незамысловатый персонаж Dark Heresy. */
export function makeDhCharacter(overrides: Record<string, any> = {}): any {
  return {
    id: 'dh-1',
    userId: 'user-test',
    // Дискриминант редакции: без него лист DH не разрешается (ADR 0004).
    systemId: 'dh1',
    gameSystem: 'Dark Heresy',
    name: 'Acolyte Vex',
    careerPath: 'Adept',
    homeWorld: 'Hive World',
    rank: 'Acolyte',
    statUpgrades: {
      weaponSkill: [false, false, false, false],
      ballisticSkill: [false, false, false, false],
      strength: [false, false, false, false],
      toughness: [false, false, false, false],
      agility: [false, false, false, false],
      intelligence: [false, false, false, false],
      perception: [false, false, false, false],
      willpower: [false, false, false, false],
      fellowship: [false, false, false, false],
      influence: [false, false, false, false],
    },
    statNotes: {},
    stats: {
      weaponSkill: 30,
      ballisticSkill: 35,
      strength: 30,
      toughness: 30,
      agility: 32,
      intelligence: 40,
      perception: 33,
      willpower: 31,
      fellowship: 28,
      influence: 5,
    },
    wounds: { current: 10, max: 10, notes: '' },
    fatePoints: { current: 1, max: 1, notes: '' },
    insanityPoints: { total: 0, notes: '' },
    corruptionPoints: { total: 0, notes: '' },
    movement: { walkHalf: 3, walkFull: 6, charge: 9, run: 18 },
    experience: 0,
    totalExpSpent: 0,
    equipment: {
      armor: {
        Head: null,
        'Right arm': null,
        Body: null,
        'Left arm': null,
        'Right leg': null,
        'Left leg': null,
      },
      weapons: { melee: [], ranged: [] },
    },
    inventory: [],
    wealth: { throneGelt: 0, monthlyIncome: 0 },
    skills: [],
    talents: [],
    questLog: [],
    customHouseRules: [],
    ...overrides,
  };
}

/** Есть ли плагин в этой сборке (редакцию могли удалить из репозитория). */
export function hasPlugin(systemId: string): boolean {
  return getGamePlugin(systemId as SystemId) !== undefined;
}

/** Идентификаторы плагинов текущей сборки — для итерации без списка игр. */
export function pluginIds(): string[] {
  return listGamePlugins().map((entry) => entry.manifest.id);
}
