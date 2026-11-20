'use client';

import { useEffect, useState } from 'react';

import { getLoadedPluginFont, loadPluginFont } from '@/games/registry';
import type { SystemId } from '@/games/types';

/**
 * Класс шрифта темы для обёртки листа. `next/font/local` отдаёт класс,
 * который объявляет `--font-plugin`; плагин сам решает, где применить
 * `font-family: var(--font-plugin)`. Пока модуль грузится, класс пуст — это
 * нормально: шрифт не влияет на раскладку и появляется без сдвигов.
 */
export function usePluginFontClass(systemId?: string): string | undefined {
  const [fontClass, setFontClass] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!systemId) return;
    const id = systemId as SystemId;
    const loaded = getLoadedPluginFont(id);
    if (loaded) {
      setFontClass(loaded.variable ?? loaded.className);
      return;
    }
    let active = true;
    void loadPluginFont(id)
      ?.then((font) => {
        if (active) setFontClass(font.variable ?? font.className);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [systemId]);

  return fontClass;
}
