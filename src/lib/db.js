import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Resolve database path
const dbPath = path.join(process.cwd(), 'soba_secure_vault.db');
const uploadsDir = path.join(process.cwd(), 'uploads');

// Ensure uploads folder exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Initialize SQLite database
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Run DDL migrations to set up tables
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
  );

  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes')),
    updated_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
  );

  CREATE TABLE IF NOT EXISTS file_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    edited_by TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes')),
    FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    file_id INTEGER,
    action TEXT NOT NULL,
    soba_verified INTEGER NOT NULL, -- 0 or 1
    soba_role TEXT,
    created_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
  );

  CREATE TABLE IF NOT EXISTS soba_users (
    email TEXT PRIMARY KEY,
    role TEXT NOT NULL, -- 'viewer', 'editor', 'admin'
    verified INTEGER DEFAULT 1, -- 0 or 1
    verification_id TEXT,
    verification_link TEXT
  );
`);

// Alter table schema dynamically for existing databases
try {
  db.exec('ALTER TABLE soba_users ADD COLUMN verification_id TEXT');
} catch (e) {
  // Already exists
}
try {
  db.exec('ALTER TABLE soba_users ADD COLUMN verification_link TEXT');
} catch (e) {
  // Already exists
}

db.exec(`
  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

db.prepare(`
  INSERT OR IGNORE INTO system_settings (key, value)
  VALUES ('verification_link', 'https://poh.soba.network/verify?sid=MTI2MDAwMnwzOTAwMDAz')
`).run();

// Seed default accounts if tables are empty
const seedAdmins = db.prepare('SELECT count(*) as count FROM admins').get();
if (seedAdmins.count === 0) {
  const insertAdmin = db.prepare('INSERT INTO admins (email) VALUES (?)');
  insertAdmin.run('admin@soba.network');
  insertAdmin.run('charlie@admin.com');
}

const seedSobaUsers = db.prepare('SELECT count(*) as count FROM soba_users').get();
if (seedSobaUsers.count === 0) {
  const insertSobaUser = db.prepare('INSERT OR IGNORE INTO soba_users (email, role, verified, verification_id) VALUES (?, ?, ?, ?)');
  insertSobaUser.run('alice@viewer.com', 'viewer', 1, 'V1001');
  insertSobaUser.run('bob@editor.com', 'editor', 1, 'V1002');
  insertSobaUser.run('charlie@admin.com', 'admin', 1, 'adminpass');
} else {
  // Unconditionally ensure Charlie (Admin) exists and is verified in the registry
  db.prepare('INSERT OR IGNORE INTO soba_users (email, role, verified, verification_id) VALUES (?, ?, ?, ?)')
    .run('charlie@admin.com', 'admin', 1, 'adminpass');
}

export default db;
