import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import db from '../../../lib/db';
import { verifySoba, logAccess } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

// GET: Retrieve files available to verified SOBA users
export async function GET(request) {
  const auth = await verifySoba(request);

  if (!auth.verified) {
    logAccess(auth.email, null, 'LIST_FILES', false, auth.role);
    return NextResponse.json(
      { error: 'Access Denied: Unverified SOBA session' },
      { status: 403 }
    );
  }

  try {
    // Log the successful listing
    logAccess(auth.email, null, 'LIST_FILES', true, auth.role);

    // Fetch all files
    const files = db.prepare('SELECT * FROM files ORDER BY created_at DESC').all();

    // Attach version history to each file
    const filesWithVersions = files.map((file) => {
      const versions = db.prepare(`
        SELECT id, version_number, storage_path, edited_by, created_at
        FROM file_versions
        WHERE file_id = ?
        ORDER BY version_number DESC
      `).all(file.id);

      return {
        ...file,
        versions
      };
    });

    return NextResponse.json({
      success: true,
      user: auth,
      files: filesWithVersions
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json({ error: 'Failed to retrieve files' }, { status: 500 });
  }
}

// POST: Admin document file upload
export async function POST(request) {
  const auth = await verifySoba(request);

  // Enforce SOBA verification & admin role check
  if (!auth.verified) {
    logAccess(auth.email, null, 'UPLOAD_FILE', false, auth.role);
    return NextResponse.json({ error: 'Access Denied: Unverified SOBA session' }, { status: 403 });
  }

  if (auth.role !== 'admin' && auth.role !== 'editor') {
    logAccess(auth.email, null, 'UPLOAD_FILE', false, auth.role);
    return NextResponse.json({ error: 'Access Denied: Only SOBA Admins and Editors can upload new documents' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const originalName = file.name;
    const fileSize = file.size;
    const fileExtension = path.extname(originalName).toLowerCase();

    // Validate supported file types: PDF, PNG, JPG/JPEG, DOCX, MP4, MP3
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.mp4', '.mp3'];
    if (!allowedExtensions.includes(fileExtension)) {
      return NextResponse.json({
        error: `Unsupported file type. Supported types: PDF, PNG/JPG, DOCX, MP4, MP3 (Received: ${fileExtension})`
      }, { status: 400 });
    }

    // Determine clean file type label
    let fileType = 'Unknown';
    if (['.jpg', '.jpeg', '.png'].includes(fileExtension)) fileType = 'Image';
    else if (fileExtension === '.pdf') fileType = 'PDF';
    else if (fileExtension === '.docx') fileType = 'DOCX';
    else if (fileExtension === '.mp4') fileType = 'Video';
    else if (fileExtension === '.mp3') fileType = 'Audio';

    // Generate unique storage name
    const uniqueFileName = `${Date.now()}_${originalName.replace(/\s+/g, '_')}`;
    const storagePath = path.join('uploads', uniqueFileName);
    const absolutePath = path.join(process.cwd(), storagePath);

    // Save actual file stream to root /uploads directory
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(absolutePath, buffer);

    // Write file metadata to SQLite (Transaction ensuring atomic operations)
    let newFileId;
    const transaction = db.transaction(() => {
      const insertFile = db.prepare(`
        INSERT INTO files (file_name, original_name, file_type, file_size, storage_path, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const result = insertFile.run(
        uniqueFileName,
        originalName,
        fileType,
        fileSize,
        storagePath,
        auth.email
      );
      
      newFileId = result.lastInsertRowid;

      // Insert file version 1
      const insertVersion = db.prepare(`
        INSERT INTO file_versions (file_id, version_number, storage_path, edited_by)
        VALUES (?, ?, ?, ?)
      `);
      insertVersion.run(
        newFileId,
        1,
        storagePath,
        auth.email
      );
    });

    transaction();

    // Log the successful audit entry
    logAccess(auth.email, newFileId, 'UPLOAD_FILE', true, auth.role);

    return NextResponse.json({
      success: true,
      message: 'Document uploaded successfully',
      fileId: newFileId,
      fileName: uniqueFileName
    }, { status: 201 });

  } catch (error) {
    console.error('Error during file upload:', error);
    return NextResponse.json({ error: 'Failed to upload file due to server error' }, { status: 500 });
  }
}
