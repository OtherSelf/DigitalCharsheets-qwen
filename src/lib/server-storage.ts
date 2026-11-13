import fs from 'fs';
import path from 'path';

import {
  appendCreateMarker,
  appendHistory,
  deleteCharacterHistory,
} from './character-history';
import { normalizeCharacterRecord } from './character-version';
import { getCharactersDir, getUserDir } from './data-dir';
import { writeJsonAtomic } from './fs-atomic';
import { diffCharacterRecords } from './history-diff';
import { isUid } from './ids';
import { resolveCharacterFile } from './security/paths';
import { revokeShareForCharacter } from './shares';
import { Character } from './types';

// Каталог пользователя создаётся при первой записи: профиль и листы
// появляются в одном месте.
function ensureUserDir(userId: string): string {
  const userDir = getUserDir(userId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return userDir;
}

// Подкаталог листов — рядом с user.json, чтобы удаление аккаунта было
// одним `rm -rf` по каталогу. Создаётся только на записи: чтение не должно
// оставлять каталоги для uid, которого нет в данных.
function ensureCharactersDir(userId: string): string {
  const userDir = ensureUserDir(userId);
  const charsDir = path.join(userDir, 'characters');
  if (!fs.existsSync(charsDir)) {
    fs.mkdirSync(charsDir, { recursive: true });
  }
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

// ЧТЕНИЕ: все листы пользователя; битый файл пропускается, а не роняет список.
// Каталог здесь не создаётся: у нового аккаунта листов ещё нет.
export function getCharactersFromServer(userId: string): Character[] {
  const charsDir = getCharactersDir(userId);
  const characters: Character[] = [];

  try {
    const files = fs.readdirSync(charsDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(charsDir, file), 'utf8');
        const parsed = JSON.parse(content) as Record<string, unknown>;
        characters.push(normalizeCharacterRecord(parsed).character);
      } catch (e) {
        console.error(`Error reading character file ${file}:`, e);
      }
    }
  } catch (e) {
    // ENOENT — обычное состояние нового аккаунта, а не ошибка: каталог
    // появляется с первым листом (чтение его не создаёт).
    if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.error(`Error reading characters directory for ${userId}:`, e);
    }
  }

  return characters;
}

/**
 * ЧТЕНИЕ одного листа. `null` — файла нет, id небезопасен или файл битый.
 * Нужен PUT-роуту: валидировать патч можно только поверх текущего листа.
 */
export function getCharacterFromServer(
  userId: string,
  characterId: string,
): Character | null {
  const filePath = resolveCharacterFile(getCharactersDir(userId), characterId);
  if (!filePath || !fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return normalizeCharacterRecord(
      JSON.parse(content) as Record<string, unknown>,
    ).character;
  } catch (e) {
    console.error(`Character file ${characterId} is corrupted:`, e);
    return null;
  }
}

// ЗАПИСЬ: лист всегда живёт в своём файле, поэтому конфликтов между
// листами нет.
export function saveCharacterToServer(
  userId: string,
  character: Character,
): void {
  const charsDir = getCharactersDir(userId);
  const filePath = resolveCharacterFile(charsDir, character.id);
  if (!filePath) {
    // Сюда попадает только программная ошибка: id нового листа выдаёт сервер,
    // а не клиент. Молча писать «как получилось» нельзя — это путь на диске.
    throw new Error(`Unsafe character id: ${String(character.id)}`);
  }
  ensureCharactersDir(userId);
  const existed = fs.existsSync(filePath);
  writeJsonAtomic(
    filePath,
    normalizeCharacterRecord(character as unknown as Record<string, unknown>)
      .character,
  );
  if (!existed) {
    // Маркер «лист создан» — без полного diff. История best-effort: её сбой
    // не должен отменять создание листа. Не-UUID (старые тесты/fixtures)
    // пропускаем: боевой uid всегда UUID.
    if (isUid(userId)) {
      try {
        appendCreateMarker(userId, character.id);
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
export function saveCharactersToServer(
  userId: string,
  characters: Character[],
): void {
  for (const char of characters) {
    saveCharacterToServer(userId, char);
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
export function updateCharacterOnServer(
  userId: string,
  characterId: string,
  data: Partial<Character>,
  options: { writeToken?: WriteToken } = {},
): Character | null {
  const filePath = resolveCharacterFile(getCharactersDir(userId), characterId);
  // Небезопасный id роут отсекает сам (400) — здесь он просто не даёт пути.
  if (!filePath) return null;

  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf8');
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
    return character;
  }

  // Нормализация принимает «сырой» объект: спред Partial<Character> поверх
  // union-типа TS вывести не может, а normalize всё равно пересобирает лист.
  const updated: Character = normalizeCharacterRecord({
    ...character,
    ...data,
  } as Record<string, unknown>).character;

  // Считаем diff до записи и до добавления userId владельца: служебные поля
  // в историю не попадают, а сравнение идёт по содержанию листа.
  const diff = diffCharacterRecords(
    character as unknown as Record<string, unknown>,
    updated as unknown as Record<string, unknown>,
  );

  // Привязка к владельцу. Поле не входит в тип Character (это метаданные,
  // авторизация — по каталогу и cookie), но на диске оно должно быть: так
  // «плоский» бэкап и диагностика видят, чей это лист. Дописываем, если лист
  // пришёл из миграции/импорта без него.
  const withOwner = updated as unknown as Record<string, unknown>;
  if (!withOwner.userId) {
    withOwner.userId = userId;
  }

  writeJsonAtomic(filePath, updated);

  if (diff && isUid(userId)) {
    // Журнал не должен ломать сохранение: лист уже записан, ошибку только
    // логируем.
    try {
      appendHistory(userId, characterId, diff);
    } catch (historyError) {
      console.error(
        `Failed to append history for ${userId}/${characterId}:`,
        historyError,
      );
    }
  }
  return updated;
}

// УДАЛЕНИЕ: файл листа; true — удалили, false — файла не было или он занят.
export function deleteCharacterFromServer(
  userId: string,
  characterId: string,
): boolean {
  const filePath = resolveCharacterFile(getCharactersDir(userId), characterId);
  if (!filePath) return false;

  if (!fs.existsSync(filePath)) return false;

  try {
    fs.unlinkSync(filePath);
    resetWriteSeqGuard(userId, characterId);
    // Ссылка и журнал относятся к удалённому листу: убираем их best-effort,
    // чтобы не оставлять сирот и не отменять уже состоявшееся удаление файла.
    try {
      revokeShareForCharacter(userId, characterId);
    } catch (shareError) {
      console.error(
        `Failed to revoke share link for deleted character ${characterId}:`,
        shareError,
      );
    }
    deleteCharacterHistory(userId, characterId);
    return true;
  } catch (e) {
    console.error(`Error deleting character ${characterId}:`, e);
    return false;
  }
}

// Есть ли у пользователя каталог (профиль или хотя бы черновик).
export function userFolderExists(userId: string): boolean {
  return fs.existsSync(getUserDir(userId));
}

// Создать каталог и минимальный user.json, если профиля ещё нет.
export function createUserFolder(
  userId: string,
  username: string,
  displayName: string,
): void {
  const userDir = ensureUserDir(userId);
  const userFile = path.join(userDir, 'user.json');

  if (!fs.existsSync(userFile)) {
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
    writeJsonAtomic(userFile, userData);
  }
}
