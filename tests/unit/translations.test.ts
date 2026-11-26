import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { translations } from '@/lib/i18n';

/**
 * Целостность словарей: общий слой (`src/lib/i18n/translations.*`),
 * метаданные реестра (`src/games/i18n`) и словари модулей
 * (`src/games/<id>/i18n`); у dh1 и dh2 свои независимые словари.
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
/**
 * Файлы словарей. Ядро пока TS (`translations.*.ts`), плагины — JSON,
 * но локаль больше не обязана называться `en`/`ru`: список собирается
 * сканированием папок `i18n`, а паритет проверяется по манифестам.
 */
function dictionaryFiles(): string[] {
  const fixed = [
    path.join(SRC, 'lib', 'i18n', 'translations.en.ts'),
    path.join(SRC, 'lib', 'i18n', 'translations.ru.ts'),
    path.join(SRC, 'games', 'i18n', 'en.ts'),
    path.join(SRC, 'games', 'i18n', 'ru.ts'),
  ];
  const pluginsDir = path.join(SRC, 'games');
  const pluginDictionaries = fs
    .readdirSync(pluginsDir, { recursive: true, encoding: 'utf8' })
    .map((file) => path.join(pluginsDir, file))
    .filter(
      (file) =>
        /\.(json|ts)$/.test(file) &&
        file.includes(`${path.sep}i18n${path.sep}`),
    )
    .sort();
  return [...fixed, ...pluginDictionaries].filter((file) =>
    fs.existsSync(file),
  );
}

const TRANSLATION_FILES = dictionaryFiles();

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

/**
 * Манифесты плагинов из `src/games/<id>/plugin.json`: источник истины о том,
 * какие локали плагин объявил.
 */
function pluginManifests(): { dir: string; manifest: any }[] {
  const gamesDir = path.join(SRC, 'games');
  return fs
    .readdirSync(gamesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = path.join(gamesDir, entry.name);
      const manifestPath = path.join(dir, 'plugin.json');
      return fs.existsSync(manifestPath)
        ? { dir, manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')) }
        : null;
    })
    .filter((entry): entry is { dir: string; manifest: any } => !!entry);
}

/** Ключи словаря: JSON читаем как JSON, legacy `.ts` — построчно. */
function dictionaryKeys(file: string): string[] {
  if (file.endsWith('.json')) {
    return Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')));
  }
  const keys: string[] = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s{2}(?:'([^']+)'|"([^"]+)"):\s*/.exec(line);
    if (match) keys.push(match[1] ?? match[2]);
  }
  return keys;
}

const en = translations.en;
const ru = translations.ru;

// Значения, которые законно совпадают в en/ru: имена систем, числовой
// placeholder и маска пароля. Новые совпадения должны быть осознанными.
// Домены литеральных ключей: ядровые слои плюс id всех манифестов. Список
// не ручной: иначе плагин с новым id валит тест хоста, хотя namespace `<id>.*`
// — его контракт.
const CORE_NAMESPACES = [
  'common',
  'auth',
  'admin',
  'settings',
  'demo',
  'io',
  'games',
  'share',
  'history',
  'narrative',
  'footer',
  'about',
  // Оболочка /docs: подписи Fumadocs берутся из нашего словаря.
  'docs',
  // Статусные страницы /error/<code>.
  'error',
  // Политика конфиденциальности /privacy.
  'privacy',
];
// Домены словарей плагинов — из самих словарей: у редакции бывает несколько
// namespace (dnd5e и legacy dnd.*), и перечислять их руками в тесте хоста
// значит требовать правки при добавлении плагина.
const PLUGIN_DOMAINS = pluginManifests().flatMap(({ dir, manifest }) =>
  Object.keys(manifest.i18n ?? {}).flatMap((locale) =>
    dictionaryKeys(path.join(dir, manifest.i18n[locale])).map(
      (key) => key.split('.')[0],
    ),
  ),
);
const NAMESPACE_RE = new RegExp(
  `^(${[...CORE_NAMESPACES, ...PLUGIN_DOMAINS].sort().join('|')})\\.`,
);

const SAME_VALUE_ALLOWED = new Set([
  'dh1.placeholderAge',
  'dh2.placeholderAge',
  'dh1.systemName',
  'dh2.systemName',
  'dnd5e.systemName',
  'games.generated.dnd.name',
  'games.generated.darkHeresy.name',
  'admin.siteTitlePlaceholder',
  // Ступени тренировки записываются одинаково в обеих локалях.
  'dh1.excel.plus10',
  'dh1.excel.plus20',
  'dh2.excel.plus10',
  'dh2.excel.plus20',
  'dh2.excel.plus30',
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
        new RegExp(`(^|[./])${language}\\.(ts|json)$`).test(file),
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

  it('все объявленные локали плагина имеют один набор ключей', () => {
    for (const plugin of pluginManifests()) {
      const locales = Object.keys(plugin.manifest.i18n ?? {}).sort();
      expect(
        locales.length,
        `${plugin.manifest.id}: нет объявленных локалей`,
      ).toBeGreaterThan(0);
      const dictionaries = locales.map((locale) => {
        const file = path.join(plugin.dir, plugin.manifest.i18n[locale]);
        expect(fs.existsSync(file), `${plugin.manifest.id}/${locale}`).toBe(
          true,
        );
        return dictionaryKeys(file);
      });
      const reference = dictionaries[0].sort();
      expect(
        reference.length,
        `${plugin.manifest.id}: пустой словарь`,
      ).toBeGreaterThan(0);
      dictionaries.forEach((keys, index) => {
        expect(
          keys.sort(),
          `${plugin.manifest.id}: ${locales[index]} расходится с ${locales[0]}`,
        ).toEqual(reference);
      });
    }
  });

  it('все используемые ключи io.excel.* есть в словарях', () => {
    // Excel-адаптеры берём с диска: список редакций тест хоста не знает.
    const gamesDir = path.join(SRC, 'games');
    const files = [
      ...fs
        .readdirSync(gamesDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(gamesDir, entry.name, 'excel.ts'))
        .filter((file) => fs.existsSync(file)),
      path.join(SRC, 'lib', 'export-utils.ts'),
    ];
    expect(files.length).toBeGreaterThan(2);
    const keys = new Set<string>();
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      // Подписи Excel живут в словарях плагинов и приходят в общий набор под
      // своим доменом (`dnd.excel.*`, `dh1.excel.*`, `dh2.excel.*`); в ядре
      // остаются только общие метки выгрузки (`io.excel.*`).
      for (const match of text.matchAll(
        /'([A-Za-z0-9_-]+\.excel\.[A-Za-z0-9_]+)'/g,
      )) {
        keys.add(match[1]);
      }
    }
    expect(keys.size).toBeGreaterThan(80);
    const missing = [...keys]
      .filter((key) => !(key in en) || !(key in ru))
      .sort();
    expect(missing, 'нет ключей io.excel.* в en/ru').toEqual([]);
  });

  it('домены игр приходят из модулей, а не из общего слоя', () => {
    expect(en['games.stepGame']).toBeTruthy();
    // Словари и подписи семейств — по манифестам сборки, без списка игр.
    for (const { manifest } of pluginManifests()) {
      expect(en[`${manifest.id}.systemName`], manifest.id).toBeTruthy();
      expect(
        en[`games.generated.${manifest.gameId}.name`],
        manifest.gameId,
      ).toBeTruthy();
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
