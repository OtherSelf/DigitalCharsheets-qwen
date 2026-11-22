import { describe, expect, it } from 'vitest';

import { parseEntryPoint, type PluginManifest } from '@/games/plugin-api';
import * as sandboxNamespace from '@/games/sandbox';
import type { GameModule } from '@/games/types';

import rawManifest from '../../plugin.json';

/**
 * ─── LANDMARK: SANDBOX MODULE CONTRACT ────────────────────────────────────
 * Эталонная игра проверяет собственный модуль так же, как боевые плагины:
 * метаданные совпадают с манифестом, все точки входа — реальные экспорты,
 * схема/дефолты/демо сходятся, а необязательные ветки SDK действительно
 * объявлены.
 */
const manifest = rawManifest as unknown as PluginManifest;
const sandboxModule = sandboxNamespace.sandboxModule;
const namespace = sandboxNamespace as unknown as Record<string, unknown>;

function memberOf(entry: string): string {
  const { member } = parseEntryPoint(entry);
  expect(member, entry).toBeDefined();
  return member!;
}

function withId(gameModule: GameModule<any>, id = 'sandbox-test') {
  return { ...gameModule.createDefaults(), id };
}

describe('sandbox: модуль плагина', () => {
  it('манифест и модуль описывают одну и ту же игру', () => {
    expect(manifest.id).toBe(sandboxModule.id);
    expect(manifest.gameId).toBe(sandboxModule.gameId);
    expect(manifest.order).toBe(sandboxModule.order);
    expect(manifest.defaultStatus).toBe(sandboxModule.defaultStatus);
    expect(manifest.schemaVersion).toBe(sandboxModule.schemaVersion);
    expect(manifest.schemaVersion).toBe(3);
  });

  it('все точки входа манифеста — реальные экспорты index.ts', () => {
    expect(namespace[memberOf(manifest.entry.module)]).toBe(sandboxModule);
    expect(namespace[memberOf(manifest.demo.entry)]).toBe(
      sandboxModule.createDemo,
    );
    expect(namespace[memberOf(manifest.export.json)]).toBe(
      sandboxModule.export.toPortableJson,
    );
    expect(namespace[memberOf(manifest.export.excel)]).toBe(
      sandboxModule.export.buildExcelSections,
    );
    expect(namespace[memberOf(manifest.derive!.entry)]).toBeTypeOf('function');
    expect(namespace[memberOf(manifest.import!.normalize)]).toBeTypeOf(
      'function',
    );
    expect(namespace[memberOf(manifest.import!.merge)]).toBeTypeOf('function');
    for (const migration of manifest.migrations) {
      expect(typeof namespace[memberOf(migration.entry)]).toBe('function');
    }
  });

  it('дефолты и демо проходят схему', () => {
    for (const draft of [
      sandboxModule.createDefaults(),
      sandboxModule.createDemo(),
    ]) {
      const parsed = sandboxModule.schema.safeParse({
        ...draft,
        id: 'sandbox-schema',
      });
      expect(parsed.success, parsed.success ? '' : parsed.error.message).toBe(
        true,
      );
    }
  });

  it('схема отвергает выход за границы и кривого спутника', () => {
    const demo = withId(sandboxModule);
    expect(
      sandboxModule.schema.safeParse({
        ...demo,
        stats: { might: 999, wits: 10 },
        total: 1009,
      }).success,
    ).toBe(false);
    expect(
      sandboxModule.schema.safeParse({
        ...demo,
        companion: { id: '', name: 'x', kind: 'y', notes: '' },
      }).success,
    ).toBe(false);
  });

  it('capabilities и необязательные хуки объявлены', () => {
    expect(sandboxModule.capabilities.maxStat).toBe(99);
    expect(sandboxModule.capabilities.companion).toBe(true);
    expect(sandboxModule.history?.labels?.total).toBe('sandbox.total');
    expect(sandboxModule.normalize).toBeTypeOf('function');
    expect(sandboxModule.merge).toBeTypeOf('function');
    expect(sandboxModule.findEmbedded).toBeTypeOf('function');
    expect(sandboxModule.updateEmbedded).toBeTypeOf('function');
    expect(sandboxModule.matchesLegacyImport).toBeTypeOf('function');
    expect(sandboxModule.convertLegacyImport).toBeTypeOf('function');
    expect(sandboxModule.migrations).toHaveLength(2);
  });
});
