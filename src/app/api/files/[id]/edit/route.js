import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import db from '../../../../../lib/db';
import { verifySoba, logAccess } from '../../../../../lib/auth';

export async function POST(request, { params }) {
  const fileId = parseInt(params.id, 10);
  const auth = await verifySoba(request);

  // 1. Enforce SOBA verification
  if (!auth.verified) {
    logAccess(auth.email, fileId, 'EDIT_UPLOAD', false, auth.role);
    return NextResponse.json(
      { error: 'Access Denied: Unverified SOBA session' },
      { status: 403 }
    );
  }

  // 2. Enforce Role: Only Editor or Admin can upload revised versions
  if (auth.role !== 'editor' && auth.role !== 'admin') {
    logAccess(auth.email, fileId, 'EDIT_UPLOAD', false, auth.role);
    return NextResponse.json(
      { error: 'Access Denied: Only SOBA Editors and Admins are permitted to upload revisions' },
      { status: 403 }
    );
  }

  try {
    // 3. Find target file in database
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
    if (!file) {
      logAccess(auth.email, fileId, 'EDIT_UPLOAD', false, auth.role);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // 4. Parse multipart revision file
    const formData = await request.formData();
    const revisionFile = formData.get('file');

    if (!revisionFile || typeof revisionFile === 'string') {
      return NextResponse.json({ error: 'No file uploaded for revision' }, { status: 400 });
    }

    const originalName = revisionFile.name;
    const fileSize = revisionFile.size;
    const fileExtension = path.extname(originalName).toLowerCase();

    // Validate revision has a supported file extension
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.mp4', '.mp3'];
    if (!allowedExtensions.includes(fileExtension)) {
      return NextResponse.json({
        error: `Unsupported file type. Supported types: PDF, PNG/JPG, DOCX, MP4, MP3 (Received: ${fileExtension})`
      }, { status: 400 });
    }

    // 5. Determine the next version number
    const maxVersionRow = db.prepare('SELECT MAX(version_number) as max_ver FROM file_versions WHERE file_id = ?').get(fileId);
    const nextVersionNumber = (maxVersionRow?.max_ver || 1) + 1;

    // Generate unique storage name for this revision
    const uniqueFileName = `${Date.now()}_v${nextVersionNumber}_${originalName.replace(/\s+/g, '_')}`;
    const storagePath = path.join('uploads', uniqueFileName);
    const absolutePath = path.join(process.cwd(), storagePath);

    // Save actual file stream to root /uploads directory
    const buffer = Buffer.from(await revisionFile.arrayBuffer());
    fs.writeFileSync(absolutePath, buffer);

    // 6. Write version update to database within a Transaction
    const transaction = db.transaction(() => {
      // Insert new version
      const insertVersion = db.prepare(`
        INSERT INTO file_versions (file_id, version_number, storage_path, edited_by)
        VALUES (?, ?, ?, ?)
      `);
      insertVersion.run(
        fileId,
        nextVersionNumber,
        storagePath,
        auth.email
      );

      // Update parent file metadata to point to latest version and update size
      const updateFile = db.prepare(`
        UPDATE files 
        SET storage_path = ?, file_size = ?, updated_at = datetime('now', '+5 hours', '+30 minutes')
        WHERE id = ?
      `);
      updateFile.run(
        storagePath,
        fileSize,
        fileId
      );
    });

    transaction();

    // 7. Log successful audit entry
    logAccess(auth.email, fileId, `EDIT_UPLOAD_V${nextVersionNumber}`, true, auth.role);

    return NextResponse.json({
      success: true,
      message: `Revision uploaded successfully. Created Version ${nextVersionNumber}`,
      version: nextVersionNumber,
      fileName: uniqueFileName
    });

  } catch (error) {
    console.error('Error uploading file revision:', error);
    logAccess(auth.email, fileId, 'EDIT_UPLOAD', false, auth.role);
    return NextResponse.json({ error: 'Failed to upload revision due to server error' }, { status: 500 });
  }
}
