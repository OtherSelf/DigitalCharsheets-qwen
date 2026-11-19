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
 * Проверка литералов `dh.*` общая для репозитория и дублируется в тесте dh1:
 * сузить её до своего каталога — значит молча пропустить нарушение в
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

/**
 * ─── LANDMARK: DH2 DICTIONARY USAGE GUARD ────────────────────────────────
 * Обратная проверка к картам данных: каждый ключ словаря обязан где-то
 * применяться. Иначе словарь пухнет остатками другой редакции и мёртвыми
 * подписями, а проверки «используемый ключ существует» этого не видят.
 *
 * Сканер знает только статические ссылки: литералы `'dh2.…'` и шаблонные
 * префиксы `` `dh2.elitePrereq.${…}` ``. Всё, что собирается в рантайме,
 * обязано быть в DYNAMIC_PREFIXES: список пополняется вместе с кодом
 * осознанно, иначе тест упадёт на «мёртвом» ключе — в этом и смысл.
 */
const DYNAMIC_PREFIXES: readonly string[] = [
  'dh2.armorQuality',
  'dh2.armorType',
  'dh2.catalog.aptitude.',
  'dh2.catalog.characteristic.',
  'dh2.conditions.kind.',
  'dh2.conditions.source.',
  'dh2.elitePrereq.',
  'dh2.experienceKind.',
];

/** Сетка характеристик собирает ключи как `dh2.${stat}` / `dh2.${stat}Abbr`. */
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
  'influence',
].map((stat) => `dh2.${stat}`);

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
    // `dh2.${...}` — домен целиком, слишком широко: такие ключи покрывают
    // перечисленные префиксы характеристик.
    if (!/^[^.]+\.$/.test(match[1])) prefixes.add(match[1]);
  }
  return { literals, prefixes };
}

describe('Dark Heresy: словарь DH2 без мёртвых ключей', () => {
  it('каждый ключ словаря DH2 применяется в коде', () => {
    const text = codeText();
    const { literals, prefixes } = referencedKeys(text);
    expect(literals.size, 'сканер не нашёл литералов').toBeGreaterThan(300);

    const dictionaryKeys = Object.keys(translations.en)
      .filter((key) => key.startsWith('dh2.') || key.startsWith('games.dh2.'))
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
