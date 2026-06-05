import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import db from '../../../../../lib/db';
import { verifySoba, logAccess } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const fileId = parseInt(params.id, 10);
  const { searchParams } = new URL(request.url);
  const isDownload = searchParams.get('download') === 'true';

  const auth = await verifySoba(request);
  const logAction = isDownload ? 'DOWNLOAD' : 'VIEW';

  // 1. Enforce SOBA verification
  if (!auth.verified) {
    logAccess(auth.email, fileId, logAction, false, auth.role);
    return NextResponse.json(
      { error: 'Access Denied: Unverified SOBA session' },
      { status: 403 }
    );
  }

  try {
    // 2. Fetch file metadata
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
    if (!file) {
      logAccess(auth.email, fileId, logAction, false, auth.role);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // 3. Enforce Role Rules
    if (auth.role === 'viewer' && isDownload) {
      // Simulate "download only if allowed". By default, we deny direct downloads for viewers.
      logAccess(auth.email, fileId, 'DOWNLOAD_DENIED', false, auth.role);
      return NextResponse.json(
        { error: 'Access Denied: Viewers are not authorized to download this file.' },
        { status: 403 }
      );
    }

    // Resolve file path
    const absolutePath = path.join(process.cwd(), file.storage_path);
    if (!fs.existsSync(absolutePath)) {
      logAccess(auth.email, fileId, logAction, false, auth.role);
      return NextResponse.json({ error: 'Physical file not found on disk' }, { status: 404 });
    }

    // Determine MIME type
    let contentType = 'application/octet-stream';
    const ext = path.extname(file.original_name).toLowerCase();
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.mp3') contentType = 'audio/mpeg';
    else if (ext === '.mp4') contentType = 'video/mp4';
    else if (ext === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // Read file contents
    const fileBuffer = fs.readFileSync(absolutePath);

    // 4. Log successful audit entry
    logAccess(auth.email, fileId, logAction, true, auth.role);

    // Stream response
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': isDownload 
          ? `attachment; filename="${file.original_name}"` 
          : 'inline',
        'Content-Length': fileBuffer.length.toString()
      }
    });

  } catch (error) {
    console.error('Error viewing/downloading file:', error);
    logAccess(auth.email, fileId, logAction, false, auth.role);
    return NextResponse.json({ error: 'Server error processing file request' }, { status: 500 });
  }
}
