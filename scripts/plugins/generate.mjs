#!/usr/bin/env node
/**
 * ============================================================================
 *  scripts/plugins/generate.mjs — генерация реестра игровых плагинов
 * ============================================================================
 *
 *  Источник истины — манифесты `src/games/<id>/plugin.json` (этап 1 плана,
 *  `docs/game-modules.md`, `docs/plugin-sdk.md`). Скрипт:
 *
 *    1. читает `src/games/* /plugin.json`;
 *    2. валидирует каждый по `src/games/plugin.schema.json` (Ajv, только
 *       сборка/CI — в рантайме схема не нужна);
 *    3. проверяет уникальность `id`/`order`, совпадение `game`-блока у
 *       редакций одного семейства и совместимость `pluginApi`;
 *    4. проверяет, что все точки входа (`index.ts#export`, sheet/i18n-файлы,
 *       миграции) существуют и лежат внутри папки плагина;
 *    5. пишет `registry.generated.ts` (плагины), `i18n.generated.ts` (словари и
 *       метаданные семейств игр) и `games.generated.ts` (список игр).
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
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv from 'ajv';

// Константы и проверки Plugin API — из того же источника, что использует
// рантайм: две копии уже разошлись (manifestVersion 1 против 2).
import {
  isHostApiCompatible,
  parseEntryPoint,
  PLUGIN_API_VERSION,
  PLUGIN_MANIFEST_VERSION,
} from '../../src/games/plugin-api.constants.mjs';
import {
  collectManifests as collectManifestsFrom,
  MANIFEST_FILE,
} from './lib/manifests.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../..');
export const GAMES_DIR = join(ROOT, 'src/games');
export const SCHEMA_PATH = join(GAMES_DIR, 'plugin.schema.json');
export const REGISTRY_PATH = join(GAMES_DIR, 'registry.generated.ts');
export const I18N_REGISTRY_PATH = join(GAMES_DIR, 'i18n.generated.ts');
export const GAMES_DEFS_PATH = join(GAMES_DIR, 'games.generated.ts');
export { MANIFEST_FILE };

/**
 * Собрать манифесты плагинов (папки с `plugin.json`).
 *
 * @param {string} [gamesDir]
 * @returns {{dirName: string, dir: string, manifest: any}[]}
 */
export function collectManifests(gamesDir = GAMES_DIR) {
  return collectManifestsFrom(gamesDir);
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

  const locales = Object.keys(manifest.i18n ?? {});
  if (locales.length === 0) {
    errors.push('i18n: нужна хотя бы одна локаль');
  } else if (!locales.includes('en') && !locales.includes('ru')) {
    errors.push('i18n: нужна хотя бы одна из локалей en или ru (SDK 1.3)');
  }

  /** @type {[string, string][]} */
  const entries = [
    ['entry.module', manifest.entry?.module],
    ['sheet.client', manifest.sheet?.client],
    ['sheet.createForm', manifest.sheet?.createForm],
    ...locales.map((locale) => [`i18n.${locale}`, manifest.i18n[locale]]),
    ['demo.entry', manifest.demo?.entry],
    ['export.json', manifest.export?.json],
    ['export.excel', manifest.export?.excel],
  ];
  if (manifest.ui?.entry) {
    entries.push(['ui.entry', manifest.ui.entry]);
  }
  if (manifest.ui?.theme?.font) {
    entries.push(['ui.theme.font', manifest.ui.theme.font]);
  }
  if (manifest.import) {
    entries.push(
      ['import.normalize', manifest.import.normalize],
      ['import.merge', manifest.import.merge],
    );
  }
  if (manifest.derive) {
    entries.push(['derive.entry', manifest.derive.entry]);
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
    if (
      !parsed.member &&
      (field === 'entry.module' || field === 'derive.entry')
    ) {
      errors.push(
        `${field} должен содержать имя экспорта (например, "index.ts#deriveCharacter")`,
      );
    }
  }

  // `derive` без списка полей бесполезен: doctor и OpenAPI берут состав
  // производных из манифеста, а не из чтения кода.
  const derived = manifest.derived ?? [];
  if (manifest.derive && derived.length === 0) {
    errors.push('derived: плагин объявил derive, но не перечислил поля');
  }
  if (!manifest.derive && derived.length > 0) {
    errors.push('derive: перечислены производные поля, но точки входа нет');
  }
  const duplicated = derived.filter(
    (field, index) =>
      typeof field === 'string' && derived.indexOf(field) !== index,
  );
  if (duplicated.length > 0) {
    errors.push(
      `derived: повторяющиеся поля (${[...new Set(duplicated)].join(', ')})`,
    );
  }

  const migrations = [...(manifest.migrations ?? [])].sort(
    (a, b) => a.from - b.from,
  );

  for (const [index, migration] of migrations.entries()) {
    const removes = migration.removes;
    if (removes === undefined) continue;
    if (!Array.isArray(removes)) {
      errors.push(`migrations[${index}].removes: ожидается массив имён полей`);
      continue;
    }
    const duplicated = removes.filter(
      (field, position) =>
        typeof field === 'string' && removes.indexOf(field) !== position,
    );
    if (duplicated.length > 0) {
      errors.push(
        `migrations[${index}].removes: повторяющиеся поля (${[...new Set(duplicated)].join(', ')})`,
      );
    }
  }
  // Гейт: версионированная схема обязана объявлять путь из v1. Пока цепочка
  // была необязательной, все три плагина жили с `migrations: []` и
  // `schemaVersion` 2/5/5 — то есть без объявленного пути вообще.
  if (migrations.length === 0) {
    if (manifest.schemaVersion > 1) {
      errors.push(
        `migrations: schemaVersion ${manifest.schemaVersion}, но цепочка пуста — ` +
          `нужны шаги 1 → ${manifest.schemaVersion}`,
      );
    }
  } else {
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
 * совпадение `game`-блока у редакций одного семейства.
 *
 * @param {{dirName: string, manifest: any}[]} plugins
 */
export function validateCollection(plugins) {
  const errors = [];
  const seenIds = new Map();
  const seenShortCodes = new Map();
  const seenOrders = new Map();
  const games = new Map();

  for (const { dirName, manifest } of plugins) {
    if (seenIds.has(manifest.id)) {
      errors.push(
        `дублирующийся id "${manifest.id}" (${seenIds.get(manifest.id)} и ${dirName})`,
      );
    }
    seenIds.set(manifest.id, dirName);

    if (manifest.shortCode !== undefined) {
      if (seenShortCodes.has(manifest.shortCode)) {
        errors.push(
          `дублирующийся shortCode "${manifest.shortCode}" (${seenShortCodes.get(manifest.shortCode)} и ${dirName})`,
        );
      }
      seenShortCodes.set(manifest.shortCode, dirName);
    }

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
    // Неподдержанная форма диапазона — ошибка манифеста, а не «несовместимо»:
    // `isHostApiCompatible` бросает, и текст броска важнее общего шаблона.
    try {
      if (!isHostApiCompatible(manifest.pluginApi)) {
        errors.push(
          `pluginApi ${manifest.pluginApi}: хост предоставляет ${PLUGIN_API_VERSION}`,
        );
      }
    } catch (error) {
      errors.push(`pluginApi ${manifest.pluginApi}: ${error.message}`);
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
      description: manifest.game?.description,
    });
    const known = games.get(manifest.gameId);
    if (!known) {
      games.set(manifest.gameId, { dirName, signature: gameSignature });
    } else if (known.signature !== gameSignature) {
      errors.push(
        `игра "${manifest.gameId}": блок game отличается у ${known.dirName} и ${dirName} (у всех редакций он одинаковый)`,
      );
    }
  }

  return errors;
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

/** Суффикс импорта для локали: `en` → `En`, `pt-BR` → `Pt_BR`. */
function localeSuffix(locale) {
  return locale
    .replace(/[^A-Za-z0-9]/g, '_')
    .replace(/^./, (chr) => chr.toUpperCase());
}

/** Ключ объекта в сгенерированном TS: голый идентификатор или в кавычках. */
function tsKey(key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

/** Строка вида `dnd5eModule` из `index.ts#dnd5eModule`. */
function moduleExportName(manifest) {
  return parseEntryPoint(manifest.entry.module).member;
}

/** Локальное имя импорта функции derive: `dnd5e` → `dnd5eDerive`. */
function deriveVarName(id) {
  const camel = id.replace(/[-_]+(.)?/g, (_, chr) =>
    chr ? chr.toUpperCase() : '',
  );
  return `${camel}Derive`;
}

/** Строковый литерал в стиле prettier (одинарные кавычки). */
function tsString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** JSON-импорт манифеста: `dnd5e` → `dnd5eManifest`. */
function manifestVarName(id) {
  const camel = id.replace(/[-_]+(.)?/g, (_, chr) =>
    chr ? chr.toUpperCase() : '',
  );
  return `${camel}Manifest`;
}

/**
 * Уникальные семейства игр из `game`-блоков манифестов.
 * Порядок — `order`, затем `id`; сами названия/описания остаются в манифестах
 * и попадают в `i18n.generated.ts` как ключи `games.generated.*`.
 *
 * @param {{dirName: string, manifest: any}[]} plugins
 */
function collectGameDefinitions(plugins) {
  const games = new Map();
  for (const { manifest } of plugins) {
    const game = manifest.game;
    if (!game?.id || games.has(game.id)) continue;
    games.set(game.id, {
      id: game.id,
      order: game.order,
      name: game.name,
      description: game.description,
    });
  }
  return [...games.values()].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id, 'en'),
  );
}

/**
 * Текст `games.generated.ts`: определения семейств игр без импорта модулей,
 * чтобы `games.ts` мог их переиспользовать без цикла с реестром.
 *
 * @param {{dirName: string, manifest: any}[]} plugins
 */
export function renderGameDefinitions(plugins) {
  const entries = collectGameDefinitions(plugins)
    .map(
      (game) =>
        `  {\n` +
        `    id: ${tsString(game.id)},\n` +
        `    order: ${game.order},\n` +
        `    nameKey: 'games.generated.${game.id}.name',\n` +
        `    descriptionKey: 'games.generated.${game.id}.description',\n` +
        `  },`,
    )
    .join('\n');

  return `/**
 * ─── AUTO-GENERATED — НЕ РЕДАКТИРОВАТЬ ─────────────────────────────────────
 * Семейства игр, сгенерированные из блоков \`game\` манифестов
 * \`src/games/<id>/plugin.json\` (у редакций одной игры блок \`game\` одинаков).
 *
 * Пересобрать:  npm run plugins:generate
 * Проверить:    npm run plugins:check
 */
import type { GameDefinition } from './types';

/** Семейства игр в порядке показа (\`order\`, затем \`id\`). */
export const generatedGameDefinitions: readonly GameDefinition[] = [
${entries}
];
`;
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

  // Импорты — единым списком, отсортированным по строке пути, как это делает
  // `@ianvs/prettier-plugin-sort-imports`. Массив записей — в порядке показа
  // (`order`, затем `id`).
  //
  // `import type … from './plugin-api'` участвует в той же сортировке: иначе
  // плагин с id после `plugin-api` (`probe`, `wfrp`, `zz…`) делал
  // сгенерированный файл «грязным» для prettier, а `prettier --check` —
  // шаг «формат» в `npm run verify`. Цикл `generate` → `format` не сходился.
  const imports = [
    ...[...sorted]
      .sort((a, b) => a.manifest.id.localeCompare(b.manifest.id, 'en'))
      .map(({ manifest }) => {
        const names = [{ name: moduleExportName(manifest) }];
        if (manifest.derive) {
          // Импорт из того же модуля, что и сам плагин: derive — обычный
          // именованный экспорт точки входа, а не поле GameModule.
          names.push({
            name: parseEntryPoint(manifest.derive.entry).member,
            alias: deriveVarName(manifest.id),
          });
        }
        // Prettier сортирует именованные импорты по имени, а `plugins:check`
        // сравнивает файл побайтно: генерируем сразу в том же порядке.
        const sortedNames = [...names].sort((a, b) =>
          a.name.localeCompare(b.name, 'en'),
        );
        const list = sortedNames
          .map((item) =>
            item.alias ? `${item.name} as ${item.alias}` : item.name,
          )
          .join(', ');
        return [
          {
            spec: `./${manifest.id}`,
            text: `import { ${list} } from './${manifest.id}';`,
          },
          {
            spec: `./${manifest.id}/plugin.json`,
            text: `import ${manifestVarName(manifest.id)} from './${manifest.id}/plugin.json';`,
          },
        ];
      })
      .flat(),
    {
      spec: './plugin-api',
      text:
        'import type {\n' +
        '  GameUiSlots,\n' +
        '  GeneratedPluginRegistration,\n' +
        '  PluginFont,\n' +
        '  PluginManifest,\n' +
        "} from './plugin-api';",
    },
  ]
    .sort((a, b) => a.spec.localeCompare(b.spec, 'en'))
    .map((statement) => statement.text)
    .join('\n');
  const entries = sorted
    .map(({ manifest }) => {
      const deriveLine = manifest.derive
        ? `    derive: ${deriveVarName(manifest.id)},\n`
        : '';
      return (
        `  {\n` +
        `    manifest: ${manifestVarName(manifest.id)} as unknown as PluginManifest,\n` +
        `    module: ${moduleExportName(manifest)},\n` +
        deriveLine +
        `  },`
      );
    })
    .join('\n');

  // UI-слоты подключаются лениво (dynamic import): реестр не тянет
  // React-компоненты и контекст хоста в общий бандл и не создаёт цикл
  // registry → slots → context → registry.
  const uiLoaders = sorted
    .filter(({ manifest }) => typeof manifest.ui?.entry === 'string')
    .map(({ manifest }) => {
      const spec = `./${manifest.id}/${manifest.ui.entry.replace(/\.(ts|tsx)$/, '')}`;
      const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(manifest.id)
        ? manifest.id
        : JSON.stringify(manifest.id);
      return `  ${key}: () => import('${spec}').then((module) => module.uiSlots),`;
    })
    .join('\n');

  // Пустой набор загрузчиков prettier печатает как `{}` в одну строку —
  // генерируем сразу так, иначе `plugins:check` и `prettier --check` спорят.
  const uiLoadersBlock = uiLoaders
    ? `export const generatedUiLoaders: Readonly<
  Record<string, () => Promise<GameUiSlots<any>>>
> = {
${uiLoaders}
};`
    : `export const generatedUiLoaders: Readonly<
  Record<string, () => Promise<GameUiSlots<any>>>
> = {};`;

  // Шрифт темы грузится так же лениво, как UI-слоты: модуль шрифта может
  // тянуть `next/font/local` и ассеты, и в общий бандл он попасть не должен.
  const fontLoaders = sorted
    .filter(({ manifest }) => typeof manifest.ui?.theme?.font === 'string')
    .map(({ manifest }) => {
      const [file, member] = manifest.ui.theme.font.split('#');
      const spec = `./${manifest.id}/${file.replace(/\.(ts|tsx)$/, '')}`;
      const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(manifest.id)
        ? manifest.id
        : JSON.stringify(manifest.id);
      // prettier (printWidth 80) переносит длинную строку так же; иначе
      // `plugins:check` и `prettier --check` спорят о сгенерированном файле.
      const inline = `  ${key}: () => import('${spec}').then((module) => module.${member}),`;
      if (inline.length <= 80) return inline;
      return (
        `  ${key}: () =>\n` +
        `    import('${spec}').then((module) => module.${member}),`
      );
    })
    .join('\n');

  const fontLoadersBlock = fontLoaders
    ? `export const generatedFontLoaders: Readonly<
  Record<string, () => Promise<PluginFont>>
> = {
${fontLoaders}
};`
    : `export const generatedFontLoaders: Readonly<
  Record<string, () => Promise<PluginFont>>
> = {};`;

  return `/**
 * ─── AUTO-GENERATED — НЕ РЕДАКТИРОВАТЬ ─────────────────────────────────────
 * Реестр плагинов, сгенерированный из манифестов \`src/games/<id>/plugin.json\`
 * (плагины — build-time: новый плагин = папка + манифест + пересборка).
 *
 * Пересобрать:  npm run plugins:generate
 * Проверить:    npm run plugins:check   (шаг \`npm run verify\`)
 */
${imports}

/** Зарегистрированные плагины в порядке показа (\`order\`, затем \`id\`). */
export const generatedPlugins: readonly GeneratedPluginRegistration[] = [
${entries}
];

/** Ленивые UI-слоты: \`systemId\` → загрузчик объекта \`GameUiSlots\`. */
${uiLoadersBlock}

${fontLoadersBlock}
`;
}

/**
 * Текст `i18n.generated.ts` — словари плагинов без импорта их модулей.
 *
 * Зачем отдельный файл: `src/lib/i18n` нужен до инициализации реестра
 * (контекст языка импортируют в том числе UI-слоты плагинов), поэтому
 * собирать словари из `gameRegistry` нельзя — получается цикл
 * `i18n → registry → plugin ui → language-context → i18n`. Генерируем
 * статические импорты только словарей (этап 3).
 *
 * @param {{dirName: string, manifest: any}[]} plugins
 */
export function renderI18nRegistry(plugins) {
  const sorted = [...plugins].sort((a, b) =>
    a.manifest.id.localeCompare(b.manifest.id, 'en'),
  );

  // Импорты словарей и `import type … from './types'` — одним списком по
  // строке пути: prettier сортирует их так же, а id после `types` иначе
  // ломал `prettier --check` (шаг «формат» verify) на авто-сгенерированном файле.
  const imports = [
    ...sorted.flatMap(({ manifest }) => {
      const camel = manifest.id.replace(/[-_]+(.)?/g, (_, chr) =>
        chr ? chr.toUpperCase() : '',
      );
      return Object.keys(manifest.i18n)
        .sort()
        .map((locale) => {
          const rel = manifest.i18n[locale];
          const isJson = rel.endsWith('.json');
          const spec = `./${manifest.id}/${rel.replace(/\.(ts|tsx|json)$/, '')}${isJson ? '.json' : ''}`;
          const local = `${camel}${localeSuffix(locale)}`;
          return {
            spec,
            text: isJson
              ? `import ${local} from '${spec}';`
              : `import { ${locale} as ${local} } from '${spec}';`,
          };
        });
    }),
    {
      spec: './types',
      text: "import type { LocalizedMessages, PluginLocalizedMessages } from './types';",
    },
  ]
    .sort((a, b) => a.spec.localeCompare(b.spec, 'en'))
    .map((statement) => statement.text)
    .join('\n');

  const entries = sorted
    .map(({ manifest }) => {
      const camel = manifest.id.replace(/[-_]+(.)?/g, (_, chr) =>
        chr ? chr.toUpperCase() : '',
      );
      const key = tsKey(manifest.id);
      const fields = Object.keys(manifest.i18n)
        .sort()
        .map((locale) => `${tsKey(locale)}: ${camel}${localeSuffix(locale)}`)
        .join(', ');
      return `  ${key}: { ${fields} },`;
    })
    .join('\n');

  const gameDefinitions = collectGameDefinitions(plugins);
  const gameKeys = (locale) =>
    gameDefinitions
      .map((game) => {
        const lines = [];
        for (const [suffix, value] of [
          ['name', game.name[locale]],
          ['description', game.description[locale]],
        ]) {
          const key = `games.generated.${game.id}.${suffix}`;
          const inline = `    '${key}': ${tsString(value)},`;
          lines.push(
            inline.length <= 80
              ? inline
              : `    '${key}':\n      ${tsString(value)},`,
          );
        }
        return lines.join('\n');
      })
      .join('\n');

  return `/**
 * ─── AUTO-GENERATED — НЕ РЕДАКТИРОВАТЬ ─────────────────────────────────────
 * Словари плагинов, сгенерированные из \`src/games/<id>/plugin.json\` (поле
 * \`i18n\`) плюс названия/описания семейств игр (поле \`game\`).
 * Импортируются \`src/lib/i18n\` до инициализации реестра, поэтому здесь
 * только словари — без модулей, схем и UI (этап 3).
 *
 * Пересобрать:  npm run plugins:generate
 * Проверить:    npm run plugins:check
 */
${imports}

/** Локали плагина из манифеста; порядок ключей — по id. */
type PluginDictionaries = Readonly<Record<string, PluginLocalizedMessages>>;

/** Словари по \`systemId\`; порядок ключей — по id (стабильная генерация). */
export const generatedI18n: PluginDictionaries = {
${entries}
};

/** Названия и описания семейств игр (ключи \`games.generated.*\`). */
export const generatedGameI18n: LocalizedMessages = {
  en: {
${gameKeys('en')}
  },
  ru: {
${gameKeys('ru')}
  },
};
`;
}

/**
 * Предупреждения набора: манифест валиден, но описывает контракт не полностью.
 *
 * Сейчас это пустая цепочка миграций при `schemaVersion > 1`: гейт на неё
 * вводится отдельно (этап 4), а до тех пор молчать нельзя — иначе «проверено»
 * означает «проверка не запускалась».
 *
 * @param {{dirName: string, manifest: any}[]} plugins
 * @returns {string[]}
 */
export function collectWarnings(plugins) {
  const warnings = [];
  for (const { dirName, manifest } of plugins) {
    const steps = (manifest.migrations ?? []).length;
    if (manifest.schemaVersion > 1 && steps === 0) {
      warnings.push(
        `${dirName}: schemaVersion ${manifest.schemaVersion}, но migrations пуст — ` +
          `цепочки 1 → ${manifest.schemaVersion} нет`,
      );
    }
  }
  return warnings;
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
    warnings: collectWarnings(plugins),
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
        title: manifest.name.en ?? manifest.name.ru,
      })),
    content: renderRegistry(plugins),
    i18nContent: renderI18nRegistry(plugins),
    gamesContent: renderGameDefinitions(plugins),
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

  const { plugins, warnings, content, i18nContent, gamesContent } =
    buildRegistry();
  const summary = plugins
    .map((plugin) => `${plugin.id}@${plugin.version} (order ${plugin.order})`)
    .join(', ');

  // Предупреждения не гейт: они печатаются всегда (и в JSON), чтобы пустая
  // цепочка миграций была видна в отчёте, а не только в чьей-то памяти.
  const printWarnings = () => {
    for (const warning of warnings) console.warn(`⚠ ${warning}`);
  };

  if (flags.has('--json')) {
    console.log(JSON.stringify({ plugins, warnings }, null, 2));
    return 0;
  }
  printWarnings();

  if (flags.has('--check')) {
    const targets = [
      ['registry.generated.ts', REGISTRY_PATH, content],
      ['i18n.generated.ts', I18N_REGISTRY_PATH, i18nContent],
      ['games.generated.ts', GAMES_DEFS_PATH, gamesContent],
    ];
    let failed = false;
    for (const [label, filePath, expected] of targets) {
      const current = existsSync(filePath)
        ? readFileSync(filePath, 'utf8')
        : '';
      if (current === expected) continue;
      failed = true;
      console.error(
        `✗ src/games/${label} устарел: манифесты и файл расходятся.`,
      );
      console.error('  Пересоберите: npm run plugins:generate');
      const currentLines = current.split('\n');
      const nextLines = expected.split('\n');
      const index = nextLines.findIndex((line, i) => currentLines[i] !== line);
      if (index >= 0) {
        console.error(`  первое расхождение — строка ${index + 1}:`);
        console.error(`    в файле:  ${currentLines[index] ?? '∅'}`);
        console.error(`    ожидается: ${nextLines[index]}`);
      }
    }
    if (failed) return 1;
    console.log(
      `✓ registry.generated.ts, i18n.generated.ts и games.generated.ts в синхроне · ${summary}`,
    );
    return 0;
  }

  writeFileSync(REGISTRY_PATH, content, 'utf8');
  writeFileSync(I18N_REGISTRY_PATH, i18nContent, 'utf8');
  writeFileSync(GAMES_DEFS_PATH, gamesContent, 'utf8');
  console.log(
    `✓ registry/i18n/games.generated.ts: ${plugins.length} плагин(ов) · ${summary}`,
  );
  if (warnings.length > 0) {
    console.log(
      `  предупреждений: ${warnings.length} (гейт на цепочки миграций — этап 4)`,
    );
  }
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
