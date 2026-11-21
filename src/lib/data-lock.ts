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

/**
 * Состояние per-key локов. Ключ — `sheet:<uid>/<id>`; разные ключи пишутся
 * параллельно, один и тот же — строго по очереди. Глобальный лок (регистрация,
 * удаление аккаунта, каталог) исключает ВСЕ ключевые операции: он ждёт, пока
 * activeKeys опустеет, а новые ключевые операции ждут, пока он снят.
 *
 * Это in-process координатор; сам файловый мьютекс (mkdir) остался только в
 * глобальном локе. Однопроцессность подтверждена владельцем (Q9).
 */
let globalHeld = false;
let globalWaiters = 0;
let activeKeys = 0;
const keyChains = new Map<string, Promise<void>>();
const lockWaiters = new Set<() => void>();

function notifyLockWaiters(): void {
  for (const wake of lockWaiters) wake();
  lockWaiters.clear();
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  while (!predicate()) {
    await new Promise<void>((resolve) => {
      lockWaiters.add(resolve);
    });
  }
}

/**
 * Короткая критическая секция для изменения globalHeld/activeKeys. Без неё
 * ключевой лок и глобальный могли одновременно увидеть «свободно» между
 * двумя await и войти вместе.
 */
let decisionChain: Promise<void> = Promise.resolve();

async function withDecision<T>(fn: () => T | Promise<T>): Promise<T> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = decisionChain;
  decisionChain = previous.then(() => gate);
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function lockAgeMs(lockDir: string): Promise<number> {
  try {
    return Date.now() - (await fs.stat(lockDir)).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Лок одного листа. Однофайловые записи разных листов не ждут друг друга;
 * глобальные операции (удаление аккаунта/листа, каталог, сессии) ждут все
 * ключевые и блокируют новые.
 */
export async function withSheetLock<T>(
  key: string,
  fn: () => Promise<T> | T,
): Promise<T> {
  const previous = keyChains.get(key) ?? Promise.resolve();
  let releaseKey!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseKey = resolve;
  });
  const chain = previous.then(() => gate);
  keyChains.set(key, chain);

  await previous;
  try {
    // Право войти выдаётся короткой секцией: проверка globalHeld и
    // activeKeys += 1 не должны пересекаться с глобальным локом.
    for (;;) {
      const acquired = await withDecision(() => {
        // Если глобальный лок уже ждёт, новые ключевые не влезают вперёд:
        // иначе поток записей мог бы откладывать удаление аккаунта бесконечно.
        if (globalHeld || globalWaiters > 0) return false;
        activeKeys += 1;
        return true;
      });
      if (acquired) break;
      await waitUntil(() => !globalHeld && globalWaiters === 0);
    }
    try {
      return await fn();
    } finally {
      activeKeys -= 1;
      notifyLockWaiters();
    }
  } finally {
    releaseKey();
    if (keyChains.get(key) === chain) keyChains.delete(key);
    notifyLockWaiters();
  }
}

/**
 * Выполнить `fn` под эксклюзивным локом каталога данных.
 * `fn` может быть асинхронным; лок держится до завершения его промиса.
 */
export async function withDataLock<T>(fn: () => Promise<T> | T): Promise<T> {
  globalWaiters += 1;
  let releaseLocal!: () => void;
  const localGate = new Promise<void>((resolve) => {
    releaseLocal = resolve;
  });
  const previous = localTurn;
  localTurn = localGate;
  await previous;

  try {
    // Глобальный лок исключает все per-key операции: ждём активные и
    // блокируем новые, пока держим globalHeld. Право входа выдаёт та же
    // короткая секция, что и у ключевых локов.
    for (;;) {
      const acquired = await withDecision(() => {
        if (globalHeld || activeKeys > 0) return false;
        globalHeld = true;
        return true;
      });
      if (acquired) break;
      await waitUntil(() => activeKeys === 0);
    }
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
    globalHeld = false;
    globalWaiters -= 1;
    notifyLockWaiters();
    releaseLocal();
  }
}
