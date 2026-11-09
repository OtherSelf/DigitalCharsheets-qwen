import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Обход EXDEV в scripts/lib/fs-rename-fallback.cjs — шиме для `next build`.
 *
 * Каждый кейс запускается в отдельном процессе `node --require`: шим патчит `fs`
 * навсегда, поэтому require внутри vitest-воркера отравил бы остальные тесты.
 * EXDEV инжектится фикстурой fixtures/fake-rename-error.cjs, подключённой ДО
 * шима, — тест не зависит от ФС (ext4/9p/overlayfs дают одинаковый результат).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SHIM = path.join(ROOT, 'scripts', 'lib', 'fs-rename-fallback.cjs');
const FAKE = path.join(HERE, 'fixtures', 'fake-rename-error.cjs');

interface RunOptions {
  /** Подключить фикстуру, ломающую rename. */
  fake: boolean;
  /** Код ошибки, которым «падает» rename (по умолчанию EXDEV). */
  errorCode?: string;
}

/**
 * Тело сценария получает `dir` (свой временный каталог), `report` (объект
 * результата) и `warnings` (коды предупреждений процесса). Всё, что нужно
 * проверить, кладётся в `report`; тест читает JSON из stdout.
 */
function makeScript(body: string): string {
  return `
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const warnings = [];
process.on('warning', (warning) => warnings.push(warning.code || warning.name));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-shim-'));
const report = {};

(async () => {
  try {
    ${body}
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  // process.emitWarning асинхронный: даём событию 'warning' дойти до
  // слушателя, иначе warnings окажется пустым при мгновенном JSON.stringify.
  await new Promise((resolve) => setImmediate(resolve));
  process.stdout.write(JSON.stringify({ ...report, warnings }));
})().catch((error) => {
  console.error(error && error.stack || error);
  process.exit(1);
});
`;
}

function runNode(body: string, options: RunOptions): Record<string, unknown> {
  const args: string[] = [];
  if (options.fake) args.push('--require', FAKE);
  args.push('--require', SHIM, '-e', makeScript(body));

  const stdout = execFileSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    // NODE_OPTIONS не наследуем: иначе шим мог бы подключиться дважды.
    env: {
      ...process.env,
      NODE_OPTIONS: '',
      DCS_FAKE_RENAME_CODE: options.errorCode || 'EXDEV',
    },
  });

  return JSON.parse(stdout) as Record<string, unknown>;
}

describe('fs-rename-fallback.cjs (обход EXDEV при next build)', () => {
  it('на рабочей ФС ничего не меняет: rename проходит, предупреждений нет', () => {
    const result = runNode(
      `
      fs.writeFileSync(path.join(dir, 'a.txt'), 'payload');
      fs.renameSync(path.join(dir, 'a.txt'), path.join(dir, 'b.txt'));
      report.moved = fs.existsSync(path.join(dir, 'b.txt'));
      report.sourceGone = !fs.existsSync(path.join(dir, 'a.txt'));
      report.content = fs.readFileSync(path.join(dir, 'b.txt'), 'utf8');
      `,
      { fake: false },
    );

    expect(result).toMatchObject({
      moved: true,
      sourceGone: true,
      content: 'payload',
      warnings: [],
    });
  });

  it('EXDEV в renameSync: файл копируется, источник удаляется, шим сообщает о срабатывании', () => {
    const result = runNode(
      `
      fs.writeFileSync(path.join(dir, 'a.txt'), 'payload');
      fs.renameSync(path.join(dir, 'a.txt'), path.join(dir, 'b.txt'));
      report.moved = fs.existsSync(path.join(dir, 'b.txt'));
      report.sourceGone = !fs.existsSync(path.join(dir, 'a.txt'));
      report.content = fs.readFileSync(path.join(dir, 'b.txt'), 'utf8');
      `,
      { fake: true },
    );

    expect(result).toMatchObject({
      moved: true,
      sourceGone: true,
      content: 'payload',
    });
    expect(result.warnings).toContain('FSEXDEVFIX');
  });

  it('EXDEV для каталога: переносится рекурсивно, исходный каталог удаляется', () => {
    const result = runNode(
      `
      const src = path.join(dir, 'tree');
      fs.mkdirSync(path.join(src, 'nested'), { recursive: true });
      fs.writeFileSync(path.join(src, 'nested', 'deep.txt'), 'deep');

      const dst = path.join(dir, 'tree-moved');
      fs.renameSync(src, dst);

      report.moved = fs.existsSync(path.join(dst, 'nested', 'deep.txt'));
      report.sourceGone = !fs.existsSync(src);
      report.content = fs.readFileSync(path.join(dst, 'nested', 'deep.txt'), 'utf8');
      `,
      { fake: true },
    );

    expect(result).toMatchObject({
      moved: true,
      sourceGone: true,
      content: 'deep',
    });
  });

  it('EXDEV в fs.rename(from, to, cb): колбэк получает null, файл на месте', () => {
    const result = runNode(
      `
      fs.writeFileSync(path.join(dir, 'a.txt'), 'payload');
      report.callbackError = await new Promise((resolve) => {
        fs.rename(path.join(dir, 'a.txt'), path.join(dir, 'b.txt'), (error) => {
          resolve(error ? String(error.code) : null);
        });
      });
      report.moved = fs.existsSync(path.join(dir, 'b.txt'));
      report.sourceGone = !fs.existsSync(path.join(dir, 'a.txt'));
      `,
      { fake: true },
    );

    expect(result).toMatchObject({
      callbackError: null,
      moved: true,
      sourceGone: true,
    });
  });

  it('EXDEV в fs.promises.rename: промис резолвится, файл на месте', () => {
    const result = runNode(
      `
      fs.writeFileSync(path.join(dir, 'a.txt'), 'payload');
      await fs.promises.rename(path.join(dir, 'a.txt'), path.join(dir, 'b.txt'));
      report.moved = fs.existsSync(path.join(dir, 'b.txt'));
      report.sourceGone = !fs.existsSync(path.join(dir, 'a.txt'));
      report.content = fs.readFileSync(path.join(dir, 'b.txt'), 'utf8');
      `,
      { fake: true },
    );

    expect(result).toMatchObject({
      moved: true,
      sourceGone: true,
      content: 'payload',
    });
  });

  it('ошибка не EXDEV (EACCES) пробрасывается и копирования не делает', () => {
    const result = runNode(
      `
      fs.writeFileSync(path.join(dir, 'a.txt'), 'payload');
      report.code = null;
      try {
        fs.renameSync(path.join(dir, 'a.txt'), path.join(dir, 'b.txt'));
      } catch (error) {
        report.code = error.code;
      }
      report.sourceKept = fs.existsSync(path.join(dir, 'a.txt'));
      report.destCreated = fs.existsSync(path.join(dir, 'b.txt'));
      `,
      { fake: true, errorCode: 'EACCES' },
    );

    expect(result).toMatchObject({
      code: 'EACCES',
      sourceKept: true,
      destCreated: false,
    });
    expect(result.warnings).not.toContain('FSEXDEVFIX');
  });
});
