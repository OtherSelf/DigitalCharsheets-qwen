import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { listGameModules } from '@/games/registry';
import { translations } from '@/lib/i18n';

/**
 * Целостность словарей: общий слой (`src/lib/i18n/translations.*`),
 * метаданные реестра (`src/games/i18n`) и словари модулей
 * (`src/games/<id>/i18n`, общий DH — `dh-shared`).
 *
 * Регресс, который этот тест ловит: при разбиении монолитного translations.ts
 * на слой + модули часть ключей теряется, а t() возвращает сам ключ при
 * промахе — в UI попадают сырые строки вроде «weaponSkillAbbr». Проверяем:
 *   1. en и ru содержат одинаковый набор ключей (в т.ч. по каждому модулю);
 *   2. каждый литеральный ключ из t('...') в src существует в обоих языках;
 *   3. нет пустых значений и дублей внутри файла и между слоями.
 */

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const TRANSLATION_FILES = [
  path.join(SRC, 'lib', 'i18n', 'translations.en.ts'),
  path.join(SRC, 'lib', 'i18n', 'translations.ru.ts'),
  path.join(SRC, 'games', 'i18n', 'en.ts'),
  path.join(SRC, 'games', 'i18n', 'ru.ts'),
  path.join(SRC, 'games', 'dh-shared', 'i18n', 'en.ts'),
  path.join(SRC, 'games', 'dh-shared', 'i18n', 'ru.ts'),
  path.join(SRC, 'games', 'dnd5e', 'i18n', 'en.ts'),
  path.join(SRC, 'games', 'dnd5e', 'i18n', 'ru.ts'),
  path.join(SRC, 'games', 'dh1', 'i18n', 'en.ts'),
  path.join(SRC, 'games', 'dh1', 'i18n', 'ru.ts'),
  path.join(SRC, 'games', 'dh2', 'i18n', 'en.ts'),
  path.join(SRC, 'games', 'dh2', 'i18n', 'ru.ts'),
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
    if (file.includes(`${path.sep}i18n${path.sep}`)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\bt\(\s*['"]([A-Za-z0-9_.]+)['"]/g)) {
      if (!used.has(match[1])) used.set(match[1], file);
    }
  }
  return used;
}

/** Дубли ключей внутри одного файла словаря (последний молча затирает первый). */
function duplicateKeys(file: string): string[] {
  const seen = new Map<string, number>();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s{2}(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_]+)):\s*/.exec(
      line,
    );
    if (!match) continue;
    const key = match[1] ?? match[2] ?? match[3];
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
    .sort();
}

const en = translations.en;
const ru = translations.ru;

// Значения, которые законно совпадают в en/ru: имена систем, числовой
// placeholder и маска пароля. Новые совпадения должны быть осознанными.
const NAMESPACE_RE = /^(common|auth|admin|dnd|dh|settings|demo|io|games)\./;

const SAME_VALUE_ALLOWED = new Set([
  'common.gameSystemDarkHeresy',
  'common.dungeonsAndDragons',
  'common.darkHeresy',
  'games.dnd.name',
  'games.darkHeresy.name',
  'dh.placeholderAge',
  'auth.passwordPlaceholder',
]);

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

  it('все ключи-идентификаторы namespaced', () => {
    // 55 sentence-ключей — значения DIVINATIONS/эффектов, они хранятся в
    // данных персонажа как есть; их миграция — отдельный level 2.
    const bad = Object.keys(en).filter(
      (key) => /^[A-Za-z][A-Za-z0-9]*$/.test(key) && !NAMESPACE_RE.test(key),
    );
    expect(bad, 'ключи без домена').toEqual([]);
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

    const badNamespace = [...used.keys()]
      .filter((key) => !NAMESPACE_RE.test(key))
      .sort();
    expect(badNamespace, 'литеральные t() без домена').toEqual([]);
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
      expect(
        duplicateKeys(file),
        `дубли в ${path.relative(ROOT, file)}`,
      ).toEqual([]);
    }
  });

  it('нет дублей ключей между слоями и модулями', () => {
    for (const language of ['en', 'ru'] as const) {
      const files = TRANSLATION_FILES.filter((file) =>
        new RegExp(`(^|[./])${language}\\.ts$`).test(file),
      );
      const seen = new Map<string, string>();
      const duplicates: string[] = [];
      for (const file of files) {
        const relative = path.relative(ROOT, file);
        for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
          const match = /^\s{2}(?:'([^']+)'|"([^"]+)"):\s*/.exec(line);
          if (!match) continue;
          const key = match[1] ?? match[2];
          const previous = seen.get(key);
          if (previous && previous !== relative) {
            duplicates.push(`${key} (${previous} и ${relative})`);
          } else {
            seen.set(key, relative);
          }
        }
      }
      expect(
        duplicates.sort(),
        `${language}: ключи объявлены в нескольких слоях`,
      ).toEqual([]);
    }
  });

  it('каждый модуль реестра отдаёт паритет en/ru', () => {
    for (const gameModule of listGameModules()) {
      const enKeys = Object.keys(gameModule.i18n.en).sort();
      const ruKeys = Object.keys(gameModule.i18n.ru).sort();
      expect(enKeys, `${gameModule.id}: en/ru расходятся`).toEqual(ruKeys);
      expect(enKeys.length, `${gameModule.id}: пустой словарь`).toBeGreaterThan(
        0,
      );
    }
  });

  it('домены dnd/dh/games приходят из модулей, а не из общего слоя', () => {
    expect(en['dnd.lvl']).toBeTruthy();
    expect(en['dh.weaponSkill']).toBeTruthy();
    expect(en['games.stepGame']).toBeTruthy();
    expect(en['games.dh1.name']).toBeTruthy();
    expect(en['games.dh2.name']).toBeTruthy();
    expect(en['games.dnd5e.name']).toBeTruthy();
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

  it('в ru нет непереведённых значений, совпадающих с en', () => {
    const untranslated = Object.entries(ru)
      .filter(
        ([key, value]) => value === en[key] && !SAME_VALUE_ALLOWED.has(key),
      )
      .map(([key]) => key)
      .sort();
    expect(untranslated, 'ru-значения, совпадающие с en').toEqual([]);
  });

  it('словари не пустые и содержат идентичные переводы обеих локалей', () => {
    expect(Object.keys(en).length).toBeGreaterThan(500);
    expect(Object.keys(ru).length).toBe(Object.keys(en).length);
  });
});
