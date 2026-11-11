import { resolveCharacterSystemId } from '@/games/character-system';
import type { SystemId } from '@/games/types';

import { canAccessModule } from './game-catalog';
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
export function getRequestActor(request: Request): RequestActor {
  const uid = getSessionUid(request);
  if (!uid) return { uid: null, role: 'user' };
  const stored = readStoredUser(uid);
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
      reason: 'unknown_system' | 'unauthorized' | 'module_forbidden';
    };

export function requireModuleAccess(
  request: Request,
  systemId: SystemId | undefined,
): ModuleAccessResult {
  if (!systemId) {
    return {
      ok: false,
      status: 400,
      error: 'Не удалось определить игру/редакцию персонажа.',
      reason: 'unknown_system',
    };
  }

  const uid = getSessionUid(request);
  if (!uid) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized.',
      reason: 'unauthorized',
    };
  }
  const stored = readStoredUser(uid);
  if (!stored || stored.isBlocked) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized.',
      reason: 'unauthorized',
    };
  }

  const role = normalizeUserRole(stored.role);
  if (!canAccessModule(role, systemId)) {
    return {
      ok: false,
      status: 403,
      error: 'Эта редакция недоступна вашей роли.',
      reason: 'module_forbidden',
    };
  }

  return { ok: true, uid, role, systemId };
}
