import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CURRENT_SCHEMA_VERSION, PLUGIN_API_VERSION } from '@/games/plugin-api';
import { gamePlugins } from '@/games/registry';

import * as example from '../fixtures/example-plugin';
import { en as exampleEn } from '../fixtures/example-plugin/i18n/en';
import { ru as exampleRu } from '../fixtures/example-plugin/i18n/ru';
import exampleManifest from '../fixtures/example-plugin/plugin.json';
import type { ExampleCharacter } from '../fixtures/example-plugin/types';
import { uiSlots as exampleUiSlots } from '../fixtures/example-plugin/ui';

/**
 * ─── LANDMARK: EXAMPLE PLUGIN CONFORMANCE ─────────────────────────────────
 * Эталонный плагин из `tests/fixtures/example-plugin` прогоняется теми же
 * правилами, что и боевые: манифест → схема → проверки папки → генерация
 * реестра, плюс контракт модуля (дефолты, демо, экспорт, i18n, слоты).
 *
 * Это доказательство приёмочного критерия «новая игра = папка + plugin.json +
 * sheet.tsx/create-form.tsx + пересборка» без правок ядра (этап 3).
 */

const FIXTURE_DIR = path.join(process.cwd(), 'tests/fixtures/example-plugin');

type Generator = {
  buildRegistry(options: { gamesDir: string; schemaPath: string }): {
    plugins: { id: string }[];
    content: string;
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

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** Копирует фикстуру как настоящую папку плагина во временный src/games. */
function installFixture(): { gamesDir: string; schemaPath: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-example-'));
  tempDirs.push(root);
  const gamesDir = path.join(root, 'src/games');
  fs.mkdirSync(gamesDir, { recursive: true });
  fs.cpSync(FIXTURE_DIR, path.join(gamesDir, 'example'), {
    recursive: true,
  });
  const schemaPath = path.join(process.cwd(), 'src/games/plugin.schema.json');
  return { gamesDir, schemaPath };
}

const t = (key: string) => (exampleEn as Record<string, string>)[key] ?? key;

describe('эталонный плагин: манифест', () => {
  it('проходит JSON Schema и проверки папки', async () => {
    const { buildRegistry, validatePluginFolder } = await generator();
    const { gamesDir, schemaPath } = installFixture();

    expect(
      validatePluginFolder({
        gamesDir,
        dirName: 'example',
        manifest: exampleManifest,
      }),
    ).toEqual([]);

    const { plugins, content } = buildRegistry({ gamesDir, schemaPath });
    expect(plugins.map((plugin) => plugin.id)).toEqual(['example']);
    expect(content).toContain("import { exampleModule } from './example';");
    expect(content).toContain('module: exampleModule');
  });

  it('UI-слоты объявлены в манифесте и лежат в ui.ts', () => {
    expect(exampleManifest.ui?.entry).toBe('ui.ts');
    expect([...(exampleManifest.ui?.slots ?? [])].sort()).toEqual(
      Object.keys(exampleUiSlots).sort(),
    );
  });

  it('объявляет API, версию схемы и скрытую видимость', () => {
    expect(exampleManifest.pluginApi).toBe('^1.0.0');
    expect(exampleManifest.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(exampleManifest.defaultStatus).toBe('hidden');
    expect(PLUGIN_API_VERSION).toBe('1.0.0');
    // Фикстура не попадает в боевой реестр.
    expect(gamePlugins.some((plugin) => plugin.manifest.id === 'example')).toBe(
      false,
    );
  });
});

describe('эталонный плагин: модуль', () => {
  it('совпадает с манифестом по id/gameId/order/version схемы', () => {
    expect(example.exampleModule.id).toBe(exampleManifest.id);
    expect(example.exampleModule.gameId).toBe(exampleManifest.gameId);
    expect(example.exampleModule.order).toBe(exampleManifest.order);
    expect(example.exampleModule.schemaVersion).toBe(
      exampleManifest.schemaVersion,
    );
    expect(example.exampleModule.defaultStatus).toBe(
      exampleManifest.defaultStatus,
    );
  });

  it('все точки входа манифеста — реальные экспорты модуля', () => {
    const members = [
      'exampleModule',
      'createDemo',
      'toPortableJson',
      'buildExcelSections',
    ] as const;
    const namespace = example as unknown as Record<string, unknown>;
    for (const member of members) {
      expect(namespace[member], member).toBeDefined();
    }
  });

  it('дефолты и демо проходят собственную схему', () => {
    for (const draft of [example.createDefaults(), example.createDemo()]) {
      const parsed = example.exampleModule.schema.safeParse({
        ...draft,
        id: 'fixture',
      });
      expect(parsed.success, parsed.success ? '' : parsed.error.message).toBe(
        true,
      );
    }
  });

  it('словари имеют паритет en/ru', () => {
    expect(Object.keys(exampleEn).sort()).toEqual(
      Object.keys(exampleRu).sort(),
    );
  });

  it('лист и форма грузятся и являются компонентами', async () => {
    const sheet = await example.exampleModule.components.loadSheet();
    const form = await example.exampleModule.components.loadCreateForm();
    expect(sheet.default).toBeTruthy();
    expect(form.default).toBeTruthy();
  });

  it('экспорт отдаёт портативные поля и секции Excel', () => {
    const character = {
      ...example.createDemo(),
      id: 'fixture',
    } as ExampleCharacter;

    const json = example.toPortableJson(character, {
      includeBasicInfo: true,
      includeStats: true,
      includeCombat: false,
      includeEquipment: false,
      includeInventory: false,
      includeSpells: false,
      includeNarrative: false,
      includeProgression: false,
      includeCompanions: false,
      includeQuestLog: false,
      includeCustomHouseRules: false,
    });
    expect(json).toMatchObject({
      name: 'Example Hero',
      rank: 'Veteran',
      stats: { might: 10, wits: 10 },
    });

    const sections = example.buildExcelSections(
      character,
      {
        includeBasicInfo: true,
        includeStats: true,
        includeCombat: false,
        includeEquipment: false,
        includeInventory: false,
        includeSpells: false,
        includeNarrative: false,
        includeProgression: false,
        includeCompanions: false,
        includeQuestLog: false,
        includeCustomHouseRules: false,
      },
      (key) => (exampleEn as Record<string, string>)[key] ?? key,
    );
    expect(sections.length).toBe(2);
    expect(sections[0].rows).toEqual([['Veteran']]);
  });

  it('UI-слоты работают с хост-переводчиком', () => {
    const character = {
      ...example.createDemo(),
      id: 'fixture',
    } as ExampleCharacter;

    expect(exampleUiSlots.HeaderSubtitle?.(character, t)).toBe('Rank: Veteran');
    expect(exampleUiSlots.CardSummary?.(character, t)).toEqual({
      text: 'Rank Veteran',
      badgeVariant: 'outline',
    });
    expect(exampleUiSlots.CompactNav?.(character)).toEqual([
      { labelKey: 'example.sheetTitle', id: 'info-section' },
    ]);
  });
});
