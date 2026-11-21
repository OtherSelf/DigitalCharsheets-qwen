import fs from 'fs/promises';

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
 *
 * Ожидание асинхронное: пока один запрос ждёт лок, event loop обслуживает
 * остальные запросы. Синхронный `Atomics.wait` здесь недопустим.
 */

const LOCK_STALE_MS = 30_000;
const LOCK_WAIT_STEP_MS = 5;
const LOCK_MAX_WAIT_MS = 2_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Локальная очередь ожидающих. Сам мьютекс остаётся файловым (mkdir), но без
 * очереди 50 параллельных запросов устраивают «толпу»: каждый опрашивает
 * каталог, и кто-то стабильно проигрывает гонку дольше LOCK_MAX_WAIT_MS.
 * Очередь не заменяет mkdir и не создаёт второй мьютекс: она только передаёт
 * право опроса следующему в процессе, а между процессами по-прежнему
 * арбитрирует каталог.
 */
let localTurn: Promise<void> = Promise.resolve();

async function lockAgeMs(lockDir: string): Promise<number> {
  try {
    return Date.now() - (await fs.stat(lockDir)).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Выполнить `fn` под эксклюзивным локом каталога данных.
 * `fn` может быть асинхронным; лок держится до завершения его промиса.
 */
export async function withDataLock<T>(fn: () => Promise<T> | T): Promise<T> {
  let releaseLocal!: () => void;
  const localGate = new Promise<void>((resolve) => {
    releaseLocal = resolve;
  });
  const previous = localTurn;
  localTurn = localGate;
  await previous;

  try {
    const dataDir = getDataDir();
    await fs.mkdir(dataDir, { recursive: true });
    const lockDir = getDataLockDir();
    const deadline = Date.now() + LOCK_MAX_WAIT_MS;

    for (;;) {
      try {
        await fs.mkdir(lockDir);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') throw error;
        // Брошенный лок от упавшего процесса не должен блокировать вход навсегда.
        if ((await lockAgeMs(lockDir)) > LOCK_STALE_MS) {
          try {
            await fs.rmdir(lockDir);
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
        await delay(LOCK_WAIT_STEP_MS);
      }
    }

    try {
      return await fn();
    } finally {
      try {
        await fs.rmdir(lockDir);
      } catch {
        /* best effort */
      }
    }
  } finally {
    releaseLocal();
  }
}
