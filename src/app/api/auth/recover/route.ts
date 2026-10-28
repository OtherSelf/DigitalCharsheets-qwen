import { NextResponse } from 'next/server';
import { recoverPasswordWithUsernameAndWords } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, word1, word2, word3, newPassword } = body;

    if (!username || !word1 || !word2 || !word3 || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'All fields are required.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 4 characters.' },
        { status: 400 }
      );
    }

    const result = recoverPasswordWithUsernameAndWords(username, [word1, word2, word3], newPassword);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password successfully reset. You can now log in.'
    });
  } catch (error) {
    console.error('Recovery error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}