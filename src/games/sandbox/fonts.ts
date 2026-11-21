import type { PluginFont } from '@/games/plugin-api';

/**
 * Шрифт демо-игры: `@font-face` в `sheet.module.css`, юникод-подмножества
 * latin + cyrillic. CSS-модуль листа грузит файлы только на листе; хосту
 * нужен непустой класс для `data-font-ready`.
 */
export const pluginFont: PluginFont = {
  className: 'sandbox-theme-font',
};
