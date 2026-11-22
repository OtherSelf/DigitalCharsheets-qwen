import { NextResponse } from 'next/server';

import { getGameDefinition } from '@/games/games';
import {
  getGameModule,
  getPluginManifest,
  listGameModules,
} from '@/games/registry';
import type { SystemId } from '@/games/types';
import { requireAdmin } from '@/lib/admin-auth';
import { jsonError } from '@/lib/api/respond';
import {
  getModuleStatus,
  isModuleEnabled,
  isModuleHostTheme,
  isModuleStatus,
  readGameCatalog,
  setModuleEnabled,
  setModuleHostTheme,
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
async function catalogResponse() {
  const catalog = await readGameCatalog();
  const games = [];
  for (const gameModule of listGameModules()) {
    const manifest = getPluginManifest(gameModule.id);
    games.push({
      id: gameModule.id,
      gameId: gameModule.gameId,
      gameNameKey:
        getGameDefinition(gameModule.gameId)?.nameKey ?? gameModule.nameKey,
      nameKey: gameModule.nameKey,
      descriptionKey: gameModule.descriptionKey,
      defaultStatus: gameModule.defaultStatus,
      status: await getModuleStatus(gameModule.id, catalog),
      enabled: await isModuleEnabled(gameModule.id, catalog),
      useHostTheme: await isModuleHostTheme(gameModule.id, catalog),
      // Метаданные плагина для админки из манифеста: версия, схема, зависимости.
      // tags хранятся, но в UI не выводятся.
      version: manifest?.version ?? null,
      schemaVersion: manifest?.schemaVersion ?? gameModule.schemaVersion,
      tags: manifest?.tags ?? [],
      dependencies: manifest?.dependencies ?? null,
      conformance: manifest?.tests?.conformance ?? null,
      demo: Boolean(manifest?.demo),
    });
  }
  return {
    success: true as const,
    siteTitle: catalog.siteTitle ?? null,
    games,
  };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json(await catalogResponse());
}

export async function PUT(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonError(400, 'Invalid JSON body.', 'bad_request');
  }

  try {
    const usesSystem =
      body.enabled !== undefined ||
      body.useHostTheme !== undefined ||
      body.status !== undefined;
    let systemId: SystemId | undefined;
    if (usesSystem) {
      const raw = body.systemId;
      if (typeof raw !== 'string' || !getGameModule(raw as SystemId)) {
        return jsonError(400, 'Unknown game module.', 'unknown_system');
      }
      systemId = raw as SystemId;
    }

    if (body.siteTitle !== undefined) {
      if (body.siteTitle !== null && typeof body.siteTitle !== 'string') {
        return jsonError(
          400,
          'siteTitle must be a string or null.',
          'bad_request',
        );
      }
      await setSiteTitle(body.siteTitle as string | null);
    }

    if (body.enabled !== undefined) {
      if (typeof body.enabled !== 'boolean') {
        return jsonError(400, 'enabled must be a boolean.', 'bad_request');
      }
      await setModuleEnabled(systemId!, body.enabled);
    }

    if (body.useHostTheme !== undefined) {
      if (typeof body.useHostTheme !== 'boolean') {
        return jsonError(400, 'useHostTheme must be a boolean.', 'bad_request');
      }
      await setModuleHostTheme(systemId!, body.useHostTheme);
    }

    if (body.status !== undefined) {
      if (!isModuleStatus(body.status)) {
        return jsonError(
          400,
          'status must be published, test or hidden.',
          'bad_status',
        );
      }
      await setModuleStatus(systemId!, body.status);
    }
  } catch (error) {
    return jsonError(
      500,
      error instanceof Error ? error.message : 'Failed to save.',
      'write_failed',
    );
  }

  return NextResponse.json(await catalogResponse());
}
