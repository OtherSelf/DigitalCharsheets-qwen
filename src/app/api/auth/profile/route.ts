import { NextResponse } from 'next/server';
import { updateUserProfile } from '@/lib/server-auth';
import { getSessionUid } from '@/lib/session';

/**
 * ─── LANDMARK: PROFILE (uid из сессии) ──────────────────────────────────────
 * uid больше не приходит в теле: он берётся из подписанной cookie. Смена
 * логина обновляет `user.json` и индекс, каталог с листами остаётся на месте.
 */
export async function PUT(request: Request) {
  try {
    const uid = getSessionUid(request);
    if (!uid) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { newUsername, newDisplayName, newPassword, newRecoveryPhrase } = body;

    if (!newUsername || !newDisplayName) {
      return NextResponse.json(
        { success: false, error: 'Username and display name are required.' },
        { status: 400 }
      );
    }

    const result = updateUserProfile(
      uid,
      newUsername,
      newDisplayName,
      newPassword,
      newRecoveryPhrase
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, user: result.user });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ success: false, error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
