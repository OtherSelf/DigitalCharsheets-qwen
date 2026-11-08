import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/server-auth';
import { sessionCookieHeader } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, displayName } = body;

    // Validate inputs
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username/Email and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 4 characters.' },
        { status: 400 }
      );
    }

    const result = authenticateUser(username, password, displayName);

    if (!result.success || !result.user) {
      return NextResponse.json(
        { success: false, error: result.error || 'Login failed.' },
        { status: 401 }
      );
    }

    // Сессия — подписанная httpOnly-cookie; дальше uid берётся только из неё.
    const response = NextResponse.json({
      success: true,
      isNewUser: result.isNewUser,
      user: result.user,
    });
    response.headers.set('Set-Cookie', sessionCookieHeader(result.user.uid));
    return response;

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
