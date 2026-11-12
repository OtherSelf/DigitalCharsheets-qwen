import { NextResponse } from 'next/server';

import {
  getGameModule,
  getPluginManifest,
  listGameModules,
} from '@/games/registry';
import type { SystemId } from '@/games/types';
import { requireAdmin } from '@/lib/admin-auth';
import {
  getModuleStatus,
  isModuleEnabled,
  isModuleStatus,
  readGameCatalog,
  setModuleEnabled,
  setModuleStatus,
  setSiteTitle,
} from '@/lib/game-catalog';

/**
 * ─── LANDMARK: /api/admin/games ────────────────────────────────────────────
 * Управление видимостью редакций (только admin). GET — список из реестра с
 * текущими статусами; PUT — смена статуса редакции или заголовка сайта.
 *
 * Скрытие влияет на создание/меню, но не блокирует открытие существующих
 * листов владельцем.
 */
function catalogResponse() {
  const catalog = readGameCatalog();
  return {
    success: true as const,
    siteTitle: catalog.siteTitle ?? null,
    games: listGameModules().map((gameModule) => {
      const manifest = getPluginManifest(gameModule.id);
      return {
        id: gameModule.id,
        gameId: gameModule.gameId,
        nameKey: gameModule.nameKey,
        descriptionKey: gameModule.descriptionKey,
        defaultStatus: gameModule.defaultStatus,
        status: getModuleStatus(gameModule.id, catalog),
        enabled: isModuleEnabled(gameModule.id, catalog),
        // Метаданные плагина для админки (D4): версия, схема, зависимости.
        // tags хранятся, но в UI не выводятся (D15).
        version: manifest?.version ?? null,
        schemaVersion: manifest?.schemaVersion ?? gameModule.schemaVersion,
        tags: manifest?.tags ?? [],
        dependencies: manifest?.dependencies ?? null,
        conformance: manifest?.tests?.conformance ?? null,
        demo: Boolean(manifest?.demo),
      };
    }),
  };
}

export async function GET(request: Request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json(catalogResponse());
}

export async function PUT(request: Request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body.', reason: 'bad_request' },
      { status: 400 },
    );
  }

  try {
    if (body.siteTitle !== undefined) {
      if (body.siteTitle !== null && typeof body.siteTitle !== 'string') {
        return NextResponse.json(
          {
            success: false,
            error: 'siteTitle must be a string or null.',
            reason: 'bad_request',
          },
          { status: 400 },
        );
      }
      setSiteTitle(body.siteTitle as string | null);
    }

    if (body.systemId !== undefined && body.enabled !== undefined) {
      const systemId = body.systemId as SystemId;
      if (!systemId || !getGameModule(systemId)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Unknown game module.',
            reason: 'unknown_system',
          },
          { status: 400 },
        );
      }
      if (typeof body.enabled !== 'boolean') {
        return NextResponse.json(
          {
            success: false,
            error: 'enabled must be a boolean.',
            reason: 'bad_request',
          },
          { status: 400 },
        );
      }
      setModuleEnabled(systemId, body.enabled);
    }

    if (body.status !== undefined) {
      const systemId = body.systemId as SystemId;
      if (!systemId || !getGameModule(systemId)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Unknown game module.',
            reason: 'unknown_system',
          },
          { status: 400 },
        );
      }
      if (!isModuleStatus(body.status)) {
        return NextResponse.json(
          {
            success: false,
            error: 'status must be published, test or hidden.',
            reason: 'bad_status',
          },
          { status: 400 },
        );
      }
      setModuleStatus(systemId, body.status);
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save.',
        reason: 'write_failed',
      },
      { status: 500 },
    );
  }

  return NextResponse.json(catalogResponse());
}
