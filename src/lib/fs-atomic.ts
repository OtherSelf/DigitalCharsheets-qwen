import fs from 'fs/promises';

import { invalidateCachedFile } from './read-cache';

/**
 * ─── LANDMARK: ATOMIC WRITE ─────────────────────────────────────────────────
 * Раньше лист писался прямо в файл (`writeFileSync`). Если процесс падал/
 * ронялся посреди записи (OOM, Ctrl+C, кончилось место, Windows EBUSY), в
 * `<id>.json` оставался ОБРЕЗАННЫЙ JSON: `getCharactersFromServer` такой файл
 * молча пропускает — персонаж «исчезал» из списка.
 *
 * Теперь пишем во временный файл рядом и подменяем им основной через
 * `rename` — на одной ФС это атомарная операция. Читатель видит либо старую
 * версию целиком, либо новую целиком, но никогда — половину.
 *
 * Вынесено из server-storage.ts, чтобы тем же способом писать `user.json`
 * и индекс логинов: и то, и другое нельзя оставлять обрезанным.
 */
export async function writeJsonAtomic(
  filePath: string,
  data: unknown,
): Promise<void> {
  const tmpPath = `${filePath}.${process.pid.toString(36)}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  const json = JSON.stringify(data, null, 2);
  let handle: Awaited<ReturnType<typeof fs.open>> | null = null;
  try {
    handle = await fs.open(tmpPath, 'w');
    await handle.writeFile(json, 'utf8');
    // fsync, чтобы запись пережила внезапное выключение питания/контейнера.
    try {
      await handle.sync();
    } catch {
      /* на некоторых ФС fsync не поддерживается */
    }
    await handle.close();
    handle = null;
    await fs.rename(tmpPath, filePath);
    invalidateCachedFile(filePath);
  } catch (error) {
    if (handle !== null) {
      try {
        await handle.close();
      } catch {
        /* уже закрыт */
      }
    }
    try {
      await fs.unlink(tmpPath);
    } catch {
      /* best effort */
    }
    // EXDEV: временный файл лежит рядом с целевым, поэтому «честный» rename
    // внутри одного каталога EXDEV не даёт. Ветку могут вызвать только
    // экзотические FUSE/сетевые ФС, которые всё же отвечают EXDEV и здесь:
    // тогда деградируем до прямой записи — атомарность теряется, но данные
    // остаются целыми (лучше, чем 500 и потерянная правка).
    // Покрыто тестами tests/unit/exdev-storage.test.ts.
    if ((error as NodeJS.ErrnoException)?.code === 'EXDEV') {
      await fs.writeFile(filePath, json, 'utf8');
      invalidateCachedFile(filePath);
      try {
        await fs.unlink(tmpPath);
      } catch {
        /* best effort */
      }
      return;
    }
    throw error;
  }
}
