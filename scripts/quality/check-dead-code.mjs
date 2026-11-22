#!/usr/bin/env node
/**
 * ============================================================================
 *  scripts/quality/check-dead-code.mjs — мёртвые экспорты и файлы
 * ============================================================================
 *
 *  Зачем. За этапы разделения редакций в `src/` накопились экспорты и файлы,
 *  на которые никто не ссылается: `export-import-dialog.tsx` (270 строк),
 *  `lib/security/index.ts`, схемы DH2, синхронный двойник `hashRecoveryPhrase`.
 *  ESLint видит только локальные символы, `tsc` не включает noUnusedLocals, а
 *  экспорты и файлы не проверяет никто. Гейт закрывает именно эту дыру.
 *
 *  Что считается мёртвым:
 *    • `dead`   — экспорт без единой ссылки вне файла объявления;
 *    • `test-only` — ссылки есть, но только из тестов;
 *    • `export-only` — ссылки только внутри своего файла (не гейтится, D2);
 *    • мёртвый файл — исходник `src/`, который никто не импортирует.
 *
 *  Чего скрипт НЕ видит (осознанно, см. docs/development.md):
 *    • мёртвые локальные функции и переменные — это ESLint no-unused-vars;
 *    • неиспользуемые npm-зависимости — отдельная задача;
 *    • мёртвые ассеты (PNG/ICO/CSS) — гейт работает по TypeScript.
 *
 *  Исключения (без них гейт ложно падал бы на точках входа):
 *    • `src/app/**`, `instrumentation.ts`, `middleware.ts` — Next;
 *    • `games/<id>/{index,ui,sheet,create-form}` — `plugin.json` и `import()`;
 *    • `*.generated.ts` и файлы с заголовком `AUTO-GENERATED` (DH2-данные
 *      собирает `games/dh2/scripts/generate.mjs`, правка файла отменяется);
 *    • цели динамического `import('…')` — модуль живёт ради ленивой загрузки;
 *    • `<file>#<export>` из `plugin.json` — контракт манифеста, а не импорт;
 *    • `src/components/ui/**` — вендоренный shadcn: неиспользуемый
 *      `Dialog.close`/`Sheet.trigger` не «мёртвый код команды» (D10).
 *
 *  Храповики:
 *    • allowlist (`dead-code-allowlist.json`) — запись без `reason` или запись,
 *      которая уже не нужна, роняет проверку (D8);
 *    • `test-only` держится потолком `TEST_ONLY_MAX`: новые тест-симы можно
 *      добавлять только осознанно, поднимая число в том же коммите (D4).
 *
 *  Использование:
 *    npm run deadcode:check            # отчёт + exit 1 при нарушениях
 *    npm run deadcode:check -- --json  # машинный отчёт для CI/отладки
 *
 *  Связано: scripts/predeploy.sh, docs/testing.md, docs/development.md,
 *  scripts/quality/dead-code-allowlist.json, tests/unit/dead-code-check.test.ts.
 * ============================================================================
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, '../..');

/**
 * Потолок `test-only` (храповик, D4). 81 — фактический замер после того, как
 * parity-тест DH1/DH2 перестал прятать ссылки за структурным кастом: к трём
 * копиям-симам (`STAT_UPGRADE_STEP`, `statTotal`, `TRAINING_KEYS`) добавилось
 * видимое использование. Новый тест-сим — осознанное изменение: удалить
 * прод-мёртвое или поднять потолок в том же коммите.
 */
export const TEST_ONLY_MAX = 81;

/** Файлы, которые Next или генератор вызывает сам, а не по импорту. */
const ENTRY_PATTERNS = [
  /^src\/app\//,
  /^src\/instrumentation\.ts$/,
  /^src\/middleware\.ts$/,
  /^src\/games\/[^/]+\/(index|ui|sheet|create-form)\.(ts|tsx)$/,
  /\.generated\.ts$/,
];

const isTestPath = (file) =>
  /(^|\/)tests?\//.test(file) ||
  /\.(test|spec)\.[tj]sx?$/.test(file) ||
  /(^|\/)__tests__\//.test(file);

const isUiKit = (file) => file.startsWith('src/components/ui/');

/** Признак сгенерированного файла — заголовок, а не имя (D9). */
const hasGeneratedHeader = (text) => /AUTO-GENERATED/.test(text.slice(0, 2000));

const toPosix = (value) => value.split(path.sep).join('/');

function readJsonIfExists(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Цели `<file>#<export>` из всех `plugin.json`: это контракт манифеста,
 * а не импорт, и сканер ссылок их не видит.
 */
function collectManifestTargets(root) {
  const targets = new Set();
  const dir = path.join(root, 'src', 'games');
  if (!fs.existsSync(dir)) return targets;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(dir, entry.name, 'plugin.json');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = readJsonIfExists(manifestPath);
    if (!manifest) continue;

    const visit = (value) => {
      if (typeof value === 'string') {
        const hash = value.indexOf('#');
        if (hash > 0) {
          const file = `src/games/${entry.name}/${value.slice(0, hash)}`;
          targets.add(`${file}::${value.slice(hash + 1)}`);
          targets.add(file);
        }
        return;
      }
      if (value && typeof value === 'object') {
        for (const nested of Object.values(value)) visit(nested);
      }
    };
    visit(manifest);
  }
  return targets;
}

/**
 * Разбор программы: экспорты, ссылки, импортированные файлы.
 *
 * @returns {{
 *   exports: Array<{file: string, line: number, name: string, status: string}>,
 *   deadFiles: string[],
 *   counts: {used: number, dead: number, exportOnly: number, testOnly: number},
 * }}
 */
export function analyze(root = DEFAULT_ROOT) {
  const configPath = path.join(root, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) {
    throw new Error(
      `не читается tsconfig.json: ${ts.flattenDiagnosticMessageText(config.error.messageText, '\n')}`,
    );
  }
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const isTestFile = (file) => isTestPath(file);

  const program = ts.createProgram(
    parsed.fileNames.filter(
      (file) =>
        !file.includes('node_modules') &&
        !file.includes(`${path.sep}.next${path.sep}`),
    ),
    parsed.options,
  );
  const checker = program.getTypeChecker();
  const relOf = (file) => toPosix(path.relative(root, file));

  const manifestTargets = collectManifestTargets(root);

  /** Файлы, подтянутые динамическим `import('…')`: их экспорты не гейтятся. */
  const dynamicTargets = new Set();
  /** Все файлы, на которые есть статический импорт/реэкспорт. */
  const importedFiles = new Set();

  const resolveSpecifier = (specifier, fromFile) => {
    const resolved = ts.resolveModuleName(
      specifier,
      fromFile,
      parsed.options,
      ts.sys,
    ).resolvedModule;
    return resolved ? toPosix(path.normalize(resolved.resolvedFileName)) : null;
  };

  const sourceFiles = program
    .getSourceFiles()
    .filter((source) => !source.isDeclarationFile);

  for (const source of sourceFiles) {
    const fromFile = source.fileName;
    const visit = (node) => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const specifier = node.moduleSpecifier;
        if (specifier && ts.isStringLiteral(specifier)) {
          const resolved = resolveSpecifier(specifier.text, fromFile);
          if (resolved) importedFiles.add(resolved);
        }
      }
      // import('…') — ленивая загрузка: цель живёт ради неё. Только из
      // прод-кода: тесты тоже импортируют модули динамически (изоляция,
      // vi.mock), но это не делает модуль «точкой входа» — иначе из анализа
      // выпадают server-auth, shared/defaults и другие живые файлы.
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const resolved = resolveSpecifier(node.arguments[0].text, fromFile);
        if (resolved) {
          importedFiles.add(resolved);
          if (!isTestFile(relOf(fromFile))) dynamicTargets.add(resolved);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  // ── 1. Экспорты, объявленные в src ───────────────────────────────────────
  const declSymbols = new Map();

  for (const source of sourceFiles) {
    const file = relOf(source.fileName);
    if (!file.startsWith('src/')) continue;
    if (isTestFile(file)) continue;
    if (isUiKit(file)) continue;
    if (ENTRY_PATTERNS.some((pattern) => pattern.test(file))) continue;
    if (hasGeneratedHeader(source.text)) continue;
    if (dynamicTargets.has(toPosix(path.normalize(source.fileName)))) continue;

    const moduleSymbol = checker.getSymbolAtLocation(source);
    if (!moduleSymbol) continue;

    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      let symbol = exported;
      if (symbol.flags & ts.SymbolFlags.Alias) {
        try {
          symbol = checker.getAliasedSymbol(symbol);
        } catch {
          /* оставляем исходный символ */
        }
      }
      if (!symbol?.declarations?.length) continue;

      const declaration =
        symbol.declarations.find(
          (item) => !item.getSourceFile().isDeclarationFile,
        ) ?? symbol.declarations[0];
      const declaredIn = relOf(declaration.getSourceFile().fileName);
      if (!declaredIn.startsWith('src/') || isTestFile(declaredIn)) continue;

      if (!declSymbols.has(symbol)) {
        const { line } = declaration
          .getSourceFile()
          .getLineAndCharacterOfPosition(declaration.getStart());
        declSymbols.set(symbol, {
          file: declaredIn,
          line: line + 1,
          name: exported.getName(),
        });
      }
    }
  }

  // ── 2. Ссылки на экспорты ────────────────────────────────────────────────
  const references = new Map(); // ts.Symbol -> Set<file>
  const record = (symbol, file) => {
    if (!symbol) return;
    if (!references.has(symbol)) references.set(symbol, new Set());
    references.get(symbol).add(file);
  };

  const resolveSymbol = (node) => {
    let symbol = checker.getSymbolAtLocation(node);
    if (!symbol) return null;
    if (symbol.flags & ts.SymbolFlags.Alias) {
      try {
        symbol = checker.getAliasedSymbol(symbol);
      } catch {
        return symbol;
      }
    }
    return symbol;
  };

  const isDeclarationName = (node) => {
    const parent = node.parent;
    if (!parent) return false;
    const named = [
      ts.isVariableDeclaration,
      ts.isFunctionDeclaration,
      ts.isClassDeclaration,
      ts.isInterfaceDeclaration,
      ts.isTypeAliasDeclaration,
      ts.isEnumDeclaration,
      ts.isEnumMember,
      ts.isParameter,
      ts.isPropertySignature,
      ts.isMethodSignature,
      ts.isPropertyDeclaration,
      ts.isMethodDeclaration,
      ts.isTypeParameterDeclaration,
      ts.isImportSpecifier,
      ts.isImportClause,
      ts.isNamespaceImport,
      ts.isExportSpecifier,
      ts.isModuleDeclaration,
    ].some((guard) => guard(parent));
    return named && parent.name === node;
  };

  // Ссылки ищем во всей программе, включая корневые конфиги: только
  // `next.config.ts` импортирует `readGitCheckoutSync`, и без него живой
  // экспорт выглядел бы мёртвым.
  for (const source of sourceFiles) {
    const file = relOf(source.fileName);
    const visit = (node) => {
      if (ts.isIdentifier(node)) {
        if (!isDeclarationName(node)) {
          if (ts.isShorthandPropertyAssignment(node.parent)) {
            record(
              checker.getShorthandAssignmentValueSymbol(node.parent),
              file,
            );
          }
          record(resolveSymbol(node), file);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  // ── 3. Классификация ─────────────────────────────────────────────────────
  const exportsReport = [];
  for (const [symbol, meta] of declSymbols) {
    if (manifestTargets.has(`${meta.file}::${meta.name}`)) continue;
    if (manifestTargets.has(meta.file)) continue;

    const referenceFiles = [...(references.get(symbol) ?? [])];
    const outside = referenceFiles.filter((file) => file !== meta.file);
    const nonTest = outside.filter((file) => !isTestFile(file));

    let status = 'used';
    if (outside.length === 0 && referenceFiles.length === 0) status = 'dead';
    else if (outside.length === 0) status = 'export-only';
    else if (nonTest.length === 0) status = 'test-only';

    exportsReport.push({ ...meta, status });
  }

  // ── 4. Мёртвые файлы ─────────────────────────────────────────────────────
  const deadFiles = [];
  for (const source of sourceFiles) {
    const file = relOf(source.fileName);
    if (!file.startsWith('src/')) continue;
    if (isTestFile(file)) continue;
    if (ENTRY_PATTERNS.some((pattern) => pattern.test(file))) continue;
    if (hasGeneratedHeader(source.text)) continue;
    if (manifestTargets.has(file)) continue;
    if (importedFiles.has(toPosix(path.normalize(source.fileName)))) continue;
    deadFiles.push(file);
  }

  const counts = { used: 0, dead: 0, 'export-only': 0, 'test-only': 0 };
  for (const item of exportsReport) counts[item.status] += 1;

  return {
    exports: exportsReport.sort(
      (a, b) => a.file.localeCompare(b.file) || a.line - b.line,
    ),
    deadFiles: deadFiles.sort(),
    counts,
  };
}

/**
 * Сверка отчёта с allowlist и потолками. Возвращает список нарушений.
 */
export function validate(report, allowlist, limits = {}) {
  const problems = [];
  const entries = Array.isArray(allowlist?.allowed) ? allowlist.allowed : [];
  const deadKeys = new Set(
    report.exports
      .filter((item) => item.status === 'dead')
      .map((item) => `${item.file}::${item.name}`),
  );

  const used = new Set();
  for (const entry of entries) {
    if (
      !entry ||
      typeof entry.file !== 'string' ||
      typeof entry.name !== 'string'
    ) {
      problems.push(
        `allowlist: запись без file/name: ${JSON.stringify(entry)}`,
      );
      continue;
    }
    if (typeof entry.reason !== 'string' || entry.reason.trim() === '') {
      problems.push(
        `allowlist: нет reason у ${entry.file}::${entry.name} (D8)`,
      );
      continue;
    }
    const key = `${entry.file}::${entry.name}`;
    if (!deadKeys.has(key)) {
      problems.push(
        `allowlist: запись больше не нужна — ${key} (удалить из allowlist)`,
      );
      continue;
    }
    used.add(key);
  }

  for (const key of deadKeys) {
    if (used.has(key)) continue;
    const item = report.exports.find(
      (entry) => `${entry.file}::${entry.name}` === key,
    );
    problems.push(
      `мёртвый экспорт: ${item.file}:${item.line} ${item.name} — удалить или внести в allowlist с reason`,
    );
  }

  for (const file of report.deadFiles) {
    problems.push(
      `мёртвый файл: ${file} — нет импортёров (входы Next и плагинов не считаются)`,
    );
  }

  const testOnlyMax = limits.testOnlyMax ?? TEST_ONLY_MAX;
  if (report.counts['test-only'] > testOnlyMax) {
    problems.push(
      `test-only вырос: ${report.counts['test-only']} > ${testOnlyMax}. Новый тест-сим — осознанное решение: удалить прод-мёртвое или поднять потолок в том же коммите (D4)`,
    );
  }

  return problems;
}

function formatReport(report, problems) {
  const lines = [];
  lines.push(
    `экспортов: ${report.exports.length} (used ${report.counts.used}, dead ${report.counts.dead}, export-only ${report.counts['export-only']}, test-only ${report.counts['test-only']})`,
  );
  lines.push(`мёртвых файлов: ${report.deadFiles.length}`);

  const dead = report.exports.filter((item) => item.status === 'dead');
  if (dead.length > 0) {
    lines.push('', 'мёртвые экспорты:');
    for (const item of dead)
      lines.push(`  ${item.file}:${item.line}  ${item.name}`);
  }
  if (report.deadFiles.length > 0) {
    lines.push('', 'мёртвые файлы:');
    for (const file of report.deadFiles) lines.push(`  ${file}`);
  }
  if (problems.length > 0) {
    lines.push('', 'нарушения:');
    for (const problem of problems) lines.push(`  ✗ ${problem}`);
  }
  return lines.join('\n');
}

function main(argv) {
  const json = argv.includes('--json');
  const root = DEFAULT_ROOT;
  const allowlistPath = path.join(HERE, 'dead-code-allowlist.json');

  let allowlist = { allowed: [] };
  if (fs.existsSync(allowlistPath)) {
    allowlist = readJsonIfExists(allowlistPath);
    if (!allowlist) {
      console.error(
        `✗ ${toPosix(path.relative(root, allowlistPath))}: невалидный JSON`,
      );
      process.exit(1);
    }
  }

  const report = analyze(root);
  const problems = validate(report, allowlist);

  if (json) {
    process.stdout.write(
      `${JSON.stringify({ ...report, problems, limits: { testOnlyMax: TEST_ONLY_MAX } }, null, 2)}\n`,
    );
  } else {
    console.log(formatReport(report, problems));
    if (problems.length === 0) {
      console.log('\n✓ мёртвого кода вне allowlist нет');
    }
  }

  process.exit(problems.length === 0 ? 0 : 1);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main(process.argv.slice(2));
}
