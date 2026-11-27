import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * ─── LANDMARK: CN_FONT_SIZES ────────────────────────────────────────────────
 * Служебные кегли листов (`text-8px`…`text-15px`, см. `@theme` в `globals.css`)
 * `tailwind-merge` не знает: без явной записи он считает `text-10px` цветом и
 * не выкидывает его при конфликте с `text-xs`. Тогда в `cn('text-xs',
 * compact && 'text-10px')` оба класса остаются, и побеждает тот, что ниже в
 * таблице стилей, а не последний в вызове. Регистрируем их как размеры шрифта,
 * чтобы `cn` снова работал как «последний класс побеждает».
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['8px', '9px', '10px', '11px', '15px'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
