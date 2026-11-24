import { cache } from 'react';
import type { Metadata } from 'next';

import { GameThemeScope } from '@/components/layout/game-theme-scope';
import { SharedLinkUnavailable } from '@/components/share/shared-link-unavailable';
import { SharedSheetView } from '@/components/sheets/shared-sheet-view';
import { resolveCharacterSystemId } from '@/games/character-system';
import { isModuleHostTheme, readGameCatalog } from '@/lib/game-catalog';
import { resolveSharedSheet } from '@/lib/shared-character';

/**
 * ─── LANDMARK: PUBLIC SHARE PAGE (/share/<token>) ───────────────────────────
 * Публичная страница без сессии: токен проверяется на каждый запрос, поэтому
 * отзыв/истечение действуют сразу. Любая проблема (нет токена, истёк,
 * отозван, владелец заблокирован, лист удалён) даёт один и тот же экран: он
 * не подтверждает, существовала ли ссылка.
 *
 * `notFound()` здесь не используется: у отозванной и несуществующей ссылки
 * должен быть один и тот же экран, который не подтверждает, существовал ли
 * токен. `notFound()` подменил бы его общим «страница не найдена» и потерял бы
 * объяснение причины. Поэтому сервер сразу рендерит понятный экран — без
 * данных листа и без uid.
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

  // Флаг «стили ядра» решаем на сервере: гостевая страница не должна
  // показывать тему плагина на первом кадре, если админ её отключил.
  const systemId = resolveCharacterSystemId(shared.character);
  const hostTheme = systemId
    ? await isModuleHostTheme(systemId, await readGameCatalog())
    : false;

  return (
    <GameThemeScope systemId={systemId} hostTheme={hostTheme}>
      <SharedSheetView
        character={shared.character}
        history={shared.history}
        ownerName={shared.ownerName}
      />
    </GameThemeScope>
  );
}
