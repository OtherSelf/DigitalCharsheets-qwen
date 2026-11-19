import { describe, expect, it } from 'vitest';

import { createDh2Defaults } from '@/games/dh2/defaults';
import { DH2E_ELITES } from '@/games/dh2/dh2e-reference';
import {
  availableEliteAdvances,
  buyEliteAdvance,
  eliteById,
  eliteIdFromEntry,
  eliteRequirementIssues,
  removeEliteAdvance,
  removeEliteJournalEntry,
} from '@/games/dh2/elite';
import { buildDh2ExcelSections } from '@/games/dh2/excel';
import { dh2History } from '@/games/dh2/history';
import type { GameExportConfig } from '@/games/types';

/**
 * ─── LANDMARK: DH2 ELITE TESTS ────────────────────────────────────────────
 * Элитные продвижения: пререквизиты и цена — из данных; покупка пишется в
 * журнал, instant changes остаются памяткой, удаление симметрично
 * возвращает опыт, но не откатывает характеристики.
 */

const translate = (key: string) => key;

const config: GameExportConfig = {
  includeBasicInfo: true,
  includeStats: false,
  includeCombat: false,
  includeEquipment: false,
  includeInventory: false,
  includeSpells: false,
  includeNarrative: false,
  includeProgression: false,
  includeCompanions: false,
  includeQuestLog: false,
  includeCustomHouseRules: false,
};

function draft() {
  return createDh2Defaults({ name: 'Acolyte', homeWorld: 'hive-world' });
}

describe('данные элитных продвижений', () => {
  it('пять продвижений с ценой, пререквизитами и памяткой изменений', () => {
    expect(DH2E_ELITES.map((elite) => elite.id).sort()).toEqual([
      'astropath',
      'inquisitor',
      'psyker',
      'sister-of-battle',
      'untouchable',
    ]);
    for (const elite of DH2E_ELITES) {
      expect(elite.cost, elite.id).toBeGreaterThan(0);
      expect(elite.prereqText, elite.id).toBeTruthy();
      expect(elite.changeKeys.length, elite.id).toBeGreaterThan(0);
      expect(eliteById(elite.id), elite.id).toBe(elite);
    }
    expect(DH2E_ELITES.find((elite) => elite.id === 'psyker')?.cost).toBe(300);
    expect(DH2E_ELITES.find((elite) => elite.id === 'inquisitor')?.cost).toBe(
      1000,
    );
    expect(
      DH2E_ELITES.find((elite) => elite.id === 'sister-of-battle')?.cost,
    ).toBe(750);
    expect(DH2E_ELITES.find((elite) => elite.id === 'astropath')?.cost).toBe(
      300,
    );
  });

  it('доступные не включают уже взятые', () => {
    expect(availableEliteAdvances([]).map((elite) => elite.id)).toHaveLength(5);
    expect(availableEliteAdvances(['psyker']).map((elite) => elite.id)).toEqual(
      DH2E_ELITES.filter((elite) => elite.id !== 'psyker').map(
        (elite) => elite.id,
      ),
    );
  });
});

describe('структурные требования', () => {
  function sister(overrides: Record<string, unknown> = {}) {
    return {
      ...createDh2Defaults({
        name: 'Sororitas',
        homeWorld: 'hive-world',
        background: 'adepta-sororitas',
        role: 'warrior',
        gender: 'female',
        influence: 50,
        willpower: 40,
        ...overrides,
      }),
    };
  }

  it('валидная Сестра Битвы требований не нарушает', () => {
    const elite = eliteById('sister-of-battle')!;
    expect(eliteRequirementIssues(sister(), elite)).toEqual([]);
  });

  it('male, чужой бэкграунд и низкие характеристики — причины', () => {
    const elite = eliteById('sister-of-battle')!;
    expect(
      eliteRequirementIssues(sister({ gender: 'male' }), elite).map(
        (issue) => issue.code,
      ),
    ).toEqual(['gender']);
    expect(
      eliteRequirementIssues(
        sister({ background: 'adeptus-arbites' }),
        elite,
      ).map((issue) => issue.code),
    ).toEqual(['background']);
    const weak = eliteRequirementIssues(
      sister({ influence: 40, willpower: 30 }),
      elite,
    ).map((issue) => issue.code);
    expect(weak).toEqual(['characteristic', 'characteristic']);
  });

  it('Астропат требует Телепатику и купленного Псайкера', () => {
    const elite = eliteById('astropath')!;
    const wrongBackground = createDh2Defaults({
      name: 'Acolyte',
      background: 'adepta-sororitas',
    });
    expect(
      eliteRequirementIssues(wrongBackground, elite).map((issue) => issue.code),
    ).toEqual(['background', 'elite']);

    const telepathica = createDh2Defaults({
      name: 'Astropath',
      background: 'adeptus-astra-telepathica',
    });
    expect(
      eliteRequirementIssues(telepathica, elite).map((issue) => issue.code),
    ).toEqual(['elite']);
    expect(
      eliteRequirementIssues(
        { ...telepathica, eliteAdvances: ['psyker'] },
        elite,
      ),
    ).toEqual([]);
  });

  it('Псайкер и Неприкасаемый конфликтуют в обе стороны', () => {
    const psyker = eliteById('psyker')!;
    const untouchable = eliteById('untouchable')!;
    const character = {
      ...createDh2Defaults({
        name: 'Psyker',
        homeWorld: 'hive-world',
        willpower: 40,
      }),
      eliteAdvances: ['untouchable'],
    };
    expect(
      eliteRequirementIssues(character, psyker).map((issue) => issue.code),
    ).toEqual(['notElite']);
    expect(
      eliteRequirementIssues(
        { ...character, eliteAdvances: ['psyker'] },
        untouchable,
      ).map((issue) => issue.code),
    ).toEqual(['notElite']);
  });

  it('Инквизитор требует Influence 75, черта не блокирует', () => {
    const elite = eliteById('inquisitor')!;
    expect(
      eliteRequirementIssues(
        createDh2Defaults({ name: 'Acolyte', influence: 74 }),
        elite,
      ).map((issue) => issue.code),
    ).toEqual(['characteristic']);
    expect(
      eliteRequirementIssues(
        createDh2Defaults({ name: 'Acolyte', influence: 75 }),
        elite,
      ),
    ).toEqual([]);

    // `trait` остаётся подсказкой: свободный текст на листе не проверить.
    expect(
      eliteById('untouchable')?.requirements?.some(
        (requirement) => requirement.kind === 'trait',
      ),
    ).toBe(true);
  });
});

describe('покупка и удаление', () => {
  it('покупка пишет id, цену и строку журнала, но не трогает характеристики', () => {
    const character = draft();
    const purchase = buyEliteAdvance(
      character,
      'psyker',
      'Psyker',
      '2026-11-16T00:00:00Z',
    );
    expect(purchase).toBeDefined();
    expect(purchase!.patch.eliteAdvances).toEqual(['psyker']);
    expect(purchase!.patch.totalExpSpent).toBe(300);
    expect(purchase!.patch.experienceLog[0]).toMatchObject({
      kind: 'elite-advance',
      ref: 'Psyker',
      cost: 300,
      createdAt: '2026-11-16T00:00:00Z',
    });
    // instant changes — только памятка, поле характеристик не меняется.
    expect(Object.keys(purchase!.patch).sort()).toEqual([
      'eliteAdvances',
      'experienceLog',
      'totalExpSpent',
    ]);
  });

  it('повтор и неизвестный id не добавляются', () => {
    const character = {
      ...draft(),
      eliteAdvances: ['psyker'],
    };
    expect(buyEliteAdvance(character, 'psyker', 'Psyker')).toBeUndefined();
    expect(buyEliteAdvance(character, 'no-such-elite', 'No')).toBeUndefined();
  });

  function purchased(): ReturnType<typeof draft> {
    const character = draft();
    const purchase = buyEliteAdvance(
      character,
      'psyker',
      'Psyker',
      '2026-11-16T00:00:00Z',
    );
    expect(purchase).toBeDefined();
    return { ...character, ...purchase!.patch };
  }

  it('удаление в профиле снимает id, строку журнала и возвращает цену', () => {
    const character = purchased();
    expect(removeEliteAdvance(character, 'psyker')).toEqual({
      eliteAdvances: [],
      totalExpSpent: 0,
      experienceLog: [],
    });
  });

  it('legacy-лист без строки журнала теряет только id', () => {
    const character = {
      ...draft(),
      eliteAdvances: ['psyker', 'untouchable'],
    };
    const patch = removeEliteAdvance(character, 'psyker');
    expect(patch).toEqual({ eliteAdvances: ['untouchable'] });
    expect(patch).not.toHaveProperty('totalExpSpent');
    expect(patch).not.toHaveProperty('experienceLog');
  });

  it('опыт не уходит в минус, повторное удаление не трогает журнал', () => {
    const character = { ...purchased(), totalExpSpent: 100 };
    const patch = removeEliteAdvance(character, 'psyker');
    expect(patch.totalExpSpent).toBe(0);

    const after = { ...character, ...patch };
    expect(removeEliteAdvance(after, 'psyker')).toEqual({ eliteAdvances: [] });
  });

  it('удаление строки журнала снимает id из профиля и цену', () => {
    const character = purchased();
    const entryId = character.experienceLog[0].id;
    expect(removeEliteJournalEntry(character, entryId)).toEqual({
      eliteAdvances: [],
      totalExpSpent: 0,
      experienceLog: [],
    });
    expect(removeEliteJournalEntry(character, 'no-such-entry')).toBeUndefined();
  });

  it('не элитную строку журнала этот путь не трогает', () => {
    const character = {
      ...draft(),
      experienceLog: [
        {
          id: 'manual:1',
          kind: 'other' as const,
          ref: 'Manual',
          cost: 50,
          createdAt: '2026-11-16T00:00:00Z',
        },
      ],
    };
    expect(removeEliteJournalEntry(character, 'manual:1')).toBeUndefined();
  });

  it('eliteIdFromEntry разбирает суффикс и игнорирует чужие записи', () => {
    expect(
      eliteIdFromEntry({
        id: 'elite-advance:2026-11-16T00:00:00Z:psyker',
        kind: 'elite-advance',
      }),
    ).toBe('psyker');
    expect(eliteIdFromEntry({ id: 'award:1', kind: 'award' })).toBeUndefined();
    expect(
      eliteIdFromEntry({ id: 'elite-advance:broken', kind: 'elite-advance' }),
    ).toBeUndefined();
  });
});

describe('каналы листа', () => {
  it('Excel и история знают элитные продвижения', () => {
    expect(dh2History.labels?.eliteAdvances).toBe('dh2.eliteAdvances');
    expect(dh2History.collections?.eliteAdvances).toBe('dh2.eliteAdvances');

    const character = {
      ...draft(),
      id: 'test-id',
      eliteAdvances: ['psyker'],
    };
    const labels = buildDh2ExcelSections(character, config, translate)
      .flatMap((section) => section.rows.flatMap((row) => row))
      .filter((cell): cell is string => typeof cell === 'string')
      .map((cell) => cell.trim());
    expect(labels).toContain('dh2.catalog.elite.psyker');
  });
});
