/**
 * Изолированный каталог данных и файловый макет data-dir для тестов.
 *
 * В ./data тесты не пишут: useTempDataDir() создаёт каталог в os.tmpdir() и
 * выставляет DCS_DATA_DIR, removeDir() удаляет его в afterEach. Пути ниже
 * повторяют раскладку хранилища (схема v2), чтобы тест мог прочитать файл
 * обратно и проверить, что запись действительно состоялась.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Создаёт пустой временный каталог и делает его DATA_DIR для приложения
 * (src/lib/data-dir.ts читает DCS_DATA_DIR при каждом вызове).
 * Так тесты не видят и не портят реальные ./data.
 */
export function useTempDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-test-'));
  process.env.DCS_DATA_DIR = dir;
  return dir;
}

export function removeDir(dir: string | undefined | null) {
  if (!dir) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

export function readJson<T = any>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

/**
 * Подпись пользователя: файловый макет каталога
 * `<data-dir>/users/<uid>/{user.json,characters}` (схема v2).
 */
export function userPaths(dataDir: string, userId: string) {
  const userDir = path.join(dataDir, 'users', userId);
  return {
    userDir,
    userFile: path.join(userDir, 'user.json'),
    charactersDir: path.join(userDir, 'characters'),
  };
}

/** Индекс «логин → uid»: `<data-dir>/index/logins.json`. */
export function loginIndexPath(dataDir: string): string {
  return path.join(dataDir, 'index', 'logins.json');
}
