import { NextResponse } from 'next/server';

import { jsonError } from '@/lib/api/respond';
import { readAuthJson } from '@/lib/security/payload';
import {
  getAuthRateLimiter,
  rateLimitKey,
  RECOVERY_RATE_LIMIT,
} from '@/lib/security/rate-limit';
import { delay } from '@/lib/security/timing';
import { issueRecoveryToken } from '@/lib/security/tokens';
import { verifyRecovery } from '@/lib/server-auth';

/**
 * ─── LANDMARK: RECOVER VERIFY ───────────────────────────────────────────────
 * POST /api/auth/recover/verify — { username, recoveryPhrase }
 *
 * Проверяет recovery-фразу ЦЕЛИКОМ (состав и порядок слов) и при успехе
 * возвращает одноразовый токен `{ token, expiresAt }`. Сессионная cookie здесь
 * не ставится: доказана только фраза, а пароль и фразу меняет
 * `POST /api/auth/recover/update` по этому токену.
 *
 * Ответ на неуспех единый и с задержкой: по статусу и времени нельзя понять,
 * существует ли аккаунт и задана ли у него фраза. Попытки ограничены лимитом
 * (5 за 15 минут на IP+логин), при превышении — 429 с `Retry-After`.
 *
 * Статусы: 400 — не заполнены поля или проверка не прошла; 429 — лимит;
 * 500 — внутренняя ошибка.
 */
const FAILURE_DELAY_MS = 300;

export async function POST(request: Request) {
  try {
    const parsedBody = await readAuthJson(request);
    if (!parsedBody.ok) {
      return jsonError(parsedBody.status, parsedBody.error, parsedBody.reason);
    }
    const body = parsedBody.body;

    const username = typeof body?.username === 'string' ? body.username : '';
    // Старый клиент присылал `recoveryPhraseInput`; поле принимается, но
    // `words` из листов больше не участвуют в проверке.
    const phrase =
      typeof body?.recoveryPhrase === 'string'
        ? body.recoveryPhrase
        : typeof body?.recoveryPhraseInput === 'string'
          ? body.recoveryPhraseInput
          : '';

    // Успешная проверка сбрасывает счётчик: окно считает неудачные попытки,
    // а не любые.
    const verifyKey = rateLimitKey('recover-verify', request, username);
    const limiter = getAuthRateLimiter().check(verifyKey, RECOVERY_RATE_LIMIT);
    if (!limiter.allowed) {
      return jsonError(
        429,
        'Too many recovery attempts. Try again later.',
        'rate_limited',
        { 'Retry-After': String(limiter.retryAfterSeconds) },
      );
    }

    if (username.trim() === '' || phrase.trim() === '') {
      return jsonError(
        400,
        'Username and recovery phrase are required.',
        'invalid_input',
      );
    }

    const result = await verifyRecovery(username, phrase);
    if (!result.success || !result.user) {
      // В журнал — только причина, без логина и фразы.
      console.warn(
        `[security] recover/verify rejected: reason=${result.reason ?? 'unknown'}`,
      );
      await delay(FAILURE_DELAY_MS);
      return jsonError(400, 'Recovery verification failed.', 'recovery_failed');
    }

    getAuthRateLimiter().reset(verifyKey);

    const { token, expiresAt } = await issueRecoveryToken(result.user.uid);
    return NextResponse.json({ success: true, token, expiresAt });
  } catch (error) {
    console.error('Recovery verify error:', error);
    return jsonError(500, 'An unexpected error occurred.');
  }
}
