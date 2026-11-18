import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { listGameDefinitions } from '@/games/games';
import { generatedI18n } from '@/games/i18n.generated';
import {
  isHostApiCompatible,
  parseEntryPoint,
  PLUGIN_API_VERSION,
  type PluginManifest,
} from '@/games/plugin-api';
import { gamePlugins, gameRegistry } from '@/games/registry';

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

/** Обнаруженные плагины: список id берётся из манифестов, не из литералов. */
const discoveredIds = gamePlugins.map((plugin) => plugin.manifest.id);

/** Манифест фиктивного плагина; `overrides` — точечные правки для тестов. */
function exampleManifest(
  overrides: Record<string, unknown> = {},
): PluginManifest {
  return {
    manifestVersion: 2,
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
      description: { en: 'Fixture game', ru: 'Фиктивная игра' },
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

  it('содержит все обнаруженные плагины в порядке показа', async () => {
    const { buildRegistry, collectManifests } = await generator();
    const { plugins } = buildRegistry();
    const manifests = collectManifests().map(({ manifest }) => manifest);
    const expected = [...manifests].sort(
      (a, b) => a.order - b.order || a.id.localeCompare(b.id),
    );

    expect(expected.length).toBeGreaterThan(0);
    expect(plugins.map((plugin) => plugin.id)).toEqual(
      expected.map((manifest) => manifest.id),
    );
    for (let index = 1; index < plugins.length; index += 1) {
      expect(plugins[index].order, plugins[index].id).toBeGreaterThanOrEqual(
        plugins[index - 1].order,
      );
    }
  });

  it('реестр собран из сгенерированного списка, а не из ручного', () => {
    expect(discoveredIds.length).toBeGreaterThan(0);
    expect(gameRegistry.modules.map((gameModule) => gameModule.id)).toEqual(
      discoveredIds,
    );
    expect(gameRegistry.modules).toHaveLength(gamePlugins.length);
  });

  describe.each(discoveredIds)('плагин %s', (id) => {
    it('манифест совпадает с модулем', () => {
      const plugin = gamePlugins.find((entry) => entry.manifest.id === id);
      expect(plugin, `нет плагина для ${id}`).toBeDefined();
      const { manifest, module: gameModule } = plugin!;

      expect(manifest.id).toBe(gameModule.id);
      expect(manifest.gameId).toBe(gameModule.gameId);
      expect(manifest.order).toBe(gameModule.order);
      expect(manifest.defaultStatus).toBe(gameModule.defaultStatus);
      expect(manifest.schemaVersion).toBe(gameModule.schemaVersion);
      expect(manifest.game.id).toBe(gameModule.gameId);
    });

    // Имя экспорта `index.ts` сверяет тест самой редакции
    // (`src/games/<id>/tests/unit/module.test.ts`): у хоста нет её namespace.
    it('точки входа манифеста резолвятся в функции модуля', () => {
      const plugin = gamePlugins.find((entry) => entry.manifest.id === id);
      expect(plugin, `нет плагина для ${id}`).toBeDefined();
      const { manifest, module: gameModule } = plugin!;

      expect(parseEntryPoint(manifest.entry.module).member).toBeDefined();

      const demoMember = parseEntryPoint(manifest.demo.entry).member!;
      expect(
        typeof (gameModule as unknown as Record<string, unknown>)[demoMember],
        `${id}: ${manifest.demo.entry}`,
      ).toBe('function');

      for (const entry of [manifest.export.json, manifest.export.excel]) {
        const member = parseEntryPoint(entry).member!;
        expect(
          typeof (gameModule.export as unknown as Record<string, unknown>)[
            member
          ],
          `${id}: ${entry}`,
        ).toBe('function');
      }

      for (const migration of manifest.migrations) {
        expect(parseEntryPoint(migration.entry).member).toBeDefined();
      }
    });

    it('демо-персонаж проходит схему модуля', () => {
      const plugin = gamePlugins.find((entry) => entry.manifest.id === id);
      expect(plugin, `нет плагина для ${id}`).toBeDefined();
      const gameModule = plugin!.module;
      const parsed = gameModule.schema.safeParse({
        ...gameModule.createDemo(),
        id: 'demo-fixture',
      });
      expect(parsed.success, parsed.success ? '' : parsed.error.message).toBe(
        true,
      );
    });

    it('normalize идемпотентен и молчит на дефолтах', () => {
      const plugin = gamePlugins.find((entry) => entry.manifest.id === id);
      expect(plugin, `нет плагина для ${id}`).toBeDefined();
      const normalize = plugin!.module.normalize;
      expect(normalize).toBeTypeOf('function');
      const draft = { ...plugin!.module.createDefaults(), id: 'fixture' };
      const first = normalize!(draft);
      const second = normalize!(first.character);
      expect(second.character).toEqual(first.character);
      expect(second.warnings ?? []).toEqual([]);
    });
  });

  it('каждый плагин реализует normalize и merge (этап 2)', () => {
    for (const plugin of gamePlugins) {
      expect(typeof plugin.module.normalize, plugin.manifest.id).toBe(
        'function',
      );
      expect(typeof plugin.module.merge, plugin.manifest.id).toBe('function');
    }
  });

  it('все объявленные локали плагина имеют паритет ключей', () => {
    for (const plugin of gamePlugins) {
      const locales = Object.keys(plugin.manifest.i18n).sort();
      const dictionaries = generatedI18n[plugin.manifest.id];
      expect(locales.length, plugin.manifest.id).toBeGreaterThan(0);
      const reference = Object.keys(dictionaries[locales[0]] ?? {}).sort();
      expect(reference.length, plugin.manifest.id).toBeGreaterThan(0);
      for (const locale of locales) {
        expect(
          Object.keys(dictionaries[locale] ?? {}).sort(),
          `${plugin.manifest.id}: ${locale}`,
        ).toEqual(reference);
      }
    }
  });

  it('манифесты и модули объявляют одну и ту же цепочку миграций', () => {
    for (const plugin of gamePlugins) {
      const { manifest, module } = plugin;
      expect(manifest.migrations).toHaveLength(module.migrations.length);
      manifest.migrations.forEach((migration, index) => {
        expect(migration.from).toBe(module.migrations[index].from);
        expect(migration.to).toBe(module.migrations[index].to);
        // Имя экспорта миграции сверяет тест редакции: у хоста нет её
        // namespace, а сам формат точки входа проверяется здесь.
        expect(parseEntryPoint(migration.entry).member).toBeDefined();
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
    // Семейств столько же, сколько сгенерированных определений игр.
    expect([...games.keys()].sort()).toEqual(
      listGameDefinitions()
        .map((game) => game.id)
        .sort(),
    );
  });

  it('названия и описания заполнены на обоих языках сайта', () => {
    for (const plugin of gamePlugins) {
      for (const locale of ['en', 'ru'] as const) {
        expect(plugin.manifest.name[locale]?.length ?? 0).toBeGreaterThan(0);
        expect(
          plugin.manifest.description[locale]?.length ?? 0,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('plugin API и версии манифеста свежие', () => {
    for (const plugin of gamePlugins) {
      expect(plugin.manifest.manifestVersion).toBe(2);
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
        description: { en: 'Fixture game', ru: 'Фиктивная игра' },
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
            description: { en: 'Other', ru: 'Другая' },
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
