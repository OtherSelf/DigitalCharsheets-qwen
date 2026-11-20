'use client';

import type { ReactNode } from 'react';

import { getPluginManifest } from '@/games/registry';
import type { SystemId } from '@/games/types';
import { usePluginFontClass } from '@/hooks/use-plugin-font';
import { gameThemeCss } from '@/lib/game-theme';
import { cn } from '@/lib/utils';

/**
 * Обёртка темы игры вокруг шапки и листа страницы персонажа (и публичной
 * страницы share). Плагин без темы не получает обёртку вовсе — разметка и
 * пиксели остаются прежними.
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
  if (!css) return <>{children}</>;

  return (
    <div className={cn('contents', fontClass)} data-system={systemId}>
      <style>{css}</style>
      {children}
    </div>
  );
}
