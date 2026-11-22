/**
 * ─── AUTO-GENERATED — НЕ РЕДАКТИРОВАТЬ ─────────────────────────────────────
 * Данные 2-й редакции из внешнего контент-каталога (DCS_CONTENT_DIR).
 * Пересобрать: node src/games/dh2/scripts/generate.mjs.
 * Проверить дрейф: тот же файл с --check (или unit-тест dh2e-freshness).
 */

import type {
  Dh2eAvailabilityModifier,
  Dh2eCostRow,
  Dh2eCraftsmanshipModifier,
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

/** Таблица 5-1: ступени доступности и модификатор Реквизиции. */
export const DH2E_AVAILABILITY: readonly Dh2eAvailabilityModifier[] = [
  {
    id: 'ubiquitous',
    labelKey: 'dh2.catalog.availability.ubiquitous',
    modifier: null,
    automatic: true,
  },
  {
    id: 'abundant',
    labelKey: 'dh2.catalog.availability.abundant',
    modifier: 30,
    automatic: false,
  },
  {
    id: 'plentiful',
    labelKey: 'dh2.catalog.availability.plentiful',
    modifier: 20,
    automatic: false,
  },
  {
    id: 'common',
    labelKey: 'dh2.catalog.availability.common',
    modifier: 10,
    automatic: false,
  },
  {
    id: 'average',
    labelKey: 'dh2.catalog.availability.average',
    modifier: 0,
    automatic: false,
  },
  {
    id: 'scarce',
    labelKey: 'dh2.catalog.availability.scarce',
    modifier: -10,
    automatic: false,
  },
  {
    id: 'rare',
    labelKey: 'dh2.catalog.availability.rare',
    modifier: -20,
    automatic: false,
  },
  {
    id: 'very-rare',
    labelKey: 'dh2.catalog.availability.very-rare',
    modifier: -30,
    automatic: false,
  },
  {
    id: 'extremely-rare',
    labelKey: 'dh2.catalog.availability.extremely-rare',
    modifier: -40,
    automatic: false,
  },
  {
    id: 'near-unique',
    labelKey: 'dh2.catalog.availability.near-unique',
    modifier: -50,
    automatic: false,
  },
  {
    id: 'unique',
    labelKey: 'dh2.catalog.availability.unique',
    modifier: -60,
    automatic: false,
  },
];

/** Таблица 5-2: качество предмета и модификатор Реквизиции/ремонта. */
export const DH2E_CRAFTSMANSHIP: readonly Dh2eCraftsmanshipModifier[] = [
  {
    id: 'poor',
    labelKey: 'dh2.catalog.craftsmanship.poor',
    modifier: 10,
  },
  {
    id: 'common',
    labelKey: 'dh2.catalog.craftsmanship.common',
    modifier: 0,
  },
  {
    id: 'good',
    labelKey: 'dh2.catalog.craftsmanship.good',
    modifier: -20,
  },
  {
    id: 'best',
    labelKey: 'dh2.catalog.craftsmanship.best',
    modifier: -30,
  },
];
