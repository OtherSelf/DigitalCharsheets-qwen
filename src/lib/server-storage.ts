import fs from 'fs';
import path from 'path';
import { Character } from './types';
import { getDataDir } from './data-dir';

// Ensure a user's data directory exists
function ensureUserDir(userId: string): string {
  const userDir = path.join(getDataDir(), userId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return userDir;
}

// Ensure a user's characters directory exists
function ensureCharactersDir(userId: string): string {
  const userDir = ensureUserDir(userId);
  const charsDir = path.join(userDir, 'characters');
  if (!fs.existsSync(charsDir)) {
    fs.mkdirSync(charsDir, { recursive: true });
  }
  return charsDir;
}

/**
 * ─── LANDMARK: ATOMIC WRITE ─────────────────────────────────────────────────
 * Раньше лист писался прямо в файл (`writeFileSync`). Если процесс падал/
 * ронялся посреди записи (OOM, Ctrl+C, кончилось место, Windows EBUSY), в
 * `<id>.json` оставался ОБРЕЗАННЫЙ JSON: `getCharactersFromServer` такой файл
 * молча пропускает — персонаж «исчезал» из списка.
 *
 * Теперь пишем во временный файл рядом и подменяем им основной через
 * `renameSync` — на одной ФС это атомарная операция. Читатель видит либо
 * старую версию целиком, либо новую целиком, но никогда — половину.
 */
function writeJsonAtomic(filePath: string, data: unknown): void {
  const tmpPath = `${filePath}.${process.pid.toString(36)}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  const json = JSON.stringify(data, null, 2);
  let fd: number | null = null;
  try {
    fd = fs.openSync(tmpPath, 'w');
    fs.writeFileSync(fd, json, 'utf8');
    // fsync, чтобы запись пережила внезапное выключение питания/контейнера.
    try { fs.fsyncSync(fd); } catch { /* на некоторых ФС fsync не поддерживается */ }
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* уже закрыт */ }
    }
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch { /* best effort */ }
    // EXDEV: временный файл лежит рядом с целевым, поэтому «честный» rename
    // внутри одного каталога EXDEV не даёт. Ветку могут вызвать только
    // экзотические FUSE/сетевые ФС, которые всё же отвечают EXDEV и здесь:
    // тогда деградируем до прямой записи — атомарность теряется, но данные
    // остаются целыми (лучше, чем 500 и потерянная правка).
    // Покрыто тестами tests/unit/exdev-storage.test.ts.
    if ((error as NodeJS.ErrnoException)?.code === 'EXDEV') {
      fs.writeFileSync(filePath, json, 'utf8');
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch { /* best effort */ }
      return;
    }
    throw error;
  }
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

export function isStaleWrite(userId: string, characterId: string, token?: WriteToken): boolean {
  if (!token || typeof token.page !== 'string' || !token.page || typeof token.seq !== 'number' || !Number.isFinite(token.seq)) {
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
export function resetWriteSeqGuard(userId?: string, characterId?: string): void {
  if (!userId) { lastSeqBySheet.clear(); return; }
  const key = characterId ? `${userId}/${characterId}` : null;
  if (key) { lastSeqBySheet.delete(key); return; }
  for (const existing of Array.from(lastSeqBySheet.keys())) {
    if (existing.startsWith(`${userId}/`)) lastSeqBySheet.delete(existing);
  }
}

// READ: Get all characters for a user (reads individual files)
export function getCharactersFromServer(userId: string): Character[] {
  const charsDir = ensureCharactersDir(userId);
  const characters: Character[] = [];

  try {
    const files = fs.readdirSync(charsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(charsDir, file), 'utf8');
        const char = JSON.parse(content) as Character;
        characters.push(char);
      } catch (e) {
        console.error(`Error reading character file ${file}:`, e);
      }
    }
  } catch (e) {
    console.error(`Error reading characters directory for ${userId}:`, e);
  }

  return characters;
}

// WRITE: Save a single character to its own file
export function saveCharacterToServer(userId: string, character: Character): void {
  const charsDir = ensureCharactersDir(userId);
  const filePath = path.join(charsDir, `${character.id}.json`);
  writeJsonAtomic(filePath, character);
}

// WRITE: Save multiple characters (used during import)
export function saveCharactersToServer(userId: string, characters: Character[]): void {
  for (const char of characters) {
    saveCharacterToServer(userId, char);
  }
}

/**
 * UPDATE: Update a specific character file.
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
  const charsDir = ensureCharactersDir(userId);
  const filePath = path.join(charsDir, `${characterId}.json`);

  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf8');
  let character: Character;
  try {
    character = JSON.parse(content) as Character;
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

  // 🎯 LANDMARK: Explicit cast to Character to resolve TypeScript discriminated union
  // inference issues when spreading Partial<Character> over a union type.
  const updated: Character = { ...character, ...data } as Character;

  writeJsonAtomic(filePath, updated);
  return updated;
}

// DELETE: Remove a character file
export function deleteCharacterFromServer(userId: string, characterId: string): boolean {
  const charsDir = ensureCharactersDir(userId);
  const filePath = path.join(charsDir, `${characterId}.json`);

  if (!fs.existsSync(filePath)) return false;

  try {
    fs.unlinkSync(filePath);
    resetWriteSeqGuard(userId, characterId);
    return true;
  } catch (e) {
    console.error(`Error deleting character ${characterId}:`, e);
    return false;
  }
}

// Check if a user exists
export function userFolderExists(userId: string): boolean {
  return fs.existsSync(path.join(getDataDir(), userId));
}

// Create a user folder with user.json
export function createUserFolder(userId: string, username: string, displayName: string): void {
  const userDir = ensureUserDir(userId);
  const userFile = path.join(userDir, 'user.json');
  
  if (!fs.existsSync(userFile)) {
    const userData = { username, displayName, passwordHash: '' };
    fs.writeFileSync(userFile, JSON.stringify(userData, null, 2), 'utf8');
  }
}