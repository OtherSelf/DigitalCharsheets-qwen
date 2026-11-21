import type { PluginFont } from '@/games/plugin-api';

/**
 * Шрифт темы DH2 объявлен в `sheet.module.css` через `@font-face`:
 * Cormorant SC с кириллическим подмножеством по `unicode-range`. CSS-модуль
 * листа грузит файлы только на листе; `next/font/local` из ленивого модуля
 * Turbopack поднимает в общий CSS и preload каждой страницы.
 *
 * Хосту нужен только непустой класс: он навешивает его на обёртку темы и
 * ставит `data-font-ready`; `font-family` выбирает CSS-модуль плагина.
 */
export const pluginFont: PluginFont = {
  className: 'dh2-theme-font',
};
