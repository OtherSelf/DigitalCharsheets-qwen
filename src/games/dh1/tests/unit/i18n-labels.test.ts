import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import * as dh1Data from '@/games/dh1/dark-heresy-data';
import { dh1CardSummary } from '@/games/dh1/slots/card-summary';
import { STARTING_PACKAGES } from '@/games/dh1/starting-packages';
import { translations } from '@/lib/i18n';

/**
 * ─── LANDMARK: DH1 DATA I18N GUARD ───────────────────────────────────────
 * Справочные карты 1e (`HOME_WORLD_KEYS`, `RANK_KEYS`, …) отдают готовые
 * ключи домена `dh1.*`; виртуального домена `dh.*` в `src/games` быть не
 * должно, иначе в UI уходит сырой ключ. Каждый ключ обязан быть в обоих
 * словарях.
 *
 * Проверка литералов `dh.*` общая для репозитория и дублируется в тесте dh2
 * (D16): сузить её до своего каталога — значит молча пропустить нарушение в
 * соседнем плагине.
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
});
