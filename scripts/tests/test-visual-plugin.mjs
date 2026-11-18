#!/usr/bin/env node
/**
 * ============================================================================
 *  scripts/tests/test-visual-plugin.mjs — visual-тесты одного плагина
 * ============================================================================
 *
 *  Игровые сценарии размечены тегом `@plugin:<id>` (в том числе сценарии,
 *  которые пока живут в host-спеках), а спеки плагина лежат в
 *  `src/games/<id>/tests/visual/*.visual.spec.ts`. Скрипт запускает только
 *  выбранный плагин через `playwright --grep`, не перечисляя файлы.
 *
 *  Использование:
 *    npm run test:visual:plugin -- dh1
 *    npm run test:visual:plugin -- dh1 --skip-build
 *    npm run test:visual:plugin -- dnd5e --grep @fast
 *
 *  Связано: scripts/visual.sh, playwright.config.ts, tests/visual/*.spec.ts.
 * ============================================================================
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GAMES_DIR = join(ROOT, 'src/games');

const [id, ...rest] = process.argv.slice(2);

if (!id || id === '-h' || id === '--help') {
  console.log(`Visual-тесты одного игрового плагина.

  npm run test:visual:plugin -- <id> [флаги visual.sh]

  <id> — папка src/games/<id> с plugin.json (dh1, dh2, dnd5e).
  Запускает playwright --grep @plugin:<id>; остальные аргументы уходят в
  scripts/visual.sh как есть.`);
  process.exit(id ? 0 : 1);
}

if (!/^[a-z0-9-]+$/.test(id)) {
  console.error(`test:visual:plugin: некорректный id "${id}"`);
  process.exit(1);
}

if (!existsSync(join(GAMES_DIR, id, 'plugin.json'))) {
  const known = readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(GAMES_DIR, name, 'plugin.json')))
    .sort();
  console.error(
    `test:visual:plugin: нет плагина "${id}". Есть: ${known.join(', ')}`,
  );
  process.exit(1);
}

const result = spawnSync(
  'bash',
  [join('scripts', 'visual.sh'), '--grep', `@plugin:${id}`, ...rest],
  { cwd: ROOT, stdio: 'inherit' },
);

process.exit(result.status ?? 1);
