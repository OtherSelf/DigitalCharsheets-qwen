/**
 * Политика recovery-фразы. Отдельный модуль без Node-криптографии: те же
 * правила проверяют клиентские формы и сервер, а `phrase.ts` тянет scrypt и
 * не должен попадать в браузерный бандл.
 *
 * Фраза — второй ключ к аккаунту (восстановление пароля), поэтому минимум
 * считается по энтропии, а не по «непустой строке»: либо шесть слов, либо
 * длинная парольная фраза. Нормализация совпадает с той, по которой фраза
 * хэшируется и сравнивается (регистр, NFC, пробелы).
 */

export const MIN_PHRASE_WORDS = 6;
export const MIN_PHRASE_LENGTH = 24;
export const MAX_PHRASE_LENGTH = 256;

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

/**
 * Сообщение об ошибке политики фразы или `null`, если фраза допустима.
 * Один текст на все точки установки — клиент показывает его как есть.
 */
export function phrasePolicyError(phrase: unknown): string | null {
  const normalized = normalizePhrase(phrase);
  if (normalized === '') {
    return 'Recovery phrase is required.';
  }
  if (normalized.length > MAX_PHRASE_LENGTH) {
    return `Recovery phrase must be at most ${MAX_PHRASE_LENGTH} characters.`;
  }
  const words = normalizePhraseWords(normalized);
  if (
    words.length < MIN_PHRASE_WORDS &&
    normalized.length < MIN_PHRASE_LENGTH
  ) {
    return `Recovery phrase must be at least ${MIN_PHRASE_WORDS} words or ${MIN_PHRASE_LENGTH} characters.`;
  }
  return null;
}
