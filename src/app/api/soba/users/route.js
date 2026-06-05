import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import { sendVerificationEmail } from '../../../../lib/email';

// GET: List all simulated SOBA users
export async function GET() {
  try {
    const users = db.prepare('SELECT * FROM soba_users ORDER BY email ASC').all();
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching SOBA users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST: Provision/Allocate a new user and role in the SOBA registry
export async function POST(request) {
  try {
    // 1. Authorize: only charlie@admin.com can allocate roles in the backend
    const requesterEmail = request.headers.get('x-soba-session-email') || '';
    if (requesterEmail.toLowerCase().trim() !== 'charlie@admin.com') {
      return NextResponse.json({
        error: 'Access Denied: Only the admin role (charlie@admin.com) can allocate roles.'
      }, { status: 403 });
    }

    const body = await request.json();
    const { email, role, verificationId, verificationLink: customVerificationLink } = body;

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 });
    }

    if (!['viewer', 'editor', 'admin'].includes(role.toLowerCase())) {
      return NextResponse.json({ error: 'Invalid role. Must be viewer, editor, or admin' }, { status: 400 });
    }

    const finalVerificationId = verificationId || 'None';

    const targetEmail = email.toLowerCase().trim();
    const reqUrl = new URL(request.url);
    const callbackUrl = `${reqUrl.protocol}//${reqUrl.host}/api/soba/verify-callback?email=${encodeURIComponent(targetEmail)}`;

    let verificationLink = customVerificationLink || 'https://poh.soba.network/verify?sid=MTI2MDAwMnwzOTAwMDAz';

    try {
      const parsedUrl = new URL(verificationLink);
      parsedUrl.searchParams.delete('redirect_uri');
      verificationLink = parsedUrl.toString();
    } catch (e) {
      verificationLink = verificationLink.split('&redirect_uri=')[0].split('?redirect_uri=')[0];
    }

    const separator = verificationLink.includes('?') ? '&' : '?';
    verificationLink = `${verificationLink}${separator}redirect_uri=${encodeURIComponent(callbackUrl)}`;

    // Insert or update with verified = 0 (requiring verification link flow)
    db.prepare(`
      INSERT INTO soba_users (email, role, verified, verification_id, verification_link)
      VALUES (?, ?, 0, ?, ?)
      ON CONFLICT(email) DO UPDATE SET role = excluded.role, verified = 0, verification_id = excluded.verification_id, verification_link = excluded.verification_link
    `).run(targetEmail, role.toLowerCase().trim(), finalVerificationId, verificationLink);

    // Send the login link to the user's email
    const loginLink = `${reqUrl.protocol}//${reqUrl.host}/`;
    await sendVerificationEmail(targetEmail, loginLink);

    return NextResponse.json({
      success: true,
      message: `User ${email} successfully allocated in SOBA with role ${role}. Login link email sent.`,
      verificationId: finalVerificationId
    });
  } catch (error) {
    console.error('Error allocating SOBA user:', error);
    return NextResponse.json({ error: 'Failed to allocate user' }, { status: 500 });
  }
}

