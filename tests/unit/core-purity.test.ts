import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

/**
 * ─── LANDMARK: CORE PURITY GATE ───────────────────────────────────────────
 * Гейт `scripts/plugins/check-core-purity.mjs` сам должен быть проверен:
 * иначе «0 нарушений» может означать «сканер ничего не видит».
 */

type Purity = {
  findViolations(source: string): { line: number; tokens: string[] }[];
  stripNonCode(source: string): string;
  findCssViolations(source: string): { line: number; tokens: string[] }[];
  findIdViolations(source: string): { line: number; tokens: string[] }[];
  stripCssComments(source: string): string;
};

async function purity(): Promise<Purity> {
  return (await import('../../scripts/plugins/check-core-purity.mjs')) as unknown as Purity;
}

const createdRoots: string[] = [];

afterEach(() => {
  for (const root of createdRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('гейт чистоты ядра', () => {
  it('находит игровое поле в коде', async () => {
    const { findViolations } = await purity();
    const violations = findViolations('const value = doc.proficiencyBonus;');
    expect(violations).toHaveLength(1);
    expect(violations[0].tokens).toContain('proficiencyBonus');
  });

  it('находит имя игры в коде', async () => {
    const { findViolations } = await purity();
    // Имя игры как идентификатор/значение — нарушение (импорт по строке
    // ловит отдельный гейт границ).
    const violations = findViolations('const plugin = dnd5e;');
    expect(violations[0].tokens).toContain('dnd5e');
  });

  it('не считает комментарии и строки', async () => {
    const { findViolations } = await purity();
    const source = [
      '// proficiencyBonus приходит из плагина',
      '/* rank, wounds, level — это плагин */',
      "const label = 'Dungeons & Dragons';",
      'const text = `rank ${value}`;',
    ].join('\n');
    expect(findViolations(source)).toEqual([]);
  });

  it('видит код внутри шаблонной подстановки и после неё', async () => {
    const { findViolations } = await purity();
    const source = [
      'const tpl = `x ${doc.level} y`;',
      'const after = doc.rank;',
    ].join('\n');
    const tokens = findViolations(source).flatMap((hit) => hit.tokens);
    expect(tokens).toContain('level');
    expect(tokens).toContain('rank');
  });

  it('не ломается на вложенных шаблонах', async () => {
    const { stripNonCode } = await purity();
    const source = 'const a = `${`${doc.wounds}`}`;\n// rank\nconst b = 1;';
    const stripped = stripNonCode(source);
    expect(stripped).toContain('doc.wounds');
    expect(stripped).not.toContain('rank');
  });

  it('видит игровой селектор в стилях', async () => {
    const { findCssViolations } = await purity();
    expect(
      findCssViolations('.dnd-sheet .sheet-top-row { order: 1; }'),
    ).toEqual([{ line: 1, tokens: ['dnd'] }]);
    expect(
      findCssViolations(
        '.dh-sheet .sheet-panels > .w-12 { min-height: 3rem; }',
      ),
    ).toEqual([{ line: 1, tokens: ['dh'] }]);
    expect(findCssViolations('.dcs-info-grid { gap: 1rem; }')).toEqual([
      { line: 1, tokens: ['info-grid'] },
    ]);
  });

  it('не считает игровые слова в комментариях CSS и в общих селекторах', async () => {
    const { findCssViolations } = await purity();
    const source = [
      '/* широкий режим для блока Info в Dark Heresy */',
      '@media (min-width: 1800px) {',
      '  .sheet-main-grid { gap: 1rem; }',
      '}',
    ].join('\n');
    expect(findCssViolations(source)).toEqual([]);
  });

  it('находит точный id игры в строковом литерале', async () => {
    const { findIdViolations } = await purity();
    expect(findIdViolations("if (systemId === 'dh1') return 1;")).toEqual([
      { line: 1, tokens: ['dh1'] },
    ]);
    expect(findIdViolations('const system = `dnd5e`;')).toEqual([
      { line: 1, tokens: ['dnd5e'] },
    ]);
  });

  it('не считает id в комментариях, подписи и частичные совпадения', async () => {
    const { findIdViolations } = await purity();
    const source = [
      "// 'dh1' приходит из манифеста",
      "const label = 'Dungeons & Dragons';",
      "const other = 'dh1x';",
      "const game = 'darkHeresy';",
    ].join('\n');
    expect(findIdViolations(source)).toEqual([]);
  });

  it('посеянный id игры в литерале валит гейт', async () => {
    const { checkCore } =
      (await import('../../scripts/plugins/check-core-purity.mjs')) as unknown as {
        checkCore(options?: { root?: string }): {
          idViolations: { file: string; hits: unknown[] }[];
        };
      };
    const root = mkdtempSync(join(tmpdir(), 'dcs-purity-id-'));
    createdRoots.push(root);
    mkdirSync(join(root, 'src/lib'), { recursive: true });
    writeFileSync(
      join(root, 'src/lib/leak.ts'),
      "export const pick = (id: string) => (id === 'dh2' ? 1 : 0);\n",
      'utf8',
    );

    const result = checkCore({ root });
    expect(result.idViolations.map((item) => item.file)).toEqual([
      'src/lib/leak.ts',
    ]);
  });

  it('посеянный игровой селектор в чужом CSS валит гейт', async () => {
    const { checkCore } =
      (await import('../../scripts/plugins/check-core-purity.mjs')) as unknown as {
        checkCore(options?: { root?: string }): {
          violations: unknown[];
          cssViolations: { file: string }[];
        };
      };
    const root = mkdtempSync(join(tmpdir(), 'dcs-purity-'));
    createdRoots.push(root);
    mkdirSync(join(root, 'src/app'), { recursive: true });
    writeFileSync(
      join(root, 'src/app/leak.css'),
      '.dh-sheet .sheet-panels { display: flex; }\n',
      'utf8',
    );

    const result = checkCore({ root });
    expect(result.cssViolations.map((item) => item.file)).toEqual([
      'src/app/leak.css',
    ]);
  });

  it('проверяет реальное дерево: нарушений 0, CSS — под храповиком', async () => {
    const { checkCore } =
      (await import('../../scripts/plugins/check-core-purity.mjs')) as unknown as {
        checkCore(options?: { root?: string }): {
          violations: unknown[];
          filesScanned: number;
          cssScanned: number;
          cssViolations: unknown[];
          cssAllowed: { file: string; lines: number[]; max: number }[];
          staleCssAllowlist: unknown[];
        };
      };
    const result = checkCore();
    expect(result.filesScanned).toBeGreaterThan(100);
    expect(result.violations).toEqual([]);
    expect(result.cssScanned).toBeGreaterThan(0);
    expect(result.cssViolations).toEqual([]);
    expect(result.staleCssAllowlist).toEqual([]);
    const [ratchet] = result.cssAllowed;
    expect(ratchet.file).toBe('src/app/globals.css');
    expect(ratchet.lines).toHaveLength(ratchet.max);
  });
});
