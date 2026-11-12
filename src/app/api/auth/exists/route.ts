import { NextResponse } from 'next/server';

import {
  EXISTS_RATE_LIMIT,
  getAuthRateLimiter,
  rateLimitKey,
} from '@/lib/security/rate-limit';
import { accountExists } from '@/lib/server-auth';

/**
 * ─── LANDMARK: ACCOUNT EXISTS ───────────────────────────────────────────────
 * POST /api/auth/exists — есть ли аккаунт с таким логином.
 *
 * Нужен странице /login: до отправки пароля она проверяет существование
 * аккаунта и показывает «аккаунт не найден» вместо молчаливого 404. Логин
 * нормализуется (`Hero@Example.com` == `hero@example.com`).
 *
 * Это оракул перечисления, поэтому он под лимитером (20 запросов за 10 минут
 * на IP+логин) и отвечает `429` с `Retry-After`, когда лимит исчерпан.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username } = body;

    if (typeof username !== 'string' || username.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Username/Email is required.' },
        { status: 400 },
      );
    }

    const limiter = getAuthRateLimiter().check(
      rateLimitKey('exists', request, username),
      EXISTS_RATE_LIMIT,
    );
    if (!limiter.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many checks. Try again later.',
          reason: 'rate_limited',
        },
        {
          status: 429,
          headers: { 'Retry-After': String(limiter.retryAfterSeconds) },
        },
      );
    }

    return NextResponse.json({
      success: true,
      exists: accountExists(username),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}
