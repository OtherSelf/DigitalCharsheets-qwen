import { describe, expect, it } from 'vitest';

import {
  rankForCharacter,
  rankStateForCharacter,
} from '@/games/dh1/dark-heresy-ranks';
import { createDh1Defaults } from '@/games/dh1/defaults';
import { buildDh1PortableJson } from '@/games/dh1/export';
import { dh1History } from '@/games/dh1/history';
import { migrateDh1V8toV9 } from '@/games/dh1/migrations';
import { normalizeDh1 } from '@/games/dh1/normalize';
import { dh1CharacterSchema } from '@/games/dh1/schema';
import { getGameModule } from '@/games/registry';
import type { GameExportConfig } from '@/games/types';
import { normalizeCharacterRecord } from '@/lib/character-version';
import { translations } from '@/lib/i18n';

/**
 * ─── LANDMARK: DH1 RANK CHOICES ──────────────────────────────────────────
 * Выбор развилки — одна запись `rankChoices`: id узла-развилки → id
 * выбранного узла. Старые `advancedPath`/`alternatePath` остаются в документе
 * для прежнего экспорта, но читаются только через миграцию v9.
 *
 * Здесь же проверяется поведение выбора: стандарт по умолчанию, запирание,
 * сохранение выбора при падении опыта и отказ от устаревшей альтернативы.
 */

const SCHOLAR = 'dh1/core/rank/adept-scholar';
const SCRIBE = 'dh1/core/rank/adept-scribe';
const INDITOR = 'dh1/core/rank/adept-inditor';
const CHIRURGEON = 'dh1/core/rank/adept-chirurgeon';
const COMPTROLLER = 'dh1/core/rank/adept-comptroller';
const LEXOGRAPHER = 'dh1/core/rank/adept-lexographer';
const VETERAN = 'dh1/core/rank/guardsman-veteran';
const SCOUT = 'dh1/core/rank/guardsman-scout';

const EXPORT_PROGRESSION: GameExportConfig = {
  includeBasicInfo: false,
  includeStats: false,
  includeCombat: false,
  includeEquipment: false,
  includeInventory: false,
  includeSpells: false,
  includeNarrative: false,
  includeProgression: true,
  includeCompanions: false,
  includeQuestLog: false,
  includeCustomHouseRules: false,
};

function sheet(overrides: Record<string, unknown> = {}) {
  return {
    ...createDh1Defaults({ careerPath: 'Adept' }),
    id: 'dh1-choices',
    userId: 'user-test',
    schemaVersion: 8,
    ...overrides,
  } as unknown as Record<string, unknown>;
}

describe('DH1 v8 → v9: выборы развилок', () => {
  it('advancedPath переносится в rankChoices, legacy-поле остаётся', () => {
    const next = migrateDh1V8toV9(sheet({ advancedPath: 'Comptroller' }), []);

    expect(next.rankChoices).toEqual({ [SCHOLAR]: COMPTROLLER });
    expect(next.advancedPath).toBe('Comptroller');
  });

  it('alternatePath переносится в rankChoices', () => {
    const next = migrateDh1V8toV9(sheet({ alternatePath: 'Chirurgeon' }), []);

    expect(next.rankChoices).toEqual({ [SCRIBE]: CHIRURGEON });
    expect(next.alternatePath).toBe('Chirurgeon');
  });

  it('оба выбора живут в одной карте', () => {
    const next = migrateDh1V8toV9(
      sheet({ advancedPath: 'Comptroller', alternatePath: 'Chirurgeon' }),
      [],
    );

    expect(next.rankChoices).toEqual({
      [SCRIBE]: CHIRURGEON,
      [SCHOLAR]: COMPTROLLER,
    });
  });

  it('без выбранных путей карта пустая', () => {
    expect(migrateDh1V8toV9(sheet(), []).rankChoices).toEqual({});
  });

  it('неизвестное имя ветки игнорируется', () => {
    expect(
      migrateDh1V8toV9(
        sheet({ advancedPath: 'Нет такого пути', alternatePath: 'Нет' }),
        [],
      ).rankChoices,
    ).toEqual({});
  });

  it('идемпотентна и не перетирает уже записанный выбор', () => {
    const once = migrateDh1V8toV9(sheet({ advancedPath: 'Comptroller' }), []);
    const existing = {
      ...once,
      rankChoices: { [SCHOLAR]: LEXOGRAPHER },
    };
    const twice = migrateDh1V8toV9(existing, []);

    expect(twice.rankChoices).toEqual({ [SCHOLAR]: LEXOGRAPHER });
    expect(migrateDh1V8toV9(twice, [])).toEqual(twice);
  });

  it('normalize добавляет пустую карту и не трогает legacy-поля', () => {
    const { character } = normalizeDh1(
      sheet({ advancedPath: 'Comptroller' }) as never,
    );

    expect(character.rankChoices).toEqual({});
    expect(character.advancedPath).toBe('Comptroller');
  });

  it('чтение старого листа проходит миграцию и сохраняет данные', () => {
    const { character } = normalizeCharacterRecord(
      sheet({ advancedPath: 'Comptroller', alternatePath: 'Chirurgeon' }),
    );
    const cast = character as unknown as Record<string, unknown>;

    expect(cast.schemaVersion).toBe(9);
    expect(cast.rankChoices).toEqual({
      [SCRIBE]: CHIRURGEON,
      [SCHOLAR]: COMPTROLLER,
    });
    expect(cast.advancedPath).toBe('Comptroller');
    expect(cast.alternatePath).toBe('Chirurgeon');
  });

  it('схема принимает карту и отвергает нечисловые значения', () => {
    const valid = sheet({ rankChoices: { [SCHOLAR]: COMPTROLLER } });
    expect(() => dh1CharacterSchema.parse(valid)).not.toThrow();
    expect(() =>
      dh1CharacterSchema.parse(sheet({ rankChoices: { [SCHOLAR]: 1 } })),
    ).toThrow();
  });

  it('модуль объявляет версию 9 и шаг 8 → 9', () => {
    const gameModule = getGameModule('dh1');
    expect(gameModule?.schemaVersion).toBe(9);
    expect(
      gameModule?.migrations?.some((step) => step.from === 8 && step.to === 9),
    ).toBe(true);
  });
});

describe('DH1: выбор развилки в rankChoices', () => {
  it('выбор ветки ведёт по её рангам', () => {
    expect(
      rankForCharacter({
        careerPath: 'Adept',
        totalExpSpent: 7000,
        rankChoices: { [SCHOLAR]: COMPTROLLER },
      }),
    ).toBe('Comptroller');
    expect(
      rankForCharacter({
        careerPath: 'Adept',
        totalExpSpent: 2500,
        rankChoices: { [SCRIBE]: CHIRURGEON },
      }),
    ).toBe('Chirurgeon');
  });

  it('явный стандартный выбор запирает развилку', () => {
    const state = rankStateForCharacter({
      careerPath: 'Adept',
      totalExpSpent: 2500,
      rankChoices: { [SCRIBE]: INDITOR },
    });

    expect(state.node?.name).toBe('Inditor');
    expect(state.fork).toBeNull();
    expect(state.pendingFork).toBeNull();
  });

  it('альтернатива предлагается, пока открыт её диапазон', () => {
    const state = rankStateForCharacter({
      careerPath: 'Adept',
      totalExpSpent: 2500,
    });

    expect(state.node?.name).toBe('Inditor');
    expect(state.fork).toEqual({
      nodeId: SCRIBE,
      options: expect.any(Array),
      required: false,
    });
    expect(state.fork?.options.map((node) => node.name).sort()).toEqual([
      'Chirurgeon',
      'Inditor',
    ]);
  });

  it('после диапазона альтернатива не предлагается', () => {
    const state = rankStateForCharacter({
      careerPath: 'Adept',
      totalExpSpent: 3200,
    });

    expect(state.node?.name).toBe('Scholar');
    expect(state.fork).toBeNull();
  });

  it('обязательная развилка без выбора блокирует ранг', () => {
    const state = rankStateForCharacter({
      careerPath: 'Guardsman',
      totalExpSpent: 7000,
    });

    expect(state.node?.name).toBe('Veteran');
    expect(state.pendingFork).toBe(VETERAN);
    expect(state.fork?.required).toBe(true);
    expect(state.options.map((node) => node.name).sort()).toEqual([
      'Assault Veteran',
      'Lieutenant',
      'Scout',
    ]);
  });

  it('выбор обязательной развилки снимает ожидание', () => {
    const state = rankStateForCharacter({
      careerPath: 'Guardsman',
      totalExpSpent: 7000,
      rankChoices: { [VETERAN]: SCOUT },
    });

    expect(state.node?.name).toBe('Scout');
    expect(state.pendingFork).toBeNull();
  });

  it('падение опыта не стирает выбор', () => {
    const character = {
      careerPath: 'Guardsman',
      totalExpSpent: 5000,
      rankChoices: { [VETERAN]: SCOUT },
    };
    const state = rankStateForCharacter(character);

    expect(state.node?.name).toBe('Veteran');
    // Выбор сделан: диалог не должен открываться снова, пока опыта мало.
    expect(state.fork).toBeNull();
    expect(state.pendingFork).toBeNull();
    expect(character.rankChoices).toEqual({ [VETERAN]: SCOUT });
  });
});

describe('DH1: экспорт и история выборов', () => {
  it('JSON-экспорт включает rankChoices и legacy-поля', () => {
    const json = buildDh1PortableJson(
      {
        ...createDh1Defaults({ careerPath: 'Adept' }),
        rankChoices: { [SCHOLAR]: COMPTROLLER },
      } as never,
      EXPORT_PROGRESSION,
    );

    expect(json.rankChoices).toEqual({ [SCHOLAR]: COMPTROLLER });
  });

  it('история показывает выбранные пути подписями узлов', () => {
    const t = (key: string) => translations.en[key] ?? key;
    const label = dh1History.formatValue?.(
      'rankChoices',
      { [SCHOLAR]: COMPTROLLER, [SCRIBE]: CHIRURGEON },
      t,
    );

    expect(label).toBe('Comptroller, Chirurgeon');
  });
});
