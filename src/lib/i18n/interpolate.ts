import type { Language } from '@/lib/language';

/**
 * ─── LANDMARK: TRANSLATION FORMATTING ───────────────────────────────────────
 * Подстановка значений в переведённую строку и выбор формы по числу.
 *
 * Плейсхолдеры — `{name}`: имя латиницей/цифрами, без пробелов. Неизвестный
 * плейсхолдер остаётся в тексте как есть — это ловит тест, а не тихий пропуск
 * (иначе в UI уезжала бы строка без числа).
 *
 * Формы числа живут отдельными ключами `<key>_<form>` (`_one`, `_few`,
 * `_many`, `_other`): база и формы — разные строки в словаре, поэтому
 * плюрализация не требует ни шаблонного движка, ни склейки слов.
 */

export type TranslationVars = Record<string, string | number>;

const PLACEHOLDER = /\{([a-zA-Z0-9_]+)\}/g;

/** Подставить значения в строку. Без `vars` строка возвращается как есть. */
export function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Разбить строку по плейсхолдеру: нужен там, где значение должно быть
 * размечено (жирный шрифт), а не вставлено текстом.
 */
export function splitPlaceholder(
  template: string,
  name: string,
): [string, string] {
  const marker = `{${name}}`;
  const index = template.indexOf(marker);
  if (index < 0) return [template, ''];
  return [template.slice(0, index), template.slice(index + marker.length)];
}

/** Ключ формы числа для языка сайта: `one`, `few`, `many`, `other`. */
export function pluralForm(language: Language, count: number): string {
  return new Intl.PluralRules(language).select(count);
}
