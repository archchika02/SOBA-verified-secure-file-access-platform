import { NextResponse } from 'next/server';
import db from '../../../lib/db';

export async function GET() {
  try {
    // Retrieve the 100 most recent audit logs, joining files to resolve the original filename
    const logs = db.prepare(`
      SELECT 
        l.id, 
        l.user_email, 
        l.file_id, 
        l.action, 
        l.soba_verified, 
        l.soba_role, 
        l.created_at,
        f.original_name as file_name
      FROM access_logs l
      LEFT JOIN files f ON l.file_id = f.id
      ORDER BY l.created_at DESC
      LIMIT 100
    `).all();

    return NextResponse.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Failed to retrieve access audit logs' }, { status: 500 });
  }
}
