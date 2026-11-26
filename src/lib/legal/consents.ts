import fs from 'node:fs/promises';
import path from 'node:path';

import { getDataDir } from '@/lib/data-dir';

/**
 * ─── LANDMARK: CONSENT LOG ─────────────────────────────────────────────────
 * Журнал принятия редакции политики: одна строка JSONL на регистрацию или на
 * вход после смены редакции. Это акцепт опубликованного документа, а не
 * согласие на обработку по ст. 9 152-ФЗ (текст политики говорит то же самое).
 * Без записи недоказуемо, что редакция доведена и принята.
 *
 * Запись не откатывает уже созданный аккаунт и не блокирует успешный вход,
 * если упала: ошибку логируем, потому что откат потребовал бы удаления данных,
 * а отказ во входе — потери доступа к своим листам.
 */
export type ConsentSource = 'register' | 'login';

export interface ConsentRecord {
  uid: string;
  at: string;
  version: string;
  source: ConsentSource;
}

function consentsFile(): string {
  return path.join(getDataDir(), 'consents.jsonl');
}

export async function appendConsent(record: {
  uid: string;
  version: string;
  source: ConsentSource;
}): Promise<void> {
  const line = JSON.stringify({
    ...record,
    at: new Date().toISOString(),
  } satisfies ConsentRecord);
  await fs.appendFile(consentsFile(), `${line}\n`, { mode: 0o600 });
}

/**
 * Последняя редакция политики, которую принял этот аккаунт. `null` — записи
 * нет: аккаунт создан до появления лога согласий либо файл потерян.
 *
 * Версии — даты в формате ISO, поэтому сравнение строк совпадает со
 * сравнением по времени.
 */
export async function latestConsentVersion(
  uid: string,
): Promise<string | null> {
  let raw: string;
  try {
    raw = await fs.readFile(consentsFile(), 'utf8');
  } catch {
    return null;
  }

  let latest: string | null = null;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as Partial<ConsentRecord>;
      if (parsed.uid !== uid || typeof parsed.version !== 'string') continue;
      if (!parsed.version) continue;
      if (latest === null || parsed.version > latest) latest = parsed.version;
    } catch {
      // Битая строка не должна ронять вход: остальные записи остаются.
    }
  }
  return latest;
}
