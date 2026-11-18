import { describe, expect, it } from 'vitest';

/**
 * ─── LANDMARK: PLUGIN MIGRATION WARNINGS ───────────────────────────────────
 * Генератор обязан говорить о неполном контракте, даже когда манифест
 * формально валиден. Пустая цепочка миграций при `schemaVersion > 1` — именно
 * такой случай: схема версионирована, а пути из v1 нет.
 */

type WarningPlugin = {
  dirName: string;
  manifest: { schemaVersion: number; migrations: unknown[] };
};

type Generator = {
  collectWarnings(plugins: WarningPlugin[]): string[];
  buildRegistry(options?: { gamesDir?: string; schemaPath?: string }): {
    plugins: { id: string; schemaVersion: number }[];
    warnings: string[];
  };
};

function plugin(dirName: string, schemaVersion: number, steps: number) {
  return {
    dirName,
    manifest: {
      schemaVersion,
      migrations: Array.from({ length: steps }, (_, index) => ({
        from: index + 1,
        to: index + 2,
        entry: `index.ts#migrateV${index + 1}`,
      })),
    },
  };
}

describe('пустая цепочка миграций видна в отчёте генератора', () => {
  it('предупреждает только там, где schemaVersion > 1 и цепочки нет', async () => {
    const { collectWarnings } =
      (await import('../../scripts/plugins/generate.mjs')) as unknown as Generator;
    const warnings = collectWarnings([
      plugin('empty-chain', 3, 0),
      plugin('v1-only', 1, 0),
      plugin('complete-chain', 3, 2),
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('empty-chain');
    expect(warnings[0]).toContain('1 → 3');
  });

  it('в отчёте генератора предупреждений нет: цепочки объявлены', async () => {
    const { buildRegistry } =
      (await import('../../scripts/plugins/generate.mjs')) as unknown as Generator;
    const { plugins, warnings } = buildRegistry();
    const behind = plugins.filter((item) => item.schemaVersion > 1);
    expect(behind.length).toBeGreaterThan(0);
    // С тех пор как цепочки появились, гейт обязателен: пустая цепочка —
    // ошибка манифеста, а не предупреждение.
    expect(warnings).toEqual([]);
  });
});
