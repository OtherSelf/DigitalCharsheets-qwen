import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  APP_VERSION,
  getAppInfo,
  SHORT_COMMIT_LENGTH,
  shortenCommit,
} from '@/lib/app-info';
import {
  findGitDir,
  getGitCheckoutInfo,
  readGitCheckout,
  resetGitCheckoutCache,
} from '@/lib/git-commit';

/**
 * Версия из рабочей копии (SEC-11 / удобство эксплуатации): `/api/version` и
 * подпись в UI называют коммит без переменных окружения, если приложение
 * запущено из клона репозитория.
 *
 * `.git` читаем так же, как это делает git для простых случаев: HEAD → ref →
 * файл ссылки, `packed-refs`, detached HEAD, worktree с `.git`-файлом. Никаких
 * вызовов `git`, поэтому тесты детерминированы и работают без установленного
 * бинарника.
 */

const SHA = '0123456789abcdef0123456789abcdef01234567';
const OTHER_SHA = 'fedcba9876543210fedcba9876543210fedcba98';

let tempRoot: string;

function makeDir(...segments: string[]): string {
  const dir = path.join(tempRoot, ...segments);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

/** Рабочая копия с распакованной ссылкой: `.git/refs/heads/<branch>`. */
function makeRepo(
  name: string,
  options: { branch?: string; sha?: string; detached?: boolean } = {},
): string {
  const repo = makeDir(name);
  const gitDir = path.join(repo, '.git');
  const sha = options.sha ?? SHA;

  if (options.detached) {
    writeFile(path.join(gitDir, 'HEAD'), `${sha}\n`);
    return repo;
  }

  const branch = options.branch ?? 'main';
  writeFile(path.join(gitDir, 'HEAD'), `ref: refs/heads/${branch}\n`);
  writeFile(path.join(gitDir, 'refs', 'heads', branch), `${sha}\n`);
  return repo;
}

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-git-'));
  resetGitCheckoutCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetGitCheckoutCache();
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('readGitCheckout: разбор .git', () => {
  it('читает SHA и ветку из распакованной ссылки', () => {
    const repo = makeRepo('repo', { branch: 'thfree-dev' });

    expect(readGitCheckout(repo)).toEqual({
      commit: SHA,
      branch: 'thfree-dev',
    });
  });

  it('находит .git выше по дереву (запуск из вложенного каталога)', () => {
    const repo = makeRepo('nested');
    const deep = makeDir('nested', 'src', 'lib');

    expect(findGitDir(deep)).toBe(path.join(repo, '.git'));
    expect(readGitCheckout(deep)).toEqual({ commit: SHA, branch: 'main' });
  });

  it('понимает упакованные ссылки (packed-refs)', () => {
    const repo = makeRepo('packed', { branch: 'release' });
    const gitDir = path.join(repo, '.git');
    // Ссылка ещё не распакована: файла refs/heads/release нет, только packed-refs.
    fs.rmSync(path.join(gitDir, 'refs', 'heads', 'release'));
    writeFile(
      path.join(gitDir, 'packed-refs'),
      `# pack-refs with: peeled fully-peeled sorted\n${OTHER_SHA} refs/heads/release\n`,
    );

    expect(readGitCheckout(repo)).toEqual({
      commit: OTHER_SHA,
      branch: 'release',
    });
  });

  it('понимает detached HEAD (в HEAD лежит SHA)', () => {
    const repo = makeRepo('detached', { detached: true });

    expect(readGitCheckout(repo)).toEqual({ commit: SHA, branch: null });
  });

  it('понимает worktree: `.git` — файл `gitdir: …`', () => {
    const repo = makeRepo('main-repo', { branch: 'wt-branch' });
    const worktree = makeDir('worktree');
    writeFile(
      path.join(worktree, '.git'),
      `gitdir: ${path.join(repo, '.git')}\n`,
    );

    expect(readGitCheckout(worktree)).toEqual({
      commit: SHA,
      branch: 'wt-branch',
    });
  });

  it('приводит SHA к нижнему регистру', () => {
    const repo = makeRepo('upper');
    writeFile(
      path.join(repo, '.git', 'refs', 'heads', 'main'),
      `${SHA.toUpperCase()}\n`,
    );

    expect(readGitCheckout(repo)?.commit).toBe(SHA);
  });

  it('не падает на битом/отсутствующем HEAD и возвращает null', () => {
    const repo = makeRepo('broken');
    writeFile(path.join(repo, '.git', 'HEAD'), 'ref: refs/heads/gone\n');
    expect(readGitCheckout(repo)).toBeNull();

    writeFile(path.join(repo, '.git', 'HEAD'), 'not a sha\n');
    expect(readGitCheckout(repo)).toBeNull();

    fs.rmSync(path.join(repo, '.git', 'HEAD'));
    expect(readGitCheckout(repo)).toBeNull();
  });

  it('возвращает null, если это не рабочая копия', () => {
    const plain = makeDir('no-git');
    expect(findGitDir(plain)).toBeNull();
    expect(readGitCheckout(plain)).toBeNull();
  });
});

describe('getAppInfo: версия из рабочей копии', () => {
  it('без env берёт commit и ветку из .git', () => {
    const repo = makeRepo('info-repo', { branch: 'thfree-dev' });
    resetGitCheckoutCache();

    const info = getAppInfo({ cwd: repo });
    expect(info.version).toBe(APP_VERSION);
    expect(info.commit).toBe(SHA);
    expect(info.commitShort).toBe(SHA.slice(0, SHORT_COMMIT_LENGTH));
    expect(info.branch).toBe('thfree-dev');
  });

  it('кэширует результат на каталог', () => {
    const repo = makeRepo('cache-repo', { branch: 'one' });
    resetGitCheckoutCache();
    expect(getGitCheckoutInfo(repo)?.branch).toBe('one');

    // Меняем HEAD — без сброса кэша значение прежнее (один процесс = одна
    // рабочая копия), после сброса читается заново.
    writeFile(
      path.join(repo, '.git', 'refs', 'heads', 'one'),
      `${OTHER_SHA}\n`,
    );
    expect(getGitCheckoutInfo(repo)?.commit).toBe(SHA);

    resetGitCheckoutCache();
    expect(getGitCheckoutInfo(repo)?.commit).toBe(OTHER_SHA);
  });

  it('env важнее .git (Docker/CI задают коммит и ветку явно)', () => {
    const repo = makeRepo('env-repo');
    vi.stubEnv('DCS_GIT_COMMIT', OTHER_SHA.toUpperCase());
    vi.stubEnv('DCS_GIT_BRANCH', 'from-ci');
    resetGitCheckoutCache();

    const info = getAppInfo({ cwd: repo });
    // env отдаётся как есть (commitShort — уже нормализованный), .git не читается.
    expect(info.commit).toBe(OTHER_SHA.toUpperCase());
    expect(info.branch).toBe('from-ci');
    expect(info.commitShort).toBe(OTHER_SHA.slice(0, SHORT_COMMIT_LENGTH));
  });

  it('в образе без .git commit остаётся null', () => {
    const plain = makeDir('image-root');
    vi.stubEnv('DCS_GIT_COMMIT', '');
    vi.stubEnv('GIT_COMMIT', '');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '');
    resetGitCheckoutCache();

    const info = getAppInfo({ cwd: plain });
    expect(info.commit).toBeNull();
    expect(info.commitShort).toBeNull();
    expect(info.branch).toBeNull();
  });

  it('shortenCommit: 7 символов в нижнем регистре, null без коммита', () => {
    expect(shortenCommit(SHA.toUpperCase())).toBe(SHA.slice(0, 7));
    expect(shortenCommit('abc')).toBe('abc');
    expect(shortenCommit(null)).toBeNull();
  });
});
