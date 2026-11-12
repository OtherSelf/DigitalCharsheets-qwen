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
 * Runtime-состояние плагинов поверх манифестов. Хранится в
 * `<data-dir>/settings/game-catalog.json`, переживает рестарт, пишется
 * атомарно под data-lock.
 *
 * Две независимые сущности (D16):
 *   • `visibility` — published / test / hidden: кто видит плагин в создании и
 *     меню (матрица ниже);
 *   • `enabled` — активен ли плагин: false = не показываем в создании/меню/
 *     демо, а существующие листы открываются только для чтения (D9).
 *
 * v1 (`statuses`) читается и автоматически переезжает в v2
 * (`plugins: { id: { enabled, visibility } }`): `enabled=true`,
 * `visibility=status` (§5.9).
 */
export interface PluginCatalogEntry {
  enabled: boolean;
  visibility: ModuleStatus;
}

export interface GameCatalog {
  version: 2;
  plugins: Record<string, PluginCatalogEntry>;
  siteTitle?: string;
}

export interface ModuleAccessEntry {
  module: AnyGameModule;
  /** Видимость по ролям. */
  status: ModuleStatus;
  /** Активность плагина (создание/меню/демо). */
  enabled: boolean;
  /** Виден роли и активен — можно создавать и показывать в меню. */
  visible: boolean;
}

export const CATALOG_VERSION = 2 as const;
const MAX_SITE_TITLE_LENGTH = 80;

export function isModuleStatus(value: unknown): value is ModuleStatus {
  return (
    typeof value === 'string' &&
    (MODULE_STATUSES as readonly string[]).includes(value)
  );
}

function emptyCatalog(): GameCatalog {
  return { version: CATALOG_VERSION, plugins: {} };
}

function parseEntry(value: unknown): PluginCatalogEntry | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const enabled = typeof record.enabled === 'boolean' ? record.enabled : true;
  const visibility = isModuleStatus(record.visibility)
    ? record.visibility
    : undefined;
  return visibility
    ? { enabled, visibility }
    : { enabled, visibility: 'published' };
}

export function readGameCatalog(): GameCatalog {
  const file = getGameCatalogFile();
  const fallback = emptyCatalog();

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
  const record = raw as Record<string, unknown>;

  const plugins: Record<string, PluginCatalogEntry> = {};

  // v2: plugins { id: { enabled, visibility } }
  const rawPlugins = record.plugins;
  if (
    rawPlugins &&
    typeof rawPlugins === 'object' &&
    !Array.isArray(rawPlugins)
  ) {
    for (const [systemId, value] of Object.entries(rawPlugins)) {
      const entry = parseEntry(value);
      if (entry) plugins[systemId] = entry;
    }
  }

  // v1 → v2: statuses { id: status } → enabled=true, visibility=status.
  const rawStatuses = record.statuses;
  if (
    rawStatuses &&
    typeof rawStatuses === 'object' &&
    !Array.isArray(rawStatuses)
  ) {
    for (const [systemId, status] of Object.entries(rawStatuses)) {
      if (!isModuleStatus(status)) continue;
      if (plugins[systemId]) continue; // v2-запись важнее
      plugins[systemId] = { enabled: true, visibility: status };
    }
  }

  const siteTitle =
    typeof record.siteTitle === 'string' && record.siteTitle.trim()
      ? record.siteTitle.trim().slice(0, MAX_SITE_TITLE_LENGTH)
      : undefined;

  return {
    version: CATALOG_VERSION,
    plugins,
    ...(siteTitle ? { siteTitle } : {}),
  };
}

/** Видимость плагина: runtime-переопределение или `defaultStatus` манифеста. */
export function getModuleStatus(
  systemId: SystemId,
  catalog: GameCatalog = readGameCatalog(),
): ModuleStatus {
  const override = catalog.plugins[systemId]?.visibility;
  if (isModuleStatus(override)) return override;
  return getGameModule(systemId)?.defaultStatus ?? 'hidden';
}

/** Активен ли плагин (v1-каталог и отсутствие записи → enabled). */
export function isModuleEnabled(
  systemId: SystemId,
  catalog: GameCatalog = readGameCatalog(),
): boolean {
  return catalog.plugins[systemId]?.enabled ?? true;
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

/**
 * Можно ли создавать листы плагина и показывать его в меню: плагин включён
 * и виден роли. Открытие существующих листов проверяется отдельно (D9).
 */
export function canCreateWithModule(
  role: UserRole | undefined,
  systemId: SystemId,
  catalog: GameCatalog = readGameCatalog(),
): boolean {
  return (
    isModuleEnabled(systemId, catalog) &&
    canAccessModule(role, systemId, catalog)
  );
}

export function listModuleAccess(
  role: UserRole | undefined,
  catalog: GameCatalog = readGameCatalog(),
): ModuleAccessEntry[] {
  return listGameModules().map((gameModule) => {
    const status = getModuleStatus(gameModule.id, catalog);
    const enabled = isModuleEnabled(gameModule.id, catalog);
    return {
      module: gameModule,
      status,
      enabled,
      visible: enabled && canAccessModule(role, gameModule.id, catalog),
    };
  });
}

function writeGameCatalog(next: GameCatalog): void {
  const normalized: GameCatalog = {
    version: CATALOG_VERSION,
    plugins: next.plugins,
    ...(next.siteTitle ? { siteTitle: next.siteTitle } : {}),
  };
  withDataLock(() => {
    fs.mkdirSync(getSettingsDir(), { recursive: true });
    writeJsonAtomic(getGameCatalogFile(), normalized);
  });
}

function withEntry(
  catalog: GameCatalog,
  systemId: SystemId,
  patch: Partial<PluginCatalogEntry>,
): GameCatalog {
  const current: PluginCatalogEntry = {
    enabled: isModuleEnabled(systemId, catalog),
    visibility: getModuleStatus(systemId, catalog),
  };
  return {
    ...catalog,
    plugins: { ...catalog.plugins, [systemId]: { ...current, ...patch } },
  };
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
  const next = withEntry(readGameCatalog(), systemId, { visibility: status });
  writeGameCatalog(next);
  return next;
}

/** Включить/выключить плагин (создание и меню; листы — read-only, D9). */
export function setModuleEnabled(
  systemId: SystemId,
  enabled: boolean,
): GameCatalog {
  if (!getGameModule(systemId)) {
    throw new Error(`Неизвестный модуль игры: ${systemId}`);
  }
  const next = withEntry(readGameCatalog(), systemId, {
    enabled: Boolean(enabled),
  });
  writeGameCatalog(next);
  return next;
}

/** `null`/пустая строка — сбросить переопределение заголовка. */
export function setSiteTitle(title: string | null): GameCatalog {
  const catalog = readGameCatalog();
  const trimmed = (title ?? '').trim().slice(0, MAX_SITE_TITLE_LENGTH);
  const next: GameCatalog = {
    version: CATALOG_VERSION,
    plugins: catalog.plugins,
    ...(trimmed ? { siteTitle: trimmed } : {}),
  };
  writeGameCatalog(next);
  return next;
}

/** Полный путь файла — для документации/диагностики. */
export function gameCatalogPath(): string {
  return path.join(getSettingsDir(), 'game-catalog.json');
}
