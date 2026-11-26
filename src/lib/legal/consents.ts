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
export type ConsentSource = 'register' | 'login' | 'erasure';

/** Сколько хранится факт принятия после удаления аккаунта. */
export const ERASED_CONSENT_RETENTION_DAYS = 3 * 365;

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
      // Строка-надгробие говорит «аккаунта больше нет», а не «редакция
      // принята»: она не должна закрывать гейт повторно.
      if (parsed.source === 'erasure') continue;
      if (!parsed.version) continue;
      if (latest === null || parsed.version > latest) latest = parsed.version;
    } catch {
      // Битая строка не должна ронять вход: остальные записи остаются.
    }
  }
  return latest;
}

/**
 * Аккаунт удалён. Принятие редакции — доказательство, которое нужно, пока идёт
 * обработка; после удаления профиля остаётся минимальный след: идентификатор,
 * дата и версия. Он нужен только на случай спора (срок исковой давности —
 * три года) и через `pruneErasedConsents` исчезает вместе с остальными
 * строками этого аккаунта.
 *
 * Если аккаунт не принимал ни одной редакции (нечем доказывать), ничего не
 * пишем: удалять нечего.
 */
export async function markConsentsErased(uid: string): Promise<void> {
  const version = await latestConsentVersion(uid);
  if (!version) return;
  await appendConsent({ uid, version, source: 'erasure' });
}

/**
 * Удалить строки аккаунтов, удалённых больше трёх лет назад: и надгробие, и
 * само принятие. Вызывается суточной очисткой, чтобы срок не зависел от
 * рестартов.
 */
export async function pruneErasedConsents(now = Date.now()): Promise<number> {
  let raw: string;
  try {
    raw = await fs.readFile(consentsFile(), 'utf8');
  } catch {
    return 0;
  }

  const cutoff = now - ERASED_CONSENT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const erasedBefore = new Set<string>();
  const records: Array<{ uid: string; at: number; line: string }> = [];

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as Partial<ConsentRecord>;
      if (typeof parsed.uid !== 'string') continue;
      const at = Date.parse(String(parsed.at ?? ''));
      if (!Number.isFinite(at)) continue;
      if (parsed.source === 'erasure' && at < cutoff) {
        erasedBefore.add(parsed.uid);
      }
      records.push({ uid: parsed.uid, at, line });
    } catch {
      // Битая строка не мешает почистить остальные.
    }
  }

  if (erasedBefore.size === 0) return 0;

  // Аккаунт мог удалиться заново (новый аккаунт с тем же uid невозможен), но
  // строки после надгробия всё равно не оставляем: срок истёк для всех.
  const kept = records.filter((record) => !erasedBefore.has(record.uid));
  const removed = records.length - kept.length;
  await fs.writeFile(
    consentsFile(),
    kept.map((record) => record.line).join('\n') + (kept.length ? '\n' : ''),
    { mode: 0o600 },
  );
  return removed;
}
