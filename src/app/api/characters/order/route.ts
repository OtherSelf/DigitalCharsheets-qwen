import { NextResponse } from 'next/server';

import { jsonError, unauthorized } from '@/lib/api/respond';
import {
  CHARACTER_ORDER_MAX,
  normalizeCharacterOrder,
} from '@/lib/character-order';
import { readAuthJson } from '@/lib/security/payload';
import {
  AUTH_MUTATION_RATE_LIMIT,
  getAuthRateLimiter,
  rateLimitKey,
} from '@/lib/security/rate-limit';
import { updateUserCharacterOrder } from '@/lib/server-auth';
import { getSessionUid } from '@/lib/session';

/**
 * ─── LANDMARK: CHARACTER ORDER API (/api/characters/order) ─────────────────
 * Пользовательский порядок карточек. uid — только из сессии; тело
 * `{ order: string[] }`, где элементы — id листов. Порядок пишется в профиль
 * (`user.json#characterOrder`), листы и экспорт не меняются.
 *
 * Неизвестные id не отвергаются: карточку могли удалить в другой вкладке.
 * Лимит длины и фильтр символов — `normalizeCharacterOrder`. Лимитер общий с
 * мутациями профиля: перетаскивание — не повод нагружать диск.
 */
export async function PUT(request: Request) {
  try {
    const uid = await getSessionUid(request);
    if (!uid) return unauthorized();

    const limiter = getAuthRateLimiter().check(
      rateLimitKey('characters-order', request, uid),
      AUTH_MUTATION_RATE_LIMIT,
    );
    if (!limiter.allowed) {
      return jsonError(
        429,
        'Too many attempts. Try again later.',
        'rate_limited',
        { 'Retry-After': String(limiter.retryAfterSeconds) },
      );
    }

    const parsedBody = await readAuthJson(request);
    if (!parsedBody.ok) {
      return jsonError(parsedBody.status, parsedBody.error, parsedBody.reason);
    }

    const { order } = parsedBody.body as { order?: unknown };
    const normalized = normalizeCharacterOrder(order);
    if (!normalized) {
      return jsonError(
        400,
        `Order must be an array of character ids (max ${CHARACTER_ORDER_MAX}).`,
        'invalid_order',
      );
    }

    const updated = await updateUserCharacterOrder(uid, normalized);
    if (!updated) {
      return jsonError(404, 'User not found.', 'not_found');
    }

    return NextResponse.json({
      success: true,
      order: updated.characterOrder ?? [],
    });
  } catch (error) {
    return jsonError(500, 'An unexpected error occurred.');
  }
}
