/**
 * ─── AUTO-GENERATED — НЕ РЕДАКТИРОВАТЬ ─────────────────────────────────────
 * Данные 2-й редакции из контент-каталога workspace (content/dh2).
 * Пересобрать: npm run dh2e:data. Проверить дрейф: npm run dh2e:check.
 */

import type {
  Dh2eCostRow,
  Dh2eSkillTier,
  Dh2eStatStep,
  Dh2eTalentTier,
} from './dh2e-types';

export const DH2E_STAT_STEPS: readonly Dh2eStatStep[] = [
  {
    id: 'simple',
    order: 1,
    labelKey: 'dh2.catalog.stat-step.simple',
    bonus: 5,
  },
  {
    id: 'intermediate',
    order: 2,
    labelKey: 'dh2.catalog.stat-step.intermediate',
    bonus: 5,
  },
  {
    id: 'trained',
    order: 3,
    labelKey: 'dh2.catalog.stat-step.trained',
    bonus: 5,
  },
  {
    id: 'proficient',
    order: 4,
    labelKey: 'dh2.catalog.stat-step.proficient',
    bonus: 5,
  },
  {
    id: 'expert',
    order: 5,
    labelKey: 'dh2.catalog.stat-step.expert',
    bonus: 5,
  },
];

export const DH2E_SKILL_TIERS: readonly Dh2eSkillTier[] = [
  {
    id: 'known',
    rank: 1,
    labelKey: 'dh2.catalog.skill-tier.known',
    bonus: 0,
  },
  {
    id: 'trained',
    rank: 2,
    labelKey: 'dh2.catalog.skill-tier.trained',
    bonus: 10,
  },
  {
    id: 'experienced',
    rank: 3,
    labelKey: 'dh2.catalog.skill-tier.experienced',
    bonus: 20,
  },
  {
    id: 'veteran',
    rank: 4,
    labelKey: 'dh2.catalog.skill-tier.veteran',
    bonus: 30,
  },
];

export const DH2E_TALENT_TIERS: readonly Dh2eTalentTier[] = [
  {
    id: 1,
    labelKey: 'dh2.catalog.talent-tier.1',
  },
  {
    id: 2,
    labelKey: 'dh2.catalog.talent-tier.2',
  },
  {
    id: 3,
    labelKey: 'dh2.catalog.talent-tier.3',
  },
];

/**
 * Таблицы 2-2 (характеристики), 2-4 (навыки), 2-6 (таланты).
 * Строка — число совпавших аптитюд, колонки — ступени/ранги/уровни.
 */
export const DH2E_XP_COST_TABLES: Readonly<{
  characteristic: Dh2eCostRow;
  skill: Dh2eCostRow;
  talent: Dh2eCostRow;
}> = {
  characteristic: {
    two: [100, 250, 500, 750, 1250],
    one: [250, 500, 750, 1000, 1500],
    zero: [500, 750, 1000, 1500, 2500],
  },
  skill: {
    two: [100, 200, 300, 400],
    one: [200, 400, 600, 800],
    zero: [300, 600, 900, 1200],
  },
  talent: {
    two: [200, 300, 400],
    one: [300, 450, 600],
    zero: [600, 900, 1200],
  },
};

export const DH2E_STARTING_XP = 1000;

export const DH2E_ELITE_COSTS: Readonly<Record<string, number>> = {
  inquisitor: 1000,
  psyker: 300,
  untouchable: 300,
};

/** Стоимость повышения пси-рейтинга: 200 × новый рейтинг (с. 90). */
export const DH2E_PSY_RATING_MULTIPLIER = 200;
