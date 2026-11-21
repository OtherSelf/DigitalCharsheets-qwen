'use client';

import type { ReactNode } from 'react';

import { getPluginManifest } from '@/games/registry';
import type { SystemId } from '@/games/types';
import { usePluginFontClass } from '@/hooks/use-plugin-font';
import { gameThemeCss } from '@/lib/game-theme';
import { cn } from '@/lib/utils';

/**
 * Обёртка темы игры вокруг шапки и листа страницы персонажа (и публичной
 * страницы share). Плагин без темы и без шрифта не получает обёртку вовсе —
 * разметка и пиксели остаются прежними.
 *
 * Обёртка нужна и теме без токенов, но со шрифтом: она задаёт `data-system`,
 * по которому CSS-модуль плагина включает своё семейство. `data-font-ready`
 * появляется, когда ленивый чанк шрифта уже загружен и класс навешен; по нему
 * визуальные тесты понимают, что можно снимать (файлы шрифта при этом могут
 * ещё грузиться, поэтому хелпер дополнительно ждёт `document.fonts.ready`).
 *
 * `display: contents` нужен, чтобы обёртка не участвовала в раскладке:
 * родитель — flex-колонка страницы, и лишний блок сломал бы её высоту.
 * Свои CSS-переменные при этом наследуются детьми как обычно.
 */
export function GameThemeScope({
  systemId,
  children,
}: {
  systemId?: string;
  children: ReactNode;
}) {
  const theme = systemId
    ? getPluginManifest(systemId as SystemId)?.ui?.theme
    : undefined;
  const fontClass = usePluginFontClass(theme?.font ? systemId : undefined);
  const css = gameThemeCss(systemId, theme);
  // Шрифт без токенов всё равно требует обёртки: иначе не будет ни
  // `data-system` для CSS плагина, ни класса семейства.
  if (!css && !theme?.font) return <>{children}</>;

  return (
    <div
      className={cn('contents', fontClass)}
      data-system={systemId}
      data-font-expected={theme?.font ? '' : undefined}
      data-font-ready={fontClass ? '' : undefined}
    >
      {css ? <style>{css}</style> : null}
      {children}
    </div>
  );
}
