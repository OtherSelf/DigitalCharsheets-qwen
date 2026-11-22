#!/usr/bin/env node
/**
 * ============================================================================
 *  scripts/plugins/check-layout.mjs — стандарт раскладки игрового плагина
 * ============================================================================
 *
 *  Зачем. dh1, dh2 и dnd5e выросли из разных копий и разошлись не столько
 *  правилами (это нормально, D10), сколько именами и составом файлов: у одной
 *  редакции был `schema-version.ts`, у другой — нет, тесты назывались то по
 *  теме, то с префиксом id. Документация описывала это по памяти и разъехалась
 *  с кодом. Гейт проверяет минимум, который делает плагин предсказуемым:
 *
 *    1. обязательные файлы контракта (манифест, модуль, схема, UI, словари)
 *       существуют, а тесты контракта — у видимого плагина или версии 1.0+;
 *    2. имена тестов — тема, а не id: папка и так называется `dh1`/`dh2`,
 *       префикс `dh1-` ничего не уточняет и мешает копировать тест между
 *       редакциями;
 *    3. визуальный набор не висит без конфига и фикстур;
 *    4. `assets/favicon.png` существует и не пуст.
 *
 *  Гейт не требует одинаковых секций и механик: это была бы попытка слить
 *  редакции, запрещённая D10. Он требует одинакового скелета.
 *
 *  Использование:
 *    npm run plugins:layout          # проверка (шаг npm run verify)
 *    node scripts/plugins/check-layout.mjs --json
 *
 *  Связано: docs/plugin-layout.md (стандарт), scripts/plugins/generate.mjs,
 *           scripts/predeploy.sh, tests/unit/plugin-layout.test.ts.
 * ============================================================================
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const GAMES_DIR = path.join(ROOT, 'src/games');
const CORE_DIRS = new Set(['shared', 'i18n']);

/**
 * Минимальный скелет каждого плагина. Список намеренно короткий: он описывает
 * контракт, а не механику. Ветки (`capabilities.ts`, `strings.ts`, `data/`,
 * `scripts/`) игра добавляет по необходимости.
 */
export const REQUIRED_FILES = [
  'plugin.json',
  'index.ts',
  'types.ts',
  'schema.ts',
  'schema-version.ts',
  'defaults.ts',
  'demo.ts',
  'normalize.ts',
  'merge.ts',
  'export.ts',
  'excel.ts',
  'create-form.tsx',
  'sheet.tsx',
  'sheet.module.css',
  'ui.ts',
  'bulk-editor.ts',
  'fonts.ts',
  'assets/favicon.png',
  'i18n/en.json',
  'i18n/ru.json',
];

/**
 * Тесты контракта обязательны не с первого дня: scaffold создаёт скрытый
 * плагин 0.x, у которого ещё нет своей механики для проверки. Как только
 * плагин становится видимым или дорастает до 1.0, `module.test.ts` и
 * `contract.test.ts` входят в обязательный набор.
 */
export const REQUIRED_TEST_FILES = [
  'tests/unit/module.test.ts',
  'tests/unit/contract.test.ts',
];

/** Нужны ли плагину тесты контракта (видимый или уже 1.0+). */
export function requiresContractTests(manifest) {
  const major = Number.parseInt(
    String(manifest.version ?? '0').split('.')[0],
    10,
  );
  return (
    manifest.defaultStatus !== 'hidden' ||
    !(Number.isFinite(major) && major < 1)
  );
}

/** Имя теста = тема в kebab-case; id плагина в имени запрещён. */
const TEST_NAME_RE = /^[a-z][a-z0-9-]*\.test\.ts$/;
const VISUAL_SPEC_RE = /^[a-z][a-z0-9-]*\.visual\.spec\.ts$/;

function discoverPlugins() {
  return fs
    .readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !CORE_DIRS.has(entry.name))
    .flatMap((entry) => {
      const dir = path.join(GAMES_DIR, entry.name);
      const manifestPath = path.join(dir, 'plugin.json');
      if (!fs.existsSync(manifestPath)) return [];
      return [
        {
          id: entry.name,
          dir,
          manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
        },
      ];
    })
    .sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

/** Файлы каталога рекурсивно, относительно него, без node_modules. */
function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, base);
    return [path.relative(base, full).split(path.sep).join('/')];
  });
}

/** Проверить один плагин; возвращает список человекочитаемых ошибок. */
export function checkPlugin({ id, dir, manifest }) {
  const errors = [];

  const required = [
    ...REQUIRED_FILES,
    ...(requiresContractTests(manifest) ? REQUIRED_TEST_FILES : []),
  ];
  for (const file of required) {
    if (!fs.existsSync(path.join(dir, file))) {
      errors.push(`нет обязательного файла ${file}`);
    }
  }

  for (const locale of ['en', 'ru']) {
    if (!manifest.i18n?.[locale]) {
      errors.push(
        `i18n.${locale}: у боевого плагина должны быть обе локали сайта`,
      );
    }
  }

  const favicon = path.join(dir, 'assets/favicon.png');
  if (fs.existsSync(favicon) && fs.statSync(favicon).size === 0) {
    errors.push('assets/favicon.png пуст');
  }

  const unitDir = path.join(dir, 'tests/unit');
  if (fs.existsSync(unitDir)) {
    for (const file of fs.readdirSync(unitDir)) {
      if (!file.endsWith('.test.ts')) continue;
      if (!TEST_NAME_RE.test(file)) {
        errors.push(
          `tests/unit/${file}: имя должно быть <тема>.test.ts в kebab-case`,
        );
      }
      if (file.startsWith(`${id}-`)) {
        errors.push(
          `tests/unit/${file}: папка уже называется ${id}, префикс id в имени теста лишний`,
        );
      }
    }
  }

  const visualDir = path.join(dir, 'tests/visual');
  const visualSpecs = walk(visualDir).filter((file) =>
    file.endsWith('.visual.spec.ts'),
  );
  for (const file of visualSpecs) {
    const name = path.basename(file);
    if (!VISUAL_SPEC_RE.test(name)) {
      errors.push(
        `tests/visual/${file}: имя должно быть <страница>.visual.spec.ts`,
      );
    }
  }
  const hasVisualConfig = fs.existsSync(path.join(dir, 'tests/visual.json'));
  if (visualSpecs.length > 0 && !hasVisualConfig) {
    errors.push('есть tests/visual/*.visual.spec.ts, но нет tests/visual.json');
  }
  if (
    hasVisualConfig &&
    !fs.existsSync(path.join(dir, 'tests/fixtures/visual.ts'))
  ) {
    errors.push('есть tests/visual.json, но нет tests/fixtures/visual.ts');
  }

  const strayTests = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
    .map((entry) => entry.name);
  for (const file of strayTests) {
    errors.push(
      `${file}: тест лежит в корне плагина, перенесите в tests/unit/`,
    );
  }

  return errors;
}

function main() {
  const plugins = discoverPlugins();
  const report = plugins.map((plugin) => ({
    id: plugin.id,
    errors: checkPlugin(plugin),
  }));
  const failed = report.filter((item) => item.errors.length > 0);

  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else if (failed.length === 0) {
    console.log(
      `✓ раскладка плагинов: ${plugins.length} плагин(ов) по стандарту ` +
        `(${REQUIRED_FILES.length} обязательных файлов)`,
    );
  } else {
    console.error('✗ раскладка плагинов не совпадает со стандартом:');
    for (const item of failed) {
      console.error(`\n  ${item.id}`);
      for (const error of item.errors) console.error(`    - ${error}`);
    }
    console.error('\nСтандарт: docs/plugin-layout.md');
  }

  process.exit(failed.length === 0 ? 0 : 1);
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) main();
