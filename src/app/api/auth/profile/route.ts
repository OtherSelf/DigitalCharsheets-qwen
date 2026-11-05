import { NextResponse } from 'next/server';
import { updateUserProfile } from '@/lib/server-auth';

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { currentUserId, newUsername, newDisplayName, newPassword, newRecoveryPhrase } = body;

    if (!currentUserId || !newUsername || !newDisplayName) {
      return NextResponse.json(
        { success: false, error: 'Current user ID, username, and display name are required.' },
        { status: 400 }
      );
    }

    const result = updateUserProfile(currentUserId, newUsername, newDisplayName, newPassword, newRecoveryPhrase);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, user: result.user });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ success: false, error: 'An unexpected error occurred.' }, { status: 500 });
  }
}