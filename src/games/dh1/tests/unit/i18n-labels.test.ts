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

/**
 * ─── LANDMARK: DH1 DICTIONARY USAGE GUARD ────────────────────────────────
 * Обратная проверка к картам данных: каждый ключ словаря обязан где-то
 * применяться. Без неё словарь пухнет остатками другой редакции и мёртвыми
 * подписями, а проверки «используемый ключ существует» этого не видят.
 *
 * Сканер знает только статические ссылки: литералы `'dh1.…'` и шаблонные
 * префиксы `` `dh1.rank${…}` ``. Всё, что собирается в рантайме, обязано
 * быть в DYNAMIC_PREFIXES: список пополняется вместе с кодом осознанно,
 * иначе тест упадёт на «мёртвом» ключе — в этом и смысл проверки.
 */
const DYNAMIC_PREFIXES: readonly string[] = [
  'dh1.armorQuality',
  'dh1.armorType',
  'dh1.career',
  'dh1.conditions.kind.',
  'dh1.conditions.source.',
  'dh1.data.divination.',
  'dh1.data.divinationEffect.',
  'dh1.rank',
];

/** Сетка характеристик собирает ключи как `dh1.${stat}` / `dh1.${stat}Abbr`. */
const STAT_PREFIXES: readonly string[] = [
  'weaponSkill',
  'ballisticSkill',
  'strength',
  'toughness',
  'agility',
  'intelligence',
  'perception',
  'willpower',
  'fellowship',
].map((stat) => `dh1.${stat}`);

/** Исходники продукта: без словарей и тестов, чтобы ключ искался в коде. */
function codeText(): string {
  return fs
    .readdirSync(path.join(ROOT, 'src'), { recursive: true, encoding: 'utf8' })
    .map((file) => path.join(ROOT, 'src', file))
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .filter((file) => !file.includes(`${path.sep}i18n${path.sep}`))
    .filter((file) => !file.includes(`${path.sep}tests${path.sep}`))
    .filter((file) => !file.endsWith('i18n.generated.ts'))
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
}

function referencedKeys(text: string): {
  literals: Set<string>;
  prefixes: Set<string>;
} {
  const literals = new Set<string>();
  for (const match of text.matchAll(
    /['"`]((?:[A-Za-z][A-Za-z0-9_-]*\.)+[A-Za-z0-9_.-]+)['"`]/g,
  )) {
    literals.add(match[1]);
  }
  const prefixes = new Set<string>();
  for (const match of text.matchAll(
    /`((?:[A-Za-z][A-Za-z0-9_-]*\.)+[A-Za-z0-9_.-]*)\$\{/g,
  )) {
    // `dh1.${...}` — домен целиком, слишком широко: такие ключи покрывают
    // перечисленные префиксы характеристик.
    if (!/^[^.]+\.$/.test(match[1])) prefixes.add(match[1]);
  }
  return { literals, prefixes };
}

describe('Dark Heresy: словарь DH1 без мёртвых ключей', () => {
  it('каждый ключ словаря DH1 применяется в коде', () => {
    const text = codeText();
    const { literals, prefixes } = referencedKeys(text);
    expect(literals.size, 'сканер не нашёл литералов').toBeGreaterThan(300);

    const dictionaryKeys = Object.keys(translations.en)
      .filter((key) => key.startsWith('dh1.') || key.startsWith('games.dh1.'))
      .sort();
    expect(dictionaryKeys.length).toBeGreaterThan(100);

    const dynamic = [...DYNAMIC_PREFIXES, ...STAT_PREFIXES];
    const unused = dictionaryKeys.filter(
      (key) =>
        !literals.has(key) &&
        ![...prefixes].some((prefix) => key.startsWith(prefix)) &&
        !dynamic.some((prefix) => key.startsWith(prefix)),
    );
    expect(
      unused,
      'ключи без применения: удалить из en/ru или объявить динамическое семейство',
    ).toEqual([]);
  });
});
