import { describe, expect, it } from 'vitest';

import { parseEntryPoint, type PluginManifest } from '@/games/plugin-api';
import { gamePlugins } from '@/games/registry';
import { translations } from '@/lib/i18n';

import { sandboxBulkEditor } from '../../bulk-editor';
import { createSandboxDefaults } from '../../defaults';
import { createSandboxDemo } from '../../demo';
import { deriveSandbox } from '../../derive';
import { sandboxHistory } from '../../history';
import { mergeSandboxData } from '../../merge';
import { normalizeSandbox } from '../../normalize';
import rawManifest from '../../plugin.json';
import type { SandboxCharacter } from '../../types';
import { uiSlots } from '../../ui';

/**
 * ─── LANDMARK: SANDBOX CONTRACT ───────────────────────────────────────────
 * Договорённости эталонной игры, которые не видны в схеме: полный набор
 * UI-слотов, таблицы массового редактора, подписи истории, derive и импорт.
 * Это же — пример того, какие проверки стоит писать внутри своего плагина.
 */
const manifest = rawManifest as unknown as PluginManifest;

describe('sandbox: контракт плагина', () => {
  it('объявленные UI-слоты совпадают с реализованными', () => {
    const declared = [...(manifest.ui?.slots ?? [])].sort();
    const implemented = Object.entries(uiSlots)
      .filter(([name, value]) => value !== undefined && name !== 'favicon')
      .map(([name]) => name)
      .sort();
    expect(implemented).toEqual(declared);
    expect(uiSlots.favicon).toContain('/games/sandbox/assets/');
  });

  it('таблица массового редактора пишет stats и total', () => {
    expect(sandboxBulkEditor.map((table) => table.id)).toEqual([
      'sandbox-stats',
    ]);
    const table = sandboxBulkEditor[0];
    const character = createSandboxDefaults() as SandboxCharacter;
    const patch = table.apply(character, { might: 40, wits: 30 });
    expect(patch.stats).toMatchObject({ might: 40, wits: 30 });
    expect(patch.total).toBe(70);
    expect(character.stats).toEqual({ might: 10, wits: 10 });
  });

  it('derive считает total и не мутирует вход', () => {
    const input = createSandboxDemo() as SandboxCharacter;
    const snapshot = structuredClone(input);
    const output = deriveSandbox(input);
    expect(output.total).toBe(65);
    expect(input).toEqual(snapshot);
    expect(deriveSandbox(output)).toEqual(output);
  });

  it('импорт: merge пересчитывает total, а normalize терпит старый лист', () => {
    const target = createSandboxDefaults({
      name: 'Target',
    }) as SandboxCharacter;
    const merged = mergeSandboxData(
      target,
      { stats: { might: 20, wits: 15 }, rank: 'Adept' },
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
    );
    expect(merged.rank).toBe('Adept');
    expect(merged.total).toBe(35);

    const legacy = normalizeSandbox({ name: 'Old', stats: { might: 7 } });
    expect(legacy.character.stats).toEqual({ might: 7, wits: 10 });
    expect(legacy.character.total).toBe(17);
  });

  it('подписи истории есть в обоих словарях', () => {
    const keys: string[] = [
      ...Object.values(sandboxHistory.labels ?? {}),
      ...Object.values(sandboxHistory.tokens ?? {}).flatMap((value) =>
        typeof value === 'string'
          ? [value]
          : typeof value === 'object' && value !== null
            ? Object.values(value)
            : [],
      ),
    ].filter((key): key is string => typeof key === 'string');
    for (const key of keys) {
      expect(translations.en[key], `en ${key}`).toBeDefined();
      expect(translations.ru[key], `ru ${key}`).toBeDefined();
    }
  });

  it('реестр подключает derive из манифеста', () => {
    const entry = gamePlugins.find(
      (plugin) => plugin.manifest.id === manifest.id,
    );
    expect(entry?.derive).toBeTypeOf('function');
    expect(parseEntryPoint(manifest.derive!.entry).member).toBe(
      'deriveCharacter',
    );
  });
});
