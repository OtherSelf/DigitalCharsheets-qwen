#!/usr/bin/env node
/**
 * ============================================================================
 *  scripts/plugins/generate.mjs — генерация реестра игровых плагинов
 * ============================================================================
 *
 *  Источник истины — манифесты `src/games/<id>/plugin.json` (этап 1 плана,
 *  `_NEW_FUTURE2_PROMPT.md` §5.3–5.4). Скрипт:
 *
 *    1. читает `src/games/* /plugin.json`;
 *    2. валидирует каждый по `src/games/plugin.schema.json` (Ajv, только
 *       сборка/CI — в рантайме схема не нужна);
 *    3. проверяет уникальность `id`/`order`, совпадение `game`-блока у
 *       редакций одного семейства (D17) и совместимость `pluginApi`;
 *    4. проверяет, что все точки входа (`index.ts#export`, sheet/i18n-файлы,
 *       миграции) существуют и лежат внутри папки плагина;
 *    5. пишет `src/games/registry.generated.ts` со статическими импортами.
 *
 *  Ядро больше не перечисляет модули руками: добавление папки с манифестом
 *  меняет реестр без правок `registry.ts`.
 *
 *  Использование:
 *    npm run plugins:generate          # перегенерировать реестр
 *    npm run plugins:check             # только проверить (шаг npm run verify)
 *    node scripts/plugins/generate.mjs --json   # отчёт о плагинах
 *
 *  Связано: src/games/plugin.schema.json, src/games/plugin-api.ts,
 *           src/games/registry.ts, scripts/predeploy.sh.
 * ============================================================================
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv from 'ajv';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../..');
export const GAMES_DIR = join(ROOT, 'src/games');
export const SCHEMA_PATH = join(GAMES_DIR, 'plugin.schema.json');
export const REGISTRY_PATH = join(GAMES_DIR, 'registry.generated.ts');
export const MANIFEST_FILE = 'plugin.json';

/** Версия Plugin API, с которой сверяется `pluginApi` манифестов. */
export const PLUGIN_API_VERSION = '1.0.0';
/** Версия формата манифеста, которую понимает генератор. */
export const PLUGIN_MANIFEST_VERSION = 1;

/** Каталоги `src/games/*`, которые являются ядром, а не плагинами. */
const CORE_GAMES_DIRS = new Set(['shared', 'i18n']);

// ────────────────────────────────────────────────────────────────────────────
//  Актуальные для генерации проверки манифеста (те же правила, что в схеме)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Совместим ли диапазон `pluginApi` с версией хоста.
 * Поддержаны `^`, `~`, `>=`, точная версия и `*` — без зависимости semver.
 *
 * @param {string} range
 * @param {string} [hostVersion]
 */
export function isHostApiCompatible(range, hostVersion = PLUGIN_API_VERSION) {
  const host = parseVersion(hostVersion);
  if (!host) return false;
  const trimmed = String(range ?? '').trim();
  if (trimmed === '' || trimmed === '*') return true;

  const expected = parseVersion(trimmed.replace(/^[~^>=<\s]+/, ''));
  if (!expected) return false;

  if (trimmed.startsWith('^')) {
    return host.major === expected.major && compare(host, expected) >= 0;
  }
  if (trimmed.startsWith('~')) {
    return (
      host.major === expected.major &&
      host.minor === expected.minor &&
      compare(host, expected) >= 0
    );
  }
  if (trimmed.startsWith('>=')) return compare(host, expected) >= 0;
  return compare(host, expected) === 0;
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version).trim());
  if (!match) return undefined;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compare(a, b) {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/**
 * Разобрать точку входа `<файл>(#<экспорт>)?` и убедиться, что путь
 * относительный и не выходит за папку плагина.
 *
 * @param {string} entry
 * @returns {{file: string, member?: string}}
 */
export function parseEntryPoint(entry) {
  const parts = String(entry ?? '').split('#');
  if (parts.length > 2) {
    throw new Error(`Некорректная точка входа: "${entry}"`);
  }
  const file = (parts[0] ?? '').trim();
  const member = parts[1]?.trim();
  if (!file) throw new Error(`Пустая точка входа: "${entry}"`);
  if (file.startsWith('/') || file.split(/[\\/]/).includes('..')) {
    throw new Error(
      `Точка входа должна быть относительным путём внутри плагина: "${entry}"`,
    );
  }
  if (member !== undefined && !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(member)) {
    throw new Error(`Некорректное имя экспорта: "${entry}"`);
  }
  return member ? { file, member } : { file };
}

/**
 * Проверка одного плагина: id = имя папки, файлы точек входа существуют,
 * миграции упорядочены и (если заданы) покрывают 1…schemaVersion.
 *
 * @param {{gamesDir: string, dirName: string, manifest: any}} input
 * @returns {string[]} ошибки (пустой массив — всё хорошо)
 */
export function validatePluginFolder({ gamesDir, dirName, manifest }) {
  const errors = [];
  const pluginDir = join(gamesDir, dirName);

  if (manifest.id !== dirName) {
    errors.push(
      `id "${manifest.id}" не совпадает с именем папки "${dirName}" (это должен быть один и тот же systemId)`,
    );
  }

  /** @type {[string, string][]} */
  const entries = [
    ['entry.module', manifest.entry?.module],
    ['sheet.client', manifest.sheet?.client],
    ['sheet.createForm', manifest.sheet?.createForm],
    ['i18n.en', manifest.i18n?.en],
    ['i18n.ru', manifest.i18n?.ru],
    ['demo.entry', manifest.demo?.entry],
    ['export.json', manifest.export?.json],
    ['export.excel', manifest.export?.excel],
  ];
  if (manifest.import) {
    entries.push(
      ['import.normalize', manifest.import.normalize],
      ['import.merge', manifest.import.merge],
    );
  }
  for (const [index, migration] of (manifest.migrations ?? []).entries()) {
    entries.push([`migrations[${index}].entry`, migration.entry]);
  }

  for (const [field, entry] of entries) {
    if (typeof entry !== 'string') {
      errors.push(`${field}: ожидается строка с точкой входа`);
      continue;
    }
    let parsed;
    try {
      parsed = parseEntryPoint(entry);
    } catch (error) {
      errors.push(`${field}: ${error.message}`);
      continue;
    }
    const absolute = join(pluginDir, parsed.file);
    if (!absolute.startsWith(pluginDir + sep)) {
      errors.push(`${field}: путь выходит за папку плагина (${entry})`);
      continue;
    }
    if (!existsSync(absolute)) {
      errors.push(`${field}: файл не найден (${entry})`);
    }
    if (!parsed.member && field === 'entry.module') {
      errors.push(
        'entry.module должен содержать имя экспорта модуля (например, "index.ts#dnd5eModule")',
      );
    }
  }

  const migrations = [...(manifest.migrations ?? [])].sort(
    (a, b) => a.from - b.from,
  );
  if (migrations.length > 0) {
    let expected = 1;
    for (const migration of migrations) {
      if (migration.from !== expected) {
        errors.push(
          `migrations: ожидался шаг с ${expected}, найден с ${migration.from}`,
        );
      }
      if (migration.to !== migration.from + 1) {
        errors.push(
          `migrations: шаг ${migration.from} должен вести в ${migration.from + 1}, а не в ${migration.to}`,
        );
      }
      expected = migration.to;
    }
    if (expected !== manifest.schemaVersion) {
      errors.push(
        `migrations: цепочка заканчивается на ${expected}, а schemaVersion = ${manifest.schemaVersion}`,
      );
    }
  }

  return errors;
}

/**
 * Проверки уровня набора плагинов: уникальность id/order, версии,
 * совпадение `game`-блока у редакций одного семейства (D17).
 *
 * @param {{dirName: string, manifest: any}[]} plugins
 */
export function validateCollection(plugins) {
  const errors = [];
  const seenIds = new Map();
  const seenOrders = new Map();
  const games = new Map();

  for (const { dirName, manifest } of plugins) {
    if (seenIds.has(manifest.id)) {
      errors.push(
        `дублирующийся id "${manifest.id}" (${seenIds.get(manifest.id)} и ${dirName})`,
      );
    }
    seenIds.set(manifest.id, dirName);

    if (seenOrders.has(manifest.order)) {
      errors.push(
        `дублирующийся order ${manifest.order} (${seenOrders.get(manifest.order)} и ${manifest.id})`,
      );
    }
    seenOrders.set(manifest.order, manifest.id);

    if (manifest.manifestVersion !== PLUGIN_MANIFEST_VERSION) {
      errors.push(
        `manifestVersion ${manifest.manifestVersion}: хост понимает ${PLUGIN_MANIFEST_VERSION}`,
      );
    }
    if (!isHostApiCompatible(manifest.pluginApi)) {
      errors.push(
        `pluginApi ${manifest.pluginApi}: хост предоставляет ${PLUGIN_API_VERSION}`,
      );
    }
    if (manifest.gameId !== manifest.game?.id) {
      errors.push(
        `gameId "${manifest.gameId}" не совпадает с game.id "${manifest.game?.id}"`,
      );
    }

    const gameSignature = JSON.stringify({
      id: manifest.game?.id,
      order: manifest.game?.order,
      name: manifest.game?.name,
    });
    const known = games.get(manifest.gameId);
    if (!known) {
      games.set(manifest.gameId, { dirName, signature: gameSignature });
    } else if (known.signature !== gameSignature) {
      errors.push(
        `игра "${manifest.gameId}": блок game отличается у ${known.dirName} и ${dirName} (D17 — у всех редакций он одинаковый)`,
      );
    }
  }

  return errors;
}

/**
 * Собрать манифесты плагинов (папки с `plugin.json`).
 *
 * @param {string} [gamesDir]
 * @returns {{dirName: string, dir: string, manifest: any}[]}
 */
export function collectManifests(gamesDir = GAMES_DIR) {
  const result = [];
  for (const entry of readdirSync(gamesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || CORE_GAMES_DIRS.has(entry.name)) continue;
    const dir = join(gamesDir, entry.name);
    const manifestPath = join(dir, MANIFEST_FILE);
    if (!existsSync(manifestPath)) continue;
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (error) {
      throw new Error(`${manifestPath}: некорректный JSON — ${error.message}`);
    }
    result.push({ dirName: entry.name, dir, manifest });
  }
  return result.sort((a, b) => a.dirName.localeCompare(b.dirName, 'en'));
}

/** Валидатор Ajv по `plugin.schema.json`. */
export function createManifestValidator(schemaPath = SCHEMA_PATH) {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  return (manifest) =>
    validate(manifest)
      ? []
      : validate.errors.map((error) => {
          const path = error.instancePath || '(корень)';
          return `${path} ${error.message}${
            error.params?.additionalProperty
              ? ` (поле "${error.params.additionalProperty}")`
              : ''
          }`;
        });
}

/** Строка вида `dnd5eModule` из `index.ts#dnd5eModule`. */
function moduleExportName(manifest) {
  return parseEntryPoint(manifest.entry.module).member;
}

/** JSON-импорт манифеста: `dnd5e` → `dnd5eManifest`. */
function manifestVarName(id) {
  const camel = id.replace(/[-_]+(.)?/g, (_, chr) =>
    chr ? chr.toUpperCase() : '',
  );
  return `${camel}Manifest`;
}

/**
 * Текст `registry.generated.ts` для набора плагинов.
 *
 * Формат стабилен (и совпадает с prettier), потому что `plugins:check`
 * сравнивает файл побайтно: перегенерация без изменений не должна давать diff.
 *
 * @param {{dirName: string, manifest: any}[]} plugins
 */
export function renderRegistry(plugins) {
  const sorted = [...plugins].sort(
    (a, b) =>
      a.manifest.order - b.manifest.order ||
      a.manifest.id.localeCompare(b.manifest.id, 'en'),
  );

  // Импорты — в алфавитном порядке (так их сортирует prettier), а записи
  // массива — в порядке показа (`order`, затем `id`).
  const imports = [...sorted]
    .sort((a, b) => a.manifest.id.localeCompare(b.manifest.id, 'en'))
    .map(
      ({ manifest }) =>
        `import { ${moduleExportName(manifest)} } from './${manifest.id}';\n` +
        `import ${manifestVarName(manifest.id)} from './${manifest.id}/plugin.json';`,
    )
    .join('\n');
  const entries = sorted
    .map(
      ({ manifest }) =>
        `  {\n` +
        `    manifest: ${manifestVarName(manifest.id)} as unknown as PluginManifest,\n` +
        `    module: ${moduleExportName(manifest)},\n` +
        `  },`,
    )
    .join('\n');

  return `/**
 * ─── AUTO-GENERATED — НЕ РЕДАКТИРОВАТЬ ─────────────────────────────────────
 * Реестр плагинов, сгенерированный из манифестов \`src/games/<id>/plugin.json\`
 * (D1: плагины — build-time; новый плагин = папка + манифест + пересборка).
 *
 * Пересобрать:  npm run plugins:generate
 * Проверить:    npm run plugins:check   (шаг \`npm run verify\`)
 */
${imports}
import type { GeneratedPluginRegistration, PluginManifest } from './plugin-api';

/** Зарегистрированные плагины в порядке показа (\`order\`, затем \`id\`). */
export const generatedPlugins: readonly GeneratedPluginRegistration[] = [
${entries}
];
`;
}

/**
 * Полный цикл: манифесты → проверки → текст реестра.
 *
 * @param {{gamesDir?: string, schemaPath?: string}} [options]
 */
export function buildRegistry({
  gamesDir = GAMES_DIR,
  schemaPath = SCHEMA_PATH,
} = {}) {
  const validateManifest = createManifestValidator(schemaPath);
  const plugins = collectManifests(gamesDir);
  const errors = [];

  for (const plugin of plugins) {
    for (const message of validateManifest(plugin.manifest)) {
      errors.push(`${plugin.dirName}/plugin.json: ${message}`);
    }
    for (const message of validatePluginFolder({ gamesDir, ...plugin })) {
      errors.push(`${plugin.dirName}/plugin.json: ${message}`);
    }
  }
  for (const message of validateCollection(plugins)) {
    errors.push(message);
  }

  if (errors.length > 0) {
    const error = new Error(
      `Манифесты плагинов не проходят проверку:\n${errors
        .map((line) => `  ✗ ${line}`)
        .join('\n')}`,
    );
    error.errors = errors;
    throw error;
  }

  return {
    plugins: [...plugins]
      .sort(
        (a, b) =>
          a.manifest.order - b.manifest.order ||
          a.manifest.id.localeCompare(b.manifest.id, 'en'),
      )
      .map(({ dirName, manifest }) => ({
        id: manifest.id,
        dirName,
        order: manifest.order,
        version: manifest.version,
        schemaVersion: manifest.schemaVersion,
        gameId: manifest.gameId,
        title: manifest.name.en,
      })),
    content: renderRegistry(plugins),
  };
}

// ────────────────────────────────────────────────────────────────────────────
//  CLI
// ────────────────────────────────────────────────────────────────────────────

function main(argv) {
  const flags = new Set(argv);
  const unknown = [...flags].filter(
    (flag) => !['--check', '--json', '-h', '--help'].includes(flag),
  );
  if (unknown.length > 0) {
    throw new Error(`Неизвестный флаг: ${unknown[0]}`);
  }
  if (flags.has('-h') || flags.has('--help')) {
    console.log(`Генерация реестра плагинов из src/games/<id>/plugin.json.

  npm run plugins:generate   перегенерировать src/games/registry.generated.ts
  npm run plugins:check      проверить, что файл не устарел (шаг npm run verify)
  node scripts/plugins/generate.mjs --json   отчёт о плагинах`);
    return 0;
  }

  const { plugins, content } = buildRegistry();
  const summary = plugins
    .map((plugin) => `${plugin.id}@${plugin.version} (order ${plugin.order})`)
    .join(', ');

  if (flags.has('--json')) {
    console.log(JSON.stringify({ plugins }, null, 2));
    return 0;
  }

  if (flags.has('--check')) {
    const current = existsSync(REGISTRY_PATH)
      ? readFileSync(REGISTRY_PATH, 'utf8')
      : '';
    if (current !== content) {
      console.error(
        '✗ src/games/registry.generated.ts устарел: манифесты и реестр расходятся.',
      );
      console.error('  Пересоберите: npm run plugins:generate');
      const currentLines = current.split('\n');
      const nextLines = content.split('\n');
      const index = nextLines.findIndex((line, i) => currentLines[i] !== line);
      if (index >= 0) {
        console.error(`  первое расхождение — строка ${index + 1}:`);
        console.error(`    в файле:  ${currentLines[index] ?? '∅'}`);
        console.error(`    ожидается: ${nextLines[index]}`);
      }
      return 1;
    }
    console.log(`✓ registry.generated.ts в синхроне · ${summary}`);
    return 0;
  }

  writeFileSync(REGISTRY_PATH, content, 'utf8');
  console.log(
    `✓ registry.generated.ts: ${plugins.length} плагин(ов) · ${summary}`,
  );
  return 0;
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
