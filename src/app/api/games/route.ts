import { NextResponse } from 'next/server';

import { listCatalog } from '@/games/character-system';
import {
  canAccessModule,
  getModuleStatus,
  readGameCatalog,
} from '@/lib/game-catalog';
import { getRequestActor } from '@/lib/module-access';

/**
 * ─── LANDMARK: GET /api/games ──────────────────────────────────────────────
 * Публичный каталог игр/редакций, отфильтрованный по видимости роли:
 *   • гость и user — только published;
 *   • tester      — published + test;
 *   • admin       — все, включая hidden.
 *
 * Используется мастером создания (/new) и шапкой сайта (переопределённый
 * заголовок из game-catalog.json). Секретов здесь нет: только ключи i18n.
 */
export async function GET(request: Request) {
  const actor = getRequestActor(request);
  const catalog = readGameCatalog();

  const games = listCatalog()
    .map(({ game, editions }) => ({
      id: game.id,
      nameKey: game.nameKey,
      descriptionKey: game.descriptionKey,
      editions: editions
        .filter((gameModule) =>
          canAccessModule(actor.role, gameModule.id, catalog),
        )
        .map((gameModule) => ({
          id: gameModule.id,
          nameKey: gameModule.nameKey,
          descriptionKey: gameModule.descriptionKey,
          status: getModuleStatus(gameModule.id, catalog),
        })),
    }))
    .filter((game) => game.editions.length > 0);

  return NextResponse.json({
    success: true,
    role: actor.role,
    siteTitle: catalog.siteTitle ?? null,
    games,
  });
}
