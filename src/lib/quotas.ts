import fs from 'node:fs/promises';
import path from 'node:path';

import { getUserDir } from './data-dir';

/**
 * ─── LANDMARK: ACCOUNT QUOTAS ───────────────────────────────────────────────
 * Диск — общий ресурс инсталляции: без квот один аккаунт может забить его
 * листами или историей. Лимиты считаются по каталогу пользователя целиком
 * (профиль, листы, history/), а не только по JSON листов: история растёт
 * при каждом сохранении и иначе обходила бы лимит.
 *
 * Существующие превышения не блокируются на чтение: «дедушка»-правило
 * разрешает правку без роста объёма (nextTotal <= currentTotal), но не
 * создание новых листов и не рост сверх лимита.
 */

export const MAX_SHEETS_PER_ACCOUNT = 100;
export const MAX_ACCOUNT_BYTES = 50 * 1024 * 1024;

export interface AccountUsage {
  sheets: number;
  bytes: number;
}

async function directoryUsage(
  dir: string,
): Promise<{ bytes: number; sheets: number }> {
  let bytes = 0;

  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        const stat = await fs.stat(entryPath);
        bytes += stat.size;
      } catch {
        // Файл исчез между readdir и stat: квоту это не ломает.
      }
    }
  }

  await walk(dir);
  // Листы считаются на верхнем уровне characters/, а не в history/.
  try {
    const characterFiles = await fs.readdir(path.join(dir, 'characters'));
    const sheets = characterFiles.filter((name) =>
      name.endsWith('.json'),
    ).length;
    return { bytes, sheets };
  } catch {
    return { bytes, sheets: 0 };
  }
}

/** Текущее использование аккаунта (листы + байты всего каталога). */
export async function getAccountUsage(uid: string): Promise<AccountUsage> {
  const { bytes, sheets } = await directoryUsage(getUserDir(uid));
  return { sheets, bytes };
}

export type QuotaFailure = 'sheets' | 'bytes';

export interface QuotaEvaluation {
  usage: AccountUsage;
  failure: QuotaFailure | null;
}

/**
 * Проверить, влезает ли операция в квоту.
 * `currentFileBytes` — размер изменяемого листа (0 для нового),
 * `nextFileBytes` — размер после записи.
 */
export function evaluateQuota(
  usage: AccountUsage,
  options: {
    isNewSheet: boolean;
    currentFileBytes?: number;
    nextFileBytes?: number;
  },
): QuotaEvaluation {
  if (options.isNewSheet && usage.sheets + 1 > MAX_SHEETS_PER_ACCOUNT) {
    return { usage, failure: 'sheets' };
  }

  const currentFileBytes = options.currentFileBytes ?? 0;
  const nextFileBytes = options.nextFileBytes ?? 0;
  const nextTotal = usage.bytes - currentFileBytes + nextFileBytes;
  // Уже сверх лимита: разрешаем только не увеличивать объём.
  if (nextTotal > MAX_ACCOUNT_BYTES && nextTotal > usage.bytes) {
    return { usage, failure: 'bytes' };
  }
  return { usage, failure: null };
}

/** Ошибка квоты: роуты превращают её в 409, не смешивая с 500. */
export class QuotaExceededError extends Error {
  readonly reason: QuotaFailure;
  readonly usage: AccountUsage;

  constructor(reason: QuotaFailure, usage: AccountUsage) {
    super(
      reason === 'sheets'
        ? `Account limit reached: at most ${MAX_SHEETS_PER_ACCOUNT} character sheets.`
        : `Account limit reached: at most ${Math.round(MAX_ACCOUNT_BYTES / (1024 * 1024))} MiB of data.`,
    );
    this.name = 'QuotaExceededError';
    this.reason = reason;
    this.usage = usage;
  }
}

/** Проверить квоту и бросить `QuotaExceededError`, если операция не влезает. */
export async function enforceCharacterQuota(
  uid: string,
  options: {
    isNewSheet: boolean;
    currentFileBytes?: number;
    nextFileBytes?: number;
  },
): Promise<void> {
  const usage = await getAccountUsage(uid);
  const result = evaluateQuota(usage, options);
  if (result.failure) throw new QuotaExceededError(result.failure, usage);
}
