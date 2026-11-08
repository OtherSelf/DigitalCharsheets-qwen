import { NextResponse } from 'next/server';
import { setRecoveryPhrase } from '@/lib/server-auth';
import { getSessionUid } from '@/lib/session';

/**
 * Установка recovery-фразы. Раньше сюда приходил `username` и uid вычислялся
 * из него — то есть фразу можно было поставить любому аккаунту, зная логин.
 * Теперь uid берётся из сессии: менять можно только свой профиль.
 */
export async function POST(request: Request) {
  try {
    const uid = getSessionUid(request);
    if (!uid) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { phrase } = body;

    if (!phrase) {
      return NextResponse.json({ success: false, error: 'Phrase is required.' }, { status: 400 });
    }

    const success = setRecoveryPhrase(uid, phrase);

    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to update recovery phrase.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
