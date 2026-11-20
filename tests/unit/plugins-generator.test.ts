import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ─── LANDMARK: PLUGIN GENERATOR FORMAT ──────────────────────────────────────
 * `registry.generated.ts` и `i18n.generated.ts` пишет генератор, но форматирует
 * их `prettier --check` — шаг 2/7 `npm run verify`. Порядок импортов в
 * сгенерированном файле обязан совпадать с `@ianvs/prettier-plugin-sort-imports`
 * для **любого** валидного id плагина, иначе `generate` и `format` не сходятся:
 * `generate` → `check` зелёный, `prettier` красный; `prettier --write` → `check`
 * красный. Поэтому id в наборе специально берутся по обе стороны от служебных
 * модулей `./plugin-api` и `./types`.
 */

type Plugin = { dirName: string; manifest: Record<string, unknown> };
type Generator = {
  renderRegistry(plugins: Plugin[]): string;
  renderI18nRegistry(plugins: Plugin[]): string;
};

let cached: Promise<Generator> | undefined;
function generator(): Promise<Generator> {
  cached ??= import('../../scripts/plugins/generate.mjs').then(
    (module) => module as unknown as Generator,
  );
  return cached;
}

const GAMES_DIR = path.join(process.cwd(), 'src/games');

/** Манифест-минимум: генератору нужны id, order, entry, i18n и game. */
function plugin(id: string, order: number): Plugin {
  return {
    dirName: id,
    manifest: {
      id,
      order,
      entry: { module: `index.ts#${id}Module` },
      i18n: { en: 'i18n/en.json', ru: 'i18n/ru.json' },
      game: {
        id: `${id}Game`,
        order,
        name: { en: 'Game', ru: 'Игра' },
        description: { en: 'Fixture', ru: 'Фикстура' },
      },
    },
  };
}

async function formatted(content: string, file: string): Promise<string> {
  const prettier = await import('prettier');
  const config =
    (await prettier.resolveConfig(path.join(GAMES_DIR, file))) ?? {};
  return prettier.format(content, {
    ...config,
    parser: 'typescript',
    filepath: path.join(GAMES_DIR, file),
  });
}

// `alpha` и `Zeta` ловят регистр, `probe`/`wfrp`/`uprobe`/`zzprobe` — ids
// после `./plugin-api` (и после `./types` для словарей).
const IDS = ['alpha', 'probe', 'wfrp', 'uprobe', 'Zeta', 'zzprobe'];

describe('сгенерированный реестр prettier-чист для любого id', () => {
  it.each(IDS)('%s: registry.generated.ts', async (id) => {
    const { renderRegistry } = await generator();
    const content = renderRegistry([plugin('dnd5e', 10), plugin(id, 90)]);
    expect(await formatted(content, 'registry.generated.ts')).toBe(content);
  });

  it.each(IDS)('%s: i18n.generated.ts', async (id) => {
    const { renderI18nRegistry } = await generator();
    const content = renderI18nRegistry([plugin('dnd5e', 10), plugin(id, 90)]);
    expect(await formatted(content, 'i18n.generated.ts')).toBe(content);
  });

  it('эмитит загрузчик шрифта темы и остаётся prettier-чистым', async () => {
    const { renderRegistry } = await generator();
    const themed = plugin('themeprobe', 90);
    themed.manifest.ui = {
      theme: {
        tokens: { light: { primary: '1 2% 3%' } },
        font: 'fonts.ts#fontProbe',
      },
    };
    const content = renderRegistry([plugin('dnd5e', 10), themed]);
    expect(content).toContain('generatedFontLoaders');
    expect(content).toContain(
      "import('./themeprobe/fonts').then((module) => module.fontProbe)",
    );
    expect(await formatted(content, 'registry.generated.ts')).toBe(content);

    const plain = renderRegistry([plugin('dnd5e', 10)]);
    expect(plain).toContain(
      'export const generatedFontLoaders: Readonly<\n  Record<string, () => Promise<PluginFont>>\n> = {};',
    );
  });

  it('служебный импорт стоит по строке пути, а не в конце', async () => {
    const { renderRegistry } = await generator();
    const content = renderRegistry([plugin('probe', 90)]);
    const api = content.indexOf("from './plugin-api'");
    const probe = content.indexOf("from './probe'");
    expect(api).toBeGreaterThanOrEqual(0);
    expect(probe).toBeGreaterThan(api);
  });
});
