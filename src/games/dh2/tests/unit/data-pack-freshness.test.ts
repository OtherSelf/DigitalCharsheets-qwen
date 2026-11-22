import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ─── LANDMARK: DH2E DATA FRESHNESS ────────────────────────────────────────
 * `dh2e-*.ts` и словарь `dh2.catalog.*` — сгенерированные файлы: эталон
 * лежит во внешнем контент-каталоге (`DCS_CONTENT_DIR`). Проверка дрейфа —
 * это тест плагина, а не шаг `predeploy.sh`: гейт ядра больше не знает ни
 * одной игры, а vitest находит тест сам.
 *
 * В CI внешнего каталога нет, поэтому без него тест пропускается с причиной
 * (условный skip разрешён AGENTS §1: нужна внешняя фикстура).
 */
const CONTENT_DIR = process.env.DCS_CONTENT_DIR;
const HAS_CATALOG =
  Boolean(CONTENT_DIR) && existsSync(path.join(CONTENT_DIR!, 'catalog.json'));

describe.skipIf(!HAS_CATALOG)('данные 2-й редакции', () => {
  it('dh2e-*.ts не дрейфуют от content/dh2', () => {
    const output = execFileSync(
      process.execPath,
      ['src/games/dh2/scripts/generate.mjs', '--check'],
      {
        cwd: process.cwd(),
        env: { ...process.env, DCS_CONTENT_DIR: CONTENT_DIR },
        encoding: 'utf8',
      },
    );
    expect(output).toContain('dh2e: ok');
  }, 60_000);
});
