import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { GeneratedPluginRegistration } from '@/games/plugin-api';
import { gamePlugins } from '@/games/registry';
import {
  applyCharacterMigrations,
  normalizeCharacterRecord,
} from '@/lib/character-version';

/**
 * ─── LANDMARK: MIGRATION CHAINS ───────────────────────────────────────────
 * Цепочка `1 → schemaVersion` проверяется на реальных legacy-документах
 * (`scripts/legacy-migration/examples`, обезличенные) и на демо-листах:
 *
 *   • цепочка объявлена и совпадает с `module.migrations` (from/to + экспорт);
 *   • проход по цепочке ничего не теряет, кроме полей, объявленных шагом в
 *     `removes`, и тех, что редакция по правилам переносит в `notes`;
 *   • повторный проход идемпотентен;
 *   • документ более новой версии не трогается;
 *   • гейт генератора падает на `schemaVersion > 1` без цепочки.
 */

type Plugin = GeneratedPluginRegistration;

const plugins = (gamePlugins as readonly Plugin[]).filter(
  (plugin) => plugin.manifest.schemaVersion > 1,
);

/**
 * Поля, которые редакция удаляет из структуры сознательно, перенося значения
 * в `notes` (см. `src/games/<id>/normalize.ts`): потерянных данных нет, но
 * ключа в документе больше нет. Объявлять их в манифесте нельзя — они
 * вложенные, а `removes` описывает верхний уровень.
 */
const NESTED_REMOVALS = [
  'stats.influence',
  'statUpgrades.influence',
  'statNotes.influence',
];

function legacyDocuments(): Record<string, unknown>[] {
  const file = path.join(
    process.cwd(),
    'scripts/legacy-migration/examples/import-source.example.json',
  );
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>[];
}

/** Все листовые пути документа: `stats.influence`, `skills.0.name`, … */
function leafPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      leafPaths(item, `${prefix}${prefix ? '.' : ''}${index}`),
    );
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(
      ([key, child]) => leafPaths(child, `${prefix}${prefix ? '.' : ''}${key}`),
    );
  }
  return [prefix];
}

function declaredRemovals(plugin: Plugin): string[] {
  return (plugin.manifest.migrations ?? []).flatMap(
    (migration) => migration.removes ?? [],
  );
}

/** Отбросить служебные пути, которых не было в исходном legacy-формате. */
function isAllowedLoss(plugin: Plugin, lost: string): boolean {
  const removals = declaredRemovals(plugin);
  if (
    removals.some((field) => lost === field || lost.startsWith(`${field}.`))
  ) {
    return true;
  }
  return NESTED_REMOVALS.some(
    (field) => lost === field || lost.startsWith(`${field}.`),
  );
}

function chainFor(plugin: Plugin, from: number, doc: Record<string, unknown>) {
  return applyCharacterMigrations(plugin.module.migrations, doc, from);
}

describe('цепочки миграций: объявление', () => {
  it.each(plugins.map((plugin) => [plugin.manifest.id, plugin] as const))(
    '%s: манифест описывает ту же цепочку, что и модуль',
    (_id, plugin) => {
      const manifestSteps = [...(plugin.manifest.migrations ?? [])].sort(
        (a, b) => a.from - b.from,
      );
      const moduleSteps = [...plugin.module.migrations].sort(
        (a, b) => a.from - b.from,
      );
      expect(manifestSteps.length).toBe(moduleSteps.length);
      expect(moduleSteps.map((step) => [step.from, step.to])).toEqual(
        manifestSteps.map((step) => [step.from, step.to]),
      );
      const last = moduleSteps[moduleSteps.length - 1];
      expect(last.to).toBe(plugin.manifest.schemaVersion);
      // Первый шаг обязан начинаться с v1: иначе из v1 пути нет.
      expect(moduleSteps[0].from).toBe(1);
    },
  );
});

describe('цепочки миграций: lossless на корпусе', () => {
  const documents = legacyDocuments();

  it('корпус содержит legacy-документы', () => {
    expect(documents.length).toBeGreaterThan(0);
  });

  for (const plugin of plugins) {
    it(`${plugin.manifest.id}: проход по цепочке не теряет полей`, () => {
      const owned = documents.filter((doc) => {
        const resolved = normalizeCharacterRecord(doc).character as {
          systemId?: string;
        };
        return resolved.systemId === plugin.manifest.id;
      });
      // У редакции может не оказаться документов в корпусе — это не ошибка.
      if (owned.length === 0) return;

      for (const doc of owned) {
        const migrated = chainFor(plugin, 1, doc).character;
        const before = new Set(leafPaths(doc));
        const after = new Set(leafPaths(migrated));
        const lost = [...before].filter(
          (field) => !after.has(field) && !isAllowedLoss(plugin, field),
        );
        expect(lost, `${plugin.manifest.id}: ${JSON.stringify(lost)}`).toEqual(
          [],
        );
      }
    });

    it(`${plugin.manifest.id}: повторный проход идемпотентен`, () => {
      const demo = {
        id: `${plugin.manifest.id}-chain`,
        ...plugin.module.createDemo(),
      };
      const once = chainFor(plugin, 1, demo).character;
      const twice = chainFor(plugin, 1, once).character;
      expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
    });
  }
});

describe('цепочки миграций: версии', () => {
  it('документ новее поддерживаемой версии не трогается', () => {
    const plugin = plugins[0];
    const newer = {
      id: 'future-sheet',
      systemId: plugin.manifest.id,
      schemaVersion: plugin.manifest.schemaVersion + 5,
      name: 'Из будущего',
    };
    const result = normalizeCharacterRecord(newer);
    expect(result.changed).toBe(false);
    expect(result.migrationsApplied).toBe(0);
    expect(result.issues.join('\n')).toContain('новее поддерживаемой');
  });

  it('проход начинается с версии, которую объявил файл', () => {
    const plugin = plugins[0];
    const demo = {
      id: `${plugin.manifest.id}-from-middle`,
      ...plugin.module.createDemo(),
    };
    // Документ уже на последней версии: ни один шаг применяться не должен.
    const result = applyCharacterMigrations(
      plugin.module.migrations,
      demo,
      plugin.manifest.schemaVersion,
    );
    expect(result.applied).toBe(0);
    expect(result.character).toEqual(demo);
  });
});

describe('цепочки миграций: гейт генератора', () => {
  type Generator = {
    validatePluginFolder(input: {
      gamesDir: string;
      dirName: string;
      manifest: Record<string, unknown>;
    }): string[];
  };

  it('schemaVersion > 1 с пустой цепочкой — ошибка манифеста', async () => {
    const { validatePluginFolder } =
      (await import('../../scripts/plugins/generate.mjs')) as unknown as Generator;
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'tests/fixtures/example-plugin/plugin.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    const errors = validatePluginFolder({
      gamesDir: path.join(process.cwd(), 'tests/fixtures'),
      dirName: 'example-plugin',
      manifest: { ...manifest, migrations: [], schemaVersion: 3 },
    }).join('\n');
    expect(errors).toContain('цепочка пуста');
  });
});
