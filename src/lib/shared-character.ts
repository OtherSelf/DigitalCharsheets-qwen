import { readHistory } from './character-history';
import { groupHistorySessions } from './history-session';
import {
  type HistoryChange,
  type HistorySession,
  type SharedHistoryPage,
  type StoredValue,
} from './history-types';
import { getCharacterFromServer } from './server-storage';
import { resolveShareToken } from './shares';
import type { Character } from './types';

/**
 * ─── LANDMARK: SHARED CHARACTER ─────────────────────────────────────────────
 * Гостевой лист готовит сервер: токен → запись реестра → лист с диска. В
 * HTML/RSC не должно попасть ничего, кроме данных самого листа: `userId` и
 * служебные `__*` вычищаются рекурсивно (они могут лежать и во вложенных
 * объектах старых файлов). История — необязательная часть ссылки; её значения
 * проходят тот же sanitize, а объём ограничен, чтобы RSC-payload не разросся.
 *
 * Функция серверная: `shares.ts` читает data-dir и профиль владельца.
 */
const SHARE_HISTORY_MAX_SESSIONS = 20;
const SHARE_HISTORY_MAX_CHANGES = 500;

function stripPrivateFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripPrivateFields(item));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (key === 'userId' || key.startsWith('__')) continue;
      result[key] = stripPrivateFields(child);
    }
    return result;
  }
  return value;
}

/** Копия листа без uid владельца и служебных полей; исходный объект не меняется. */
export function sanitizeCharacterForShare(character: Character): Character {
  return stripPrivateFields(character) as Character;
}

function stripPrivatePreview(preview: string): string {
  // preview — это JSON.stringify объекта, обрезанный по лимиту: uid и __* могут
  // оказаться в начале строки. Полноценно распарсить обрезанный JSON нельзя,
  // поэтому вырезаем именно пары служебных полей.
  return preview
    .replace(
      /"userId"\s*:\s*("(?:[^"\\]|\\.)*"|null|true|false|-?\d+(?:\.\d+)?)/g,
      '"userId":"[redacted]"',
    )
    .replace(
      /"__[A-Za-z0-9_]*"\s*:\s*("(?:[^"\\]|\\.)*"|null|true|false|-?\d+(?:\.\d+)?)/g,
      '"__redacted":"[redacted]"',
    );
}

function sanitizeStoredValue(value: StoredValue): StoredValue {
  return {
    ...value,
    ...(value.value !== undefined
      ? { value: stripPrivateFields(value.value) }
      : {}),
    ...(value.preview !== undefined
      ? { preview: stripPrivatePreview(value.preview) }
      : {}),
  };
}

/**
 * Значения истории тоже могут содержать `userId`/`__*` из старых вложенных
 * объектов. Подписи и пути приходят из кода плагина/схемы, их не трогаем.
 */
export function sanitizeHistoryForShare(
  sessions: HistorySession[],
): HistorySession[] {
  return sessions.map((session) => ({
    ...session,
    changes: session.changes.map((change): HistoryChange => ({
      ...change,
      ...(change.before !== undefined
        ? { before: sanitizeStoredValue(change.before) }
        : {}),
      ...(change.after !== undefined
        ? { after: sanitizeStoredValue(change.after) }
        : {}),
      ...(change.values !== undefined
        ? { values: change.values.map(sanitizeStoredValue) }
        : {}),
    })),
  }));
}

function readSharedHistory(
  uid: string,
  characterId: string,
): SharedHistoryPage {
  const stored = readHistory(uid, characterId);
  const grouped = groupHistorySessions(stored.revisions);
  const selected: HistorySession[] = [];
  let changeCount = 0;

  for (const session of grouped) {
    if (selected.length >= SHARE_HISTORY_MAX_SESSIONS) break;
    if (
      selected.length > 0 &&
      changeCount + session.changes.length > SHARE_HISTORY_MAX_CHANGES
    ) {
      break;
    }
    selected.push(session);
    changeCount += session.changes.length;
  }

  return {
    sessions: sanitizeHistoryForShare(selected),
    totalSessions: grouped.length,
    totalRevisions: stored.revisions.length,
    storage: {
      truncated: stored.truncated,
      oldestAt: stored.oldestAt,
    },
  };
}

export interface ResolvedSharedSheet {
  character: Character;
  history: SharedHistoryPage | null;
}

/**
 * Резолв гостевой ссылки: токен → uid/characterId → нормализованный лист и,
 * если владелец включил флаг, урезанная история. `null` — ссылка
 * недействительна или листа больше нет.
 */
export function resolveSharedSheet(token: string): ResolvedSharedSheet | null {
  const share = resolveShareToken(token);
  if (!share) return null;

  const character = getCharacterFromServer(share.uid, share.characterId);
  if (!character) return null;

  let history: SharedHistoryPage | null = null;
  if (share.includeHistory) {
    try {
      history = readSharedHistory(share.uid, share.characterId);
    } catch (error) {
      // История не должна закрывать доступ к листу: ссылка остаётся рабочей.
      console.error(
        `Failed to read shared history for ${share.uid}/${share.characterId}:`,
        error,
      );
    }
  }

  return {
    character: sanitizeCharacterForShare(character),
    history,
  };
}

/** Совместимый резолв только листа (метаданные/старые вызовы). */
export function resolveSharedCharacter(token: string): Character | null {
  return resolveSharedSheet(token)?.character ?? null;
}
