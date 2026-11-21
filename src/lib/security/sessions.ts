import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { getSessionsFile } from '../data-dir';
import { withDataLock } from '../data-lock';
import { writeJsonAtomic } from '../fs-atomic';
import { readJsonThroughCache } from '../read-cache';

/**
 * ─── LANDMARK: SERVER-SIDE SESSIONS ─────────────────────────────────────────
 * Cookie `<uid>.<exp>.<jti>.<hmac>` самодостаточна по подписи, но подпись
 * нельзя отозвать. Поэтому каждый вход заводит запись в
 * `<data-dir>/sessions.json`:
 *
 *   { "version": 1,
 *     "sessions": { "<jti>": { uid, createdAt, expiresAt, revokedAt? } } }
 *
 * Запись нужна для трёх вещей:
 *   • logout гасит конкретную сессию, а не «надеется на истечение cookie»;
 *   • смена пароля/фразы и восстановление доступа рвут старые сессии;
 *   • «выйти на всех устройствах» = `revokeAllSessionsForUser(uid)`.
 *
 * `jti` — случайный идентификатор (base64url, 18 байт), в cookie он не
 * секрет: подпись всё равно проверяется HMAC, а запись — только флаг «жива».
 * Файл содержит ТОЛЬКО живые сессии: отзыв удаляет запись, просроченные
 * вычищаются при каждой записи. Так файл не растёт от каждого выхода из
 * аккаунта, а `revokedAt` остаётся полем для совместимости с записями,
 * которые успели записать старые версии (они считаются погашенными).
 */

const FILE_VERSION = 1;
const JTI_BYTES = 18;
/** Слишком много живых сессий — старые вытесняются (защита от роста файла). */
const MAX_SESSIONS = 10_000;

export interface SessionRecord {
  uid: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
}

interface SessionsFile {
  version: number;
  sessions: Record<string, SessionRecord>;
}

export interface CreateSessionRecordOptions {
  ttlMs: number;
  nowMs?: number;
}

function emptySessionsFile(): SessionsFile {
  return { version: FILE_VERSION, sessions: {} };
}

/** Прочитать реестр. Битый/чужой файл = «живых сессий нет» (fail-closed). */
function parseSessionsFile(raw: string): SessionsFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptySessionsFile();
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return emptySessionsFile();
  }

  const rawSessions = (parsed as { sessions?: unknown }).sessions;
  if (
    !rawSessions ||
    typeof rawSessions !== 'object' ||
    Array.isArray(rawSessions)
  ) {
    return emptySessionsFile();
  }

  const sessions: Record<string, SessionRecord> = {};
  for (const [jti, value] of Object.entries(
    rawSessions as Record<string, unknown>,
  )) {
    if (typeof jti !== 'string' || jti === '') continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    if (typeof record.uid !== 'string' || record.uid === '') continue;
    if (typeof record.expiresAt !== 'string') continue;
    if (!Number.isFinite(Date.parse(record.expiresAt))) continue;
    sessions[jti] = {
      uid: record.uid,
      createdAt:
        typeof record.createdAt === 'string'
          ? record.createdAt
          : new Date(0).toISOString(),
      expiresAt: record.expiresAt,
      ...(typeof record.revokedAt === 'string'
        ? { revokedAt: record.revokedAt }
        : {}),
    };
  }

  return { version: FILE_VERSION, sessions };
}

async function readSessionsFile(): Promise<SessionsFile> {
  return (
    (await readJsonThroughCache<SessionsFile>(getSessionsFile())) ??
    emptySessionsFile()
  );
}

async function writeSessionsFile(file: SessionsFile): Promise<void> {
  await fs.mkdir(path.dirname(getSessionsFile()), { recursive: true });
  await writeJsonAtomic(getSessionsFile(), file);
}

/** Выбросить просроченные и отозванные записи; при переполнении — старые. */
function pruneSessions(
  sessions: Record<string, SessionRecord>,
  nowMs: number,
): Record<string, SessionRecord> {
  const alive = Object.entries(sessions).filter(([, record]) => {
    if (record.revokedAt) return false;
    return Date.parse(record.expiresAt) > nowMs;
  });

  alive.sort((a, b) => Date.parse(a[1].createdAt) - Date.parse(b[1].createdAt));
  if (alive.length > MAX_SESSIONS) {
    alive.splice(0, alive.length - MAX_SESSIONS);
  }
  return Object.fromEntries(alive);
}

/** Завести запись сессии; возвращает `jti` и срок жизни. */
export async function createSessionRecord(
  uid: string,
  options: CreateSessionRecordOptions,
): Promise<{ jti: string; expiresAt: string }> {
  const nowMs = options.nowMs ?? Date.now();
  const expiresAt = new Date(nowMs + options.ttlMs).toISOString();
  const jti = crypto.randomBytes(JTI_BYTES).toString('base64url');

  await withDataLock(async () => {
    const file = await readSessionsFile();
    const sessions = pruneSessions(file.sessions, nowMs);
    sessions[jti] = {
      uid,
      createdAt: new Date(nowMs).toISOString(),
      expiresAt,
    };
    await writeSessionsFile({ version: FILE_VERSION, sessions });
  });

  return { jti, expiresAt };
}

/** Существует ли живая (не отозванная и не просроченная) запись. */
export async function isSessionActive(
  jti: string,
  uid?: string,
  nowMs: number = Date.now(),
): Promise<boolean> {
  if (typeof jti !== 'string' || jti === '') return false;
  const record = (await readSessionsFile()).sessions[jti];
  if (!record) return false;
  if (record.revokedAt) return false;
  if (Date.parse(record.expiresAt) <= nowMs) return false;
  if (uid !== undefined && record.uid !== uid) return false;
  return true;
}

/**
 * Погасить одну сессию (logout): запись удаляется. `false` — такой живой
 * сессии нет (повторный logout, чужой jti, истёкшая cookie).
 */
export async function revokeSession(jti: string): Promise<boolean> {
  if (typeof jti !== 'string' || jti === '') return false;
  return withDataLock(async () => {
    const file = await readSessionsFile();
    if (!file.sessions[jti]) return false;
    delete file.sessions[jti];
    await writeSessionsFile({
      version: FILE_VERSION,
      sessions: pruneSessions(file.sessions, Date.now()),
    });
    return true;
  });
}

/**
 * Погасить все сессии пользователя. `exceptJti` оставляет текущую сессию
 * живой — так смена пароля не выкидывает пользователя с того устройства, где
 * он её сделал. Возвращает число погашенных записей.
 */
export async function revokeAllSessionsForUser(
  uid: string,
  exceptJti?: string,
): Promise<number> {
  if (typeof uid !== 'string' || uid === '') return 0;
  return withDataLock(async () => {
    const file = await readSessionsFile();
    let revoked = 0;
    for (const [jti, record] of Object.entries(file.sessions)) {
      if (record.uid !== uid) continue;
      if (exceptJti && jti === exceptJti) continue;
      delete file.sessions[jti];
      revoked += 1;
    }
    if (revoked > 0) {
      await writeSessionsFile({
        version: FILE_VERSION,
        sessions: pruneSessions(file.sessions, Date.now()),
      });
    }
    return revoked;
  });
}

/** Живые `jti` (диагностика и тесты; наружу не отдаётся). */
export async function readActiveSessions(
  nowMs: number = Date.now(),
): Promise<string[]> {
  return Object.entries((await readSessionsFile()).sessions)
    .filter(
      ([, record]) => !record.revokedAt && Date.parse(record.expiresAt) > nowMs,
    )
    .map(([jti]) => jti);
}

/** Сколько живых сессий у пользователя (для UI «выйти на всех устройствах»). */
export async function countActiveSessions(
  uid: string,
  nowMs: number = Date.now(),
): Promise<number> {
  return Object.values((await readSessionsFile()).sessions).filter(
    (record) =>
      record.uid === uid &&
      !record.revokedAt &&
      Date.parse(record.expiresAt) > nowMs,
  ).length;
}
