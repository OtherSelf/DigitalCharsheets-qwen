import type { PluginFont } from '@/games/plugin-api';

/**
 * Шрифт темы эталонного плагина. Настоящий плагин возвращает здесь результат
 * `next/font/local` (он отдаёт `variable`/`className` так же); фикстура живёт
 * вне сборки Next, поэтому обходится объектом той же формы — контракт
 * проверяет генератор, а не конкретный загрузчик шрифта.
 */
export const examplePluginFont: PluginFont = {
  variable: 'example-plugin-font',
};
