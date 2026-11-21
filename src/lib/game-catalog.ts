import fs from 'fs/promises';
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
import { readThroughCache } from './read-cache';
import type { UserRole } from './user-role';

/**
 * ─── LANDMARK: GAME CATALOG ────────────────────────────────────────────────
 * Runtime-состояние плагинов поверх манифестов. Хранится в
 * `<data-dir>/settings/game-catalog.json`, переживает рестарт, пишется
 * атомарно под data-lock.
 *
 * Две независимые сущности (enabled и visibility — разные оси):
 *   • `visibility` — published / test / hidden: кто видит плагин в создании и
 *     меню (матрица ниже);
 *   • `enabled` — активен ли плагин: false = не показываем в создании/меню/
 *     демо, а существующие листы открываются только для чтения.
 *
 * v1 (`statuses`) читается и автоматически переезжает в v2
 * (`plugins: { id: { enabled, visibility } }`): `enabled=true`,
 * `visibility=status` (§5.9).
 */
export interface PluginCatalogEntry {
  enabled: boolean;
  visibility: ModuleStatus;
  /**
   * `true` — игра использует палитру и шрифт ядра вместо `ui.theme`.
   * Дефолт `false`: стили плагина включены.
   */
  useHostTheme?: boolean;
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
  const useHostTheme =
    typeof record.useHostTheme === 'boolean' ? record.useHostTheme : undefined;
  return {
    enabled,
    visibility: visibility ?? 'published',
    ...(useHostTheme !== undefined ? { useHostTheme } : {}),
  };
}

function parseGameCatalog(rawText: string): GameCatalog {
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    return emptyCatalog();
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyCatalog();
  }
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

export async function readGameCatalog(): Promise<GameCatalog> {
  return (
    (await readThroughCache<GameCatalog>(
      getGameCatalogFile(),
      parseGameCatalog,
    )) ?? emptyCatalog()
  );
}

/** Видимость плагина: runtime-переопределение или `defaultStatus` манифеста. */
export async function getModuleStatus(
  systemId: SystemId,
  catalog?: GameCatalog,
): Promise<ModuleStatus> {
  const current = catalog ?? (await readGameCatalog());
  const override = current.plugins[systemId]?.visibility;
  if (isModuleStatus(override)) return override;
  return getGameModule(systemId)?.defaultStatus ?? 'hidden';
}

/** Использовать ли для игры палитру и шрифт ядра вместо `ui.theme`. */
export async function isModuleHostTheme(
  systemId: SystemId,
  catalog?: GameCatalog,
): Promise<boolean> {
  const current = catalog ?? (await readGameCatalog());
  return current.plugins[systemId]?.useHostTheme ?? false;
}

/** Активен ли плагин (v1-каталог и отсутствие записи → enabled). */
export async function isModuleEnabled(
  systemId: SystemId,
  catalog?: GameCatalog,
): Promise<boolean> {
  const current = catalog ?? (await readGameCatalog());
  return current.plugins[systemId]?.enabled ?? true;
}

/** Матрица видимости; гость/обычный user — только published. */
export async function canAccessModule(
  role: UserRole | undefined,
  systemId: SystemId,
  catalog?: GameCatalog,
): Promise<boolean> {
  const status = await getModuleStatus(systemId, catalog);
  if (status === 'published') return true;
  if (status === 'test') return role === 'tester' || role === 'admin';
  return role === 'admin';
}

/**
 * Можно ли создавать листы плагина и показывать его в меню: плагин включён
 * и виден роли. Открытие существующих листов проверяется отдельно.
 */
export async function canCreateWithModule(
  role: UserRole | undefined,
  systemId: SystemId,
  catalog?: GameCatalog,
): Promise<boolean> {
  return (
    (await isModuleEnabled(systemId, catalog)) &&
    (await canAccessModule(role, systemId, catalog))
  );
}

export async function listModuleAccess(
  role: UserRole | undefined,
  catalog?: GameCatalog,
): Promise<ModuleAccessEntry[]> {
  const current = catalog ?? (await readGameCatalog());
  return Promise.all(
    listGameModules().map(async (gameModule) => {
      const status = await getModuleStatus(gameModule.id, current);
      const enabled = await isModuleEnabled(gameModule.id, current);
      return {
        module: gameModule,
        status,
        enabled,
        visible:
          enabled && (await canAccessModule(role, gameModule.id, current)),
      };
    }),
  );
}

async function writeGameCatalog(next: GameCatalog): Promise<void> {
  const normalized: GameCatalog = {
    version: CATALOG_VERSION,
    plugins: next.plugins,
    ...(next.siteTitle ? { siteTitle: next.siteTitle } : {}),
  };
  await withDataLock(async () => {
    await fs.mkdir(getSettingsDir(), { recursive: true });
    await writeJsonAtomic(getGameCatalogFile(), normalized);
  });
}

function withEntry(
  catalog: GameCatalog,
  systemId: SystemId,
  patch: Partial<PluginCatalogEntry>,
): GameCatalog {
  const entry = catalog.plugins[systemId];
  const current: PluginCatalogEntry = {
    enabled: entry?.enabled ?? true,
    visibility:
      entry?.visibility ?? getGameModule(systemId)?.defaultStatus ?? 'hidden',
    useHostTheme: entry?.useHostTheme ?? false,
  };
  return {
    ...catalog,
    plugins: { ...catalog.plugins, [systemId]: { ...current, ...patch } },
  };
}

export async function setModuleStatus(
  systemId: SystemId,
  status: ModuleStatus,
): Promise<GameCatalog> {
  if (!getGameModule(systemId)) {
    throw new Error(`Неизвестный модуль игры: ${systemId}`);
  }
  if (!isModuleStatus(status)) {
    throw new Error(`Неизвестный статус видимости: ${status}`);
  }
  const next = withEntry(await readGameCatalog(), systemId, {
    visibility: status,
  });
  await writeGameCatalog(next);
  return next;
}

/** Переключить игру на палитру и шрифт ядра (админка). */
export async function setModuleHostTheme(
  systemId: SystemId,
  useHostTheme: boolean,
): Promise<GameCatalog> {
  if (!getGameModule(systemId)) {
    throw new Error(`Неизвестный модуль игры: ${systemId}`);
  }
  const next = withEntry(await readGameCatalog(), systemId, {
    useHostTheme: Boolean(useHostTheme),
  });
  await writeGameCatalog(next);
  return next;
}

/** Включить/выключить плагин (создание и меню; листы — read-only). */
export async function setModuleEnabled(
  systemId: SystemId,
  enabled: boolean,
): Promise<GameCatalog> {
  if (!getGameModule(systemId)) {
    throw new Error(`Неизвестный модуль игры: ${systemId}`);
  }
  const next = withEntry(await readGameCatalog(), systemId, {
    enabled: Boolean(enabled),
  });
  await writeGameCatalog(next);
  return next;
}

/** `null`/пустая строка — сбросить переопределение заголовка. */
export async function setSiteTitle(title: string | null): Promise<GameCatalog> {
  const catalog = await readGameCatalog();
  const trimmed = (title ?? '').trim().slice(0, MAX_SITE_TITLE_LENGTH);
  const next: GameCatalog = {
    version: CATALOG_VERSION,
    plugins: catalog.plugins,
    ...(trimmed ? { siteTitle: trimmed } : {}),
  };
  await writeGameCatalog(next);
  return next;
}

/** Полный путь файла — для документации/диагностики. */
export function gameCatalogPath(): string {
  return path.join(getSettingsDir(), 'game-catalog.json');
}
