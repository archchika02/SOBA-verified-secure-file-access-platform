import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { verified: false, error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    // Query our simulated SOBA registry in SQLite
    const user = db.prepare('SELECT * FROM soba_users WHERE email = ?').get(email);

    if (user) {
      return NextResponse.json({
        verified: user.verified === 1,
        email: user.email,
        role: user.role
      });
    }

    return NextResponse.json({
      verified: false,
      email: email,
      role: 'guest',
      error: 'User not found in SOBA registry'
    });
  } catch (error) {
    console.error('Error in SOBA verify API:', error);
    return NextResponse.json(
      { verified: false, error: 'Internal server error during verification' },
      { status: 500 }
    );
  }
}

// POST: Simulate completing the FaceID verification
export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    // Verify user in database
    const result = db.prepare('UPDATE soba_users SET verified = 1 WHERE email = ?').run(email.toLowerCase().trim());
    
    if (result.changes === 0) {
      return NextResponse.json({ error: 'User not found in directory' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `User ${email} successfully verified via FaceID.`
    });
  } catch (error) {
    console.error('Error verifying user:', error);
    return NextResponse.json({ error: 'Failed to verify user' }, { status: 500 });
  }
}

