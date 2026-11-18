import { describe, expect, it } from 'vitest';

/**
 * ─── LANDMARK: CORE PURITY GATE ───────────────────────────────────────────
 * Гейт `scripts/plugins/check-core-purity.mjs` сам должен быть проверен:
 * иначе «0 нарушений» может означать «сканер ничего не видит».
 */

type Purity = {
  findViolations(source: string): { line: number; tokens: string[] }[];
  stripNonCode(source: string): string;
};

async function purity(): Promise<Purity> {
  return (await import('../../scripts/plugins/check-core-purity.mjs')) as unknown as Purity;
}

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

  it('проверяет реальное дерево: нарушений 0', async () => {
    const { checkCore } =
      (await import('../../scripts/plugins/check-core-purity.mjs')) as unknown as {
        checkCore(options?: { root?: string }): {
          violations: unknown[];
          filesScanned: number;
        };
      };
    const result = checkCore();
    expect(result.filesScanned).toBeGreaterThan(100);
    expect(result.violations).toEqual([]);
  });
});
