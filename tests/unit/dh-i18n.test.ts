import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import * as dh1Data from '@/games/dh1/dark-heresy-data';
import { dh1CardSummary } from '@/games/dh1/slots/card-summary';
import * as dh2Data from '@/games/dh2/dark-heresy-data';
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

const DATA_MAPS = [
  ['HOME_WORLD_KEYS', dh1Data.HOME_WORLD_KEYS, dh2Data.HOME_WORLD_KEYS],
  ['VARIANT_KEYS', dh1Data.VARIANT_KEYS, dh2Data.VARIANT_KEYS],
  ['QUIRK_KEYS', dh1Data.QUIRK_KEYS, dh2Data.QUIRK_KEYS],
  ['CAREER_KEYS', dh1Data.CAREER_KEYS, dh2Data.CAREER_KEYS],
  ['RANK_KEYS', dh1Data.RANK_KEYS, dh2Data.RANK_KEYS],
] as const;

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

  it('каждый ключ карт есть в en и ru словарях', () => {
    const missing: string[] = [];
    for (const [name, dh1Map, dh2Map] of DATA_MAPS) {
      for (const [pid, map] of [
        ['dh1', dh1Map],
        ['dh2', dh2Map],
      ] as const) {
        for (const value of Object.values(map as Record<string, string>)) {
          for (const lang of ['en', 'ru'] as const) {
            if (!(value in translations[lang])) {
              missing.push(`${pid}.${name}: ${value} (${lang})`);
            }
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('карточка DH показывает переведённый ранг, а не ключ словаря', () => {
    const cases = [
      ['en', dh1CardSummary, dh1Data],
      ['ru', dh1CardSummary, dh1Data],
      ['en', dh2CardSummary, dh2Data],
      ['ru', dh2CardSummary, dh2Data],
    ] as const;

    for (const [lang, summary, data] of cases) {
      const t = (key: string) => translations[lang][key] ?? key;
      const result = (
        summary as unknown as (
          character: unknown,
          translate: (key: string) => string,
        ) => { text: string }
      )({ rank: 'Scholar', characterClass: 'Adept' }, t);

      const dataMaps = data as {
        RANK_KEYS: Record<string, string>;
        CAREER_KEYS: Record<string, string>;
      };
      expect(result.text).toBe(
        `${t(dataMaps.RANK_KEYS.Scholar)} ${t(dataMaps.CAREER_KEYS.Adept)}`,
      );
      expect(result.text).not.toMatch(/\bdh[12]?\.[A-Za-z]/);
    }
  });
});
