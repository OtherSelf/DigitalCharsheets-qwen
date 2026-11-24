/**
 * ─── LANDMARK: SITE LANGUAGE ────────────────────────────────────────────────
 * Единственное место, где объявлены языки сайта, имя cookie и правила выбора
 * языка. Root layout читает язык на сервере, поэтому первый HTML уже несёт
 * правильные `<html lang>` и тексты; клиент пишет выбор в cookie, профиль
 * хранит его между устройствами.
 *
 * Порядок выбора: cookie → `Accept-Language` → `DEFAULT_LANGUAGE`. Профиль
 * читается не в layout (это стоило бы чтения `user.json` на каждый HTML), а
 * переносится в cookie при входе и при сохранении языка.
 *
 * Модуль общий для сервера и клиента: никаких `node:*` и `next/headers`.
 * Поэтому разбор `Cookie` здесь свой, а не из `session.ts`: тот тянет
 * `node:crypto` в клиентский бандл.
 */

export const SITE_LANGUAGES = ['en', 'ru'] as const;

/** Язык интерфейса сайта. */
export type Language = (typeof SITE_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';

/** Имя cookie с явным выбором языка (не HttpOnly: клиент пишет её сам). */
export const LANGUAGE_COOKIE = 'dcs_language';

/** Ключ прежнего хранилища: только миграция и зеркало для `storage`-событий. */
export const LANGUAGE_STORAGE_KEY = 'language';

/** Год: выбор языка меняется редко, а сброс cookie возвращает `Accept-Language`. */
const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Значение — ли это поддерживаемого языка (без нормализации региона). */
export function isLanguage(value: unknown): value is Language {
  return (
    typeof value === 'string' &&
    (SITE_LANGUAGES as readonly string[]).includes(value)
  );
}

/**
 * Привести строку к языку сайта: `ru`, `RU`, `ru-RU`, `en_US` → `Language`;
 * всё остальное (`de`, пустая строка) → `null`.
 */
export function parseLanguage(value: unknown): Language | null {
  if (typeof value !== 'string') return null;
  const primary = value.trim().toLowerCase().split(/[-_]/)[0];
  const found = SITE_LANGUAGES.find((language) => language === primary);
  return found ?? null;
}

/**
 * Язык из `Accept-Language` по q-весам.
 *
 * Регион не различаем: `ru-RU` и `ru` — один язык сайта. `*` пропускаем,
 * `q=0` означает «не предлагать». Если поддерживаемого языка нет, возвращаем
 * `null` — вызывающий подставит `DEFAULT_LANGUAGE`.
 */
function languageFromAcceptLanguage(
  header: string | null | undefined,
): Language | null {
  if (!header) return null;

  const preferred = header.split(',').map((chunk, index) => {
    const [tag = '', ...params] = chunk.split(';');
    let quality = 1;
    for (const param of params) {
      const [name, rawValue] = param.split('=');
      if (name?.trim().toLowerCase() !== 'q') continue;
      const parsed = Number.parseFloat(rawValue ?? '');
      if (Number.isFinite(parsed)) quality = parsed;
    }
    return { tag: tag.trim(), quality, index };
  });

  // Стабильная сортировка: при равных q порядок из заголовка сохраняется.
  preferred.sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const entry of preferred) {
    if (entry.quality <= 0 || entry.tag === '*') continue;
    const language = parseLanguage(entry.tag);
    if (language) return language;
  }
  return null;
}

export interface ResolveLanguageInput {
  /** Значение cookie `dcs_language`; `undefined`/`null` — cookie нет. */
  cookie?: string | null;
  /** Заголовок `Accept-Language` запроса. */
  acceptLanguage?: string | null;
}

/**
 * Язык для первого кадра: явный выбор пользователя важнее языка браузера.
 */
export function resolveLanguage({
  cookie,
  acceptLanguage,
}: ResolveLanguageInput): Language {
  return (
    parseLanguage(cookie) ??
    languageFromAcceptLanguage(acceptLanguage) ??
    DEFAULT_LANGUAGE
  );
}

/** Разобрать `document.cookie`/заголовок `Cookie` в поисках языка. */
function languageFromCookieHeader(
  header: string | null | undefined,
): Language | null {
  if (!header) return null;
  for (const pair of header.split(';')) {
    const index = pair.indexOf('=');
    if (index <= 0) continue;
    if (pair.slice(0, index).trim() !== LANGUAGE_COOKIE) continue;
    let value = pair.slice(index + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      // Битое процентное кодирование — сравниваем как есть.
    }
    return parseLanguage(value);
  }
  return null;
}

/** Язык из cookie браузера; `null` — cookie нет или значение не наше. */
export function readLanguageCookie(): Language | null {
  if (typeof document === 'undefined') return null;
  return languageFromCookieHeader(document.cookie);
}

/**
 * Записать выбор языка в cookie из браузера.
 *
 * `Secure` добавляется только на https: на http браузер отбросил бы такую
 * cookie молча, и выбор языка перестал бы запоминаться.
 */
export function persistLanguageCookie(language: Language): void {
  if (typeof document === 'undefined') return;
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? '; Secure'
      : '';
  document.cookie =
    `${LANGUAGE_COOKIE}=${language}; Path=/; ` +
    `Max-Age=${LANGUAGE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

function languageCookieSecureFlag(): boolean {
  if (process.env.DCS_COOKIE_INSECURE === '1') return false;
  if (process.env.DCS_COOKIE_SECURE === '1') return true;
  return process.env.NODE_ENV === 'production';
}

/**
 * `Set-Cookie` с выбором языка — для серверных ответов (вход, сохранение
 * настроек). Флаги согласованы с сессионной cookie, кроме HttpOnly: значение
 * читает и переключатель языка.
 */
export function languageCookieHeader(language: Language): string {
  const parts = [
    `${LANGUAGE_COOKIE}=${language}`,
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${LANGUAGE_COOKIE_MAX_AGE}`,
  ];
  if (languageCookieSecureFlag()) parts.push('Secure');
  return parts.join('; ');
}
