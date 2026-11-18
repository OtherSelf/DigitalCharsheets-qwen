import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

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
 * ─── LANDMARK: DH2 DATA I18N GUARD ───────────────────────────────────────
 * Справочные данные 2e (`DH2E_HOMEWORLDS`, `DH2E_ROLES`, …) отдают готовые
 * ключи домена `dh2.*`; виртуального домена `dh.*` в `src/games` быть не
 * должно, иначе в UI уходит сырой ключ. Каждый ключ обязан быть в обоих
 * словарях.
 *
 * Проверка литералов `dh.*` общая для репозитория и дублируется в тесте dh1
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
