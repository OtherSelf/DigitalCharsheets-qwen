import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

/**
 * ─── LANDMARK: CORE IMPORTS GATE ──────────────────────────────────────────
 * Ядро не импортирует папки игр — обратное направление к границам плагинов.
 * Гейт обязан ловить и стандартный импорт, и относительный путь, иначе
 * «0 нарушений» значит только то, что сканер ничего не видит.
 */

type Gate = {
  pluginTarget(
    specifier: string,
    fromFile: string,
    plugins: Set<string>,
    root?: string,
  ): string | null;
  listPluginDirs(root?: string): string[];
  checkCoreImports(options?: { root?: string }): {
    filesScanned: number;
    plugins: string[];
    violations: { file: string; plugin: string; specifier: string }[];
  };
};

async function gate(): Promise<Gate> {
  return (await import('../../scripts/plugins/check-core-imports.mjs')) as unknown as Gate;
}

const createdRoots: string[] = [];
const plugins = new Set(['dh1', 'dh2', 'dnd5e']);

afterEach(() => {
  for (const root of createdRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('гейт импортов ядра', () => {
  it('видит импорт папки игры и не трогает контракт', async () => {
    const { pluginTarget } = await gate();
    const fromFile = '/repo/src/lib/helpers.ts';
    expect(pluginTarget('@/games/dh1/sheet', fromFile, plugins)).toBe('dh1');
    expect(pluginTarget('@/games/dnd5e/ui', fromFile, plugins)).toBe('dnd5e');
    for (const contract of [
      '@/games/types',
      '@/games/registry',
      '@/games/registry.generated',
      '@/games/games.generated',
      '@/games/plugin-api',
      '@/games/plugin-host',
      '@/games/character-system',
      '@/games/shared/dh-stats',
      '@/games/i18n/en',
      'react',
    ]) {
      expect(pluginTarget(contract, fromFile, plugins)).toBeNull();
    }
  });

  it('видит относительный импорт внутрь папки плагина', async () => {
    const { pluginTarget } = await gate();
    expect(
      pluginTarget(
        '../games/dh2/sheet',
        '/repo/src/lib/x.ts',
        plugins,
        '/repo',
      ),
    ).toBe('dh2');
    expect(
      pluginTarget('../games/types', '/repo/src/lib/x.ts', plugins, '/repo'),
    ).toBeNull();
  });

  it('посеянный импорт ядра → папка игры валит гейт', async () => {
    const { checkCoreImports } = await gate();
    const root = mkdtempSync(join(tmpdir(), 'dcs-core-imports-'));
    createdRoots.push(root);
    mkdirSync(join(root, 'src/games/mini'), { recursive: true });
    mkdirSync(join(root, 'src/lib'), { recursive: true });
    writeFileSync(
      join(root, 'src/games/mini/plugin.json'),
      JSON.stringify({ id: 'mini' }),
      'utf8',
    );
    writeFileSync(
      join(root, 'src/lib/leak.ts'),
      "import { MiniSheet } from '@/games/mini/sheet';\n",
      'utf8',
    );

    const result = checkCoreImports({ root });
    expect(result.violations).toEqual([
      {
        file: 'src/lib/leak.ts',
        plugin: 'mini',
        specifier: '@/games/mini/sheet',
      },
    ]);
  });

  it('проверяет реальное дерево: нарушений 0, плагины видны', async () => {
    const { checkCoreImports } = await gate();
    const result = checkCoreImports();
    expect(result.filesScanned).toBeGreaterThan(100);
    expect(result.plugins).toContain('dh2');
    expect(result.violations).toEqual([]);
  });
});
