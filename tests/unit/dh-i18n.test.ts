import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import * as dh1Data from '@/games/dh1/dark-heresy-data';
import { dh1CardSummary } from '@/games/dh1/slots/card-summary';
import { STARTING_PACKAGES } from '@/games/dh1/starting-packages';
import {
  DH2E_APTITUDES,
  DH2E_BACKGROUNDS,
  DH2E_DIVINATIONS,
  DH2E_HOMEWORLDS,
  DH2E_ROLES,
} from '@/games/dh2/dh2e-data';
import {
  DH2E_DISCIPLINES,
  DH2E_ELITES,
  DH2E_POWERS,
  DH2E_SKILLS,
  DH2E_TALENTS,
} from '@/games/dh2/dh2e-reference';
import { DH2E_SKILL_TIERS, DH2E_STAT_STEPS } from '@/games/dh2/dh2e-rules';
import { dh2CardSummary } from '@/games/dh2/slots/card-summary';
import { translations } from '@/lib/i18n';

/**
 * ─── LANDMARK: DH DATA I18N GUARD ─────────────────────────────────────────
 * Справочные карты DH (`HOME_WORLD_KEYS`, `RANK_KEYS`, …) отдают ключи
 * словаря. Раньше они жили в «виртуальном» домене `dh.*`, который
 * дорисовывался до `dh1.*`/`dh2.*` в момент вызова — и любой пропущенный
 * вызов показывал в UI сырой ключ (`dh.rankScholar`). После этапа 5 карты
 * содержат готовые ключи редакции, а этот тест следит, чтобы домен `dh.*`
 * не вернулся и чтобы все ключи реально были в обоих словарях.
 */

const ROOT = process.cwd();
const SRC_GAMES = path.join(ROOT, 'src', 'games');

function sourceFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map((file) => path.join(dir, file))
    .filter((file) => /\.(ts|tsx|json)$/.test(file));
}

const DH1_DATA_MAPS = [
  ['HOME_WORLD_KEYS', dh1Data.HOME_WORLD_KEYS],
  ['VARIANT_KEYS', dh1Data.VARIANT_KEYS],
  ['WORLD_VARIANT_LABELS', dh1Data.WORLD_VARIANT_LABELS],
  ['QUIRK_KEYS', dh1Data.QUIRK_KEYS],
  ['CAREER_KEYS', dh1Data.CAREER_KEYS],
  ['RANK_KEYS', dh1Data.RANK_KEYS],
] as const;

/** Все ключи данных 2e: они обязаны быть в обоих словарях. */
const DH2_DATA_KEYS: readonly string[] = [
  ...DH2E_HOMEWORLDS.flatMap((item) => [item.labelKey, item.bonusKey]),
  ...DH2E_BACKGROUNDS.flatMap((item) => [
    item.labelKey,
    ...item.bonusKeys,
    ...(item.startingTraits?.keys ?? []),
  ]),
  ...DH2E_ROLES.flatMap((item) => [item.labelKey, item.bonusKey]),
  ...DH2E_APTITUDES.map((item) => item.labelKey),
  ...DH2E_DIVINATIONS.flatMap((item) => [item.textKey, item.effectKey]),
  ...DH2E_SKILLS.map((item) => item.labelKey),
  ...DH2E_TALENTS.map((item) => item.labelKey),
  ...DH2E_DISCIPLINES.map((item) => item.labelKey),
  ...DH2E_POWERS.map((item) => item.labelKey),
  ...DH2E_ELITES.flatMap((item) => [
    item.labelKey,
    ...item.changeKeys,
    `dh2.elitePrereq.${item.id}`,
  ]),
  ...DH2E_STAT_STEPS.map((item) => item.labelKey),
  ...DH2E_SKILL_TIERS.map((item) => item.labelKey),
];

/** Особенности миров 1e: имя и механика — обязательные ключи обеих локалей. */
const DH1_FEATURE_KEYS: readonly string[] = Object.values(
  dh1Data.WORLD_FEATURES,
)
  .flat()
  .flatMap((feature) => [feature.labelKey, feature.effectKey]);

/** Стартовые пакеты 1e: каждый пункт — ключ из словаря. */
const DH1_PACKAGE_KEYS: readonly string[] = Object.values(
  STARTING_PACKAGES,
).flatMap((pkg) => [
  ...pkg.skills.flat(),
  ...pkg.talents.flat(),
  ...pkg.gear.flat(),
  ...(pkg.traits ?? []).flat(),
]);

describe('Dark Heresy: ключи справочных данных', () => {
  it('в src/games нет литералов виртуального домена dh.*', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC_GAMES)) {
      const text = fs.readFileSync(file, 'utf8');
      if (/'dh\.[A-Za-z]|`dh\.[A-Za-z]/.test(text)) {
        offenders.push(path.relative(ROOT, file));
      }
    }
    expect(offenders, 'вернулся домен dh.* — используйте dh1.*/dh2.*').toEqual(
      [],
    );
  });

  it('каждый ключ карт DH1 есть в en и ru словарях', () => {
    const missing: string[] = [];
    for (const [name, map] of DH1_DATA_MAPS) {
      for (const value of Object.values(map as Record<string, string>)) {
        for (const lang of ['en', 'ru'] as const) {
          if (!(value in translations[lang])) {
            missing.push(`dh1.${name}: ${value} (${lang})`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('каждый ключ особенностей мира есть в en и ru словарях', () => {
    const missing: string[] = [];
    for (const key of DH1_FEATURE_KEYS) {
      for (const lang of ['en', 'ru'] as const) {
        if (!(key in translations[lang])) {
          missing.push(`${key} (${lang})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('каждый ключ стартовых пакетов есть в en и ru словарях', () => {
    const missing: string[] = [];
    for (const key of DH1_PACKAGE_KEYS) {
      for (const lang of ['en', 'ru'] as const) {
        if (!(key in translations[lang])) {
          missing.push(`${key} (${lang})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('каждый ключ данных 2e есть в en и ru словарях', () => {
    const missing: string[] = [];
    for (const key of DH2_DATA_KEYS) {
      for (const lang of ['en', 'ru'] as const) {
        if (!(key in translations[lang])) {
          missing.push(`${key} (${lang})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('карточка DH1 показывает переведённый ранг, а не ключ словаря', () => {
    for (const lang of ['en', 'ru'] as const) {
      const t = (key: string) => translations[lang][key] ?? key;
      const result = dh1CardSummary(
        { rank: 'Scholar', characterClass: 'Adept' } as never,
        t,
      );
      expect(result.text).toBe(
        `${t(dh1Data.RANK_KEYS.Scholar)} ${t(dh1Data.CAREER_KEYS.Adept)}`,
      );
      expect(result.text).not.toMatch(/\bdh[12]?\.[A-Za-z]/);
    }
  });

  it('карточка DH2 показывает бэкграунд и роль 2e', () => {
    for (const lang of ['en', 'ru'] as const) {
      const t = (key: string) => translations[lang][key] ?? key;
      const result = dh2CardSummary(
        { background: 'adeptus-arbites', role: 'warrior' } as never,
        t,
      );
      expect(result.text).toBe(
        `${t('dh2.catalog.background.adeptus-arbites')} / ${t(
          'dh2.catalog.role.warrior',
        )}`,
      );
      expect(result.text).not.toMatch(/\bdh[12]?\.[A-Za-z]/);
    }
  });
});
