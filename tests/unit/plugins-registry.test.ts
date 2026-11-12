import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import * as dh1 from '@/games/dh1';
import * as dh2 from '@/games/dh2';
import * as dnd5e from '@/games/dnd5e';
import {
  parseEntryPoint,
  PLUGIN_API_VERSION,
  type PluginManifest,
} from '@/games/plugin-api';
import { gamePlugins, gameRegistry, getPluginManifest } from '@/games/registry';

/**
 * ─── LANDMARK: PLUGIN REGISTRY TESTS ──────────────────────────────────────
 * Conformance «манифест ↔ модуль» (этап 1 плана `_NEW_FUTURE2_PROMPT.md`):
 *
 *   • `plugin.json` каждого плагина описывает именно свой модуль
 *     (id, игра, порядок, schemaVersion, точки входа);
 *   • сгенерированный реестр совпадает с манифестами побайтно;
 *   • код плагина не перечисляется в ядре: фиктивная папка с манифестом
 *     попадает в реестр без правок `registry.ts`;
 *   • ошибки манифеста (нет файла, дубль id, разрыв цепочки миграций)
 *     ловятся на этапе генерации.
 */

type Generator = {
  collectManifests(gamesDir?: string): {
    dirName: string;
    dir: string;
    manifest: PluginManifest;
  }[];
  buildRegistry(options?: { gamesDir?: string; schemaPath?: string }): {
    plugins: {
      id: string;
      order: number;
      version: string;
      schemaVersion: number;
      gameId: string;
      title: string;
    }[];
    content: string;
  };
  validatePluginFolder(input: {
    gamesDir: string;
    dirName: string;
    manifest: PluginManifest;
  }): string[];
  validateCollection(
    plugins: { dirName: string; manifest: PluginManifest }[],
  ): string[];
  isHostApiCompatible(range: string, hostVersion?: string): boolean;
  renderRegistry(
    plugins: { dirName: string; manifest: PluginManifest }[],
  ): string;
  GAMES_DIR: string;
  REGISTRY_PATH: string;
  SCHEMA_PATH: string;
};

let cached: Promise<Generator> | undefined;
function generator(): Promise<Generator> {
  cached ??= import('../../scripts/plugins/generate.mjs').then(
    (module) => module as unknown as Generator,
  );
  return cached;
}

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const MODULE_NAMESPACES: Record<string, Record<string, unknown>> = {
  dnd5e,
  dh1,
  dh2,
};

/** Манифест фиктивного плагина; `overrides` — точечные правки для тестов. */
function exampleManifest(
  overrides: Record<string, unknown> = {},
): PluginManifest {
  return {
    manifestVersion: 1,
    pluginApi: '^1.0.0',
    id: 'example',
    gameId: 'exampleGame',
    version: '0.1.0',
    order: 90,
    defaultStatus: 'hidden',
    name: { en: 'Example', ru: 'Пример' },
    description: { en: 'Fixture plugin', ru: 'Фиктивный плагин' },
    tags: [],
    author: 'tests',
    license: 'MIT',
    schemaVersion: 2,
    game: {
      id: 'exampleGame',
      order: 90,
      name: { en: 'Example game', ru: 'Пример игры' },
    },
    dependencies: { host: '^1.0.0', plugins: {} },
    entry: { module: 'index.ts#exampleModule' },
    sheet: {
      mode: 'custom',
      client: 'sheet.tsx',
      createForm: 'create-form.tsx',
    },
    i18n: { en: 'i18n/en.ts', ru: 'i18n/ru.ts' },
    demo: { entry: 'index.ts#createDemo' },
    export: {
      json: 'index.ts#toPortableJson',
      excel: 'index.ts#buildExcelSections',
    },
    migrations: [],
    tests: { conformance: '>=1' },
    ...overrides,
  } as PluginManifest;
}

/** Временное `src/games` с одним плагином из манифеста. */
function sandboxPlugin(
  manifest: PluginManifest = exampleManifest(),
  files: Record<string, string> = {},
): { gamesDir: string; pluginDir: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-plugins-'));
  tempDirs.push(root);
  const gamesDir = path.join(root, 'src/games');
  const pluginDir = path.join(gamesDir, manifest.id);
  fs.mkdirSync(path.join(pluginDir, 'i18n'), { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'plugin.json'),
    JSON.stringify(manifest, null, 2),
    'utf8',
  );
  const defaults: Record<string, string> = {
    'index.ts': 'export const exampleModule = {};\n',
    'sheet.tsx': 'export const ExampleSheet = () => null;\n',
    'create-form.tsx': 'export const ExampleForm = () => null;\n',
    'i18n/en.ts': 'export const en = {};\n',
    'i18n/ru.ts': 'export const ru = {};\n',
  };
  for (const [file, source] of Object.entries({ ...defaults, ...files })) {
    fs.mkdirSync(path.dirname(path.join(pluginDir, file)), { recursive: true });
    fs.writeFileSync(path.join(pluginDir, file), source, 'utf8');
  }
  return { gamesDir, pluginDir };
}

describe('сгенерированный реестр', () => {
  it('совпадает с манифестами побайтно (plugins:check в тестах)', async () => {
    const { buildRegistry, REGISTRY_PATH } = await generator();
    const { content } = buildRegistry();
    expect(fs.readFileSync(REGISTRY_PATH, 'utf8')).toBe(content);
  });

  it('содержит ровно три встроенных плагина в порядке показа', async () => {
    const { buildRegistry } = await generator();
    const { plugins } = buildRegistry();
    expect(plugins.map((plugin) => plugin.id)).toEqual(['dnd5e', 'dh1', 'dh2']);
    expect(plugins.map((plugin) => plugin.order)).toEqual([10, 20, 30]);
  });

  it('реестр собран из сгенерированного списка, а не из ручного', () => {
    expect(gameRegistry.modules.map((gameModule) => gameModule.id)).toEqual([
      'dnd5e',
      'dh1',
      'dh2',
    ]);
    expect(gamePlugins.map((plugin) => plugin.manifest.id)).toEqual([
      'dnd5e',
      'dh1',
      'dh2',
    ]);
  });

  it.each([['dnd5e'], ['dh1'], ['dh2']])(
    'манифест %s совпадает с модулем',
    async (id) => {
      const manifest = getPluginManifest(id);
      expect(manifest, `нет манифеста для ${id}`).toBeDefined();
      const gameModule = gameRegistry.require(id);
      expect(manifest!.id).toBe(gameModule.id);
      expect(manifest!.gameId).toBe(gameModule.gameId);
      expect(manifest!.order).toBe(gameModule.order);
      expect(manifest!.defaultStatus).toBe(gameModule.defaultStatus);
      expect(manifest!.schemaVersion).toBe(gameModule.schemaVersion);
      expect(manifest!.game.id).toBe(gameModule.gameId);

      // Точки входа — реальные экспорты модуля, а не только поля объекта:
      // `entry.module` — сам объект модуля, остальные — функции.
      const namespace = MODULE_NAMESPACES[id];
      expect(namespace, `нет namespace для ${id}`).toBeDefined();
      const moduleEntry = parseEntryPoint(manifest!.entry.module);
      expect(moduleEntry.member).toBeDefined();
      expect(typeof namespace[moduleEntry.member!], `${id}: module entry`).toBe(
        'object',
      );
      for (const entry of [
        manifest!.demo.entry,
        manifest!.export.json,
        manifest!.export.excel,
      ]) {
        const member = parseEntryPoint(entry).member;
        expect(typeof namespace[member!], `${id}: ${entry}`).toBe('function');
      }
    },
  );

  it.each([['dnd5e'], ['dh1'], ['dh2']])(
    'демо-персонаж %s проходит схему модуля',
    (id) => {
      const gameModule = gameRegistry.require(id);
      const parsed = gameModule.schema.safeParse({
        ...gameModule.createDemo(),
        id: 'demo-fixture',
      });
      expect(parsed.success, parsed.success ? '' : parsed.error.message).toBe(
        true,
      );
    },
  );

  it('каждый плагин реализует normalize и merge (этап 2)', () => {
    for (const plugin of gamePlugins) {
      expect(typeof plugin.module.normalize, plugin.manifest.id).toBe(
        'function',
      );
      expect(typeof plugin.module.merge, plugin.manifest.id).toBe('function');
    }
  });

  it.each([['dnd5e'], ['dh1'], ['dh2']])(
    'normalize плагина %s идемпотентен и молчит на дефолтах',
    (id) => {
      const plugin = gamePlugins.find((entry) => entry.manifest.id === id);
      const normalize = plugin?.module.normalize;
      expect(normalize).toBeTypeOf('function');
      const draft = { ...plugin!.module.createDefaults(), id: 'fixture' };
      const first = normalize!(draft);
      const second = normalize!(first.character);
      expect(second.character).toEqual(first.character);
      expect(second.warnings ?? []).toEqual([]);
    },
  );

  it('словари плагинов имеют паритет en/ru', () => {
    for (const plugin of gamePlugins) {
      const { en, ru } = plugin.module.i18n;
      expect(Object.keys(en).sort(), plugin.manifest.id).toEqual(
        Object.keys(ru).sort(),
      );
    }
  });

  it('манифесты и модули объявляют одну и ту же цепочку миграций', () => {
    for (const plugin of gamePlugins) {
      const { manifest, module } = plugin;
      expect(manifest.migrations).toHaveLength(module.migrations.length);
      manifest.migrations.forEach((migration, index) => {
        expect(migration.from).toBe(module.migrations[index].from);
        expect(migration.to).toBe(module.migrations[index].to);
        expect(
          typeof MODULE_NAMESPACES[manifest.id][
            parseEntryPoint(migration.entry).member!
          ],
        ).toBe('function');
      });
      // Пока цепочка пуста (миграции в ядре, этап 2), покрывать нечего.
      expect(manifest.migrations).toEqual([]);
    }
  });

  it('блок game одинаков у редакций одного семейства (D17)', () => {
    const games = new Map<string, PluginManifest['game']>();
    for (const plugin of gamePlugins) {
      const known = games.get(plugin.manifest.gameId);
      if (known) {
        expect(plugin.manifest.game).toEqual(known);
      } else {
        games.set(plugin.manifest.gameId, plugin.manifest.game);
      }
    }
    expect(games.size).toBe(2);
  });

  it('названия и описания заполнены на обоих языках', () => {
    for (const plugin of gamePlugins) {
      for (const locale of ['en', 'ru'] as const) {
        expect(plugin.manifest.name[locale].length).toBeGreaterThan(0);
        expect(plugin.manifest.description[locale].length).toBeGreaterThan(0);
      }
    }
  });

  it('plugin API и версии манифеста свежие', async () => {
    const { isHostApiCompatible } = await generator();
    for (const plugin of gamePlugins) {
      expect(plugin.manifest.manifestVersion).toBe(1);
      expect(isHostApiCompatible(plugin.manifest.pluginApi)).toBe(true);
      expect(PLUGIN_API_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});

describe('фиктивный плагин добавляется папкой + манифестом', () => {
  it('попадает в манифесты и в сгенерированный реестр', async () => {
    const { buildRegistry, SCHEMA_PATH } = await generator();
    const manifest = exampleManifest();
    const { gamesDir } = sandboxPlugin(manifest);

    const { plugins, content } = buildRegistry({
      gamesDir,
      schemaPath: SCHEMA_PATH,
    });
    expect(plugins.map((plugin) => plugin.id)).toEqual(['example']);
    expect(content).toContain("import { exampleModule } from './example';");
    expect(content).toContain(
      "import exampleManifest from './example/plugin.json';",
    );
    expect(content).toContain('module: exampleModule');
  });

  it('удаление папки убирает плагин из реестра, не ломая генерацию', async () => {
    const { buildRegistry, SCHEMA_PATH } = await generator();
    const { gamesDir } = sandboxPlugin(exampleManifest());
    expect(
      buildRegistry({ gamesDir, schemaPath: SCHEMA_PATH }).plugins.map(
        (plugin) => plugin.id,
      ),
    ).toEqual(['example']);

    fs.rmSync(path.join(gamesDir, 'example'), { recursive: true });

    const after = buildRegistry({ gamesDir, schemaPath: SCHEMA_PATH });
    expect(after.plugins).toEqual([]);
    expect(after.content).not.toContain("from './example'");
  });

  it('не требует правок ядра: реестр собирается из любой папки', async () => {
    const { renderRegistry } = await generator();
    const another = exampleManifest({
      id: 'another',
      order: 95,
      entry: { module: 'index.ts#anotherModule' },
      game: {
        id: 'exampleGame',
        order: 90,
        name: { en: 'Example game', ru: 'Пример игры' },
      },
    });
    sandboxPlugin(another);
    const content = renderRegistry([
      { dirName: 'example', manifest: exampleManifest() },
      { dirName: 'another', manifest: another },
    ]);
    // Импорты — по алфавиту, записи — по order.
    expect(content).toContain("from './another'");
    expect(content).toContain('module: anotherModule');
    expect(content).toContain('module: exampleModule');
    expect(content.indexOf('module: exampleModule')).toBeLessThan(
      content.indexOf('module: anotherModule'),
    );
  });
});

describe('ошибки манифеста ловятся при генерации', () => {
  it('несуществующий файл точки входа', async () => {
    const { validatePluginFolder } = await generator();
    const manifest = exampleManifest();
    const { gamesDir } = sandboxPlugin(manifest, {});
    fs.rmSync(path.join(gamesDir, 'example/sheet.tsx'));
    const errors = validatePluginFolder({
      gamesDir,
      dirName: 'example',
      manifest,
    });
    expect(errors.join('\n')).toContain('sheet.client: файл не найден');
  });

  it('id не совпадает с именем папки', async () => {
    const { validatePluginFolder } = await generator();
    const manifest = exampleManifest({ id: 'renamed' });
    const { gamesDir } = sandboxPlugin(exampleManifest());
    const errors = validatePluginFolder({
      gamesDir,
      dirName: 'example',
      manifest,
    });
    expect(errors.join('\n')).toContain('не совпадает с именем папки');
  });

  it('entry.module без имени экспорта', async () => {
    const { validatePluginFolder } = await generator();
    const manifest = exampleManifest({ entry: { module: 'index.ts' } });
    const { gamesDir } = sandboxPlugin(manifest);
    expect(
      validatePluginFolder({ gamesDir, dirName: 'example', manifest }).join(
        '\n',
      ),
    ).toContain('должен содержать имя экспорта');
  });

  it('разрыв цепочки миграций', async () => {
    const { validatePluginFolder } = await generator();
    const manifest = exampleManifest({
      schemaVersion: 3,
      migrations: [
        { from: 1, to: 2, entry: 'index.ts#migrateV1toV2' },
        { from: 2, to: 4, entry: 'index.ts#migrateV2toV4' },
      ],
    });
    const { gamesDir } = sandboxPlugin(manifest);
    const errors = validatePluginFolder({
      gamesDir,
      dirName: 'example',
      manifest,
    }).join('\n');
    expect(errors).toContain('должен вести в 3');
    expect(errors).toContain('schemaVersion = 3');
  });

  it('дубли order и id в наборе', async () => {
    const { validateCollection } = await generator();
    const errors = validateCollection([
      { dirName: 'example', manifest: exampleManifest() },
      { dirName: 'example2', manifest: exampleManifest() },
    ]).join('\n');
    expect(errors).toContain('дублирующийся id');
    expect(errors).toContain('дублирующийся order');
  });

  it('расхождение game-блока у редакций одной игры (D17)', async () => {
    const { validateCollection } = await generator();
    const errors = validateCollection([
      { dirName: 'example', manifest: exampleManifest() },
      {
        dirName: 'example2',
        manifest: exampleManifest({
          id: 'example2',
          order: 91,
          game: {
            id: 'exampleGame',
            order: 91,
            name: { en: 'Other', ru: 'Другая' },
          },
        }),
      },
    ]).join('\n');
    expect(errors).toContain('блок game отличается');
  });

  it('несовместимый pluginApi', async () => {
    const { validateCollection } = await generator();
    const errors = validateCollection([
      {
        dirName: 'example',
        manifest: exampleManifest({ pluginApi: '^2.0.0' }),
      },
    ]).join('\n');
    expect(errors).toContain('pluginApi');
  });
});

describe('разбор точек входа и версий API', () => {
  it('parseEntryPoint разделяет файл и экспорт', () => {
    expect(parseEntryPoint('index.ts#createDemo')).toEqual({
      file: 'index.ts',
      member: 'createDemo',
    });
    expect(parseEntryPoint('i18n/en.ts')).toEqual({ file: 'i18n/en.ts' });
    expect(() => parseEntryPoint('index.ts#a#b')).toThrow(/Некорректная/);
    expect(() => parseEntryPoint('../outside.ts#x')).toThrow(/относительным/);
    expect(() => parseEntryPoint('/abs.ts#x')).toThrow(/относительным/);
    expect(() => parseEntryPoint('index.ts#bad-name')).toThrow(/экспорта/);
  });

  it('isHostApiCompatible понимает ^, ~, >= и точную версию', async () => {
    const { isHostApiCompatible } = await generator();
    expect(isHostApiCompatible('^1.0.0')).toBe(true);
    expect(isHostApiCompatible('^1.5.0')).toBe(false);
    expect(isHostApiCompatible('^2.0.0')).toBe(false);
    expect(isHostApiCompatible('~1.0.0')).toBe(true);
    expect(isHostApiCompatible('~1.1.0')).toBe(false);
    expect(isHostApiCompatible('>=1.0.0')).toBe(true);
    expect(isHostApiCompatible('1.0.0')).toBe(true);
    expect(isHostApiCompatible('0.9.0')).toBe(false);
    expect(isHostApiCompatible('*')).toBe(true);
    expect(isHostApiCompatible('not-a-version')).toBe(false);
  });
});
