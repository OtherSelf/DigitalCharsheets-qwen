import { POST as updateRecoveryCredentials } from './update/route';

/**
 * ─── LANDMARK: RECOVER (ALIAS) ──────────────────────────────────────────────
 * POST /api/auth/recover — исторический эндпоинт «сменить пароль».
 *
 * Прежний контракт `{ username, word1..word3, newPassword }` убран: три слова
 * из листов не доказывают владение аккаунтом (их знает любой, кто видел лист),
 * а один логин не доказывает ничего. Теперь это алиас
 * `POST /api/auth/recover/update`: нужен одноразовый токен из
 * `POST /api/auth/recover/verify`, фраза необязательна.
 *
 * Путь сохранён, чтобы не ломать существующих клиентов молча: они получат
 * `401 invalid_token` и должны перейти на флоу с токеном.
 */
export async function POST(request: Request) {
  return updateRecoveryCredentials(request);
}
