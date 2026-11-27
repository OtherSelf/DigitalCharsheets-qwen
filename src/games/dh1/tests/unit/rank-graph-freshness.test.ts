import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ─── LANDMARK: DH1 RANK GRAPH FRESHNESS ──────────────────────────────────
 * `rank-graph.generated.ts` и ключи `dh1.rank.*` — сгенерированные файлы:
 * эталон лежит во внешнем контент-каталоге (`DCS_CONTENT_DIR`). Проверка
 * дрейфа — тест плагина, а не шаг `predeploy.sh`: гейт ядра не знает ни одной
 * игры, а vitest находит тест сам.
 *
 * В CI внешнего каталога нет, поэтому без него тест пропускается с причиной
 * (условный skip разрешён: нужна внешняя фикстура).
 */
const CONTENT_DIR = process.env.DCS_CONTENT_DIR;
const HAS_CATALOG =
  Boolean(CONTENT_DIR) && existsSync(path.join(CONTENT_DIR!, 'catalog.json'));

describe.skipIf(!HAS_CATALOG)('граф рангов 1-й редакции', () => {
  it('не дрейфует от content/dh1', () => {
    const output = execFileSync(
      process.execPath,
      ['src/games/dh1/scripts/generate.mjs', '--check'],
      {
        cwd: process.cwd(),
        env: { ...process.env, DCS_CONTENT_DIR: CONTENT_DIR },
        encoding: 'utf8',
      },
    );
    expect(output).toContain('dh1: ok');
  }, 60_000);
});
