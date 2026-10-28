import { NextResponse } from 'next/server';
import { updateRecoveryCredentials } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, newPassword, newRecoveryPhrase } = body;

    if (!username || !newPassword || !newRecoveryPhrase) {
      return NextResponse.json({ success: false, error: 'All fields are required.' }, { status: 400 });
    }
    if (newPassword.length < 4) {
      return NextResponse.json({ success: false, error: 'New password must be at least 4 characters.' }, { status: 400 });
    }
    if (newRecoveryPhrase.trim().length < 5) {
      return NextResponse.json({ success: false, error: 'Recovery phrase must be at least 5 characters.' }, { status: 400 });
    }

    const result = updateRecoveryCredentials(username, newPassword, newRecoveryPhrase);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'An unexpected error occurred.' }, { status: 500 });
  }
}