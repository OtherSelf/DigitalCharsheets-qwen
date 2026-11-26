import fs from 'node:fs/promises';
import path from 'node:path';

import { getDataDir } from '@/lib/data-dir';

/**
 * ─── LANDMARK: CONSENT LOG ─────────────────────────────────────────────────
 * Доказательство согласия с политикой: одна строка JSONL на регистрацию.
 * Пишется после успешного создания аккаунта; без записи согласие недоказуемо,
 * поэтому ошибку записи логируем, но регистрацию не откатываем — аккаунт уже
 * создан, откат потребовал бы удаления данных.
 */
export interface ConsentRecord {
  uid: string;
  at: string;
  version: string;
  source: 'register';
}

export function consentsFile(): string {
  return path.join(getDataDir(), 'consents.jsonl');
}

export async function appendConsent(
  record: Omit<ConsentRecord, 'at' | 'source'>,
): Promise<void> {
  const line = JSON.stringify({
    ...record,
    at: new Date().toISOString(),
    source: 'register',
  } satisfies ConsentRecord);
  await fs.appendFile(consentsFile(), `${line}\n`, { mode: 0o600 });
}
