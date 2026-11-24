import type { Language } from '@/lib/language';
import type { UserRole } from '@/lib/user-role';

/**
 * Снимок профиля для UI. Это НЕ источник прав: `role`/`isBlocked` здесь нужны
 * только чтобы показать пункт «Админка» и предупреждение о стартовом пароле.
 * Сервер проверяет роль по `user.json` на каждом административном запросе,
 * поэтому подмена localStorage доступа не даёт.
 */
export interface LocalUser {
  uid: string;
  username: string;
  displayName: string;
  hasRecoveryPhrase: boolean; // Needed for UI to know if prompt is required
  role?: UserRole;
  isBlocked?: boolean;
  /** Пароль был сгенерирован при первом запуске — стоит сменить. */
  mustChangePassword?: boolean;
  /** TOTP включён и подтверждён кодом. */
  totpEnabled?: boolean;
  /** Выбранный язык профиля: снимок нужен, чтобы догнать cookie на новом устройстве. */
  language?: Language;
}

const STORAGE_KEYS = {
  USER: 'digital_charsheets_user',
  // Ключ остаётся, чтобы `clearLocalAccountData` убирал листы старых установок,
  // когда листы хранились в браузере.
  CHARACTERS: 'digital_charsheets_characters',
};

export function getLocalUser(): LocalUser | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(STORAGE_KEYS.USER);
  if (!userStr) return null;
  const user = JSON.parse(userStr);
  // Backward compatibility: map old 'email' field to 'username'
  if (user.email && !user.username) {
    user.username = user.email;
  }
  return user;
}

export function setLocalUser(user: LocalUser): void {
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
}

export function clearLocalUser(): void {
  localStorage.removeItem(STORAGE_KEYS.USER);
}

/**
 * Полная очистка локальных данных аккаунта: снимок профиля И локальные листы.
 *
 * Обычному выходу (`clearLocalUser`) этого не нужно — листы остаются на
 * сервере. А после удаления аккаунта localStorage не должен хранить даже
 * устаревший снимок: аккаунта больше нет, восстанавливать его «из кеша» нельзя.
 */
export function clearLocalAccountData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.CHARACTERS);
}
