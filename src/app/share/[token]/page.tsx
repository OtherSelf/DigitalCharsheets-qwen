import { cache } from 'react';
import type { Metadata } from 'next';

import { SharedLinkUnavailable } from '@/components/share/shared-link-unavailable';
import { SharedSheetView } from '@/components/sheets/shared-sheet-view';
import { resolveSharedSheet } from '@/lib/shared-character';

/**
 * ─── LANDMARK: PUBLIC SHARE PAGE (/share/<token>) ───────────────────────────
 * Публичная страница без сессии: токен проверяется на каждый запрос, поэтому
 * отзыв/истечение действуют сразу. Любая проблема (нет токена, истёк,
 * отозван, владелец заблокирован, лист удалён) даёт один и тот же экран: он
 * не подтверждает, существовала ли ссылка.
 *
 * `notFound()` здесь не используется: корневой `loading.tsx` отдаёт оболочку
 * потоком раньше, чем страница успевает бросить 404, и в ответе остаётся 200 с
 * клиентской заглушкой. Вместо этого сервер сразу рендерит понятный экран —
 * без данных листа и без uid. Семантика URL от этого не страдает: ни один
 * токен не раскрывает, был ли он когда-то валиден.
 *
 * Токен и данные листа не кэшируются: `force-dynamic` + заголовки
 * `no-store`/`X-Robots-Tag` отсекают CDN, поисковики и referrer-утечки.
 */
export const dynamic = 'force-dynamic';

const resolveShared = cache(async (token: string) => resolveSharedSheet(token));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const shared = await resolveShared(token);
  const character = shared?.character;

  return {
    title: character
      ? `${character.name} — Digital Character Sheets`
      : 'Shared character sheet — Digital Character Sheets',
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shared = await resolveShared(token);
  if (!shared) return <SharedLinkUnavailable />;

  return (
    <SharedSheetView character={shared.character} history={shared.history} />
  );
}
