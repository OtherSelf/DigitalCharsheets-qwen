import { hashSecret, isScryptHash, verifySecretHash } from './scrypt';
import { safeStringEqual } from './timing';

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

/** Слова фразы в каноническом виде. */
export function normalizePhraseWords(phrase: unknown): string[] {
  if (typeof phrase !== 'string') return [];
  return phrase
    .toLowerCase()
    .normalize('NFC')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/** Каноническая строка фразы: слова через один пробел. */
export function normalizePhrase(phrase: unknown): string {
  return normalizePhraseWords(phrase).join(' ');
}

/** Похоже ли значение на хэш фразы (а не на старый открытый текст). */
export function isRecoveryPhraseHash(value: unknown): value is string {
  return isScryptHash(value);
}

/** Захэшировать фразу. Формат версионирован: параметры лежат в строке. */
export function hashRecoveryPhrase(phrase: string): string {
  return hashSecret(normalizePhrase(phrase));
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
