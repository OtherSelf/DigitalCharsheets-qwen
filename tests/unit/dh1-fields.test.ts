import { describe, expect, it } from 'vitest';

import { createDh1Defaults } from '@/games/dh1/defaults';
import { buildDh1PortableJson } from '@/games/dh1/export';
import { dh1CharacterSchema } from '@/games/dh1/schema';
import { DarkHeresyHomeWorlds } from '@/games/dh1/types';
import type { GameExportConfig } from '@/games/types';

import { makeDhCharacter } from './helpers';

/**
 * Полный лист 1e: `makeDhCharacter` — облегчённая заготовка миграций, в ней
 * нет обязательных полей базы (`characterClass`, `backstory`, `fatigue1st`…).
 */
function baseDh1(overrides: Record<string, unknown> = {}) {
  return {
    ...makeDhCharacter(overrides),
    characterClass: 'Adept',
    backstory: '',
    notes: '',
    questLog: [],
    worldVariant: '',
    divination: '',
    divinationEffect: '',
    quirk: '',
    height: '',
    weight: '',
    age: '',
    skinColor: '',
    hairColor: '',
    eyeColor: '',
    alternatePath: null,
    advancedPath: null,
    criticalConditions: [],
    fatigue1st: { current: 0 },
    ...overrides,
  };
}

/**
 * ─── LANDMARK: DH1 OPTIONAL FIELDS ────────────────────────────────────────
 * Поля DH1APP (идентичность, груз, черты, мутации, безумие/порча, пси,
 * Pen у стрелкового) добавлены аддитивно. Legacy-лист без них обязан
 * проходить схему без миграции, а заполненные блоки — сохраняться как есть.
 */
describe('DH1: аддитивные поля листа', () => {
  it('legacy-лист без новых блоков проходит схему', () => {
    const parsed = dh1CharacterSchema.parse(baseDh1());
    expect(parsed.identity).toBeUndefined();
    expect(parsed.psy).toBeUndefined();
    expect(parsed.traits).toBeUndefined();
  });

  it('сохраняет идентичность, груз, черты, мутации и элитные наборы', () => {
    const character = baseDh1({
      identity: {
        playerName: 'Анна',
        gender: 'Ж',
        build: 'Сухое',
        handedness: 'Правая',
      },
      carry: {
        totalCarriedWeight: '12 кг',
        carry: '27 кг',
        lift: '54 кг',
        push: '108 кг',
      },
      traits: [{ id: 't1', name: 'Железное Нутро' }],
      mutations: [{ id: 'm1', name: 'Третья рука', notes: 'Скрывает' }],
      eliteAdvances: [{ id: 'e1', name: 'Присяга Радикала' }],
    });
    const parsed = dh1CharacterSchema.parse(character);
    expect(parsed.identity?.playerName).toBe('Анна');
    expect(parsed.carry?.push).toBe('108 кг');
    expect(parsed.traits?.[0].name).toBe('Железное Нутро');
    expect(parsed.mutations?.[0].notes).toBe('Скрывает');
    expect(parsed.eliteAdvances?.[0].name).toBe('Присяга Радикала');
  });

  it('сохраняет пси-блок и детали безумия/порчи', () => {
    const character = baseDh1({
      psy: {
        rating: 2,
        discipline: 'Биомантия',
        powers: [{ id: 'p1', name: 'Очищение', threshold: '8' }],
        testedAgainst: 'Стойкость',
      },
      insanityDetails: {
        degree: '1',
        traumaModifier: '-10',
        disorders: 'Паранойя',
        severity: 'Лёгкая',
      },
      corruptionDetails: {
        degree: '0',
        test: '—',
        defilements: 'Нет',
      },
    });
    const parsed = dh1CharacterSchema.parse(character);
    expect(parsed.psy?.rating).toBe(2);
    expect(parsed.psy?.powers?.[0].threshold).toBe('8');
    expect(parsed.insanityDetails?.disorders).toBe('Паранойя');
    expect(parsed.corruptionDetails?.defilements).toBe('Нет');
  });

  it('принимает Pen и вес у стрелкового оружия и вес у доспехов', () => {
    const ranged = {
      id: 'r1',
      name: 'Лазган',
      type: 'Basic',
      range: '100',
      rof: 'S/2/-',
      damage: '1d10+3',
      penetration: '4',
      clip: 1,
      clipSize: 60,
      reload: 'Full',
      traits: 'Reliable',
      weight: '2,5 кг',
    };
    const character = baseDh1({
      equipment: {
        armor: {
          Head: null,
          'Right arm': null,
          'Left arm': null,
          'Right leg': null,
          'Left leg': null,
          Body: {
            ap: 4,
            type: 'Flak',
            mods: '',
            quality: 'Common',
            weight: '6 кг',
          },
        },
        weapons: { melee: [], ranged: [ranged] },
      },
    });
    const parsed = dh1CharacterSchema.parse(character);
    expect(parsed.equipment.weapons.ranged[0].penetration).toBe('4');
    expect(parsed.equipment.weapons.ranged[0].weight).toBe('2,5 кг');
    expect(parsed.equipment.armor.Body?.weight).toBe('6 кг');
  });

  it('принимает legacy-оружие без Pen и веса', () => {
    const legacy = {
      id: 'r1',
      name: 'Лазган',
      type: 'Basic',
      range: '100',
      rof: 'S/2/-',
      damage: '1d10+3',
      clip: 1,
      clipSize: 60,
      reload: 'Full',
      traits: 'Reliable',
    };
    const character = baseDh1({
      equipment: {
        armor: {
          Head: null,
          'Right arm': null,
          Body: null,
          'Left arm': null,
          'Right leg': null,
          'Left leg': null,
        },
        weapons: { melee: [], ranged: [legacy] },
      },
    });
    expect(() => dh1CharacterSchema.parse(character)).not.toThrow();
  });

  it('Псайкер начинает с Пси-рейтингом 1, остальные — без psy', () => {
    const psyker = createDh1Defaults({ careerPath: 'Imperial Psyker' });
    expect(psyker.psy?.rating).toBe(1);
    expect(psyker.psy?.powers).toEqual([]);
    const guardsman = createDh1Defaults({ careerPath: 'Guardsman' });
    expect(guardsman.psy).toBeUndefined();
  });

  it('принимает все восемь родных миров, включая IH', () => {
    for (const world of DarkHeresyHomeWorlds) {
      const character = baseDh1({ homeWorld: world });
      expect(() => dh1CharacterSchema.parse(character)).not.toThrow();
    }
  });
});

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

describe('DH1: новые блоки в JSON-экспорте', () => {
  it('экспортирует идентичность, пси, черты, мутации, безумие, порчу и груз', () => {
    const character = baseDh1({
      identity: { playerName: 'Анна', gender: 'Ж', build: 'Сухое' },
      traits: [{ id: 't1', name: 'Железное Нутро' }],
      mutations: [{ id: 'm1', name: 'Третья рука' }],
      eliteAdvances: [{ id: 'e1', name: 'Присяга Радикала' }],
      psy: { rating: 2, discipline: 'Биомантия', powers: [] },
      insanityDetails: { degree: '1' },
      corruptionDetails: { degree: '0' },
      carry: { push: '108 кг' },
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
        armorWeight: '6 кг',
      },
    });
    const exported = buildDh1PortableJson(
      character as never,
      EXPORT_ALL,
    ) as Record<string, { playerName?: string; armorWeight?: string }>;
    expect((exported.identity as { playerName?: string }).playerName).toBe(
      'Анна',
    );
    expect((exported.psy as { rating?: number }).rating).toBe(2);
    expect(Array.isArray(exported.traits)).toBe(true);
    expect((exported.insanityDetails as { degree?: string }).degree).toBe('1');
    expect((exported.corruptionDetails as { degree?: string }).degree).toBe(
      '0',
    );
    expect((exported.carry as { push?: string }).push).toBe('108 кг');
    expect((exported.equipment as { armorWeight?: string }).armorWeight).toBe(
      '6 кг',
    );
  });
});
