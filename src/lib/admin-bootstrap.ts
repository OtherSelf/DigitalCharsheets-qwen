import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { getDataDir } from './data-dir';
import { normalizeLogin } from './ids';
import { createServiceAdmin } from './server-auth';
import { resolveLogin } from './user-index';
import { listStoredUsers } from './user-schema';

/**
 * ─── LANDMARK: INITIAL ADMIN BOOTSTRAP ──────────────────────────────────────
 * Если в data-dir нет ни одного АКТИВНОГО администратора (свежая установка
 * или все админы заблокированы/разжалованы), при старте создаётся служебный
 * аккаунт:
 *
 *   логин    — `DCS_ADMIN_USERNAME` (по умолчанию `admin`), при занятости
 *              берётся следующий свободный `admin-2`, `admin-3`, …
 *   пароль   — 16 символов base64url, генерируется здесь;
 *   роль     — `admin`, флаг `mustChangePassword`;
 *   вывод    — консоль сервера + `<data-dir>/.initial-admin.txt` (0600).
 *
 * Старые аккаунты не трогаются. Повторный старт ничего не делает, пока есть
 * хотя бы один активный админ, — сгенерированный пароль не меняется.
 */

export const INITIAL_ADMIN_FILE = '.initial-admin.txt';

export interface ServiceAdminReport {
  created: boolean;
  username?: string;
  password?: string;
  credentialsFile?: string;
  error?: string;
}

function writeCredentialsFile(
  username: string,
  password: string,
): string | null {
  const file = path.join(getDataDir(), INITIAL_ADMIN_FILE);
  const content = [
    'Digital Character Sheets — initial administrator',
    '',
    'Admin panel: /admin',
    `Login:       ${username}`,
    `Password:    ${password}`,
    `Created:     ${new Date().toISOString()}`,
    '',
    'Change this password after the first login and delete this file.',
    '',
  ].join('\n');

  try {
    fs.mkdirSync(getDataDir(), { recursive: true });
    fs.writeFileSync(file, content, { encoding: 'utf8', mode: 0o600 });
    try {
      // mode в writeFileSync действует только при создании файла; если файл
      // остался от прошлого bootstrap — выставляем права явно.
      fs.chmodSync(file, 0o600);
    } catch {
      /* Windows/некоторые ФС не поддерживают chmod — не критично */
    }
    return file;
  } catch (error) {
    console.error('Failed to write initial admin credentials file:', error);
    return null;
  }
}

/** Кандидаты логина: `admin`, `admin-2`, `admin-3`, … */
function candidateLogins(base: string): string[] {
  const logins = [base];
  for (let index = 2; index <= 20; index += 1) {
    logins.push(`${base}-${index}`);
  }
  return logins;
}

/**
 * Создать служебного администратора, если активных админов нет.
 * Возвращает `created: false`, когда админ уже есть или создать не удалось.
 */
export function ensureServiceAdmin(): ServiceAdminReport {
  const activeAdmin = listStoredUsers().some(
    (user) => user.role === 'admin' && !user.isBlocked,
  );
  if (activeAdmin) return { created: false };

  const requested =
    normalizeLogin(process.env.DCS_ADMIN_USERNAME || 'admin') || 'admin';
  const password = crypto.randomBytes(12).toString('base64url');

  for (const login of candidateLogins(requested)) {
    if (resolveLogin(login)) continue;

    const created = createServiceAdmin(login, password, 'Administrator');
    if (!created.success) {
      // `exists` — гонка с параллельным созданием; пробуем следующий логин.
      if (created.reason === 'exists') continue;
      return {
        created: false,
        error: created.error || 'Failed to create the initial administrator.',
      };
    }

    return {
      created: true,
      username: login,
      password,
      credentialsFile: writeCredentialsFile(login, password) ?? undefined,
    };
  }

  return {
    created: false,
    error: 'Could not find a free login for the initial administrator.',
  };
}
