'use client';

/**
 * Шим совместимости: общий лист Dark Heresy переехал в
 * `src/games/dh-shared/sheet.tsx`. Старый путь сохраняется до этапа 7;
 * после разделения dh1/dh2 (этап 3) шим уйдёт вместе с переключателем
 * редакций.
 */
export { DarkHeresySheet } from '@/games/dh-shared/sheet';
