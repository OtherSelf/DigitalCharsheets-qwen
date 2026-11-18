import type { UserRole } from './user-role';

/**
 * ─── LANDMARK: ADMIN API CONTRACTS ─────────────────────────────────────────
 * Общие типы ответов /api/admin/*. Вынесены отдельно, чтобы клиентская
 * страница /admin импортировала только типы и в её бандл не попадал
 * серверный код (fs, data-dir, локи).
 */

export interface AdminUserSummary {
  uid: string;
  username: string;
  displayName: string;
  role: UserRole;
  isBlocked: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  lastLoginAt: string | null;
  /** Сколько листов персонажей лежит в `users/<uid>/characters`. */
  characterCount: number;
  hasRecoveryPhrase: boolean;
  mustChangePassword: boolean;
}

export interface AdminUsersStats {
  totalUsers: number;
  admins: number;
  blocked: number;
  totalCharacters: number;
}

export interface AdminUsersResponse {
  success: boolean;
  users: AdminUserSummary[];
  stats: AdminUsersStats;
  error?: string;
}

export interface AdminCharacterSummary {
  id: string;
  name: string;
  /** Машинный id редакции (null — плагин не установлен). */
  systemId: string | null;
  gameSystem: string;
  /**
   * Лист как есть. Ядро не читает его поля: подпись строки собирает плагин
   * слотом `CardSummary`, поэтому админка не знает ни `level`, ни `rank`.
   */
  sheet: Record<string, unknown>;
  /** Время изменения файла листа (в самих листах нет общего updatedAt). */
  updatedAt: string | null;
}

export interface AdminCharactersResponse {
  success: boolean;
  uid: string;
  characters: AdminCharacterSummary[];
}

export interface AdminUserUpdatePatch {
  displayName?: unknown;
  username?: unknown;
  password?: unknown;
  role?: unknown;
  isBlocked?: unknown;
}

export type AdminActionReason =
  | 'invalid_input'
  | 'not_found'
  | 'username_taken'
  | 'last_admin'
  | 'self'
  | 'failed';

export interface AdminActionResponse {
  success: boolean;
  user?: AdminUserSummary;
  error?: string;
  reason?: AdminActionReason;
}
