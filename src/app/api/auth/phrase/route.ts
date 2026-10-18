import { NextResponse } from 'next/server';
import { setRecoveryPhrase, generateUserIdFromEmail } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, phrase } = body;

    if (!email || !phrase) {
      return NextResponse.json({ success: false, error: 'Email and phrase are required.' }, { status: 400 });
    }

    const userId = generateUserIdFromEmail(email.toLowerCase().trim());
    const success = setRecoveryPhrase(userId, phrase);

    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to update recovery phrase.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'An unexpected error occurred.' }, { status: 500 });
  }
}