import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, verificationId, password } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const cleanedEmail = email.toLowerCase().trim();

    // 1. Admin login verification
    if (cleanedEmail === 'charlie@admin.com') {
      if (password === 'password123') {
        return NextResponse.json({
          success: true,
          user: {
            email: 'charlie@admin.com',
            role: 'admin',
            verified: true
          }
        });
      } else {
        return NextResponse.json({ error: 'Incorrect admin password' }, { status: 401 });
      }
    }

    // 2. Normal user login verification
    const user = db.prepare('SELECT * FROM soba_users WHERE email = ?').get(cleanedEmail);

    if (!user) {
      return NextResponse.json({ error: 'User not registered in the directory' }, { status: 404 });
    }

    if (user.verification_id !== verificationId) {
      return NextResponse.json({ error: 'Incorrect Personal ID' }, { status: 401 });
    }

    // Reset verification status to 0 for every login session
    db.prepare('UPDATE soba_users SET verified = 0 WHERE email = ?').run(cleanedEmail);

    // Get the verification link actively set by admin
    const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'verification_link'").get();
    const baseLink = setting ? setting.value : 'https://poh.soba.network/verify?sid=MTI2MDAwMnwzOTAwMDAz';

    const reqUrl = new URL(request.url);
    const callbackUrl = `${reqUrl.protocol}//${reqUrl.host}/api/soba/verify-callback?email=${encodeURIComponent(cleanedEmail)}`;

    let verificationUrl = baseLink;
    try {
      const parsedUrl = new URL(verificationUrl);
      parsedUrl.searchParams.delete('redirect_uri');
      verificationUrl = parsedUrl.toString();
    } catch (e) {
      verificationUrl = verificationUrl.split('&redirect_uri=')[0].split('?redirect_uri=')[0];
    }

    const separator = verificationUrl.includes('?') ? '&' : '?';
    verificationUrl = `${verificationUrl}${separator}redirect_uri=${encodeURIComponent(callbackUrl)}`;

    return NextResponse.json({
      success: true,
      requiresVerification: true,
      verificationUrl: verificationUrl
    });
  } catch (error) {
    console.error('Error logging in:', error);
    return NextResponse.json({ error: 'Internal server error during login' }, { status: 500 });
  }
}
