import fs from 'fs/promises';
import fsSync, { type Stats } from 'node:fs';
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
async function resolveGitDir(dir: string): Promise<string | null> {
  const candidate = path.join(dir, '.git');
  let stat: Stats;
  try {
    stat = await fs.stat(candidate);
  } catch {
    return null;
  }

  if (stat.isDirectory()) return candidate;

  if (stat.isFile()) {
    // `git worktree` и submodule хранят не каталог, а ссылку на него:
    //   gitdir: /repo/.git/worktrees/name
    try {
      const content = (await fs.readFile(candidate, 'utf8')).trim();
      const match = /^gitdir:\s*(.+)$/i.exec(content);
      if (!match) return null;
      const target = path.resolve(dir, match[1]);
      return (await fs.stat(target)).isDirectory() ? target : null;
    } catch {
      return null;
    }
  }

  return null;
}

/** Ближайший вверх по дереву каталог с `.git` (рабочая копия) или `null`. */
export async function findGitDir(startDir: string): Promise<string | null> {
  let dir = path.resolve(startDir);

  for (;;) {
    const gitDir = await resolveGitDir(dir);
    if (gitDir) return gitDir;

    const parent = path.dirname(dir);
    // Корень ФС: дальше подниматься некуда.
    if (parent === dir) return null;
    dir = parent;
  }
}

async function readSmallFile(file: string): Promise<string | null> {
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > MAX_REFS_FILE_BYTES) return null;
    return await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
}

/** SHA из распакованной ссылки (`refs/heads/x`) или из `packed-refs`. */
async function readRef(gitDir: string, ref: string): Promise<string | null> {
  const loose = (await readSmallFile(path.join(gitDir, ref)))?.trim();
  if (loose && SHA_RE.test(loose)) return loose;

  const packed = await readSmallFile(path.join(gitDir, 'packed-refs'));
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
export async function readGitCheckout(
  startDir: string = process.cwd(),
): Promise<GitCheckoutInfo | null> {
  const gitDir = await findGitDir(startDir);
  if (!gitDir) return null;

  const head = (await readSmallFile(path.join(gitDir, 'HEAD')))?.trim();
  if (!head) return null;

  const refMatch = /^ref:\s*(refs\/heads\/.+)$/.exec(head);
  if (refMatch) {
    const branch = refMatch[1].slice('refs/heads/'.length);
    const sha = await readRef(gitDir, refMatch[1]);
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

export async function getGitCheckoutInfo(
  startDir: string = process.cwd(),
): Promise<GitCheckoutInfo | null> {
  if (cached && cached.startDir === startDir) return cached.info;
  const info = await readGitCheckout(startDir);
  cached = { startDir, info };
  return info;
}

/** Сбросить кэш (тесты и смена рабочего каталога в рантайме). */
export function resetGitCheckoutCache(): void {
  cached = null;
}

/**
 * Синхронный вариант для `next.config.ts`: конфиг вычисляется до старта
 * сервера и не может ждать промис. В запросном пути используйте
 * `getGitCheckoutInfo` — он не блокирует event loop.
 */
export function readGitCheckoutSync(
  startDir: string = process.cwd(),
): GitCheckoutInfo | null {
  const readSmall = (file: string): string | null => {
    try {
      const stat = fsSync.statSync(file);
      if (!stat.isFile() || stat.size > MAX_REFS_FILE_BYTES) return null;
      return fsSync.readFileSync(file, 'utf8');
    } catch {
      return null;
    }
  };

  const resolveDir = (dir: string): string | null => {
    const candidate = path.join(dir, '.git');
    let stat: fsSync.Stats;
    try {
      stat = fsSync.statSync(candidate);
    } catch {
      return null;
    }
    if (stat.isDirectory()) return candidate;
    if (stat.isFile()) {
      try {
        const content = fsSync.readFileSync(candidate, 'utf8').trim();
        const match = /^gitdir:\s*(.+)$/i.exec(content);
        if (!match) return null;
        const target = path.resolve(dir, match[1]);
        return fsSync.statSync(target).isDirectory() ? target : null;
      } catch {
        return null;
      }
    }
    return null;
  };

  let dir = path.resolve(startDir);
  let gitDir: string | null = null;
  for (;;) {
    gitDir = resolveDir(dir);
    if (gitDir) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (!gitDir) return null;

  const head = readSmall(path.join(gitDir, 'HEAD'))?.trim();
  if (!head) return null;

  const refMatch = /^ref:\s*(refs\/heads\/.+)$/.exec(head);
  if (refMatch) {
    const branch = refMatch[1].slice('refs/heads/'.length);
    const loose = readSmall(path.join(gitDir, refMatch[1]))?.trim();
    if (loose && SHA_RE.test(loose)) {
      return { commit: loose.toLowerCase(), branch };
    }
    const packed = readSmall(path.join(gitDir, 'packed-refs'));
    if (packed) {
      for (const line of packed.split('\n')) {
        const trimmed = line.trim();
        if (
          trimmed === '' ||
          trimmed.startsWith('#') ||
          trimmed.startsWith('^')
        ) {
          continue;
        }
        const [sha, name] = trimmed.split(/\s+/);
        if (name === refMatch[1] && SHA_RE.test(sha)) {
          return { commit: sha.toLowerCase(), branch };
        }
      }
    }
    return null;
  }

  return SHA_RE.test(head)
    ? { commit: head.toLowerCase(), branch: null }
    : null;
}
