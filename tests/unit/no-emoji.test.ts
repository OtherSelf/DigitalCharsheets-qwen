import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Эмодзи не должны попадать в код и комментарии: они ломают снимки/шрифты,
 * не читаются скринридером и расходятся с правилом репозитория о тексте.
 * Проверяем диапазон пиктограмм и variation selector FE0F, не задевая
 * типографские стрелки/✓/⚠, которые в проекте допустимы.
 */

const ROOTS = ['src', 'tests', 'scripts'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.mjs', '.cjs', '.js']);
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{FE0F}]/u;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return EXTENSIONS.has(path.extname(entry.name)) ? [full] : [];
  });
}

describe('текст репозитория', () => {
  it('в коде и комментариях нет эмодзи', () => {
    const violations: string[] = [];
    for (const file of ROOTS.flatMap((root) => walk(root))) {
      const source = fs.readFileSync(file, 'utf8');
      source.split('\n').forEach((line, index) => {
        if (EMOJI.test(line)) {
          violations.push(`${file}:${index + 1}: ${line.trim().slice(0, 100)}`);
        }
      });
    }
    expect(violations, 'эмодзи в коде/комментариях').toEqual([]);
  });
});
