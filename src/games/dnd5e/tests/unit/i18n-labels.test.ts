import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { translations } from '@/lib/i18n';

/**
 * ─── LANDMARK: DND5E DICTIONARY USAGE GUARD ────────────────────────────────
 * Обратная проверка к `translations.test.ts`: тот ищет недостающие ключи, а
 * этот — лишние. Без него словарь пухнет остатками прежней схемы имён: у DH1
 * и DH2 такой guard есть с этапа разделения редакций, у 5e не было, и десять
 * ключей дожили до 0.16.1.
 *
 * Сканер знает только статические ссылки: литералы `'dnd.…'` и шаблонные
 * префиксы `` `dnd.class${…}` ``. Всё, что собирается в рантайме, обязано быть
 * в DYNAMIC_PREFIXES или DYNAMIC_FAMILIES. Семейство `dnd.boon*Desc` — не
 * список из 26 ключей, а правило «префикс + суффикс» с проверкой, что
 * конкатенация в коде действительно есть: переименование переломает test.
 */

const ROOT = process.cwd();

/** Префиксы, которые код собирает шаблоном: `dnd.class${…}`, `dnd.bg${…}`. */
const DYNAMIC_PREFIXES: readonly string[] = ['dnd.bg', 'dnd.class', 'dnd.race'];

/**
 * Ключи, которые требует хост-контракт, а не код плагина:
 * `translations.test.ts` проверяет `<pluginId>.systemName` у каждого манифеста.
 * Лист 5e показывает своё название из манифеста, но ключ обязан быть в словаре.
 */
const CONTRACT_KEYS: readonly string[] = ['dnd5e.systemName'];

/** Семейства «префикс + суффикс», собираемые конкатенацией. */
const DYNAMIC_FAMILIES = [
  { prefix: 'dnd.boon', suffix: 'Desc', needle: "+ 'Desc'" },
] as const;

/** Исходники продукта: без словарей, тестов и сгенерированных файлов. */
function codeText(): string {
  return fs
    .readdirSync(path.join(ROOT, 'src'), { recursive: true, encoding: 'utf8' })
    .map((file) => path.join(ROOT, 'src', file))
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .filter((file) => !file.includes(`${path.sep}i18n${path.sep}`))
    .filter((file) => !file.includes(`${path.sep}tests${path.sep}`))
    .filter((file) => !file.endsWith('.generated.ts'))
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
    prefixes.add(match[1]);
  }
  return { literals, prefixes };
}

describe('D&D 5e: словарь без мёртвых ключей', () => {
  it('каждый ключ словаря 5e применяется в коде', () => {
    const text = codeText();
    const { literals, prefixes } = referencedKeys(text);
    expect(literals.size, 'сканер не нашёл литералов').toBeGreaterThan(250);

    const dictionaryKeys = Object.keys(translations.en)
      .filter((key) => key.startsWith('dnd.') || key.startsWith('dnd5e.'))
      .sort();
    expect(dictionaryKeys.length).toBeGreaterThan(400);

    const dynamic = [...DYNAMIC_PREFIXES, ...prefixes];
    const families = DYNAMIC_FAMILIES.filter((family) =>
      text.includes(family.needle),
    );
    expect(
      families.length,
      'конкатенация семейства исчезла из кода — правило устарело',
    ).toBe(DYNAMIC_FAMILIES.length);

    const unused = dictionaryKeys.filter(
      (key) =>
        !literals.has(key) &&
        !CONTRACT_KEYS.includes(key) &&
        !dynamic.some((prefix) => key.startsWith(prefix)) &&
        !families.some(
          (family) =>
            key.startsWith(family.prefix) && key.endsWith(family.suffix),
        ),
    );
    expect(
      unused,
      'ключи без применения: удалить из en/ru или объявить динамическое семейство',
    ).toEqual([]);
  });
});
