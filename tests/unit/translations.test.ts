import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { translations } from '@/lib/translations';

/**
 * Целостность словарей (src/lib/translations.*).
 *
 * Регресс, который этот тест ловит: при разбиении монолитного translations.ts
 * на translations.en.ts / translations.ru.ts часть ключей потерялась, а t()
 * возвращает сам ключ при промахе — в UI попадали сырые строки вроде
 * «weaponSkillAbbr». Поэтому проверяем:
 *   1. en и ru содержат одинаковый набор ключей;
 *   2. каждый литеральный ключ из t('...') в src существует в обоих языках;
 *   3. нет пустых значений и дублей ключей внутри файла.
 */

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const TRANSLATION_FILES = [
  path.join(SRC, 'lib', 'translations.en.ts'),
  path.join(SRC, 'lib', 'translations.ru.ts'),
];

function sourceFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map((file) => path.join(dir, file))
    .filter((file) => /\.(ts|tsx)$/.test(file));
}

/** Все литеральные ключи вида t('key') / t("key"). */
function usedLiteralKeys(): Map<string, string> {
  const used = new Map<string, string>();
  for (const file of sourceFiles(SRC)) {
    if (file.includes(`${path.sep}lib${path.sep}translations`)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\bt\(\s*['"]([A-Za-z0-9_]+)['"]/g)) {
      if (!used.has(match[1])) used.set(match[1], file);
    }
  }
  return used;
}

/** Дубли ключей внутри одного файла словаря (последний молча затирает первый). */
function duplicateKeys(file: string): string[] {
  const seen = new Map<string, number>();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s{2}([A-Za-z0-9_]+):\s*(['"])/.exec(line);
    if (!match) continue;
    seen.set(match[1], (seen.get(match[1]) ?? 0) + 1);
  }
  return [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
    .sort();
}

const en = translations.en;
const ru = translations.ru;

describe('переводы: целостность словарей', () => {
  it('en и ru содержат одинаковый набор ключей', () => {
    const onlyEn = Object.keys(en)
      .filter((key) => !(key in ru))
      .sort();
    const onlyRu = Object.keys(ru)
      .filter((key) => !(key in en))
      .sort();

    expect(onlyEn, 'ключи только в en').toEqual([]);
    expect(onlyRu, 'ключи только в ru').toEqual([]);
  });

  it('каждый литеральный ключ t(...) есть в обоих языках', () => {
    const used = usedLiteralKeys();
    expect(
      used.size,
      'найдено слишком мало ключей — сломался разбор',
    ).toBeGreaterThan(100);

    const missingEn: string[] = [];
    const missingRu: string[] = [];
    for (const [key, file] of used) {
      if (!(key in en)) missingEn.push(`${key} (${path.relative(ROOT, file)})`);
      if (!(key in ru)) missingRu.push(`${key} (${path.relative(ROOT, file)})`);
    }

    expect(missingEn.sort(), 'нет в en').toEqual([]);
    expect(missingRu.sort(), 'нет в ru').toEqual([]);
  });

  it('нет пустых значений', () => {
    for (const [lang, dict] of Object.entries(translations)) {
      const empty = Object.entries(dict)
        .filter(([, value]) => value.trim() === '')
        .map(([key]) => `${lang}.${key}`);
      expect(empty, `пустые значения в ${lang}`).toEqual([]);
    }
  });

  it('нет дублей ключей внутри файла словаря', () => {
    for (const file of TRANSLATION_FILES) {
      expect(duplicateKeys(file), `дубли в ${path.basename(file)}`).toEqual([]);
    }
  });

  it('в ru нет слов со смешанной кириллицей и латиницей', () => {
    // Ловит порчу вроде «Скintиллы»: в одном слове одновременно кириллица
    // и латиница. Разделители, дефисы и «JSON-экспорт» не считаются словом.
    const mixed: string[] = [];
    for (const [key, value] of Object.entries(ru)) {
      for (const token of value.split(/[^\p{L}\p{M}]+/u)) {
        if (/[А-Яа-яЁё]/.test(token) && /[A-Za-z]/.test(token)) {
          mixed.push(`${key}: ${token}`);
        }
      }
    }
    expect(mixed, 'слова со смешанной раскладкой').toEqual([]);
  });

  it('словари не пустые и содержат идентичные переводы обеих локалей', () => {
    expect(Object.keys(en).length).toBeGreaterThan(500);
    expect(Object.keys(ru).length).toBe(Object.keys(en).length);
  });
});
