import { NextResponse } from 'next/server';
import { setRecoveryPhrase, generateUserId } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, phrase } = body;

    if (!username || !phrase) {
      return NextResponse.json({ success: false, error: 'Username and phrase are required.' }, { status: 400 });
    }

    const userId = generateUserId(username.toLowerCase().trim());
    const success = setRecoveryPhrase(userId, phrase);

    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to update recovery phrase.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'An unexpected error occurred.' }, { status: 500 });
  }
}