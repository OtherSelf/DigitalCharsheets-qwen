import fs from 'fs';

import { getDataDir, getDataLockDir } from './data-dir';

/**
 * ─── LANDMARK: DATA LOCK ────────────────────────────────────────────────────
 * Регистрация и смена логина меняют два файла (user.json и индекс), поэтому
 * их нельзя выполнять параллельно: два одновременных запроса с одним логином
 * иначе создадут два аккаунта, а переименование может оставить индекс
 * указывающим на «старого» владельца.
 *
 * Блокировка — каталог `<data-dir>/.lock`: `mkdir` атомарен и падает с
 * EEXIST, если лок уже есть. Это работает и между процессами (если когда-то
 * запустят несколько инстансов на одном каталоге данных).
 *
 * Зависший лок (процесс упал между mkdir и rmdir) снимается по возрасту:
 * старше LOCK_STALE_MS считается брошенным. Ожидание ограничено
 * LOCK_MAX_WAIT_MS, после чего операция падает с понятной ошибкой.
 */

const LOCK_STALE_MS = 30_000;
const LOCK_WAIT_STEP_MS = 25;
const LOCK_MAX_WAIT_MS = 2_000;

/** Синхронная пауза: серверные файловые операции у нас синхронные. */
function sleepSync(ms: number): void {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    // На всякий случай: без SharedArrayBuffer просто крутимся.
    const end = Date.now() + ms;
    while (Date.now() < end) {
      /* busy wait */
    }
  }
}

function lockAgeMs(lockDir: string): number {
  try {
    return Date.now() - fs.statSync(lockDir).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Выполнить `fn` под эксклюзивным локом каталога данных.
 * `fn` должен быть синхронным и коротким: лок держится на всё время работы.
 */
export function withDataLock<T>(fn: () => T): T {
  const dataDir = getDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  const lockDir = getDataLockDir();
  const deadline = Date.now() + LOCK_MAX_WAIT_MS;

  for (;;) {
    try {
      fs.mkdirSync(lockDir);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') throw error;
      // Брошенный лок от упавшего процесса не должен блокировать вход навсегда.
      if (lockAgeMs(lockDir) > LOCK_STALE_MS) {
        try {
          fs.rmdirSync(lockDir);
        } catch {
          /* кто-то уже снял */
        }
        continue;
      }
      if (Date.now() > deadline) {
        throw new Error(
          'Data directory is locked by another request. Try again.',
        );
      }
      sleepSync(LOCK_WAIT_STEP_MS);
    }
  }

  try {
    return fn();
  } finally {
    try {
      fs.rmdirSync(lockDir);
    } catch {
      /* best effort */
    }
  }
}
