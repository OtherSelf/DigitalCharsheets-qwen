import { NextResponse } from 'next/server';

import { listCatalog } from '@/games/character-system';
import { listGameModules } from '@/games/registry';
import {
  canCreateWithModule,
  getModuleStatus,
  isModuleEnabled,
  isModuleHostTheme,
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
  const actor = await getRequestActor(request);
  const catalog = await readGameCatalog();

  const games = [];
  for (const { game, editions } of listCatalog()) {
    const visibleEditions = [];
    for (const gameModule of editions) {
      if (!(await canCreateWithModule(actor.role, gameModule.id, catalog))) {
        continue;
      }
      visibleEditions.push({
        id: gameModule.id,
        nameKey: gameModule.nameKey,
        descriptionKey: gameModule.descriptionKey,
        status: await getModuleStatus(gameModule.id, catalog),
        enabled: await isModuleEnabled(gameModule.id, catalog),
        useHostTheme: await isModuleHostTheme(gameModule.id, catalog),
      });
    }
    if (visibleEditions.length > 0) {
      games.push({
        id: game.id,
        nameKey: game.nameKey,
        descriptionKey: game.descriptionKey,
        editions: visibleEditions,
      });
    }
  }

  // Отключённые плагины нужны странице листа для read-only режима.
  const disabled = [];
  for (const gameModule of listGameModules()) {
    if (!(await isModuleEnabled(gameModule.id, catalog))) {
      disabled.push(gameModule.id);
    }
  }

  return NextResponse.json({
    success: true,
    role: actor.role,
    siteTitle: catalog.siteTitle ?? null,
    games,
    disabled,
  });
}
