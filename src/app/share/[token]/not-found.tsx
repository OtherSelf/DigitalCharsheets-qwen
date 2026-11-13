'use client';

import { SharedLinkUnavailable } from '@/components/share/shared-link-unavailable';

/**
 * Сюда попадают только настоящие 404 App Router (например, неизвестный
 * вложенный путь). Недействительный токен рендерит тот же экран из page.tsx:
 * см. объяснение про стриминг и статус в `page.tsx`.
 */
export default function SharedLinkNotFound() {
  return <SharedLinkUnavailable />;
}
