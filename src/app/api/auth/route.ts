import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, displayName } = body;
    
    // Validate inputs
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }
    
    if (password.length < 4) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 4 characters.' },
        { status: 400 }
      );
    }
    
    const result = authenticateUser(email, password, displayName);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      );
    }
    
    return NextResponse.json({
      success: true,
      isNewUser: result.isNewUser,
      user: result.user,
    });
    
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}