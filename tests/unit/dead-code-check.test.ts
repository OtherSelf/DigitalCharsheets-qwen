import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  analyze as analyzeRaw,
  validate as validateRaw,
} from '../../scripts/quality/check-dead-code.mjs';

/**
 * `.mjs`-скрипт не типизирован для `tsc`: сужаем контракт здесь, чтобы тест
 * проверял правила сканера, а не форму его JS-экспортов.
 */
interface ScannerExport {
  file: string;
  line: number;
  name: string;
  status: string;
}

interface ScannerReport {
  exports: ScannerExport[];
  deadFiles: string[];
  counts: Record<string, number>;
}

const analyze = analyzeRaw as (root: string) => ScannerReport;
const validate = validateRaw as (
  report: ScannerReport,
  allowlist: unknown,
  limits?: { testOnlyMax?: number },
) => string[];

/**
 * ─── LANDMARK: DEADCODE SCANNER FIXTURES ───────────────────────────────────
 * Сканер `scripts/quality/check-dead-code.mjs` сам является инструментом
 * контроля, поэтому его правила проверяются на синтетическом проекте:
 * настоящий `src/` меняется, а эти фикстуры держат ровно те случаи, на
 * которых гейт ошибался бы (entry Next, `import()`, `<file>#<export>` из
 * манифеста, shorthand-свойства, test-only, вендорный ui-кит, allowlist).
 */

const FILES = {
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      target: 'ES2020',
      module: 'esnext',
      moduleResolution: 'bundler',
      strict: false,
      noEmit: true,
      skipLibCheck: true,
      jsx: 'react-jsx',
      baseUrl: '.',
      paths: { '@/*': ['src/*'] },
    },
    include: ['src/**/*.ts', 'src/**/*.tsx', 'tests/**/*.ts'],
  }),
  // Entry Next: экспорт не гейтится, но он же делает consumer живым
  'src/app/page.ts': [
    "import { consume } from '@/lib/consumer';",
    'export function pageExport() { return consume(); }',
    '',
  ].join('\n'),
  // Прод-модуль: разные классы экспортов
  'src/lib/used.ts': [
    'export function usedFn() { return 1; }',
    'export function shorthandFn() { return 2; }',
    'export function deadFn() { return 3; }',
    'export function exportOnlyFn() { return 4; }',
    'function localHelper() { return exportOnlyFn(); }',
    'export function usesLocal() { return localHelper(); }',
    '',
  ].join('\n'),
  // consumer ссылается на usedFn и через shorthand на shorthandFn
  'src/lib/consumer.ts': [
    "import { usedFn, shorthandFn } from './used';",
    'export function consume() { return usedFn() + shorthandFn(); }',
    'export const bag = { shorthandFn };',
    '',
  ].join('\n'),
  // test-only: только тест
  'src/lib/only-test.ts': `export function testOnlyFn() { return 5; }\n`,
  // Цель динамического импорта из прод-кода
  'src/lib/lazy.ts': `export function lazyFn() { return 6; }\n`,
  'src/lib/loader.ts': [
    'export function load() {',
    "  return import('./lazy');",
    '}',
    '',
  ].join('\n'),
  // Мёртвый файл без импортёров
  'src/lib/orphan.ts': `export function orphanFn() { return 7; }\n`,
  // Вендорный ui-кит: экспорт не гейтится (D10)
  'src/components/ui/kit.ts': `export const kitUnused = 8;\n`,
  // Плагин: точка входа и цель манифеста
  'src/games/demo/index.ts': `export const demoModule = {};\n`,
  'src/games/demo/fonts.ts': `export const pluginFont = { className: 'x' };\n`,
  'src/games/demo/plugin.json': JSON.stringify({
    id: 'demo',
    entry: { module: 'index.ts#demoModule' },
    ui: { theme: { font: 'fonts.ts#pluginFont' } },
  }),
  'tests/unit/demo.test.ts': [
    "import { testOnlyFn } from '@/lib/only-test';",
    "import { load } from '@/lib/loader';",
    "it('x', () => { expect(testOnlyFn()).toBe(5); });",
    "it('y', () => { expect(load).toBeTypeOf('function'); });",
    '',
  ].join('\n'),
};

let dir: string;

function writeProject(extra: Record<string, string> = {}): string {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-deadcode-'));
  for (const [file, content] of Object.entries({ ...FILES, ...extra })) {
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return dir;
}

const statusOf = (report: ScannerReport, name: string) =>
  report.exports.find((item) => item.name === name)?.status ?? 'absent';

beforeEach(() => {
  writeProject();
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('deadcode: классификация', () => {
  it('видит ссылку из импорта и из shorthand-свойства', () => {
    const report = analyze(dir);
    expect(statusOf(report, 'usedFn')).toBe('used');
    expect(statusOf(report, 'shorthandFn')).toBe('used');
  });

  it('делит dead / export-only / test-only', () => {
    const report = analyze(dir);
    expect(statusOf(report, 'deadFn')).toBe('dead');
    expect(statusOf(report, 'exportOnlyFn')).toBe('export-only');
    expect(statusOf(report, 'testOnlyFn')).toBe('test-only');
  });

  it('не гейтит точки входа, import(), манифест и ui-кит', () => {
    const report = analyze(dir);
    expect(statusOf(report, 'pageExport')).toBe('absent');
    expect(statusOf(report, 'lazyFn')).toBe('absent');
    expect(statusOf(report, 'demoModule')).toBe('absent');
    expect(statusOf(report, 'pluginFont')).toBe('absent');
    expect(statusOf(report, 'kitUnused')).toBe('absent');
  });

  it('находит файл без импортёров', () => {
    const report = analyze(dir);
    expect(report.deadFiles).toContain('src/lib/orphan.ts');
    expect(report.deadFiles).not.toContain('src/lib/consumer.ts');
  });
});

describe('deadcode: allowlist и потолки', () => {
  it('запись с reason снимает нарушение и не устаревает', () => {
    const report = analyze(dir);
    const allowlist = {
      allowed: [
        { file: 'src/lib/used.ts', name: 'deadFn', reason: 'тест allowlist' },
      ],
    };
    const problems = validate(report, allowlist, { testOnlyMax: 10 });
    const own = problems.filter((item) => item.includes('deadFn'));
    expect(own).toEqual([]);
  });

  it('запись без reason и лишняя запись — нарушения (D8)', () => {
    const report = analyze(dir);
    const withoutReason = validate(
      report,
      { allowed: [{ file: 'src/lib/used.ts', name: 'deadFn' }] },
      { testOnlyMax: 10 },
    );
    expect(withoutReason.some((item) => item.includes('нет reason'))).toBe(
      true,
    );

    const unused = validate(
      report,
      {
        allowed: [
          { file: 'src/lib/used.ts', name: 'deadFn', reason: 'ok' },
          { file: 'src/lib/README.ts', name: 'gone', reason: 'уже не мёртвый' },
        ],
      },
      { testOnlyMax: 10 },
    );
    expect(unused.some((item) => item.includes('больше не нужна'))).toBe(true);
  });

  it('test-only сверх потолка — нарушение', () => {
    const report = analyze(dir);
    const problems = validate(
      report,
      {
        allowed: [{ file: 'src/lib/used.ts', name: 'deadFn', reason: 'ok' }],
      },
      { testOnlyMax: 0 },
    );
    expect(problems.some((item) => item.includes('test-only вырос'))).toBe(
      true,
    );
  });
});
