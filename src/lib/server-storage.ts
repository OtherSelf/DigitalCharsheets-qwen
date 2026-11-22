import fs from 'fs/promises';
import path from 'path';

import { applyCharacterDerive, healCharacterDerive } from './character-derive';
import {
  appendCreateMarker,
  appendHistory,
  deleteCharacterHistory,
} from './character-history';
import { normalizeCharacterRecord } from './character-version';
import { getCharactersDir, getUserDir } from './data-dir';
import { withDataLock, withSheetLock } from './data-lock';
import { writeJsonAtomic } from './fs-atomic';
import { diffCharacterRecords } from './history-diff';
import { isUid } from './ids';
import { readThroughCache } from './read-cache';
import { resolveCharacterFile } from './security/paths';
import { revokeShareForCharacter } from './shares';
import { Character } from './types';

// Каталог пользователя создаётся при первой записи: профиль и листы
// появляются в одном месте.
async function ensureUserDir(userId: string): Promise<string> {
  const userDir = getUserDir(userId);
  await fs.mkdir(userDir, { recursive: true });
  return userDir;
}

// Подкаталог листов — рядом с user.json, чтобы удаление аккаунта было
// одним `rm -rf` по каталогу. Создаётся только на записи: чтение не должно
// оставлять каталоги для uid, которого нет в данных.
async function ensureCharactersDir(userId: string): Promise<string> {
  await ensureUserDir(userId);
  const charsDir = path.join(getUserDir(userId), 'characters');
  await fs.mkdir(charsDir, { recursive: true });
  return charsDir;
}

/**
 * ─── LANDMARK: STALE-WRITE GUARD ────────────────────────────────────────────
 * Клиент помечает каждый PUT парой `__page`/`__seq` (см. character-context).
 * Здесь мы запоминаем последний применённый `seq` для каждой загрузки
 * страницы и отбрасываем запоздавшие записи.
 *
 * Зачем: при уходе со страницы браузер шлёт keepalive-досылку со СВЕЖИМ
 * снимком, а обычный PUT со СТАРЫМИ данными может ещё лететь. Без этой
 * проверки порядок прихода запросов на сервер решал, какое значение останется
 * на диске, — отсюда «опыт то сохраняется, то нет».
 *
 * Состояние in-memory: окно гонки — секунды, переживать рестарт процесса ему
 * не нужно. Ключ — пользователь/лист, значения — последний seq для до 8
 * загрузок страниц (LRU), чтобы карта не росла бесконечно.
 */
const MAX_TRACKED_PAGES = 8;
const lastSeqBySheet = new Map<string, Map<string, number>>();

/** Ключ per-sheet лока: один лист — один ресурс. */
function sheetLockKey(userId: string, characterId: string): string {
  return `sheet:${userId}/${characterId}`;
}

/**
 * Кэш списка листов на каталог. Подпись — inode+mtime каталога: атомарная
 * запись заменяет файл через rename и меняет mtime каталога, поэтому список
 * перечитывается после любой записи. Дополнительно инвалидируем явно из
 * save/update/delete, не полагаясь на гранулярность mtime.
 */
interface CharacterListEntry {
  character: Character;
  updatedAt: string | null;
}

const characterListCache = new Map<
  string,
  { signature: string; entries: CharacterListEntry[] }
>();

function invalidateCharacterList(userId: string): void {
  characterListCache.delete(getCharactersDir(userId));
}

export interface CharacterSummary {
  id: string;
  name: string;
  systemId: string | null;
  updatedAt: string | null;
}

export interface WriteToken {
  page: string;
  seq: number;
}

export function isStaleWrite(
  userId: string,
  characterId: string,
  token?: WriteToken,
): boolean {
  if (
    !token ||
    typeof token.page !== 'string' ||
    !token.page ||
    typeof token.seq !== 'number' ||
    !Number.isFinite(token.seq)
  ) {
    return false;
  }
  const sheetKey = `${userId}/${characterId}`;
  let pages = lastSeqBySheet.get(sheetKey);
  if (!pages) {
    pages = new Map();
    lastSeqBySheet.set(sheetKey, pages);
  }
  const applied = pages.get(token.page);
  if (applied !== undefined && token.seq < applied) return true;
  pages.set(token.page, token.seq);
  if (pages.size > MAX_TRACKED_PAGES) {
    const oldest = pages.keys().next().value;
    if (oldest !== undefined && oldest !== token.page) pages.delete(oldest);
  }
  return false;
}

/** Сброс кэша порядка записей. Нужен тестам и удалению листа. */
export function resetWriteSeqGuard(
  userId?: string,
  characterId?: string,
): void {
  if (!userId) {
    lastSeqBySheet.clear();
    return;
  }
  const key = characterId ? `${userId}/${characterId}` : null;
  if (key) {
    lastSeqBySheet.delete(key);
    return;
  }
  for (const existing of Array.from(lastSeqBySheet.keys())) {
    if (existing.startsWith(`${userId}/`)) lastSeqBySheet.delete(existing);
  }
}

/**
 * Разобрать файл листа через кэш. Подпись `(ino, mtime, size)` меняется при
 * записи через `writeJsonAtomic` (rename даёт новый inode), поэтому кэш не
 * отдаёт старые данные после сохранения.
 */
function readCharacterFile(
  filePath: string,
  characterId: string,
): Promise<Character | null> {
  return readThroughCache<Character>(filePath, (raw) => {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const normalized = normalizeCharacterRecord(parsed);
      return healCharacterDerive(
        normalized.character as unknown as Record<string, unknown>,
        typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 0,
      ) as unknown as Character;
    } catch (error) {
      console.error(`Character file ${characterId} is corrupted:`, error);
      return null;
    }
  });
}

// ЧТЕНИЕ: все листы пользователя; битый файл пропускается, а не роняет список.
// Каталог здесь не создаётся: у нового аккаунта листов ещё нет.
async function loadCharacterList(
  userId: string,
): Promise<CharacterListEntry[]> {
  const charsDir = getCharactersDir(userId);

  let dirStat;
  try {
    dirStat = await fs.stat(charsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.error(`Error reading characters directory for ${userId}:`, error);
    }
    return [];
  }
  const signature = `${dirStat.ino}:${dirStat.mtimeMs}`;
  const cachedList = characterListCache.get(charsDir);
  if (cachedList && cachedList.signature === signature) {
    return cachedList.entries;
  }

  let files: string[];
  try {
    files = (await fs.readdir(charsDir)).filter((file) =>
      file.endsWith('.json'),
    );
  } catch (error) {
    // ENOENT — обычное состояние нового аккаунта, а не ошибка: каталог
    // появляется с первым листом (чтение его не создаёт).
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.error(`Error reading characters directory for ${userId}:`, error);
    }
    return [];
  }

  const loaded = await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(charsDir, file);
      const character = await readCharacterFile(filePath, file.slice(0, -5));
      if (!character) return null;
      let updatedAt: string | null = null;
      try {
        updatedAt = (await fs.stat(filePath)).mtime.toISOString();
      } catch {
        /* файл удалили между readdir и stat */
      }
      return { character, updatedAt };
    }),
  );

  const entries = loaded.filter(
    (entry): entry is CharacterListEntry => !!entry,
  );
  characterListCache.set(charsDir, { signature, entries });
  return entries;
}

export async function getCharactersFromServer(
  userId: string,
): Promise<Character[]> {
  return (await loadCharacterList(userId)).map((entry) => entry.character);
}

/** Карточки для `?view=summary`: без полного листа, с mtime файла. */
export async function getCharacterSummariesFromServer(
  userId: string,
): Promise<CharacterSummary[]> {
  return (await loadCharacterList(userId)).map(({ character, updatedAt }) => ({
    id: character.id,
    name: character.name,
    systemId:
      typeof character.systemId === 'string' ? character.systemId : null,
    updatedAt,
  }));
}

/**
 * ЧТЕНИЕ одного листа. `null` — файла нет, id небезопасен или файл битый.
 * Нужен PUT-роуту: валидировать патч можно только поверх текущего листа.
 */
export async function getCharacterFromServer(
  userId: string,
  characterId: string,
): Promise<Character | null> {
  const filePath = resolveCharacterFile(getCharactersDir(userId), characterId);
  if (!filePath) return null;

  return readCharacterFile(filePath, characterId);
}

// ЗАПИСЬ: лист всегда живёт в своём файле, поэтому конфликтов между
// листами нет.
export async function saveCharacterToServer(
  userId: string,
  character: Character,
): Promise<void> {
  const charsDir = getCharactersDir(userId);
  const filePath = resolveCharacterFile(charsDir, character.id);
  if (!filePath) {
    // Сюда попадает только программная ошибка: id нового листа выдаёт сервер,
    // а не клиент. Молча писать «как получилось» нельзя — это путь на диске.
    throw new Error(`Unsafe character id: ${String(character.id)}`);
  }
  await ensureCharactersDir(userId);
  let existed = true;
  try {
    await fs.stat(filePath);
  } catch {
    existed = false;
  }
  const normalized = normalizeCharacterRecord(
    character as unknown as Record<string, unknown>,
  ).character;
  // Производные пересчитывает сервер: клиент мог прислать рассогласованный
  // лист, а в файле должен лежать согласованный.
  const derived = applyCharacterDerive(
    normalized as unknown as Record<string, unknown>,
  );
  await withSheetLock(sheetLockKey(userId, character.id), () =>
    writeJsonAtomic(filePath, derived as unknown as Character),
  );
  invalidateCharacterList(userId);
  if (!existed) {
    // Маркер «лист создан» — без полного diff. История best-effort: её сбой
    // не должен отменять создание листа. Не-UUID (старые тесты/fixtures)
    // пропускаем: боевой uid всегда UUID.
    if (isUid(userId)) {
      try {
        await appendCreateMarker(userId, character.id);
      } catch (historyError) {
        console.error(
          `Failed to append create marker for ${character.id}:`,
          historyError,
        );
      }
    }
  }
}

// ЗАПИСЬ: пачка листов (импорт/массовые операции) — по файлу на лист.
export async function saveCharactersToServer(
  userId: string,
  characters: Character[],
): Promise<void> {
  for (const char of characters) {
    await saveCharacterToServer(userId, char);
  }
}

/**
 * ПЕРЕЗАПИСЬ: обновить один лист с защитой от запоздавших PUT.
 *
 * Возвращает:
 *   • `Character` — запись применена (или отброшена как устаревшая, тогда
 *     возвращается текущее содержимое файла);
 *   • `null` — файла нет (роут отдаст 404);
 * бросает — если чтение/запись не удались (роут отдаст 500, клиент повторит).
 *
 * `options.writeToken` — пара `__page`/`__seq` из тела PUT: защита от того,
 * что запоздавший запрос перетрёт более свежие данные.
 */
export async function updateCharacterOnServer(
  userId: string,
  characterId: string,
  data: Partial<Character>,
  options: { writeToken?: WriteToken } = {},
): Promise<Character | null> {
  const filePath = resolveCharacterFile(getCharactersDir(userId), characterId);
  // Небезопасный id роут отсекает сам (400) — здесь он просто не даёт пути.
  if (!filePath) return null;

  // Чтение, проверка seq и запись — под одним локом. Иначе после перевода fs
  // на async два PUT могли прочитать один и тот же файл, оба пройти guard и
  // перезаписать друг друга в обратном порядке.
  const result = await withSheetLock(
    sheetLockKey(userId, characterId),
    async () => {
      let content: string;
      try {
        content = await fs.readFile(filePath, 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
        throw error;
      }

      let character: Character;
      try {
        character = normalizeCharacterRecord(
          JSON.parse(content) as Record<string, unknown>,
        ).character;
      } catch (e) {
        // Битый файл: НЕ перезаписываем его молча — иначе потеряем остатки данных.
        console.error(`Character file ${characterId} is corrupted:`, e);
        throw new Error(`Character file ${characterId} is corrupted`);
      }

      if (isStaleWrite(userId, characterId, options.writeToken)) {
        console.warn(
          `Ignoring stale write for ${userId}/${characterId} ` +
            `(page ${options.writeToken?.page}, seq ${options.writeToken?.seq})`,
        );
        return { character, diff: null };
      }

      // Нормализация принимает «сырой» объект: спред Partial<Character> поверх
      // union-типа TS вывести не может, а normalize всё равно пересобирает лист.
      const updated: Character = normalizeCharacterRecord({
        ...character,
        ...data,
      } as Record<string, unknown>).character;

      // Производные пересчитываются до diff и до записи: в файл и в историю
      // попадает то, что увидит игрок, а не то, что прислал клиент.
      const derived = applyCharacterDerive(
        updated as unknown as Record<string, unknown>,
      ) as unknown as Character;

      // Считаем diff до добавления userId владельца: служебные поля в историю не
      // попадают, а сравнение идёт по содержанию листа.
      const diff = diffCharacterRecords(
        character as unknown as Record<string, unknown>,
        derived as unknown as Record<string, unknown>,
      );

      // Привязка к владельцу. Поле не входит в тип Character (это метаданные,
      // авторизация — по каталогу и cookie), но на диске оно должно быть: так
      // «плоский» бэкап и диагностика видят, чей это лист. Дописываем, если лист
      // пришёл из миграции/импорта без него.
      const withOwner = derived as unknown as Record<string, unknown>;
      if (!withOwner.userId) {
        withOwner.userId = userId;
      }

      await writeJsonAtomic(filePath, derived);
      invalidateCharacterList(userId);
      return { character: derived, diff };
    },
  );

  if (!result) return null;

  if (result.diff && isUid(userId)) {
    // Журнал не должен ломать сохранение: лист уже записан, ошибку только
    // логируем.
    try {
      await appendHistory(userId, characterId, result.diff);
    } catch (historyError) {
      console.error(
        `Failed to append history for ${userId}/${characterId}:`,
        historyError,
      );
    }
  }
  return result.character;
}

// УДАЛЕНИЕ: файл листа; true — удалили, false — файла не было или он занят.
export async function deleteCharacterFromServer(
  userId: string,
  characterId: string,
): Promise<boolean> {
  const filePath = resolveCharacterFile(getCharactersDir(userId), characterId);
  if (!filePath) return false;

  // Удаление файла, ссылки и журнала — под одним локом: иначе PUT, начавшийся
  // до удаления, мог дописать файл уже после того, как лист считался удалённым.
  return withDataLock(async () => {
    try {
      await fs.unlink(filePath);
    } catch {
      return false;
    }
    invalidateCharacterList(userId);

    resetWriteSeqGuard(userId, characterId);
    // Ссылка и журнал относятся к удалённому листу: убираем их best-effort,
    // чтобы не оставлять сирот и не отменять уже состоявшееся удаление файла.
    try {
      await revokeShareForCharacter(userId, characterId, { locked: true });
    } catch (shareError) {
      console.error(
        `Failed to revoke share link for deleted character ${characterId}:`,
        shareError,
      );
    }
    await deleteCharacterHistory(userId, characterId);
    return true;
  });
}

// Есть ли у пользователя каталог (профиль или хотя бы черновик).
export async function userFolderExists(userId: string): Promise<boolean> {
  try {
    const stat = await fs.stat(getUserDir(userId));
    return stat.isDirectory();
  } catch {
    return false;
  }
}

// Создать каталог и минимальный user.json, если профиля ещё нет.
export async function createUserFolder(
  userId: string,
  username: string,
  displayName: string,
): Promise<void> {
  await ensureUserDir(userId);
  const userFile = path.join(getUserDir(userId), 'user.json');

  try {
    await fs.stat(userFile);
    return;
  } catch {
    /* профиля ещё нет — создаём */
  }

  const userData = {
    schemaVersion: 3,
    uid: userId,
    username,
    displayName,
    passwordHash: '',
    role: 'user',
    isBlocked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await writeJsonAtomic(userFile, userData);
}
