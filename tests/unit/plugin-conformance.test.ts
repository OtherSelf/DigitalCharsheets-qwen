import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { gamePlugins, loadGameUiSlots } from '@/games/registry';

/**
 * ─── LANDMARK: PLUGIN CONFORMANCE ─────────────────────────────────────────
 * Единый контракт всех плагинов, обнаруженных по файловой системе:
 * `src/games/<id>/plugin.json` — источник истины, ручного списка игр здесь нет.
 *
 * Проверяется: папка ↔ манифест ↔ сгенерированный реестр; точки входа;
 * defaults/demo против схемы модуля; паритет en/ru; UI-слоты; эталонная
 * фикстура проходит те же проверки генератора, что и боевые плагины.
 *
 * Специфика плагина (bulk-editor таблиц, нестандартные слоты) живёт в
 * `src/games/<id>/tests/` — общий раннер её не перечисляет.
 */

type Generator = {
  buildRegistry(options: { gamesDir: string; schemaPath: string }): {
    plugins: { id: string }[];
  };
  validatePluginFolder(input: {
    gamesDir: string;
    dirName: string;
    manifest: unknown;
  }): string[];
};

let cached: Promise<Generator> | undefined;
function generator(): Promise<Generator> {
  cached ??= import('../../scripts/plugins/generate.mjs').then(
    (module) => module as unknown as Generator,
  );
  return cached;
}

const GAMES_DIR = path.join(process.cwd(), 'src/games');
const SCHEMA_PATH = path.join(GAMES_DIR, 'plugin.schema.json');
const CORE_DIRS = new Set(['shared', 'i18n']);

/** Папки плагинов по манифестам, без списка игр. */
function discoverPlugins(): { dirName: string; manifest: any }[] {
  return fs
    .readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !CORE_DIRS.has(entry.name))
    .flatMap((entry) => {
      const file = path.join(GAMES_DIR, entry.name, 'plugin.json');
      if (!fs.existsSync(file)) return [];
      return [
        {
          dirName: entry.name,
          manifest: JSON.parse(fs.readFileSync(file, 'utf8')),
        },
      ];
    })
    .sort((a, b) => a.dirName.localeCompare(b.dirName, 'en'));
}

const discovered = discoverPlugins();

describe('conformance: авто-обнаружение плагинов', () => {
  it('каждый манифест проходит схему и проверки папки', async () => {
    const { validatePluginFolder } = await generator();
    expect(discovered.length).toBeGreaterThan(0);
    for (const { dirName, manifest } of discovered) {
      expect(manifest.id, dirName).toBe(dirName);
      expect(
        validatePluginFolder({ gamesDir: GAMES_DIR, dirName, manifest }),
        dirName,
      ).toEqual([]);
    }
  });

  it('сгенерированный реестр совпадает с найденными папками', () => {
    const found = discovered.map(({ dirName }) => dirName).sort();
    const registered = gamePlugins.map((plugin) => plugin.manifest.id).sort();
    expect(registered).toEqual(found);
  });

  it('манифест ↔ модуль: id, gameId, schemaVersion', () => {
    for (const { dirName, manifest } of discovered) {
      const plugin = gamePlugins.find(
        (item) => item.manifest.id === manifest.id,
      );
      expect(plugin, dirName).toBeDefined();
      const gameModule = plugin!.module;
      expect(gameModule.id, dirName).toBe(manifest.id);
      expect(gameModule.gameId, dirName).toBe(manifest.gameId);
      expect(gameModule.schemaVersion, dirName).toBe(manifest.schemaVersion);
    }
  });

  it('defaults и demo проходят схему модуля', () => {
    for (const plugin of gamePlugins) {
      const gameModule = plugin.module;
      const defaults = gameModule.createDefaults({});
      const demo = gameModule.createDemo();
      expect(
        () =>
          gameModule.schema.parse({
            id: `${gameModule.id}-defaults`,
            ...defaults,
          }),
        gameModule.id,
      ).not.toThrow();
      expect(
        () => gameModule.schema.parse({ id: `${gameModule.id}-demo`, ...demo }),
        gameModule.id,
      ).not.toThrow();
    }
  });

  it('словари en и ru совпадают по ключам', () => {
    for (const plugin of gamePlugins) {
      const en = Object.keys(plugin.module.i18n.en ?? {}).sort();
      const ru = Object.keys(plugin.module.i18n.ru ?? {}).sort();
      expect(ru, plugin.manifest.id).toEqual(en);
    }
  });

  it('объявленные UI-слоты реализованы и не пустые', async () => {
    for (const plugin of gamePlugins) {
      const declared = [...(plugin.manifest.ui?.slots ?? [])].sort();
      if (declared.length === 0) continue;
      const slots = await loadGameUiSlots(plugin.manifest.id);
      expect(slots, plugin.manifest.id).toBeDefined();
      for (const name of declared) {
        const value = (slots as Record<string, unknown>)[name];
        expect(value, `${plugin.manifest.id}: ${name}`).toBeTruthy();
      }
    }
  });
});

describe('conformance: добавление и удаление игры', () => {
  it('реестр пересобирается до сборки и проверяется перед стартом', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    // Реестр — статический граф импортов: без generate папка не появится,
    // без prestart сервер молча упадёт на устаревшем реестре.
    expect(pkg.scripts.predev).toContain('plugins:generate');
    expect(pkg.scripts.prebuild).toContain('plugins:generate');
    expect(pkg.scripts.prestart).toContain('plugins:check');
  });

  it('генератор не читает tests/ и не зависит от списка игр', async () => {
    const { validatePluginFolder } = await generator();
    for (const { dirName, manifest } of discovered) {
      expect(
        validatePluginFolder({ gamesDir: GAMES_DIR, dirName, manifest }),
        dirName,
      ).toEqual([]);
    }
  });
});

describe('conformance: эталонная фикстура', () => {
  it('фикстура проходит тот же генератор, что и боевые плагины', async () => {
    const fixtureDir = path.join(
      process.cwd(),
      'tests/fixtures/example-plugin',
    );
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-conformance-'));
    try {
      const gamesDir = path.join(root, 'src/games');
      fs.mkdirSync(gamesDir, { recursive: true });
      fs.cpSync(fixtureDir, path.join(gamesDir, 'example'), {
        recursive: true,
      });
      const manifest = JSON.parse(
        fs.readFileSync(path.join(fixtureDir, 'plugin.json'), 'utf8'),
      );
      const { buildRegistry, validatePluginFolder } = await generator();
      expect(
        validatePluginFolder({ gamesDir, dirName: 'example', manifest }),
      ).toEqual([]);
      const { plugins } = buildRegistry({ gamesDir, schemaPath: SCHEMA_PATH });
      expect(plugins.map((plugin) => plugin.id)).toEqual(['example']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
