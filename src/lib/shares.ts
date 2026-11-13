import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { getSharesFile } from './data-dir';
import { withDataLock } from './data-lock';
import { writeJsonAtomic } from './fs-atomic';
import { isUid } from './ids';
import { isSafeId } from './security/paths';
import { readStoredUser } from './user-schema';

/**
 * ─── LANDMARK: SHARE TOKEN ──────────────────────────────────────────────────
 * Гостевая ссылка — bearer-токен: кто угодно с ней видит лист в режиме
 * просмотра. Поэтому токен должен быть длинным и случайным, а на диске
 * хранится только его хэш (как у recovery-токенов): копия `shares.json` не
 * даёт открыть лист.
 *
 * 32 байта в base64url — 43 символа `[A-Za-z0-9_-]`. Этого достаточно, чтобы
 * подбор был бессмысленным, а URL не разрастался.
 *
 * Запись одна на пару `uid + characterId`: новая ссылка заменяет старую, а
 * отзыв не требует перебирать историю токенов. Просроченные записи вычищаются
 * при записи; чтение ничего не меняет.
 */

export const SHARE_TOKEN_BYTES = 32;
export const SHARE_TOKEN_LENGTH = 43;

/** Сроки, которые можно выбрать в UI/API. `null` — до отзыва. */
export type ShareExpiryDays = 7 | 30 | 90 | null;

/** Значение по умолчанию для новой ссылки. */
export const DEFAULT_SHARE_EXPIRY_DAYS: ShareExpiryDays = 30;

/** Больше живых ссылок одновременно не держим. */
const MAX_ACTIVE_SHARES = 10_000;
const SHARES_FILE_VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;
const HASH_RE = /^[0-9a-f]{64}$/;

const SHARE_TOKEN_RE = new RegExp(`^[A-Za-z0-9_-]{${SHARE_TOKEN_LENGTH}}$`);

interface ShareRecord {
  uid: string;
  characterId: string;
  createdAt: string;
  expiresAt: string | null;
  includeHistory: boolean;
}

interface SharesFile {
  version: number;
  shares: Record<string, ShareRecord>;
}

export interface ShareMetadata {
  createdAt: string;
  expiresAt: string | null;
  includeHistory: boolean;
}

export interface ResolvedShare extends ShareMetadata {
  uid: string;
  characterId: string;
}

export interface IssueShareOptions {
  expiresInDays?: ShareExpiryDays;
  /** Показывать гостю историю изменений; по умолчанию выключено. */
  includeHistory?: boolean;
  /** Часы (тесты подставляют управляемое время). */
  nowMs?: number;
}

export interface ShareClock {
  nowMs?: number;
}

/** Новый случайный токен ссылки. */
export function generateShareToken(): string {
  return crypto.randomBytes(SHARE_TOKEN_BYTES).toString('base64url');
}

/**
 * Проверка формы токена до любых обращений к диску: 43 символа base64url,
 * без padding и посторонних символов.
 */
export function isShareToken(value: unknown): value is string {
  return typeof value === 'string' && SHARE_TOKEN_RE.test(value);
}

/** Хэш токена — ключ записи в `shares.json`; сам токен на диск не попадает. */
export function hashShareToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Проверка значения срока из тела запроса/UI. */
export function isShareExpiryDays(value: unknown): value is ShareExpiryDays {
  return value === null || value === 7 || value === 30 || value === 90;
}

function emptySharesFile(): SharesFile {
  return { version: SHARES_FILE_VERSION, shares: {} };
}

function isValidDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    Number.isFinite(Date.parse(value))
  );
}

/**
 * Прочитать реестр. Битый/чужой файл считается пустым: ссылки просто не
 * работают (fail closed), листы не страдают.
 */
function readSharesFile(): SharesFile {
  let raw: string;
  try {
    raw = fs.readFileSync(getSharesFile(), 'utf8');
  } catch {
    return emptySharesFile();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptySharesFile();
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return emptySharesFile();
  }

  const rawShares = (parsed as { shares?: unknown }).shares;
  if (!rawShares || typeof rawShares !== 'object' || Array.isArray(rawShares)) {
    return emptySharesFile();
  }

  const shares: Record<string, ShareRecord> = {};
  for (const [hash, value] of Object.entries(
    rawShares as Record<string, unknown>,
  )) {
    // Ключ — SHA-256 в hex. Мусорный ключ не должен попадать даже в память.
    if (!HASH_RE.test(hash)) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;

    const record = value as Record<string, unknown>;
    if (typeof record.uid !== 'string' || !isUid(record.uid)) continue;
    if (
      typeof record.characterId !== 'string' ||
      !isSafeId(record.characterId)
    ) {
      continue;
    }
    if (!isValidDate(record.createdAt)) continue;

    let expiresAt: string | null;
    if (record.expiresAt === null) {
      expiresAt = null;
    } else if (isValidDate(record.expiresAt)) {
      expiresAt = record.expiresAt;
    } else {
      // Неизвестный/битый срок — fail closed, запись не принимаем.
      continue;
    }

    shares[hash] = {
      uid: record.uid,
      characterId: record.characterId,
      createdAt: record.createdAt,
      expiresAt,
      includeHistory: record.includeHistory === true,
    };
  }

  return { version: SHARES_FILE_VERSION, shares };
}

function writeSharesFile(file: SharesFile): void {
  fs.mkdirSync(path.dirname(getSharesFile()), { recursive: true });
  writeJsonAtomic(getSharesFile(), file);
}

function isExpired(record: ShareRecord, nowMs: number): boolean {
  return record.expiresAt !== null && Date.parse(record.expiresAt) <= nowMs;
}

/** Убрать просроченные записи; при переполнении — самые старые. */
function pruneShares(
  shares: Record<string, ShareRecord>,
  nowMs: number,
): Record<string, ShareRecord> {
  const alive: [string, ShareRecord][] = [];
  for (const [hash, record] of Object.entries(shares)) {
    if (!isExpired(record, nowMs)) alive.push([hash, record]);
  }

  alive.sort((a, b) => Date.parse(a[1].createdAt) - Date.parse(b[1].createdAt));
  if (alive.length > MAX_ACTIVE_SHARES) {
    alive.splice(0, alive.length - MAX_ACTIVE_SHARES);
  }

  return Object.fromEntries(alive);
}

function findShareForCharacter(
  shares: Record<string, ShareRecord>,
  uid: string,
  characterId: string,
): ShareRecord | undefined {
  for (const record of Object.values(shares)) {
    if (record.uid === uid && record.characterId === characterId) return record;
  }
  return undefined;
}

/**
 * Выдать (или перевыпустить) ссылку. Старая запись для этого же листа
 * удаляется в той же транзакции: активная ссылка всегда одна.
 */
export function issueShareToken(
  uid: string,
  characterId: string,
  options: IssueShareOptions = {},
): { token: string; createdAt: string; expiresAt: string | null } {
  if (!isUid(uid)) throw new Error('Share link requires a valid uid.');
  if (!isSafeId(characterId)) {
    throw new Error('Share link requires a safe character id.');
  }

  const expiresInDays =
    options.expiresInDays === undefined
      ? DEFAULT_SHARE_EXPIRY_DAYS
      : options.expiresInDays;
  if (!isShareExpiryDays(expiresInDays)) {
    throw new Error('Unsupported share expiry.');
  }

  const nowMs = options.nowMs ?? Date.now();
  const createdAt = new Date(nowMs).toISOString();
  const expiresAt =
    expiresInDays === null
      ? null
      : new Date(nowMs + expiresInDays * DAY_MS).toISOString();
  const token = generateShareToken();
  const hash = hashShareToken(token);

  withDataLock(() => {
    const file = readSharesFile();
    const shares = pruneShares(file.shares, nowMs);

    for (const [existingHash, record] of Object.entries(shares)) {
      if (record.uid === uid && record.characterId === characterId) {
        delete shares[existingHash];
      }
    }

    shares[hash] = {
      uid,
      characterId,
      createdAt,
      expiresAt,
      includeHistory: options.includeHistory === true,
    };
    writeSharesFile({
      version: SHARES_FILE_VERSION,
      shares: pruneShares(shares, nowMs),
    });
  });

  return { token, createdAt, expiresAt };
}

/**
 * Активная ссылка листа без самого токена. Токен на диске не хранится, поэтому
 * после закрытия диалога ссылку можно только перевыпустить.
 */
export function getShareForCharacter(
  uid: string,
  characterId: string,
  options: ShareClock = {},
): ShareMetadata | null {
  if (!isUid(uid) || !isSafeId(characterId)) return null;

  const nowMs = options.nowMs ?? Date.now();
  const record = findShareForCharacter(
    readSharesFile().shares,
    uid,
    characterId,
  );
  if (!record || isExpired(record, nowMs)) return null;

  return {
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    includeHistory: record.includeHistory,
  };
}

/**
 * Проверить токен из публичного URL. Помимо срока и отзыва проверяем, что
 * владелец ещё существует и не заблокирован: иначе старая ссылка пережила бы
 * блокировку аккаунта.
 */
export function resolveShareToken(
  token: string,
  options: ShareClock = {},
): ResolvedShare | null {
  if (!isShareToken(token)) return null;

  const nowMs = options.nowMs ?? Date.now();
  const record = readSharesFile().shares[hashShareToken(token)];
  if (!record || isExpired(record, nowMs)) return null;

  try {
    const owner = readStoredUser(record.uid);
    if (!owner || owner.isBlocked) return null;
  } catch {
    return null;
  }

  return {
    uid: record.uid,
    characterId: record.characterId,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    includeHistory: record.includeHistory,
  };
}

/** Отозвать ссылку листа; возвращает число удалённых записей. */
export function revokeShareForCharacter(
  uid: string,
  characterId: string,
): number {
  if (!isUid(uid) || !isSafeId(characterId)) return 0;

  return withDataLock(() => {
    const file = readSharesFile();
    const shares = { ...file.shares };
    let removed = 0;
    for (const [hash, record] of Object.entries(shares)) {
      if (record.uid === uid && record.characterId === characterId) {
        delete shares[hash];
        removed += 1;
      }
    }
    if (removed > 0) {
      writeSharesFile({ version: SHARES_FILE_VERSION, shares });
    }
    return removed;
  });
}

/** Отозвать все ссылки пользователя (удаление аккаунта/админское удаление). */
export function revokeSharesForUser(uid: string): number {
  if (!isUid(uid)) return 0;

  return withDataLock(() => {
    const file = readSharesFile();
    const shares = { ...file.shares };
    let removed = 0;
    for (const [hash, record] of Object.entries(shares)) {
      if (record.uid === uid) {
        delete shares[hash];
        removed += 1;
      }
    }
    if (removed > 0) {
      writeSharesFile({ version: SHARES_FILE_VERSION, shares });
    }
    return removed;
  });
}
