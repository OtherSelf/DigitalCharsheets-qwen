import fs from 'node:fs/promises';

/**
 * ─── LANDMARK: READ CACHE ──────────────────────────────────────────────────
 * Кэш разобранных JSON в памяти процесса. Ключ — путь, валидация — подпись
 * файла `(ino, mtimeMs, size)`, а не только mtime: `writeJsonAtomic` заменяет
 * файл через rename, поэтому каждая запись даёт новый inode, и подпись меняется
 * даже на ФС с грубым mtime.
 *
 * Запись этим же процессом инвалидирует ключ сразу (`writeJsonAtomic`), а
 * внешняя правка подхватывается на следующем чтении по подписи. Кэш хранит
 * только успешно разобранное значение; битый файл не кэшируется как валидные
 * данные — вызывающий получает `null` и решает, как fail-closed.
 *
 * Легитимность кэша — один процесс Node на data-dir (📌 D15). Несколько
 * процессов на одном каталоге не поддерживаются: write-through инвалидация
 * видит только свои записи (подпись спасает от чужих правок, но не от гонки
 * «прочитал — записал»).
 */

interface CacheEntry {
  signature: string;
  value: unknown;
}

const cache = new Map<string, CacheEntry>();

function signature(stat: {
  ino: number;
  mtimeMs: number;
  size: number;
}): string {
  return `${stat.ino}:${stat.mtimeMs}:${stat.size}`;
}

async function statOrNull(
  filePath: string,
): Promise<{ ino: number; mtimeMs: number; size: number } | null> {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

/**
 * Прочитать файл через кэш. `load` получает сырой текст и stat; его исключения
 * считаются «файл невалиден» и кэшируются как `null` до изменения подписи.
 */
export async function readThroughCache<T>(
  filePath: string,
  load: (
    raw: string,
    stat: { ino: number; mtimeMs: number; size: number },
  ) => T | null,
): Promise<T | null> {
  const before = await statOrNull(filePath);
  if (!before) {
    cache.delete(filePath);
    return null;
  }
  const beforeSignature = signature(before);
  const cached = cache.get(filePath);
  if (cached && cached.signature === beforeSignature) {
    return cached.value as T | null;
  }

  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    cache.delete(filePath);
    return null;
  }

  let value: T | null;
  try {
    value = load(raw, before);
  } catch {
    value = null;
  }

  // Пока читали, файл мог измениться: подпись берём после чтения, но значение
  // относится к прочитанному тексту. Следующее чтение сверит подпись ещё раз.
  const after = (await statOrNull(filePath)) ?? before;
  cache.set(filePath, { signature: signature(after), value });
  return value;
}

/** Прочитать JSON через кэш; битый/отсутствующий файл — `null`. */
export function readJsonThroughCache<T>(filePath: string): Promise<T | null> {
  return readThroughCache<T>(filePath, (raw) => JSON.parse(raw) as T);
}

/** Инвалидация после записи этим процессом. */
export function invalidateCachedFile(filePath: string): void {
  cache.delete(filePath);
}

/** Полный сброс (тесты и диагностика). */
export function clearReadCache(): void {
  cache.clear();
}
