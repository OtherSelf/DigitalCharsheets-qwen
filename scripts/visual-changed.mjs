#!/usr/bin/env node
/**
 * ─── LANDMARK: VISUAL CHANGED ──────────────────────────────────────────────
 * Запускает только те визуальные спеки, которые может затронуть diff.
 *
 * Источники изменений:
 *   • коммиты относительно --base (по умолчанию origin/main, затем main);
 *   • рабочее дерево: staged, unstaged и untracked.
 *
 * Правила ниже — консервативные: при сомнении выбирается более широкий набор
 * (вплоть до полного прогона). Если изменений, влияющих на UI, нет — выходим
 * с кодом 0, не поднимая сервер.
 *
 * Использование:
 *   npm run test:visual:changed
 *   npm run test:visual:changed -- --base origin/main
 *   npm run test:visual:changed -- --dry-run
 *   npm run test:visual:changed -- --files src/components/layout/header.tsx --dry-run
 *   npm run test:visual:changed -- --full
 *
 * Всё после `--` передаётся в scripts/visual.sh (например, --skip-build).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const ALL_SPECS = [
  'admin',
  'basic-pages',
  'creation',
  'dialogs',
  'editing',
  'locale',
  'pages',
  'sheets',
  'tablet',
  'themes',
  'user-menu',
].map((name) => `tests/visual/${name}.spec.ts`);

const FAST = Symbol('fast');

/**
 * Карта «путь → спеки». Порядок важен: более специфичные правила выше.
 * Значение FAST — безопасный дефолт для неизвестного UI-кода.
 */
const RULES = [
  {
    pattern: /^tests\/visual\/(helpers|state|global-setup)\.ts$/,
    specs: 'full',
  },
  {
    pattern:
      /^(playwright\.config\.ts|scripts\/visual(-changed|-prune)?\.(sh|mjs))$/,
    specs: 'full',
  },
  {
    pattern: /^tests\/visual\/__screenshots__\/[^/]+\/([a-z-]+)\.spec\.ts\//,
    specs: 'snapshot',
  },
  {
    pattern: /^tests\/visual\/([a-z-]+)\.spec\.ts$/,
    specs: 'spec',
  },
  {
    pattern: /^src\/lib\/translations/,
    specs: ['admin', 'locale', 'pages', 'themes', 'user-menu'],
  },
  {
    pattern: /^src\/components\/admin\//,
    specs: ['admin', 'user-menu'],
  },
  {
    pattern: /^src\/app\/admin\//,
    specs: ['admin', 'user-menu'],
  },
  {
    pattern: /^src\/components\/layout\//,
    specs: ['basic-pages', 'pages', 'tablet', 'user-menu'],
  },
  {
    pattern: /^src\/components\/sheets\//,
    specs: ['dialogs', 'editing', 'locale', 'sheets'],
  },
  {
    pattern: /^src\/components\/(character|stats|sheet|dnd|dark-heresy)/,
    specs: ['creation', 'dialogs', 'editing', 'sheets'],
  },
  {
    pattern: /^src\/components\/ui\//,
    specs: 'full',
  },
  {
    pattern: /^src\/app\/(globals\.css|layout\.tsx)$/,
    specs: ['basic-pages', 'pages', 'tablet', 'themes'],
  },
  {
    pattern: /^(tailwind\.config|postcss\.config|next\.config)/,
    specs: ['basic-pages', 'pages', 'themes'],
  },
  {
    pattern: /^src\/app\/(login|demo|new|settings|stats-editor)\//,
    specs: ['basic-pages', 'creation', 'pages'],
  },
  {
    pattern: /^src\/app\/\[id\]\//,
    specs: ['dialogs', 'editing', 'sheets'],
  },
  {
    pattern: /^src\/app\/api\//,
    specs: 'none',
  },
  {
    pattern: /^src\/app\//,
    specs: ['basic-pages', 'pages'],
  },
  {
    pattern: /^src\/(context|hooks)\//,
    specs: ['creation', 'dialogs', 'editing', 'pages', 'sheets'],
  },
  {
    pattern: /^src\/lib\//,
    specs: 'none',
  },
  {
    pattern: /^package(-lock)?\.json$/,
    // Зависимости/скрипты: быстрый визуальный смоук, не полный прогон.
    specs: FAST,
  },
  {
    pattern: /^src\//,
    specs: FAST,
  },
  {
    pattern: /^(docs\/|README|scripts\/|tsconfig|eslint|prettier)/,
    specs: 'none',
  },
];

function sh(args) {
  return spawnSync('git', args, { cwd: APP_DIR, encoding: 'utf8' });
}

function parseArgs(argv) {
  let base = null;
  let forceFull = false;
  let dryRun = false;
  let files = null;
  const forward = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      forward.push(...argv.slice(i + 1));
      break;
    }
    if (arg === '--base') {
      base = argv[++i];
      if (!base) throw new Error('--base требует ref');
    } else if (arg === '--full') {
      forceFull = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--files') {
      const value = argv[++i];
      if (!value) throw new Error('--files требует список через запятую');
      files = value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      // Неизвестные флаги (например, --skip-build) пробрасываем в visual.sh.
      forward.push(arg);
    }
  }
  return { base, forceFull, dryRun, files, forward };
}

function gitChangedFiles(base) {
  const files = new Set();

  const addDiff = (args) => {
    const result = sh(args);
    if (result.status !== 0) return false;
    for (const file of result.stdout.split('\n')) {
      if (file.trim()) files.add(file.trim());
    }
    return true;
  };

  if (base) {
    addDiff(['diff', '--name-only', `${base}...HEAD`]);
  }
  addDiff(['diff', '--name-only']);
  addDiff(['diff', '--cached', '--name-only']);

  const untracked = sh(['ls-files', '--others', '--exclude-standard']);
  if (untracked.status === 0) {
    for (const file of untracked.stdout.split('\n')) {
      if (file.trim()) files.add(file.trim());
    }
  }
  return [...files];
}

function resolveBase(explicit) {
  if (explicit) return explicit;
  for (const candidate of ['origin/main', 'main']) {
    const result = sh(['rev-parse', '--verify', '--quiet', candidate]);
    if (result.status === 0) return candidate;
  }
  return null;
}

function specPath(name) {
  return `tests/visual/${name}.spec.ts`;
}

/**
 * Чистая функция — её удобно проверять отдельно.
 * Возвращает { mode: 'full' | 'fast' | 'none', specs: string[] }.
 */
export function mapChangedFiles(files) {
  if (!files.length) return { mode: 'none', specs: [] };

  let full = false;
  let fast = false;
  const specs = new Set();

  for (const file of files) {
    const normalized = file.replaceAll(path.sep, '/');
    let matched = false;

    for (const rule of RULES) {
      const match = normalized.match(rule.pattern);
      if (!match) continue;
      matched = true;

      if (rule.specs === 'full') {
        full = true;
      } else if (rule.specs === 'none') {
        // Намеренно ничего: backend/docs не влияют на эталоны.
      } else if (rule.specs === FAST) {
        fast = true;
      } else if (rule.specs === 'snapshot') {
        specs.add(specPath(match[1]));
      } else if (rule.specs === 'spec') {
        specs.add(specPath(match[1]));
      } else {
        for (const name of rule.specs) specs.add(specPath(name));
      }
      break;
    }

    if (!matched) {
      // Новый файл вне известных зон: безопаснее прогнать fast-набор.
      fast = true;
    }
  }

  if (full) return { mode: 'full', specs: ALL_SPECS };
  if (specs.size > 0) return { mode: 'specs', specs: [...specs].sort() };
  if (fast) return { mode: 'fast', specs: [] };
  return { mode: 'none', specs: [] };
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[visual-changed] ${error.message}`);
    process.exit(2);
  }

  if (args.forceFull) {
    run('full', ALL_SPECS, args);
    return;
  }

  const files = args.files ?? gitChangedFiles(resolveBase(args.base));
  if (files.length === 0) {
    console.log('[visual-changed] изменений нет');
    return;
  }

  const plan = mapChangedFiles(files);
  console.log(`[visual-changed] изменённых файлов: ${files.length}`);
  for (const file of files) console.log(`  ${file}`);
  console.log(`[visual-changed] режим: ${plan.mode}`);

  run(plan.mode, plan.specs, args);
}

function run(mode, specs, args) {
  if (mode === 'none') {
    console.log('[visual-changed] визуальные тесты не нужны');
    return;
  }

  const playwrightArgs =
    mode === 'fast' ? ['--grep', '@fast'] : mode === 'specs' ? specs : [];

  console.log(
    `[visual-changed] спеки: ${
      mode === 'full' ? 'все' : mode === 'fast' ? '@fast' : specs.join(', ')
    }`,
  );
  if (args.dryRun) return;

  if (!fs.existsSync(path.join(APP_DIR, 'scripts', 'visual.sh'))) {
    console.error('[visual-changed] не найден scripts/visual.sh');
    process.exit(1);
  }

  const result = spawnSync(
    'bash',
    ['scripts/visual.sh', ...playwrightArgs, ...args.forward],
    { cwd: APP_DIR, stdio: 'inherit' },
  );
  process.exit(result.status ?? 1);
}

main();
