import { NextResponse } from 'next/server';
import { verifyRecovery } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, word1, word2, word3, recoveryPhraseInput } = body;

    if (!email || !word1 || !word2 || !word3 || !recoveryPhraseInput) {
      return NextResponse.json({ success: false, error: 'All fields are required.' }, { status: 400 });
    }

    const result = verifyRecovery(email, [word1, word2, word3], recoveryPhraseInput);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, user: result.user });
  } catch (error) {
    console.error('Recovery verify error:', error);
    return NextResponse.json({ success: false, error: 'An unexpected error occurred.' }, { status: 500 });
  }
}