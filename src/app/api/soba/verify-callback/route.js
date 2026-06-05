import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    const cleanedEmail = email.toLowerCase().trim();

    // 1. Mark user as verified in SQLite
    const result = db.prepare('UPDATE soba_users SET verified = 1 WHERE email = ?').run(cleanedEmail);

    if (result.changes === 0) {
      // User doesn't exist, create them as viewer by default
      db.prepare('INSERT INTO soba_users (email, role, verified) VALUES (?, ?, ?)')
        .run(cleanedEmail, 'viewer', 1);
    }

    // 2. Redirect back to the dashboard with login_as parameter
    const dashboardUrl = new URL('/', request.url);
    dashboardUrl.searchParams.set('login_as', cleanedEmail);
    
    return NextResponse.redirect(dashboardUrl);
  } catch (error) {
    console.error('Error handling verify callback:', error);
    return NextResponse.json({ error: 'Internal server error during verification' }, { status: 500 });
  }
}
