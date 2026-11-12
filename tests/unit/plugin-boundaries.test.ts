import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

/**
 * ─── LANDMARK: PLUGIN BOUNDARIES TESTS ─────────────────────────────────────
 * Проверка скрипта `scripts/plugins/check-boundaries.mjs`: правила импортов
 * игровых плагинов (этап 0 плана `_NEW_FUTURE2_PROMPT.md`).
 *
 * Тесты на временных каталогах доказывают, что скрипт ловит все четыре класса
 * нарушений, а не только «забыли добавить в список»:
 *   • запрещённый модуль ядра (`@/app`, `fs`);
 *   • относительный импорт за пределы своего плагина (в т.ч. в чужой плагин);
 *   • неизвестный модуль без записи в allowed/legacy;
 *   • расхождение счётчика legacy в обе стороны (храповик долга).
 *
 * Последний тест прогоняет правила по реальному дереву `src/games`, поэтому
 * `npm test` падает и без `npm run verify`, если границы нарушены.
 */

type LegacyEntry = {
  files: number;
  removeBy?: string | null;
  why?: string;
};

type BoundaryConfig = {
  forbidden: { pattern: string; hint: string }[];
  allowed: string[];
  legacy: Record<string, LegacyEntry>;
};

type BoundaryError = { file: string; specifier: string; message: string };

type Report = {
  errors: BoundaryError[];
  counts: Record<string, number>;
  newLegacy: string[];
  staleLegacy: string[];
};

type Checker = {
  extractSpecifiers(source: string): string[];
  isRelativeSpecifier(specifier: string): boolean;
  matchesPattern(specifier: string, pattern: string): boolean;
  isInside(parent: string, child: string): boolean;
  collectPlugins(gamesDir?: string): Record<string, string[]>;
  evaluateBoundaries(input: {
    gamesDir?: string;
    plugins: Record<string, string[]>;
    config: BoundaryConfig;
  }): Report;
  readConfig(): BoundaryConfig;
};

/**
 * Скрипт — ESM `.mjs` (его же запускает verify), поэтому типы описываем здесь:
 * `tsc` не проверяет JS-файлы, но контракт нужен тесту.
 */
let cached: Promise<Checker> | undefined;
function checker(): Promise<Checker> {
  cached ??= import('../../scripts/plugins/check-boundaries.mjs').then(
    (module) => module as unknown as Checker,
  );
  return cached;
}

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** Собирает временный `src/games/<id>/…` и возвращает пути для проверки. */
function sandbox(files: Record<string, string>): {
  gamesDir: string;
  plugins: Record<string, string[]>;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-boundaries-'));
  tempDirs.push(root);
  const gamesDir = path.join(root, 'src/games');
  const plugins: Record<string, string[]> = {};
  for (const [relativePath, source] of Object.entries(files)) {
    const absolute = path.join(gamesDir, relativePath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, source, 'utf8');
  }
  for (const id of fs.readdirSync(gamesDir)) {
    const filesInPlugin = fs
      .readdirSync(path.join(gamesDir, id), { recursive: true })
      .map((entry) => path.join(gamesDir, id, entry as string))
      .filter((entry) => /\.tsx?$/.test(entry));
    plugins[id] = filesInPlugin;
  }
  return { gamesDir, plugins };
}

const CONFIG: BoundaryConfig = {
  forbidden: [
    { pattern: '@/app*', hint: 'ядро App Router недоступно плагину' },
  ],
  allowed: ['react', '@/components/ui/*'],
  legacy: {},
};

async function evaluate(
  files: Record<string, string>,
  config: BoundaryConfig = CONFIG,
): Promise<Report> {
  const script = await checker();
  const { gamesDir, plugins } = sandbox(files);
  return script.evaluateBoundaries({ gamesDir, plugins, config });
}

function messages(report: Report): string[] {
  return report.errors.map((error) => `${error.specifier}: ${error.message}`);
}

describe('извлечение импортов', () => {
  it('видит static/dynamic/require/export-from и не дублирует модуль', async () => {
    const { extractSpecifiers } = await checker();
    const source = `
      import * as React from 'react';
      import { Button } from '@/components/ui/button';
      import './side-effect';
      export { x } from './exported';
      const lazy = () => import('./lazy');
      const cjs = require('@/lib/types');
      import type { Foo } from 'react';
    `;
    expect(extractSpecifiers(source).sort()).toEqual(
      [
        'react',
        '@/components/ui/button',
        './side-effect',
        './exported',
        './lazy',
        '@/lib/types',
      ].sort(),
    );
  });

  it('различает относительные и пакетные спецификаторы', async () => {
    const { isRelativeSpecifier } = await checker();
    expect(isRelativeSpecifier('./types')).toBe(true);
    expect(isRelativeSpecifier('../shared/types')).toBe(true);
    expect(isRelativeSpecifier('react')).toBe(false);
    expect(isRelativeSpecifier('@/lib/types')).toBe(false);
  });
});

describe('маски правил', () => {
  it('поддерживает точное совпадение и `*`', async () => {
    const { matchesPattern } = await checker();
    expect(matchesPattern('@/app/page', '@/app/*')).toBe(true);
    expect(matchesPattern('@/app', '@/app')).toBe(true);
    expect(matchesPattern('next/navigation', 'next/*')).toBe(true);
    expect(matchesPattern('@/lib/types', 'next/*')).toBe(false);
    // Спецсимволы в маске не должны трактоваться как regex: точка — это
    // точка, а не «любой символ».
    expect(matchesPattern('@/a.js/x', '@/a.js/*')).toBe(true);
    expect(matchesPattern('@/aXjs/x', '@/a.js/*')).toBe(false);
  });
});

describe('проверка границ', () => {
  it('пропускает allowed и относительные импорты внутри плагина', async () => {
    const report = await evaluate({
      'demo/index.ts':
        "import { Button } from '@/components/ui/button';\nimport { helper } from './helper';",
      'demo/helper.ts': 'export const helper = 1;',
    });
    expect(report.errors).toEqual([]);
  });

  it('запрещает модуль из forbidden', async () => {
    const report = await evaluate({
      'demo/index.ts': "import { page } from '@/app/page';",
    });
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].message).toContain('App Router');
  });

  it('запрещает относительный импорт за пределы src/games', async () => {
    const report = await evaluate({
      'demo/index.ts': "import { x } from '../../lib/types';",
    });
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].message).toContain('за пределы src/games');
  });

  it('запрещает кросс-плагинные относительные импорты (D10)', async () => {
    const report = await evaluate({
      'dh1/index.ts': 'export const dh1 = 1;',
      'dh2/index.ts': 'export const dh2 = 1;',
      'dh2/extra.ts': "import { dh1 } from '../dh1/index';",
    });
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].specifier).toBe('../dh1/index');
    expect(report.errors[0].message).toContain('кросс-плагинный');
  });

  it('падает на неизвестном модуле без записи в конфиге', async () => {
    const report = await evaluate({
      'demo/index.ts': "import { theme } from '@/lib/theme';",
    });
    expect(messages(report)[0]).toContain('не разрешён плагину');
  });

  it('пускает модуль из legacy и считает файлы', async () => {
    const report = await evaluate(
      { 'demo/index.ts': "import { Character } from '@/lib/types';" },
      {
        ...CONFIG,
        legacy: { '@/lib/types': { files: 1, removeBy: 'этап 2' } },
      },
    );
    expect(report.errors).toEqual([]);
    expect(report.counts).toEqual({ '@/lib/types': 1 });
  });

  it('падает, когда legacy-долг вырос (новая зависимость)', async () => {
    const report = await evaluate(
      {
        'demo/a.ts': "import { Character } from '@/lib/types';",
        'demo/b.ts': "import { Character } from '@/lib/types';",
      },
      {
        ...CONFIG,
        legacy: { '@/lib/types': { files: 1, removeBy: 'этап 2' } },
      },
    );
    expect(report.newLegacy).toEqual(['@/lib/types']);
    expect(messages(report)[0]).toContain('новая зависимость');
  });

  it('падает, когда legacy-долг сократился, а конфиг не обновлён', async () => {
    const report = await evaluate(
      { 'demo/index.ts': 'export const nothing = 1;' },
      {
        ...CONFIG,
        legacy: { '@/lib/types': { files: 1, removeBy: 'этап 2' } },
      },
    );
    expect(report.staleLegacy).toEqual(['@/lib/types']);
    expect(messages(report)[0]).toContain('долг сократился');
  });
});

describe('правила на реальном дереве src/games', () => {
  it('соблюдаются во всех плагинах (конфиг scripts/plugins/boundaries.json)', async () => {
    const { collectPlugins, evaluateBoundaries, readConfig } = await checker();
    const plugins = collectPlugins();
    expect(Object.keys(plugins).sort()).toEqual(['dh1', 'dh2', 'dnd5e']);

    const report = evaluateBoundaries({ plugins, config: readConfig() });
    expect(
      report.errors.map((error) => `${error.file}: ${error.specifier}`),
    ).toEqual([]);
  });

  it('каждая legacy-запись объяснена и привязана к этапу плана', async () => {
    const { readConfig } = await checker();
    for (const [specifier, entry] of Object.entries(readConfig().legacy)) {
      expect(entry.files, specifier).toBeGreaterThan(0);
      expect(entry.removeBy, specifier).toMatch(/^этап \d$/);
      expect((entry.why ?? '').length, specifier).toBeGreaterThan(20);
    }
  });
});
