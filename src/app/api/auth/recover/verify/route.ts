import { NextResponse } from 'next/server';
import { verifyRecovery } from '@/lib/server-auth';
import { sessionCookieHeader } from '@/lib/session';

/**
 * Проверка владения аккаунтом по словам из листов + recovery-фразе.
 * При успехе сразу выдаём сессию: клиент после этого считается вошедшим и
 * может сменить пароль/фразу без повторного ввода старого пароля.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, word1, word2, word3, recoveryPhraseInput } = body;

    if (!username || !word1 || !word2 || !word3 || !recoveryPhraseInput) {
      return NextResponse.json({ success: false, error: 'All fields are required.' }, { status: 400 });
    }

    const result = verifyRecovery(username, [word1, word2, word3], recoveryPhraseInput);
    if (!result.success || !result.user) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    const response = NextResponse.json({ success: true, user: result.user });
    response.headers.set('Set-Cookie', sessionCookieHeader(result.user.uid));
    return response;
  } catch (error) {
    console.error('Recovery verify error:', error);
    return NextResponse.json({ success: false, error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
