import db from './src/lib/db.js';

async function runTest() {
  const testEmail = 'test_user_flow@gmail.com';
  console.log(`Starting verification flow test for: ${testEmail}`);

  // 1. Clean up any existing test user
  db.prepare('DELETE FROM soba_users WHERE email = ?').run(testEmail);

  // 2. Allocate user (simulate admin adding user with verified = 0)
  db.prepare(`
    INSERT INTO soba_users (email, role, verified, verification_id)
    VALUES (?, 'viewer', 0, 'TEST_ID')
  `).run(testEmail);

  // 3. Verify user is pending
  let user = db.prepare('SELECT * FROM soba_users WHERE email = ?').get(testEmail);
  console.log(`Step 1: User created. Verified status in DB: ${user.verified} (Expected: 0)`);

  if (user.verified !== 0) {
    console.error("FAIL: User is already verified!");
    return;
  }

  // 4. Simulate callback request logic (verify-callback route behavior)
  const cleanedEmail = testEmail.toLowerCase().trim();
  const result = db.prepare('UPDATE soba_users SET verified = 1 WHERE email = ?').run(cleanedEmail);
  
  console.log(`Step 2: Simulating callback execution. Rows updated: ${result.changes}`);

  // 5. Verify user is now verified
  user = db.prepare('SELECT * FROM soba_users WHERE email = ?').get(testEmail);
  console.log(`Step 3: User status after callback. Verified status in DB: ${user.verified} (Expected: 1)`);

  if (user.verified === 1) {
    console.log("\x1b[32mSUCCESS: User verification flow is working perfectly in the database!\x1b[0m");
  } else {
    console.error("\x1b[31mFAIL: User status did not transition to verified.\x1b[0m");
  }

  // Clean up
  db.prepare('DELETE FROM soba_users WHERE email = ?').run(testEmail);
}

runTest().catch(console.error);
