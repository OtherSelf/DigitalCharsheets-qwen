import { normalizePhrase } from './phrase-policy';
import {
  hashSecretAsync,
  isScryptHash,
  verifySecretHash,
  verifySecretHashAsync,
} from './scrypt';
import { safeStringEqual } from './timing';

export { normalizePhrase, normalizePhraseWords } from './phrase-policy';

/**
 * ─── LANDMARK: RECOVERY PHRASE ──────────────────────────────────────────────
 * Recovery-фраза — секрет, доказывающий владение аккаунтом, поэтому:
 *
 *   1) на диске лежит **хэш** (`scrypt$…`, см. `scrypt.ts`), как у пароля:
 *      копия `user.json` больше не выдаёт фразу;
 *   2) сравнение — **полное**: канонизированные слова должны совпасть и по
 *      составу, и по порядку. «Хотя бы одно слово» и «слова из листов»
 *      доказательством владения не являются (их знает любой, кто видел лист);
 *   3) сравнение не зависит от длины и позиции расхождения — `timingSafeEqual`.
 *
 * Нормализация не зависит от алфавита: `toLowerCase` + `normalize('NFC')` и
 * разбиение по пробелам работают для кириллицы и латиницы одинаково, в отличие
 * от `\b`-регулярки, которая на кириллице не срабатывала.
 */

/** Похоже ли значение на хэш фразы (а не на старый открытый текст). */
export function isRecoveryPhraseHash(value: unknown): value is string {
  return isScryptHash(value);
}

/**
 * Совпадает ли ввод с сохранённой фразой.
 *
 * Старый формат (фраза открытым текстом) поддерживается только для чтения:
 * вызывающий код, убедившись в совпадении, обязан перезаписать значение
 * хэшем — это делает `verifyRecovery` в `server-auth.ts`.
 */
export function recoveryPhraseMatches(stored: unknown, input: string): boolean {
  const normalized = normalizePhrase(input);
  if (!normalized) return false;
  if (typeof stored !== 'string' || stored === '') return false;

  if (!isRecoveryPhraseHash(stored)) {
    // Legacy: сравнение канонических строк за постоянное время.
    return safeStringEqual(normalizePhrase(stored), normalized);
  }

  return verifySecretHash(stored, normalized);
}

/** Асинхронный хэш фразы для запросного пути. */
export function hashRecoveryPhraseAsync(phrase: string): Promise<string> {
  return hashSecretAsync(normalizePhrase(phrase));
}

/** Асинхронная проверка фразы для запросного пути. */
export async function recoveryPhraseMatchesAsync(
  stored: unknown,
  input: string,
): Promise<boolean> {
  const normalized = normalizePhrase(input);
  if (!normalized) return false;
  if (typeof stored !== 'string' || stored === '') return false;

  if (!isRecoveryPhraseHash(stored)) {
    return safeStringEqual(normalizePhrase(stored), normalized);
  }

  return verifySecretHashAsync(stored, normalized);
}
