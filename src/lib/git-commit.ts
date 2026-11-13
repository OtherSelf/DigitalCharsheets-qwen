import fs from 'fs';
import path from 'path';

/**
 * ─── LANDMARK: GIT CHECKOUT INFO ────────────────────────────────────────────
 * Версия приложения должна называть свой коммит и без переменных окружения:
 * при запуске из рабочей копии (`next start`/`next dev` в клоне репозитория)
 * рядом лежит `.git`. Читаем его напрямую — без `git`-бинарника, без сети и без
 * влияния на старт процесса (три маленьких файла).
 *
 * Понимаем оба вида рабочей копии:
 *   • `.git/` — каталог: `HEAD` → `ref: refs/heads/<ветка>` → `refs/heads/<ветка>`;
 *   • `.git` — файл `gitdir: <путь>` (worktree, submodule).
 * Detached HEAD (`HEAD` содержит SHA) и упакованные в `packed-refs` ссылки тоже
 * поддержаны.
 *
 * Наружу отдаём только SHA и имя ветки: путь к репозиторию, origin-URL и
 * остальные внутренности в /api/version не попадают (эндпоинт публичный).
 */

export interface GitCheckoutInfo {
  /** Полный SHA коммита, на который смотрит HEAD (нижний регистр). */
  commit: string;
  /** Имя ветки (`refs/heads/<name>`), `null` — detached HEAD. */
  branch: string | null;
}

const SHA_RE = /^[0-9a-f]{7,64}$/i;
/** `packed-refs` крупных репозиториев — сотни КБ; больше не читаем. */
const MAX_REFS_FILE_BYTES = 4 * 1024 * 1024;

/** Каталог `.git` для каталога или `null`, если это не рабочая копия. */
function resolveGitDir(dir: string): string | null {
  const candidate = path.join(dir, '.git');
  let stat: fs.Stats;
  try {
    stat = fs.statSync(candidate);
  } catch {
    return null;
  }

  if (stat.isDirectory()) return candidate;

  if (stat.isFile()) {
    // `git worktree` и submodule хранят не каталог, а ссылку на него:
    //   gitdir: /repo/.git/worktrees/name
    try {
      const content = fs.readFileSync(candidate, 'utf8').trim();
      const match = /^gitdir:\s*(.+)$/i.exec(content);
      if (!match) return null;
      const target = path.resolve(dir, match[1]);
      return fs.statSync(target).isDirectory() ? target : null;
    } catch {
      return null;
    }
  }

  return null;
}

/** Ближайший вверх по дереву каталог с `.git` (рабочая копия) или `null`. */
export function findGitDir(startDir: string): string | null {
  let dir = path.resolve(startDir);

  for (;;) {
    const gitDir = resolveGitDir(dir);
    if (gitDir) return gitDir;

    const parent = path.dirname(dir);
    // Корень ФС: дальше подниматься некуда.
    if (parent === dir) return null;
    dir = parent;
  }
}

function readSmallFile(file: string): string | null {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > MAX_REFS_FILE_BYTES) return null;
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** SHA из распакованной ссылки (`refs/heads/x`) или из `packed-refs`. */
function readRef(gitDir: string, ref: string): string | null {
  const loose = readSmallFile(path.join(gitDir, ref))?.trim();
  if (loose && SHA_RE.test(loose)) return loose;

  const packed = readSmallFile(path.join(gitDir, 'packed-refs'));
  if (!packed) return null;

  for (const line of packed.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('^')) {
      continue;
    }
    const [sha, name] = trimmed.split(/\s+/);
    if (name === ref && SHA_RE.test(sha)) return sha;
  }

  return null;
}

/**
 * Прочитать состояние рабочей копии. `null` — не клон (нет `.git`), HEAD
 * битый или ссылка не разрешается: вызывающий покажет версию без коммита.
 */
export function readGitCheckout(
  startDir: string = process.cwd(),
): GitCheckoutInfo | null {
  const gitDir = findGitDir(startDir);
  if (!gitDir) return null;

  const head = readSmallFile(path.join(gitDir, 'HEAD'))?.trim();
  if (!head) return null;

  const refMatch = /^ref:\s*(refs\/heads\/.+)$/.exec(head);
  if (refMatch) {
    const branch = refMatch[1].slice('refs/heads/'.length);
    const sha = readRef(gitDir, refMatch[1]);
    return sha ? { commit: sha.toLowerCase(), branch } : null;
  }

  // Detached HEAD: в файле лежит сам SHA.
  return SHA_RE.test(head)
    ? { commit: head.toLowerCase(), branch: null }
    : null;
}

/**
 * Кэш на процесс: `.git` не меняется между запросами чаще, чем раз в
 * `next start`, а /api/version опрашивается на каждой вкладке.
 */
let cached: { startDir: string; info: GitCheckoutInfo | null } | null = null;

export function getGitCheckoutInfo(
  startDir: string = process.cwd(),
): GitCheckoutInfo | null {
  if (cached && cached.startDir === startDir) return cached.info;
  const info = readGitCheckout(startDir);
  cached = { startDir, info };
  return info;
}

/** Сбросить кэш (тесты и смена рабочего каталога в рантайме). */
export function resetGitCheckoutCache(): void {
  cached = null;
}
