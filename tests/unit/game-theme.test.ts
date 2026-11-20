import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GAME_THEME_TOKENS } from '@/games/types';
import { gameThemeCss } from '@/lib/game-theme';

/**
 * ─── LANDMARK: GAME THEME CONTRACT ────────────────────────────────────────
 * Тема игры — данные манифеста, а не код плагина: список токенов задаёт
 * ядро, значения проверяет схема, а в CSS они попадают скоупленными через
 * `[data-system]`. Здесь проверяется и генератор CSS, и совпадение списка
 * токенов в типах и в `plugin.schema.json` (иначе типы и валидатор разъедутся).
 */

const FIXTURE_MANIFEST = join(
  process.cwd(),
  'tests/fixtures/example-plugin/plugin.json',
);

function fixtureManifest(): Record<string, any> {
  return JSON.parse(readFileSync(FIXTURE_MANIFEST, 'utf8'));
}

async function manifestValidator(): Promise<(manifest: unknown) => string[]> {
  const { createManifestValidator } =
    (await import('../../scripts/plugins/generate.mjs')) as unknown as {
      createManifestValidator(
        schemaPath?: string,
      ): (manifest: unknown) => string[];
    };
  return createManifestValidator();
}

describe('gameThemeCss', () => {
  it('без темы или id отдаёт пустую строку', () => {
    expect(gameThemeCss(undefined, undefined)).toBe('');
    expect(gameThemeCss('dh2', undefined)).toBe('');
    expect(gameThemeCss('dh2', { tokens: {} })).toBe('');
    expect(
      gameThemeCss('DH2', { tokens: { light: { primary: '1 2% 3%' } } }),
    ).toBe('');
  });

  it('разделяет светлый и тёмный наборы правилами по режиму сайта', () => {
    const css = gameThemeCss('dh2', {
      tokens: {
        light: { primary: '8 70% 45%', radius: '0.25rem' },
        dark: { primary: '8 70% 62%' },
      },
    });
    expect(css).toBe(
      '[data-system="dh2"]{--primary: 8 70% 45%; --radius: 0.25rem;}' +
        'html.dark [data-system="dh2"]{--primary: 8 70% 62%;}',
    );
  });

  it('не подставляет пустые значения и не знает лишних токенов', () => {
    const css = gameThemeCss('dh1', {
      tokens: {
        light: {
          primary: '  ',
          accent: '20 60% 40%',
          sidebar: '1 1% 1%',
        } as any,
      },
    });
    expect(css).toBe('[data-system="dh1"]{--accent: 20 60% 40%;}');
  });
});

describe('схема манифеста: ui.theme', () => {
  it('валидная тема проходит схему', async () => {
    const validate = await manifestValidator();
    const manifest = fixtureManifest();
    manifest.ui = {
      theme: {
        tokens: {
          light: { primary: '8 70% 45%', radius: '0.25rem' },
          dark: { primary: '8 70% 62%' },
        },
      },
    };
    expect(validate(manifest)).toEqual([]);
  });

  it('неизвестный токен отвергается', async () => {
    const validate = await manifestValidator();
    const manifest = fixtureManifest();
    manifest.ui = {
      theme: { tokens: { light: { sidebar: '1 1% 1%' } } },
    };
    const errors = validate(manifest);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join('\n')).toContain('sidebar');
  });

  it('значение цвета должно быть HSL-триплетом', async () => {
    const validate = await manifestValidator();
    const manifest = fixtureManifest();
    manifest.ui = { theme: { tokens: { light: { primary: 'blue' } } } };
    expect(validate(manifest).length).toBeGreaterThan(0);
  });

  it('слоты без entry невалидны, тема без слотов — валидна', async () => {
    const validate = await manifestValidator();
    const withSlots = fixtureManifest();
    withSlots.ui = { slots: ['HeaderSubtitle'] };
    expect(validate(withSlots).length).toBeGreaterThan(0);

    const themeOnly = fixtureManifest();
    themeOnly.ui = { theme: { tokens: { light: { accent: '20 60% 40%' } } } };
    expect(validate(themeOnly)).toEqual([]);
  });

  it('список токенов в схеме совпадает с GAME_THEME_TOKENS', () => {
    const schema = JSON.parse(
      readFileSync(join(process.cwd(), 'src/games/plugin.schema.json'), 'utf8'),
    );
    const schemaTokens = Object.keys(
      schema.definitions.themeTokenSet.properties,
    ).sort();
    expect(schemaTokens).toEqual([...GAME_THEME_TOKENS].sort());
  });
});
