/**
 * Роль пользователя в приложении.
 *
 * ─── LANDMARK: USER_ROLE ────────────────────────────────────────────────────
 * Отдельный нейтральный модуль (без fs и прочего серверного кода), чтобы тип
 * могли импортировать и серверные helpers, и клиентские компоненты:
 *   • `'user'`   — обычный аккаунт: свои листы и /settings;
 *   • `'tester'` — как user, но видит редакции со статусом `test`;
 *                  доступа к /admin и admin API НЕТ;
 *   • `'admin'`  — доступ к /admin и административному API, видит все
 *                  редакции (включая `hidden`) и управляет статусами.
 *
 * Значение по умолчанию — `'user'`; `'tester'`/`'admin'` выдаются только явно.
 * Неизвестное значение нормализуется в `'user'` (fail-closed).
 */
export const USER_ROLES = ['user', 'tester', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return value === 'user' || value === 'tester' || value === 'admin';
}

export function normalizeUserRole(value: unknown): UserRole {
  return isUserRole(value) ? value : 'user';
}
