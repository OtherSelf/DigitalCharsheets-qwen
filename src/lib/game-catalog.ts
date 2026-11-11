import fs from 'fs';
import path from 'path';

import {
  getGameModule,
  listGameModules,
  type AnyGameModule,
} from '@/games/registry';
import {
  MODULE_STATUSES,
  type ModuleStatus,
  type SystemId,
} from '@/games/types';

import { getGameCatalogFile, getSettingsDir } from './data-dir';
import { withDataLock } from './data-lock';
import { writeJsonAtomic } from './fs-atomic';
import type { UserRole } from './user-role';

/**
 * ─── LANDMARK: GAME CATALOG ────────────────────────────────────────────────
 * Runtime-видимость редакций поверх `defaultStatus` из модуля. Хранится в
 * `<data-dir>/settings/game-catalog.json`, переживает рестарт, пишется
 * атомарно под data-lock. Кроме статусов, каталог хранит необязательные
 * настройки сайта (пока — заголовок в шапке).
 *
 * Матрица:
 *   published → все;
 *   test      → tester + admin;
 *   hidden    → только admin.
 *
 * Скрытие влияет на создание и меню, но НЕ блокирует открытие существующих
 * листов владельцем — данные не прячем.
 */
export interface GameCatalog {
  version: 1;
  statuses: Record<string, ModuleStatus>;
  siteTitle?: string;
}

export interface ModuleAccessEntry {
  module: AnyGameModule;
  status: ModuleStatus;
  visible: boolean;
}

const CATALOG_VERSION = 1;
const MAX_SITE_TITLE_LENGTH = 80;

export function isModuleStatus(value: unknown): value is ModuleStatus {
  return (
    typeof value === 'string' &&
    (MODULE_STATUSES as readonly string[]).includes(value)
  );
}

export function readGameCatalog(): GameCatalog {
  const file = getGameCatalogFile();
  const fallback: GameCatalog = { version: CATALOG_VERSION, statuses: {} };

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;

  const record = raw as Record<string, unknown>;
  const statuses: Record<string, ModuleStatus> = {};
  const rawStatuses = record.statuses;
  if (
    rawStatuses &&
    typeof rawStatuses === 'object' &&
    !Array.isArray(rawStatuses)
  ) {
    for (const [systemId, status] of Object.entries(rawStatuses)) {
      if (isModuleStatus(status)) statuses[systemId] = status;
    }
  }

  const siteTitle =
    typeof record.siteTitle === 'string' && record.siteTitle.trim()
      ? record.siteTitle.trim().slice(0, MAX_SITE_TITLE_LENGTH)
      : undefined;

  return {
    version: CATALOG_VERSION,
    statuses,
    ...(siteTitle ? { siteTitle } : {}),
  };
}

export function getModuleStatus(
  systemId: SystemId,
  catalog: GameCatalog = readGameCatalog(),
): ModuleStatus {
  const override = catalog.statuses[systemId];
  if (isModuleStatus(override)) return override;
  return getGameModule(systemId)?.defaultStatus ?? 'hidden';
}

/** Матрица видимости; гость/обычный user — только published. */
export function canAccessModule(
  role: UserRole | undefined,
  systemId: SystemId,
  catalog: GameCatalog = readGameCatalog(),
): boolean {
  const status = getModuleStatus(systemId, catalog);
  if (status === 'published') return true;
  if (status === 'test') return role === 'tester' || role === 'admin';
  return role === 'admin';
}

export function listModuleAccess(
  role: UserRole | undefined,
  catalog: GameCatalog = readGameCatalog(),
): ModuleAccessEntry[] {
  return listGameModules().map((gameModule) => {
    const status = getModuleStatus(gameModule.id, catalog);
    return {
      module: gameModule,
      status,
      visible: canAccessModule(role, gameModule.id, catalog),
    };
  });
}

function writeGameCatalog(next: GameCatalog): void {
  const normalized: GameCatalog = {
    version: CATALOG_VERSION,
    statuses: next.statuses,
    ...(next.siteTitle ? { siteTitle: next.siteTitle } : {}),
  };
  withDataLock(() => {
    fs.mkdirSync(getSettingsDir(), { recursive: true });
    writeJsonAtomic(getGameCatalogFile(), normalized);
  });
}

export function setModuleStatus(
  systemId: SystemId,
  status: ModuleStatus,
): GameCatalog {
  if (!getGameModule(systemId)) {
    throw new Error(`Неизвестный модуль игры: ${systemId}`);
  }
  if (!isModuleStatus(status)) {
    throw new Error(`Неизвестный статус видимости: ${status}`);
  }
  const catalog = readGameCatalog();
  const next: GameCatalog = {
    ...catalog,
    statuses: { ...catalog.statuses, [systemId]: status },
  };
  writeGameCatalog(next);
  return next;
}

/** `null`/пустая строка — сбросить переопределение заголовка. */
export function setSiteTitle(title: string | null): GameCatalog {
  const catalog = readGameCatalog();
  const trimmed = (title ?? '').trim().slice(0, MAX_SITE_TITLE_LENGTH);
  const next: GameCatalog = {
    version: CATALOG_VERSION,
    statuses: catalog.statuses,
    ...(trimmed ? { siteTitle: trimmed } : {}),
  };
  writeGameCatalog(next);
  return next;
}

/** Полный путь файла — для документации/диагностики. */
export function gameCatalogPath(): string {
  return path.join(getSettingsDir(), 'game-catalog.json');
}
