import fs from 'fs/promises';
import type { Dirent } from 'node:fs';
import path from 'path';

import { deleteCharacterHistory } from './character-history';
import {
  getAccountTrashDir,
  getTrashDir,
  getTrashMetaFile,
  getUserDir,
  getUsersDir,
} from './data-dir';
import { withDataLock } from './data-lock';
import { writeJsonAtomic } from './fs-atomic';
import { isUid } from './ids';
import { clearReadCache, invalidateCachedFile } from './read-cache';
import { isSafeId } from './security/paths';

/**
 * ─── LANDMARK: TRASH ────────────────────────────────────────────────────────
 * Теневое хранение удалённых данных. Два независимых сценария:
 *   • лист персонажа — `<uid>/trash/<id>.json` + `<id>.meta.json`;
 *   • аккаунт — каталог в `<data-dir>/.trash/users/<uid>-<timestamp>`.
 *
 * Срок один для обоих — `TRASH_RETENTION_DAYS`. Метаданные лежат отдельным
 * файлом: JSON листа остаётся листом, его схема не знает служебных полей.
 *
 * `cleanupExpiredTrash` идемпотентна и не бросает наружу ошибки отдельной
 * записи: одна битая запись не должна мешать очистить остальные. Вызывается
 * из стартового обслуживания и лениво из API архива с часовым throttle.
 */
export const TRASH_RETENTION_DAYS = 14;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** Не чаще раза в час при ленивом вызове из API. */
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

let lastCleanupAt = 0;

export interface CharacterTrashMeta {
  version: 1;
  kind: 'character';
  deletedAt: string;
  expiresAt: string;
  characterId: string;
}

export interface AccountTrashMeta {
  version: 1;
  kind: 'account';
  deletedAt: string;
  expiresAt: string;
  uid: string;
}

export type TrashMeta = CharacterTrashMeta | AccountTrashMeta;

export interface TrashCleanupReport {
  characters: number;
  accounts: number;
  errors: string[];
}

/**
 * Перемещение файла или каталога в пределах data-dir. На обычной ФС это
 * атомарный `rename`; на сетевых/FUSE-ФС с `EXDEV` — копирование и удаление
 * источника. Кэш чтения сбрасывается для обоих путей: иначе список листов
 * мог бы отдать запись, которой уже нет.
 */
export async function moveFileOrDir(
  source: string,
  destination: string,
): Promise<void> {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  try {
    await fs.rename(source, destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'EXDEV') throw error;
    const stat = await fs.stat(source);
    if (stat.isDirectory()) {
      await fs.cp(source, destination, { recursive: true, force: true });
      await fs.rm(source, { recursive: true, force: true });
    } else {
      await fs.copyFile(source, destination);
      await fs.unlink(source);
    }
  }
  invalidateCachedFile(source);
  invalidateCachedFile(destination);
}

export function createCharacterTrashMeta(
  characterId: string,
  now: number = Date.now(),
): CharacterTrashMeta {
  return {
    version: 1,
    kind: 'character',
    deletedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TRASH_RETENTION_MS).toISOString(),
    characterId,
  };
}

export function createAccountTrashMeta(
  uid: string,
  now: number = Date.now(),
): AccountTrashMeta {
  return {
    version: 1,
    kind: 'account',
    deletedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TRASH_RETENTION_MS).toISOString(),
    uid,
  };
}

/** Разбор метаданных: ответ из файла — внешние данные, поэтому проверяем. */
export function parseTrashMeta(raw: unknown): TrashMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (data.version !== 1) return null;
  if (typeof data.deletedAt !== 'string' || typeof data.expiresAt !== 'string')
    return null;
  if (Number.isNaN(Date.parse(data.deletedAt))) return null;
  if (Number.isNaN(Date.parse(data.expiresAt))) return null;

  if (data.kind === 'character') {
    const characterId = data.characterId;
    if (typeof characterId !== 'string' || !isSafeId(characterId)) return null;
    return {
      version: 1,
      kind: 'character',
      deletedAt: data.deletedAt,
      expiresAt: data.expiresAt,
      characterId,
    };
  }

  if (data.kind === 'account') {
    const uid = data.uid;
    if (typeof uid !== 'string' || !isUid(uid)) return null;
    return {
      version: 1,
      kind: 'account',
      deletedAt: data.deletedAt,
      expiresAt: data.expiresAt,
      uid,
    };
  }

  return null;
}

export async function readTrashMeta(
  filePath: string,
): Promise<TrashMeta | null> {
  try {
    const raw = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
    return parseTrashMeta(raw);
  } catch {
    return null;
  }
}

export function isTrashExpired(
  meta: Pick<TrashMeta, 'expiresAt'>,
  now: number = Date.now(),
): boolean {
  const expiresAt = Date.parse(meta.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

/**
 * Перенести каталог аккаунта в теневую копию. Вызывается под `withDataLock`
 * (удаление своего/чужого аккаунта уже держит глобальный лок). Возвращает
 * `null`, если каталога нет: второй DELETE не должен создавать пустую тень.
 */
export async function moveAccountToTrash(
  uid: string,
): Promise<{ dir: string; meta: AccountTrashMeta } | null> {
  if (!isUid(uid)) return null;
  const source = getUserDir(uid);
  try {
    const stat = await fs.stat(source);
    if (!stat.isDirectory()) return null;
  } catch {
    return null;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = Math.random().toString(36).slice(2, 8);
  const destination = path.join(
    getAccountTrashDir(),
    `${uid}-${stamp}-${suffix}`,
  );
  await fs.mkdir(getAccountTrashDir(), { recursive: true });
  await moveFileOrDir(source, destination);
  clearReadCache();

  const meta = createAccountTrashMeta(uid);
  try {
    await writeJsonAtomic(path.join(destination, 'meta.json'), meta);
  } catch (error) {
    // Каталог уже перемещён: терять его из-за метаданных нельзя. Очистка
    // такую запись пропустит до ручного разбора оператором.
    console.error('Failed to write account trash metadata:', error);
  }
  return { dir: destination, meta };
}

interface CleanupOptions {
  now?: number;
  /** Игнорировать часовой throttle (старт приложения, тесты). */
  force?: boolean;
}

async function listDirectory(dir: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function cleanupCharacterTrash(
  uid: string,
  now: number,
  report: TrashCleanupReport,
): Promise<void> {
  const trashDir = getTrashDir(uid);
  const entries = await listDirectory(trashDir);

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    if (entry.name.endsWith('.meta.json')) continue;
    const characterId = entry.name.slice(0, -'.json'.length);
    if (!isSafeId(characterId)) continue;

    const metaFile = getTrashMetaFile(uid, characterId);
    if (!metaFile) continue;

    let meta = await readTrashMeta(metaFile);
    if (!meta) {
      // Метаданные могли не записаться (сбой посреди удаления). Возраст
      // файла — единственный оставшийся ориентир; без него не удаляем.
      try {
        const stat = await fs.stat(path.join(trashDir, entry.name));
        meta = {
          version: 1,
          kind: 'character',
          deletedAt: stat.mtime.toISOString(),
          expiresAt: new Date(stat.mtimeMs + TRASH_RETENTION_MS).toISOString(),
          characterId,
        };
      } catch {
        continue;
      }
    }

    if (meta.kind !== 'character' || !isTrashExpired(meta, now)) continue;

    try {
      await fs.unlink(path.join(trashDir, entry.name));
      await fs.unlink(metaFile).catch(() => undefined);
      await deleteCharacterHistory(uid, characterId);
      report.characters += 1;
    } catch (error) {
      report.errors.push(
        `character ${uid}/${characterId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

async function cleanupAccountTrash(
  now: number,
  report: TrashCleanupReport,
): Promise<void> {
  const root = getAccountTrashDir();
  const entries = await listDirectory(root);

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    const meta = await readTrashMeta(path.join(dir, 'meta.json'));
    // Без метаданных не удаляем: каталог мог остаться от ручного разбора.
    if (!meta || meta.kind !== 'account' || !isTrashExpired(meta, now))
      continue;
    try {
      await fs.rm(dir, { recursive: true, force: true });
      report.accounts += 1;
    } catch (error) {
      report.errors.push(
        `account ${entry.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Удалить просроченные записи корзины и теневые копии аккаунтов. Ошибки
 * складываются в отчёт, а не бросаются: старт приложения не должен падать
 * из-за одного недоступного файла.
 */
export async function cleanupExpiredTrash(
  options: CleanupOptions = {},
): Promise<TrashCleanupReport> {
  const now = options.now ?? Date.now();
  const report: TrashCleanupReport = {
    characters: 0,
    accounts: 0,
    errors: [],
  };

  if (!options.force && now - lastCleanupAt < CLEANUP_INTERVAL_MS) {
    return report;
  }
  lastCleanupAt = now;

  // Очистка меняет те же каталоги, что restore/purge: без глобального лока
  // она могла бы удалить файл между проверкой срока и возвратом листа.
  return withDataLock(async () => {
    const users = await listDirectory(getUsersDir());
    for (const user of users) {
      if (!user.isDirectory() || !isUid(user.name)) continue;
      await cleanupCharacterTrash(user.name, now, report);
    }

    await cleanupAccountTrash(now, report);
    return report;
  });
}
