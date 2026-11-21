import type { PluginFont } from '@/games/plugin-api';

/**
 * Шрифт D&D 5e (T2): Forum в титуле, `font-headline` и крупных числах.
 * `@font-face` объявлен в `sheet.module.css` — файлы грузятся с листом, а не
 * со всеми страницами (next/font/local из ленивого модуля hoist-ится).
 * Хосту достаётся непустой класс для `data-font-ready`.
 */
export const pluginFont: PluginFont = {
  className: 'dnd5e-theme-font',
};
