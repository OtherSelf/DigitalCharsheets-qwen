import { NextResponse } from 'next/server';
import { accountExists } from '@/lib/server-auth';

/**
 * ─── LANDMARK: ACCOUNT EXISTS ───────────────────────────────────────────────
 * POST /api/auth/exists — есть ли аккаунт с таким логином.
 *
 * Нужен странице /login: до отправки пароля она проверяет существование
 * аккаунта и показывает «аккаунт не найден» вместо молчаливого 404. Логин
 * нормализуется (`Hero@Example.com` == `hero@example.com`).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username } = body;

    if (typeof username !== 'string' || username.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Username/Email is required.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, exists: accountExists(username) });
  } catch {
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
