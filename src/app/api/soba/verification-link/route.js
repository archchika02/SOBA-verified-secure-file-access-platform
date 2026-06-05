import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

export async function GET() {
  try {
    const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'verification_link'").get();
    return NextResponse.json({
      success: true,
      verificationLink: setting ? setting.value : 'https://poh.soba.network/verify?sid=MTI2MDAwMnwzOTAwMDAz'
    });
  } catch (error) {
    console.error('Error fetching verification link:', error);
    return NextResponse.json({ error: 'Failed to fetch verification link' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const requesterEmail = request.headers.get('x-soba-session-email') || '';
    if (requesterEmail.toLowerCase().trim() !== 'charlie@admin.com') {
      return NextResponse.json({
        error: 'Access Denied: Only the admin role (charlie@admin.com) can update system settings.'
      }, { status: 403 });
    }

    const body = await request.json();
    const { verificationLink } = body;

    if (!verificationLink) {
      return NextResponse.json({ error: 'verificationLink is required' }, { status: 400 });
    }

    db.prepare(`
      INSERT INTO system_settings (key, value)
      VALUES ('verification_link', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(verificationLink);

    return NextResponse.json({
      success: true,
      message: 'System verification link updated successfully.'
    });
  } catch (error) {
    console.error('Error updating verification link:', error);
    return NextResponse.json({ error: 'Failed to update verification link' }, { status: 500 });
  }
}
