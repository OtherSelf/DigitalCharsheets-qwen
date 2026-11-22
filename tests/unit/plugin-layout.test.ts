import { describe, expect, it } from 'vitest';

/**
 * ─── LANDMARK: PLUGIN LAYOUT GATE ─────────────────────────────────────────
 * Стандарт папки плагина (`docs/plugin-layout.md`) проверяется на боевых
 * плагинах, а не только на фикстуре: все боевые плагины должны иметь один
 * скелет, даже когда правила игр разные. Отдельно проверяется, что гейт
 * действительно ловит регресс, а не всегда зелёный.
 */
type LayoutPlugin = {
  id: string;
  dir: string;
  manifest: { i18n?: Record<string, string> };
};

type LayoutModule = {
  checkPlugin(plugin: LayoutPlugin): string[];
  REQUIRED_FILES: string[];
  REQUIRED_TEST_FILES: string[];
  requiresContractTests(manifest: Record<string, unknown>): boolean;
};

const layout = await import('../../scripts/plugins/check-layout.mjs');

describe('плагины: стандарт раскладки', () => {
  it('обязательный скелет не пуст и содержит контракт', () => {
    const files = (layout as LayoutModule).REQUIRED_FILES;
    expect(files).toContain('plugin.json');
    expect(files).toContain('schema-version.ts');
    expect(files.length).toBeGreaterThan(15);
    expect((layout as LayoutModule).REQUIRED_TEST_FILES).toContain(
      'tests/unit/contract.test.ts',
    );
  });

  it('тесты контракта обязательны для видимого плагина или версии 1.0+', () => {
    const requires = (layout as LayoutModule).requiresContractTests;
    expect(requires({ defaultStatus: 'hidden', version: '0.2.0' })).toBe(false);
    expect(requires({ defaultStatus: 'hidden', version: '1.0.0' })).toBe(true);
    expect(requires({ defaultStatus: 'published', version: '0.1.0' })).toBe(
      true,
    );
    expect(requires({ defaultStatus: 'test', version: '1.2.0' })).toBe(true);
  });

  it('каждый боевой плагин проходит гейт', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const gamesDir = path.join(process.cwd(), 'src/games');
    const plugins = fs
      .readdirSync(gamesDir, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() && !['shared', 'i18n'].includes(entry.name),
      )
      .flatMap((entry) => {
        const dir = path.join(gamesDir, entry.name);
        const manifestPath = path.join(dir, 'plugin.json');
        if (!fs.existsSync(manifestPath)) return [];
        return [
          {
            id: entry.name,
            dir,
            manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
          },
        ];
      });
    expect(plugins.length).toBeGreaterThan(0);
    for (const plugin of plugins) {
      expect((layout as LayoutModule).checkPlugin(plugin), plugin.id).toEqual(
        [],
      );
    }
  });

  it('гейт ловит тест с префиксом id и пропавший файл', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-layout-'));
    const dir = path.join(root, 'probe');
    fs.mkdirSync(path.join(dir, 'tests/unit'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'tests/unit/probe-fields.test.ts'),
      '// test\n',
    );
    try {
      const errors = (layout as LayoutModule).checkPlugin({
        id: 'probe',
        dir,
        manifest: { i18n: { en: 'i18n/en.json', ru: 'i18n/ru.json' } },
      });
      expect(errors.some((error) => error.includes('префикс id'))).toBe(true);
      expect(errors.some((error) => error.includes('plugin.json'))).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
