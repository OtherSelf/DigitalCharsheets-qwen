import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { getRecoveryTokensFile } from '../data-dir';
import { withDataLock } from '../data-lock';
import { writeJsonAtomic } from '../fs-atomic';
import { isUid } from '../ids';

/**
 * ─── LANDMARK: RECOVERY TOKENS ──────────────────────────────────────────────
 * Одноразовый токен — единственное, что получает клиент после проверки
 * recovery-фразы. Пароль и фразу меняет только `recover/update`, и только по
 * непогашенному токену: логин в теле запроса ничего не доказывает.
 *
 * На диске (`<data-dir>/tokens.json`) лежит **хэш** токена, а не он сам: копия
 * файла не даёт войти. Запись исчезает при первой успешной попытке обмена
 * (одноразовость) и выбрасывается по истечении TTL.
 *
 * Формат файла: `{ version: 1, tokens: { <sha256 hex>: { uid, createdAt,
 * expiresAt } } }`. Все операции идут под `withDataLock`: два параллельных
 * обмена одного токена иначе могли бы оба увидеть запись живой.
 */

export const RECOVERY_TOKEN_TTL_MS = 15 * 60 * 1000;

const TOKEN_BYTES = 32;
const FILE_VERSION = 1;
/** Больше живых токенов одновременно не держим: старые вытесняются. */
const MAX_ACTIVE_TOKENS = 500;

interface TokenRecord {
  uid: string;
  createdAt: string;
  expiresAt: string;
}

interface TokensFile {
  version: number;
  tokens: Record<string, TokenRecord>;
}

export type ConsumeRecoveryTokenResult =
  | { success: true; uid: string }
  | { success: false; reason: 'invalid' | 'expired' };

export interface IssueRecoveryTokenOptions {
  ttlMs?: number;
  /** Часы (тесты подставляют управляемое время). */
  nowMs?: number;
}

export interface ConsumeRecoveryTokenOptions {
  nowMs?: number;
}

/** Хэш токена — ключ записи в `tokens.json`. */
export function hashRecoveryToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function emptyTokensFile(): TokensFile {
  return { version: FILE_VERSION, tokens: {} };
}

/**
 * Прочитать файл. Битый/чужой файл считается пустым: восстановление не
 * должно падать из-за обрезанного JSON, а «нет токена» — безопасный ответ.
 */
function readTokensFile(): TokensFile {
  let raw: string;
  try {
    raw = fs.readFileSync(getRecoveryTokensFile(), 'utf8');
  } catch {
    return emptyTokensFile();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyTokensFile();
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return emptyTokensFile();
  }

  const rawTokens = (parsed as { tokens?: unknown }).tokens;
  if (!rawTokens || typeof rawTokens !== 'object' || Array.isArray(rawTokens)) {
    return emptyTokensFile();
  }

  const tokens: Record<string, TokenRecord> = {};
  for (const [hash, value] of Object.entries(
    rawTokens as Record<string, unknown>,
  )) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    if (typeof record.uid !== 'string' || !isUid(record.uid)) continue;
    if (typeof record.createdAt !== 'string') continue;
    if (typeof record.expiresAt !== 'string') continue;
    if (!Number.isFinite(Date.parse(record.expiresAt))) continue;
    tokens[hash] = {
      uid: record.uid,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
    };
  }

  return { version: FILE_VERSION, tokens };
}

function writeTokensFile(file: TokensFile): void {
  fs.mkdirSync(path.dirname(getRecoveryTokensFile()), { recursive: true });
  writeJsonAtomic(getRecoveryTokensFile(), file);
}

/** Убрать просроченные записи; при переполнении — самые старые. */
function pruneTokens(
  tokens: Record<string, TokenRecord>,
  nowMs: number,
): Record<string, TokenRecord> {
  const alive: [string, TokenRecord][] = [];
  for (const [hash, record] of Object.entries(tokens)) {
    if (Date.parse(record.expiresAt) > nowMs) alive.push([hash, record]);
  }

  alive.sort((a, b) => Date.parse(a[1].createdAt) - Date.parse(b[1].createdAt));
  if (alive.length > MAX_ACTIVE_TOKENS) {
    alive.splice(0, alive.length - MAX_ACTIVE_TOKENS);
  }

  return Object.fromEntries(alive);
}

/**
 * Выдать одноразовый токен для uid. Возвращает сам токен (его видит только
 * вызывающий) и срок жизни; на диск уходит только хэш.
 */
export function issueRecoveryToken(
  uid: string,
  options: IssueRecoveryTokenOptions = {},
): { token: string; expiresAt: string } {
  if (!isUid(uid)) {
    throw new Error('Recovery token requires a valid uid.');
  }

  const nowMs = options.nowMs ?? Date.now();
  const ttlMs = options.ttlMs ?? RECOVERY_TOKEN_TTL_MS;
  const expiresAt = new Date(nowMs + ttlMs).toISOString();
  const token = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  const hash = hashRecoveryToken(token);

  withDataLock(() => {
    const file = readTokensFile();
    const tokens = pruneTokens(file.tokens, nowMs);
    tokens[hash] = {
      uid,
      createdAt: new Date(nowMs).toISOString(),
      expiresAt,
    };
    writeTokensFile({ version: FILE_VERSION, tokens });
  });

  return { token, expiresAt };
}

/**
 * Обменять токен на uid. Успешный обмен гасит запись: повторный вызов с тем же
 * токеном вернёт `invalid`. Просроченный токен удаляется и помечается
 * `expired` (для журнала; наружу роут отвечает одинаково — см. SEC-9).
 */
export function consumeRecoveryToken(
  token: string,
  options: ConsumeRecoveryTokenOptions = {},
): ConsumeRecoveryTokenResult {
  if (typeof token !== 'string' || token.trim() === '') {
    return { success: false, reason: 'invalid' };
  }

  const nowMs = options.nowMs ?? Date.now();
  const hash = hashRecoveryToken(token.trim());

  return withDataLock(() => {
    const file = readTokensFile();
    // Запись ищем до чистки: иначе просроченный токен выглядел бы как
    // неизвестный, и в журнале не отличить истечение от подделки.
    const record = file.tokens[hash];
    const tokens = pruneTokens(file.tokens, nowMs);

    if (!record) {
      writeTokensFile({ version: FILE_VERSION, tokens });
      return { success: false, reason: 'invalid' };
    }

    delete tokens[hash];
    writeTokensFile({ version: FILE_VERSION, tokens });

    if (Date.parse(record.expiresAt) <= nowMs) {
      return { success: false, reason: 'expired' };
    }
    return { success: true, uid: record.uid };
  });
}

/**
 * Погасить все токены пользователя. Нужно при смене пароля/фразы и удалении
 * аккаунта: выданный ранее токен не должен пережить смену секретов.
 */
export function revokeRecoveryTokensForUser(uid: string): number {
  return withDataLock(() => {
    const file = readTokensFile();
    const tokens = { ...file.tokens };
    let removed = 0;
    for (const [hash, record] of Object.entries(tokens)) {
      if (record.uid !== uid) continue;
      delete tokens[hash];
      removed += 1;
    }
    writeTokensFile({ version: FILE_VERSION, tokens });
    return removed;
  });
}
