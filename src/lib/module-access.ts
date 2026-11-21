import { resolveCharacterSystemId } from '@/games/character-system';
import type { SystemId } from '@/games/types';

import { canAccessModule, isModuleEnabled } from './game-catalog';
import { getSessionUid } from './session';
import { normalizeUserRole, type UserRole } from './user-role';
import { readStoredUser } from './user-schema';

/**
 * ─── LANDMARK: MODULE ACCESS ───────────────────────────────────────────────
 * Серверная проверка «доступна ли ролью редакция». UI-фильтрация — только
 * удобство: создание и импорт обязаны проверять это здесь.
 */
export interface RequestActor {
  uid: string | null;
  role: UserRole;
}

/** Актор запроса: гость (без валидной сессии) получает базовую роль. */
export async function getRequestActor(request: Request): Promise<RequestActor> {
  const uid = await getSessionUid(request);
  if (!uid) return { uid: null, role: 'user' };
  const stored = await readStoredUser(uid);
  if (!stored || stored.isBlocked) return { uid: null, role: 'user' };
  return { uid, role: normalizeUserRole(stored.role) };
}

/** `systemId` из тела запроса; legacy-клиенты — по gameSystem/edition. */
export function resolveRequestedSystemId(input: unknown): SystemId | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined;
  }
  return resolveCharacterSystemId(input as Record<string, string>);
}

export type ModuleAccessResult =
  | { ok: true; uid: string; role: UserRole; systemId: SystemId }
  | {
      ok: false;
      status: 400 | 401 | 403;
      error: string;
      reason:
        | 'unknown_system'
        | 'unauthorized'
        | 'module_forbidden'
        | 'module_disabled';
    };

export async function requireModuleAccess(
  request: Request,
  systemId: SystemId | undefined,
): Promise<ModuleAccessResult> {
  if (!systemId) {
    return {
      ok: false,
      status: 400,
      error: 'Не удалось определить игру/редакцию персонажа.',
      reason: 'unknown_system',
    };
  }

  const uid = await getSessionUid(request);
  if (!uid) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized.',
      reason: 'unauthorized',
    };
  }
  const stored = await readStoredUser(uid);
  if (!stored || stored.isBlocked) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized.',
      reason: 'unauthorized',
    };
  }

  const role = normalizeUserRole(stored.role);
  if (!(await canAccessModule(role, systemId))) {
    return {
      ok: false,
      status: 403,
      error: 'Эта редакция недоступна вашей роли.',
      reason: 'module_forbidden',
    };
  }

  // Отключённый плагин: создание недоступно даже админу (read-only).
  if (!(await isModuleEnabled(systemId))) {
    return {
      ok: false,
      status: 403,
      error: 'Эта игра отключена администратором.',
      reason: 'module_disabled',
    };
  }

  return { ok: true, uid, role, systemId };
}
