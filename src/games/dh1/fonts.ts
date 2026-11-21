import type { PluginFont } from '@/games/plugin-api';

/**
 * Шрифт темы DH1 объявлен в `sheet.module.css` через `@font-face`: два
 * подмножества, кириллица ограничена `unicode-range`. Так файлы грузятся
 * вместе с CSS-модулем листа, а не со всеми страницами приложения:
 * `next/font/local` из лениво импортируемого модуля Turbopack поднимает в
 * общий CSS и preload каждой страницы (проверено на `/login` и `/demo`).
 *
 * Хосту нужен только непустой класс: он навешивает его на обёртку темы и
 * ставит `data-font-ready`; `font-family` выбирает CSS-модуль плагина.
 */
export const pluginFont: PluginFont = {
  className: 'dh1-theme-font',
};
