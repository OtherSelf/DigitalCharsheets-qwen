import crypto from 'crypto';

/**
 * ─── LANDMARK: TIMING ────────────────────────────────────────────────────────
 * Сравнение секретов должно занимать одно и то же время независимо от того,
 * на каком байте значения разошлись: обычный `===` выходит на первом
 * несовпадении и по времени ответа выдаёт префикс хэша/фразы.
 *
 * `safeStringEqual` хэширует обе стороны перед сравнением. Это нужно не для
 * секретности, а чтобы уравнять длину: `timingSafeEqual` требует одинаковых
 * буферов, а бросать исключение на разной длине — это ещё и оракул длины.
 *
 * Задержка ответа при неудачной попытке входа (`delay`) — не украшение: она
 * сглаживает разницу между «аккаунта нет» и «пароль неверный» (SEC-9).
 */

/** Сравнить две строки за постоянное время. */
export function safeStringEqual(a: string, b: string): boolean {
  const left = crypto
    .createHash('sha256')
    .update(String(a ?? ''), 'utf8')
    .digest();
  const right = crypto
    .createHash('sha256')
    .update(String(b ?? ''), 'utf8')
    .digest();
  return crypto.timingSafeEqual(left, right);
}

/** Асинхронная пауза: роуты Next асинхронные, блокировать цикл нельзя. */
export function delay(ms: number): Promise<void> {
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
