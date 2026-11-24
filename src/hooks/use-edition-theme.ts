'use client';

import { useEffect, useState } from 'react';

/**
 * ─── LANDMARK: EDITION THEME FLAGS ────────────────────────────────────────
 * Флаг «стили ядра» по редакциям из `/api/games` (та же админская настройка,
 * что у листа: `edition.useHostTheme`). Пока ответа нет, карточки рисуются
 * нейтрально — иначе первый кадр показывал бы цвет игры и переключался.
 *
 * Запрос один на документ: модульный промис делится между всеми карточками и
 * другими потребителями флагов.
 */

export type EditionThemeFlags = Readonly<Record<string, boolean>>;

let pending: Promise<EditionThemeFlags> | null = null;

function loadFlags(): Promise<EditionThemeFlags> {
  if (!pending) {
    pending = fetch('/api/games', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { games?: { editions?: unknown }[] } | null) => {
        const flags: Record<string, boolean> = {};
        for (const game of data?.games ?? []) {
          const editions = game.editions;
          if (!Array.isArray(editions)) continue;
          for (const edition of editions as {
            id?: string;
            useHostTheme?: boolean;
          }[]) {
            if (typeof edition?.id === 'string') {
              flags[edition.id] = Boolean(edition.useHostTheme);
            }
          }
        }
        return flags;
      })
      .catch(() => ({}));
  }
  return pending;
}

/** `null` — ответа ещё нет; `{}` — флагов нет (тема плагина включена). */
export function useEditionThemeFlags(): EditionThemeFlags | null {
  const [flags, setFlags] = useState<EditionThemeFlags | null>(null);

  useEffect(() => {
    let active = true;
    void loadFlags().then((value) => {
      if (active) setFlags(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return flags;
}
