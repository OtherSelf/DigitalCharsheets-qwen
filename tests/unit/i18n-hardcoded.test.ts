import fs from 'node:fs';
import path from 'node:path';

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * ─── LANDMARK: I18N_HARDCODED ──────────────────────────────────────────────
 * Ловит пользовательский текст, который обошёл `t()`:
 *   • JSX-текст (`<span>Save</span>`);
 *   • атрибуты `placeholder` / `title` / `aria-label` / `alt`.
 *
 * Не проверяются строки в коде (className, URL, ключи объектов) — только
 * места, которые реально видит или слышит пользователь. Бренд, единицы
 * измерения и HTML-сущности — в allowlist.
 *
 * Тест намеренно статический: браузер и сервер не нужны.
 */

const ROOT = process.cwd();
const ROOTS = ['src/components', 'src/app', 'src/games'];
const ATTRS = new Set(['placeholder', 'title', 'aria-label', 'alt']);

const ALLOWED_TEXT = new Set([
  'Digital Character Sheets',
  'Dungeons & Dragons',
  'Dark Heresy',
  'Warhammer 40k: Dark Heresy',
]);
const ALLOWED_UNITS = /^(pt\)|ft|d)$/;
const ENTITY = /^&[a-z]+;$/;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return full.endsWith('.tsx') ? [full] : [];
  });
}

function hasLetters(value: string): boolean {
  return /[A-Za-zА-Яа-яЁё]/.test(value);
}

function isAllowedJsxText(value: string): boolean {
  return (
    ALLOWED_TEXT.has(value) || ALLOWED_UNITS.test(value) || ENTITY.test(value)
  );
}

function report(file: string, node: ts.Node, source: ts.SourceFile): string {
  const line =
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  return `${path.relative(ROOT, file)}:${line}`;
}

describe('i18n: нет hardcoded UI-строк', () => {
  it('JSX-текст и aria/placeholder/title идут через t()', () => {
    const violations: string[] = [];

    for (const file of ROOTS.flatMap((root) => walk(path.join(ROOT, root)))) {
      const source = fs.readFileSync(file, 'utf8');
      const sf = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );

      const visit = (node: ts.Node): void => {
        if (ts.isJsxText(node)) {
          const value = node.text.replace(/\s+/g, ' ').trim();
          if (value && hasLetters(value) && !isAllowedJsxText(value)) {
            violations.push(
              `${report(file, node, sf)}: JSX "${value.slice(0, 80)}"`,
            );
          }
        }

        if (ts.isJsxAttribute(node) && ATTRS.has(node.name.getText(sf))) {
          const init = node.initializer;
          if (
            init &&
            (ts.isStringLiteral(init) ||
              ts.isNoSubstitutionTemplateLiteral(init))
          ) {
            const value = init.text.trim();
            if (value && hasLetters(value) && !isAllowedJsxText(value)) {
              violations.push(
                `${report(file, node, sf)}: ${node.name.getText(sf)}="${value.slice(0, 80)}"`,
              );
            }
          }
        }

        ts.forEachChild(node, visit);
      };
      visit(sf);
    }

    expect(violations, 'hardcoded UI-строки').toEqual([]);
  });
});
