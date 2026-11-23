import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { getDataDir, getTotpKeyFile } from '../data-dir';
import { safeStringEqual } from './timing';

/**
 * ─── LANDMARK: TOTP (RFC 6238) ──────────────────────────────────────────────
 * Второй фактор на `node:crypto`, без внешних зависимостей: HMAC-SHA1,
 * 30-секундный шаг, 6 цифр, окно ±1 шаг. Секрет на диске шифруется
 * AES-256-GCM ключом `DCS_TOTP_KEY`; backup-коды хранятся ключевыми хэшами,
 * а не открытым текстом.
 *
 * Ключ шифрования обязателен для enrollment: без него TOTP-эндпоинты отвечают
 * 503, а уже включённый второй фактор нельзя обойти паролем.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BACKUP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 10;

class TotpKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TotpKeyError';
  }
}

/** Base32 без padding: формат секретов authenticator-приложений. */
function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(secret: string): Buffer {
  const normalized = secret.trim().replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 secret');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

/** Код для конкретного шага (counter = floor(now / step)). */
export function totpCodeForStep(secret: string, step: number): string {
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = crypto.createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

/**
 * Проверить код с окном ±1 шаг. Возвращает использованный шаг или `null`.
 * Повтор шага отсекается вызывающим по сохранённому `lastStep`.
 */
export function verifyTotpCode(
  secret: string,
  code: string,
  nowMs: number,
  options: { window?: number } = {},
): number | null {
  const normalized = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return null;
  const step = Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
  const window = options.window ?? TOTP_WINDOW;
  for (let delta = -window; delta <= window; delta += 1) {
    const candidate = step + delta;
    if (candidate < 0) continue;
    if (safeStringEqual(totpCodeForStep(secret, candidate), normalized)) {
      return candidate;
    }
  }
  return null;
}

/** `otpauth://`-URI для ручного ввода в authenticator (QR не генерируем). */
export function totpOtpauthUri(
  secret: string,
  account: string,
  issuer = 'Digital Character Sheets',
): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Разобрать `DCS_TOTP_KEY`: 32 байта base64. `null` — переменная не задана. */
function parseTotpKey(raw = process.env.DCS_TOTP_KEY): Buffer | null {
  const value = raw?.trim();
  if (!value) return null;
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new TotpKeyError('DCS_TOTP_KEY must be 32 bytes encoded as base64.');
  }
  return key;
}

let cachedKey: { env: string; dataDir: string; key: Buffer } | null = null;

function readOrCreateKeyFile(): Buffer {
  const file = getTotpKeyFile();
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    const key = parseTotpKey(existing);
    if (!key) throw new TotpKeyError('TOTP key file is empty.');
    return key;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
  }

  const generated = crypto.randomBytes(32).toString('base64');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    fs.writeFileSync(file, `${generated}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    return Buffer.from(generated, 'base64');
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') {
      const existing = fs.readFileSync(file, 'utf8').trim();
      const key = parseTotpKey(existing);
      if (!key) throw new TotpKeyError('TOTP key file is empty.');
      return key;
    }
    throw error;
  }
}

/**
 * Ключ TOTP. `DCS_TOTP_KEY` приоритетнее; без него используется
 * `<data-dir>/.totp-key`, который создаётся при первом обращении. Это делает
 * второй фактор доступным «из коробки»; цена — ключ лежит рядом с данными и
 * попадает в их бэкап. Для раздельного хранения задайте env.
 */
export function getTotpKey(): Buffer | null {
  const env = process.env.DCS_TOTP_KEY ?? '';
  const dataDir = getDataDir();
  if (cachedKey && cachedKey.env === env && cachedKey.dataDir === dataDir) {
    return cachedKey.key;
  }
  const key = env.trim() ? parseTotpKey(env) : readOrCreateKeyFile();
  if (!key) throw new TotpKeyError('TOTP key is not configured.');
  cachedKey = { env, dataDir, key };
  return key;
}

/**
 * Проверка конфигурации при старте: заданный env или существующий файл с
 * битым ключом — ошибка. Отсутствие ключа допустимо: он создастся при
 * первом включении TOTP.
 */
export function validateTotpKeyConfig(): void {
  const env = process.env.DCS_TOTP_KEY ?? '';
  if (env.trim()) {
    parseTotpKey(env);
    return;
  }
  try {
    const existing = fs.readFileSync(getTotpKeyFile(), 'utf8').trim();
    if (existing) parseTotpKey(existing);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return;
    throw error;
  }
}

/** Зашифровать секрет: `v1.<iv>.<tag>.<cipher>` (base64url), AAD = uid. */
export function encryptTotpSecret(
  secret: string,
  key: Buffer,
  uid: string,
): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(uid, 'utf8'));
  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

/** Расшифровать секрет; битый шифр/чужой uid — `null`. */
export function decryptTotpSecret(
  envelope: string,
  key: Buffer,
  uid: string,
): string | null {
  const [version, ivRaw, tagRaw, dataRaw] = envelope.split('.');
  if (version !== 'v1' || !ivRaw || !tagRaw || !dataRaw) return null;
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivRaw, 'base64url'),
    );
    decipher.setAAD(Buffer.from(uid, 'utf8'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataRaw, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

/** 10 одноразовых backup-кодов; показываются пользователю ровно один раз. */
export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let index = 0; index < count; index += 1) {
    let code = '';
    for (let char = 0; char < BACKUP_CODE_LENGTH; char += 1) {
      code += BACKUP_ALPHABET[crypto.randomInt(BACKUP_ALPHABET.length)];
    }
    codes.push(code);
  }
  return codes;
}

function normalizeBackupCode(code: string): string {
  return code.replace(/[\s-]+/g, '').toUpperCase();
}

/** Ключевой хэш backup-кода: без ключа хэши бесполезны. */
export function hashBackupCode(code: string, key: Buffer, uid: string): string {
  return crypto
    .createHmac('sha256', key)
    .update(`backup:${uid}:${normalizeBackupCode(code)}`)
    .digest('base64url');
}

/** Индекс совпавшего backup-кода или -1. */
export function findBackupCodeIndex(
  code: string,
  hashes: readonly string[],
  key: Buffer,
  uid: string,
): number {
  const candidate = hashBackupCode(code, key, uid);
  for (let index = 0; index < hashes.length; index += 1) {
    if (safeStringEqual(hashes[index], candidate)) return index;
  }
  return -1;
}
