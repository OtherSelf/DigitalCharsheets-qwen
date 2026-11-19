import { describe, expect, it } from 'vitest';

import { createDh2Defaults } from '@/games/dh2/defaults';
import { buildDh2ExcelSections } from '@/games/dh2/excel';
import { dh2History } from '@/games/dh2/history';
import {
  buyPsyRating,
  formatPsyList,
  parsePsyList,
  psyRatingCost,
} from '@/games/dh2/psy';
import { statTotal } from '@/games/dh2/stats';
import type { GameExportConfig } from '@/games/types';

/**
 * ─── LANDMARK: DH2 PSY TESTS ──────────────────────────────────────────────
 * Пси 2e: цена следующего рейтинга `200 × новый`, покупка пишется в ручной
 * журнал опыта, дисциплины/силы — свободный текст. Каналы
 * листа (история, Excel) знают новые значения.
 */

const translate = (key: string) => key;

const baseConfig: GameExportConfig = {
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
  return createDh2Defaults({ name: 'Psyker', homeWorld: 'hive-world' });
}

describe('пси-рейтинг: цена и покупка', () => {
  it('200 × новый рейтинг', () => {
    expect(psyRatingCost(1)).toBe(200);
    expect(psyRatingCost(2)).toBe(400);
    expect(psyRatingCost(3)).toBe(600);
    expect(psyRatingCost(0)).toBe(0);
  });

  it('покупка поднимает рейтинг и пишет строку журнала', () => {
    const character = draft();
    const first = buyPsyRating(character, 'Psy rating', '2026-11-16T00:00:00Z');

    expect(first.rating).toBe(1);
    expect(first.cost).toBe(200);
    expect(first.patch.psy).toEqual({
      rating: 1,
      disciplines: [],
      powers: [],
    });
    expect(first.patch.totalExpSpent).toBe(200);
    expect(first.patch.experienceLog).toHaveLength(1);
    expect(first.patch.experienceLog[0]).toMatchObject({
      kind: 'psy-rating',
      ref: 'Psy rating 1',
      cost: 200,
      createdAt: '2026-11-16T00:00:00Z',
    });

    const afterFirst = { ...character, ...first.patch };
    const second = buyPsyRating(
      afterFirst,
      'Psy rating',
      '2026-11-16T00:01:00Z',
    );
    expect(second.rating).toBe(2);
    expect(second.cost).toBe(400);
    expect(second.patch.totalExpSpent).toBe(600);
    expect(second.patch.experienceLog.map((entry) => entry.cost)).toEqual([
      200, 400,
    ]);
    expect(second.patch.experienceLog[1].id).not.toBe(
      second.patch.experienceLog[0].id,
    );
  });

  it('отрицательный рейтинг не ломает следующую ступень', () => {
    const character = draft();
    character.psy = { rating: -5, disciplines: [], powers: [] };
    const purchase = buyPsyRating(character, 'Psy rating');
    expect(purchase.rating).toBe(1);
    expect(purchase.cost).toBe(200);
  });
});

describe('дисциплины и силы — свободный текст', () => {
  it('разбор списка через запятую без пустых и повторов', () => {
    expect(parsePsyList(' Telepathy, Divination ,, Telepathy ')).toEqual([
      'Telepathy',
      'Divination',
    ]);
    expect(parsePsyList('')).toEqual([]);
    expect(formatPsyList(['Biomancy', 'Pyromancy'])).toBe(
      'Biomancy, Pyromancy',
    );
  });

  it('история и Excel знают psy.*', () => {
    expect(dh2History.labels?.['psy.rating']).toBe('dh2.psyRating');
    expect(dh2History.labels?.['psy.disciplines']).toBe('dh2.psyDisciplines');
    expect(dh2History.labels?.['psy.powers']).toBe('dh2.psyPowers');

    const character = {
      ...draft(),
      id: 'test-id',
      psy: {
        rating: 2,
        disciplines: ['Telepathy'],
        powers: ['Mind Link'],
      },
    };
    const labels = buildDh2ExcelSections(character, baseConfig, translate)
      .flatMap((section) => section.rows.flatMap((row) => row))
      .filter((cell): cell is string => typeof cell === 'string')
      .map((cell) => cell.trim());
    expect(labels).toContain('dh2.psyRating');
    expect(labels).toContain('dh2.psyDisciplines');
    expect(labels).toContain('dh2.psyPowers');
    expect(labels).toContain('Telepathy');
    expect(labels).toContain('Mind Link');
  });
});

describe('порог теста Фокуса', () => {
  it('Воля с покупками ступеней', () => {
    const character = draft();
    expect(statTotal(character, 'willpower')).toBe(30);
    character.stats = { ...character.stats, willpower: 40 };
    character.statUpgrades = {
      ...character.statUpgrades,
      willpower: [true, true, false, false, false],
    };
    expect(statTotal(character, 'willpower')).toBe(50);
  });
});
