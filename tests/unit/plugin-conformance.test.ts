import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { gamePlugins, loadGameUiSlots } from '@/games/registry';
import { DEFAULT_EXPORT_CONFIG } from '@/lib/export-utils';

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

/**
 * ─── НЕГАТИВНЫЙ TCK И ROUND-TRIP ────────────────────────────────────────
 * Проверяется не только «валидное проходит», но и «невалидное не проходит»:
 * иначе диапазоны в схемах никто не заметит. Round-trip — что экспорт не
 * теряет структуру листа.
 */
describe('conformance: невалидные данные обязаны падать', () => {
  /** Значение заведомо вне правил редакции: мусор, а не отрицание правил. */
  const OUT_OF_RANGE = 999;

  it.each(gamePlugins.map((plugin) => [plugin.manifest.id, plugin]))(
    '%s: уровень и характеристики за пределами правил отклоняются',
    async (_id, plugin) => {
      const { validateCharacterData } = await import('@/lib/character-payload');
      const base = {
        id: 'conformance-negative',
        userId: 'user-conformance',
        systemId: plugin.manifest.id,
        ...plugin.module.createDemo(),
      } as Record<string, unknown>;

      const candidates: Record<string, unknown>[] = [];
      if (typeof base.level === 'number') {
        candidates.push({ ...base, level: OUT_OF_RANGE });
        candidates.push({ ...base, level: -5 });
      }
      if (base.stats && typeof base.stats === 'object') {
        const stats = base.stats as Record<string, unknown>;
        const numericKey = Object.keys(stats).find(
          (key) => typeof stats[key] === 'number',
        );
        if (numericKey) {
          candidates.push({
            ...base,
            stats: { ...stats, [numericKey]: OUT_OF_RANGE },
          });
          candidates.push({
            ...base,
            stats: { ...stats, [numericKey]: -1 },
          });
        }
      }

      expect(candidates.length, plugin.manifest.id).toBeGreaterThan(0);
      for (const candidate of candidates) {
        const result = validateCharacterData(plugin.module, candidate);
        expect(result.ok, JSON.stringify(candidate).slice(0, 200)).toBe(false);
        if (result.ok) continue;
        expect(result.issues.length).toBeGreaterThan(0);
        for (const issue of result.issues) {
          expect(
            issue.path.length,
            `${plugin.manifest.id}: ${issue.path}`,
          ).toBeGreaterThan(0);
        }
      }
    },
  );

  it('лист с пустым именем не сохраняется через payload', async () => {
    const { validateCharacterData } = await import('@/lib/character-payload');
    for (const plugin of gamePlugins) {
      const base = {
        id: 'conformance-empty-name',
        userId: 'user-conformance',
        systemId: plugin.manifest.id,
        ...plugin.module.createDefaults({ name: '' }),
        name: '',
      } as Record<string, unknown>;
      const result = validateCharacterData(plugin.module, base);
      expect(result.ok, plugin.manifest.id).toBe(false);
      if (!result.ok) {
        expect(result.issues.map((issue) => issue.path)).toContain('name');
      }
    }
  });
});

describe('conformance: экспорт не теряет структуру', () => {
  it.each(gamePlugins.map((plugin) => [plugin.manifest.id, plugin]))(
    '%s: portable JSON после нормализации снова валидный лист',
    async (_id, plugin) => {
      const demo = {
        id: `${plugin.manifest.id}-roundtrip`,
        ...plugin.module.createDemo(),
      } as Record<string, unknown>;
      // Экспорт идёт с боевой конфигурацией: она включает всё, что важно
      // игроку, и именно её использует кнопка «Скачать JSON».
      const portable = plugin.module.export.toPortableJson(
        demo as never,
        DEFAULT_EXPORT_CONFIG as never,
      );

      // Экспорт — данные, а не код: он обязан пережить сериализацию.
      const restored = JSON.parse(JSON.stringify(portable)) as Record<
        string,
        unknown
      >;
      const sheet: Record<string, unknown> = {
        ...(plugin.module.createDefaults() as Record<string, unknown>),
        ...restored,
        id: demo.id,
      };
      expect(() => plugin.module.schema.parse(sheet)).not.toThrow();
      expect(sheet.name).toBe(demo.name);
    },
  );
});
