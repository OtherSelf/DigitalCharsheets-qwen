import fs from 'fs';
import path from 'path';

import { resolveCharacterSystemId } from '@/games/character-system';

import {
  type AdminActionResponse,
  type AdminCharacterSummary,
  type AdminUsersStats,
  type AdminUserSummary,
  type AdminUserUpdatePatch,
} from './admin-types';
import { getCharactersDir, getUserDir } from './data-dir';
import { withDataLock } from './data-lock';
import { isUid, normalizeLogin } from './ids';
import { hashPassword, type StoredUser } from './server-auth';
import { resetWriteSeqGuard } from './server-storage';
import {
  readLoginIndexForUpdate,
  rebuildLoginIndex,
  resolveLogin,
  writeLoginIndex,
} from './user-index';
import { isUserRole, normalizeUserRole } from './user-role';
import {
  readStoredUser,
  scanUserRecords,
  USER_SCHEMA_VERSION,
  writeStoredUser,
} from './user-schema';

/**
 * ─── LANDMARK: ADMIN USER MANAGEMENT ────────────────────────────────────────
 * Слой операций админки над `users/<uid>`:
 *   • список пользователей + счётчики листов;
 *   • список листов конкретного пользователя (только чтение);
 *   • правка полей (логин, отображаемое имя, пароль, роль, блокировка);
 *   • удаление аккаунта.
 *
 * Всё, что меняет профиль/индекс, выполняется под `withDataLock` и
 * переиспользует ту же схему, что обычная авторизация. Инварианты:
 *   • нельзя удалить/заблокировать себя;
 *   • нельзя оставить систему без активного администратора (последний админ
 *     не удаляется, не блокируется и не разжаловывается);
 *   • логин остаётся уникальным ключом индекса.
 */

function countCharacterFiles(uid: string): number {
  try {
    return fs
      .readdirSync(getCharactersDir(uid))
      .filter((file) => file.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

function toSummary(user: StoredUser, characterCount: number): AdminUserSummary {
  return {
    uid: user.uid,
    username: user.username,
    displayName: user.displayName,
    role: normalizeUserRole(user.role),
    isBlocked: !!user.isBlocked,
    createdAt: user.createdAt ?? null,
    updatedAt: user.updatedAt ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
    characterCount,
    hasRecoveryPhrase: !!user.recoveryPhrase,
    mustChangePassword: !!user.mustChangePassword,
  };
}

/** Есть ли активный админ кроме `excludeUid`. */
function hasOtherActiveAdmin(excludeUid: string): boolean {
  return scanUserRecords().records.some(
    (record) =>
      record.uid !== excludeUid &&
      record.user.role === 'admin' &&
      !record.user.isBlocked,
  );
}

export interface AdminUsersList {
  users: AdminUserSummary[];
  stats: AdminUsersStats;
}

/** Список всех валидных профилей для таблицы админки. */
export function listUsersForAdmin(): AdminUsersList {
  const users = scanUserRecords()
    .records.map((record) =>
      toSummary(record.user, countCharacterFiles(record.uid)),
    )
    .sort((a, b) => {
      const byCreated = (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
      return byCreated !== 0 ? byCreated : a.username.localeCompare(b.username);
    });

  const stats: AdminUsersStats = {
    totalUsers: users.length,
    admins: users.filter((user) => user.role === 'admin' && !user.isBlocked)
      .length,
    blocked: users.filter((user) => user.isBlocked).length,
    totalCharacters: users.reduce((sum, user) => sum + user.characterCount, 0),
  };

  return { users, stats };
}

/**
 * Листы пользователя для диалога «список чарлистов». `null` — профиля нет.
 * Отдаём только безопасную сводку: без backstory/notes и прочего содержимого.
 */
export function listCharactersForAdmin(
  uid: string,
): AdminCharacterSummary[] | null {
  if (!readStoredUser(uid)) return null;

  let files: string[] = [];
  try {
    files = fs
      .readdirSync(getCharactersDir(uid))
      .filter((file) => file.endsWith('.json'));
  } catch {
    return [];
  }

  const characters: AdminCharacterSummary[] = [];
  for (const file of files) {
    const filePath = path.join(getCharactersDir(uid), file);
    try {
      const stat = fs.statSync(filePath);
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<
        string,
        unknown
      >;
      characters.push({
        id:
          typeof raw.id === 'string' && raw.id
            ? raw.id
            : file.replace(/\.json$/, ''),
        name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : '—',
        systemId:
          resolveCharacterSystemId(raw as Record<string, string>) ?? null,
        gameSystem:
          typeof raw.gameSystem === 'string' ? raw.gameSystem : 'Unknown',
        characterClass:
          typeof raw.characterClass === 'string' ? raw.characterClass : '',
        level:
          typeof raw.level === 'number' && Number.isFinite(raw.level)
            ? raw.level
            : null,
        rank: typeof raw.rank === 'string' && raw.rank ? raw.rank : null,
        updatedAt: stat.mtime.toISOString(),
      });
    } catch {
      // Битый лист не должен ломать весь список — просто пропускаем.
    }
  }

  return characters.sort((a, b) =>
    (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
  );
}

const invalid = (error: string): AdminActionResponse => ({
  success: false,
  error,
  reason: 'invalid_input',
});

/**
 * Правка полей пользователя администратором.
 *
 * `patch` приходит из JSON, поэтому каждое поле проверяется на тип. Пустой
 * `password` означает «не менять» (клиент не отправляет его без ввода), а
 * `role`/`isBlocked` — явные действия с проверкой инвариантов.
 */
export function updateUserByAdmin(
  actorUid: string,
  targetUid: string,
  patch: AdminUserUpdatePatch,
): AdminActionResponse {
  if (!isUid(targetUid)) {
    return { success: false, error: 'User not found.', reason: 'not_found' };
  }
  if (!patch || typeof patch !== 'object') {
    return invalid('Nothing to update.');
  }

  try {
    return withDataLock(() => {
      const stored = readStoredUser(targetUid);
      if (!stored) {
        return {
          success: false,
          error: 'User not found.',
          reason: 'not_found',
        } as AdminActionResponse;
      }

      const updated: StoredUser = { ...stored };
      let renamedFrom: string | null = null;
      let hasChanges = false;

      if (patch.displayName !== undefined) {
        if (
          typeof patch.displayName !== 'string' ||
          !patch.displayName.trim()
        ) {
          return invalid('Display name is required.');
        }
        updated.displayName = patch.displayName.trim();
        hasChanges = true;
      }

      if (patch.username !== undefined) {
        if (typeof patch.username !== 'string') {
          return invalid('Username is required.');
        }
        const login = normalizeLogin(patch.username);
        if (!login) return invalid('Username is required.');

        const oldLogin = normalizeLogin(stored.username);
        if (login !== oldLogin) {
          const owner = resolveLogin(login);
          if (owner && owner !== targetUid) {
            return {
              success: false,
              error: 'This login is already taken.',
              reason: 'username_taken',
            } as AdminActionResponse;
          }
          renamedFrom = oldLogin;
          updated.username = login;
          hasChanges = true;
        }
      }

      if (patch.password !== undefined) {
        if (typeof patch.password !== 'string' || patch.password.length < 4) {
          return invalid('Password must be at least 4 characters.');
        }
        updated.passwordHash = hashPassword(patch.password);
        // Стартовый пароль сменён — предупреждение больше не актуально.
        delete updated.mustChangePassword;
        hasChanges = true;
      }

      if (patch.role !== undefined) {
        if (!isUserRole(patch.role)) {
          return invalid('Unknown role.');
        }
        // Снять с себя админа нельзя (в т.ч. переведя себя в tester).
        if (targetUid === actorUid && patch.role !== 'admin') {
          return {
            success: false,
            error: 'You cannot remove your own administrator role.',
            reason: 'self',
          } as AdminActionResponse;
        }
        if (
          patch.role !== 'admin' &&
          stored.role === 'admin' &&
          !hasOtherActiveAdmin(targetUid)
        ) {
          return {
            success: false,
            error: 'Cannot demote the last active administrator.',
            reason: 'last_admin',
          } as AdminActionResponse;
        }
        updated.role = patch.role;
        hasChanges = true;
      }

      if (patch.isBlocked !== undefined) {
        if (typeof patch.isBlocked !== 'boolean') {
          return invalid('Blocked must be a boolean.');
        }
        if (patch.isBlocked && targetUid === actorUid) {
          return {
            success: false,
            error: 'You cannot block your own account.',
            reason: 'self',
          } as AdminActionResponse;
        }
        if (
          patch.isBlocked &&
          stored.role === 'admin' &&
          !hasOtherActiveAdmin(targetUid)
        ) {
          return {
            success: false,
            error: 'Cannot block the last active administrator.',
            reason: 'last_admin',
          } as AdminActionResponse;
        }
        updated.isBlocked = patch.isBlocked;
        if (patch.isBlocked) {
          updated.blockedAt = new Date().toISOString();
        } else {
          delete updated.blockedAt;
        }
        hasChanges = true;
      }

      if (!hasChanges) return invalid('Nothing to update.');

      updated.schemaVersion = USER_SCHEMA_VERSION;
      updated.updatedAt = new Date().toISOString();

      // user.json — источник истины; индекс правим после него.
      writeStoredUser(targetUid, updated);

      if (renamedFrom !== null) {
        const index = readLoginIndexForUpdate();
        delete index.logins[renamedFrom];
        index.logins[updated.username] = targetUid;
        try {
          writeLoginIndex(index);
        } catch (error) {
          console.error(
            'Failed to update login index after admin rename:',
            error,
          );
          rebuildLoginIndex();
        }
      }

      return {
        success: true,
        user: toSummary(updated, countCharacterFiles(targetUid)),
      } as AdminActionResponse;
    });
  } catch (error) {
    console.error('Admin user update failed:', error);
    return {
      success: false,
      error: 'Failed to update the user.',
      reason: 'failed',
    };
  }
}

/** Удалить чужой аккаунт вместе с листами и записью в индексе. */
export function deleteUserByAdmin(
  actorUid: string,
  targetUid: string,
): AdminActionResponse {
  if (targetUid === actorUid) {
    return {
      success: false,
      error: 'Use your profile settings to delete your own account.',
      reason: 'self',
    };
  }
  if (!isUid(targetUid)) {
    return { success: false, error: 'User not found.', reason: 'not_found' };
  }

  try {
    return withDataLock(() => {
      const stored = readStoredUser(targetUid);
      if (!stored) {
        return {
          success: false,
          error: 'User not found.',
          reason: 'not_found',
        } as AdminActionResponse;
      }
      if (stored.role === 'admin' && !hasOtherActiveAdmin(targetUid)) {
        return {
          success: false,
          error: 'Cannot delete the last active administrator.',
          reason: 'last_admin',
        } as AdminActionResponse;
      }

      const index = readLoginIndexForUpdate();
      for (const [login, owner] of Object.entries(index.logins)) {
        if (owner === targetUid) delete index.logins[login];
      }

      fs.rmSync(getUserDir(targetUid), { recursive: true, force: true });

      try {
        writeLoginIndex(index);
      } catch (error) {
        console.error(
          'Failed to update login index after admin delete:',
          error,
        );
        rebuildLoginIndex();
      }
      resetWriteSeqGuard(targetUid);

      return { success: true } as AdminActionResponse;
    });
  } catch (error) {
    console.error('Admin user deletion failed:', error);
    return {
      success: false,
      error: 'Failed to delete the user.',
      reason: 'failed',
    };
  }
}
