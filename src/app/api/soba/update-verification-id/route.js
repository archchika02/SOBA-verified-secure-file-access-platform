import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

export async function POST(request) {
  try {
    // 1. Authorize: only charlie@admin.com can update verification IDs in the backend
    const requesterEmail = request.headers.get('x-soba-session-email') || '';
    if (requesterEmail.toLowerCase().trim() !== 'charlie@admin.com') {
      return NextResponse.json({ 
        error: 'Access Denied: Only the admin role (charlie@admin.com) can update Personal IDs.' 
      }, { status: 403 });
    }

    const body = await request.json();
    const { email, verificationId } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    const cleanedEmail = email.toLowerCase().trim();
    const cleanedId = verificationId ? verificationId.trim() : null;

    // Update in database
    const result = db.prepare('UPDATE soba_users SET verification_id = ? WHERE email = ?').run(cleanedId, cleanedEmail);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'User not found in directory' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated Personal ID for ${email} to "${cleanedId || 'None'}"`
    });
  } catch (error) {
    console.error('Error updating verification ID:', error);
    return NextResponse.json({ error: 'Failed to update Personal ID' }, { status: 500 });
  }
}
