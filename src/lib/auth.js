import db from './db';

// TOGGLE THIS TO SWITCH BETWEEN SIMULATION AND REAL DEPLOYMENT
const USE_REAL_SOBA = false;

// The real SOBA session verifier endpoint
const REAL_SOBA_SESSION_URL = 'https://dashboard.soba.network/login';

/**
 * Standardized function to check SOBA verification from incoming request headers.
 * Extracts the user session email/token and resolves verification state & role.
 */
export async function verifySoba(request) {
  if (USE_REAL_SOBA) {
    // ==========================================
    // 🛡️ REAL INTEGRATION MODE (OIDC/OAuth2)
    // ==========================================
    // 1. Read our secure, HTTP-only OAuth cookie set during OIDC callback
    const cookieToken = request.cookies.get('soba_access_token')?.value;

    // 2. Fallback to Authorization Header (e.g. from tests or API requests)
    const authHeader = request.headers.get('authorization') || '';
    const headerToken = authHeader.replace('Bearer ', '').trim();

    // 3. Fallback to simulated header for testing
    const sessionHeader = request.headers.get('x-soba-session-email') || '';

    const token = cookieToken || headerToken || sessionHeader;

    if (!token) {
      return {
        verified: false,
        email: 'guest',
        role: 'guest',
        error: 'Access Denied: Please log in at https://dashboard.soba.network/login'
      };
    }

    try {
      const userInfoUrl = process.env.SOBA_USERINFO_URL;

      // NextAuth /api/auth/session endpoint requires session tokens inside a Cookie header.
      // Standard OIDC UserInfo endpoints require standard Authorization Bearer headers.
      const isNextAuthSession = userInfoUrl.includes('/api/auth/session');
      const headers = { 'Content-Type': 'application/json' };

      if (isNextAuthSession) {
        headers['Cookie'] = `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`;
      } else {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Perform server-to-server UserInfo verification request
      const response = await fetch(userInfoUrl, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        return {
          verified: false,
          email: 'guest',
          role: 'guest',
          error: 'Access Denied: SOBA UserInfo server rejected the access token'
        };
      }

      const userInfo = await response.json();

      // Standard OIDC UserInfo response must return user's email
      if (!userInfo || !userInfo.email) {
        return {
          verified: false,
          email: 'guest',
          role: 'guest',
          error: 'Access Denied: OAuth verification did not yield a valid email'
        };
      }

      const verifiedEmail = userInfo.email.toLowerCase().trim();

      // Check role mapping from local SQLite tables
      const adminExists = db.prepare('SELECT 1 FROM admins WHERE email = ?').get(verifiedEmail);

      let resolvedRole = 'admin';
      if (adminExists) {
        resolvedRole = 'admin';
      } else {
        const allocatedUser = db.prepare('SELECT role FROM soba_users WHERE email = ?').get(verifiedEmail);
        if (allocatedUser) {
          resolvedRole = allocatedUser.role;
        }
      }

      return {
        verified: true,
        email: verifiedEmail,
        role: resolvedRole
      };

    } catch (error) {
      console.error('SOBA userinfo exchange failure:', error);
      return {
        verified: false,
        email: 'guest',
        role: 'guest',
        error: 'Access Denied: Failed to contact the SOBA UserInfo authentication server'
      };
    }
  } else {
    // ==========================================
    // 🧪 SIMULATOR MODE (Active by default)
    // ==========================================
    const email = request.headers.get('x-soba-session-email') || '';

    if (!email) {
      return {
        verified: false,
        email: 'guest',
        role: 'guest',
        error: 'Missing session header X-Soba-Session-Email'
      };
    }

    const cleanedEmail = email.toLowerCase().trim();

    // Query simulated SOBA database (soba_users table)
    const user = db.prepare('SELECT * FROM soba_users WHERE email = ?').get(cleanedEmail);

    if (user && user.verified === 1) {
      return {
        verified: true,
        email: user.email,
        role: user.role
      };
    }

    return {
      verified: false,
      email: cleanedEmail,
      role: 'guest',
      error: 'Email is not verified in SOBA directory'
    };
  }
}

/**
 * Writes an access audit log entry to the SQLite database.
 */
export function logAccess(email, fileId, action, verified, role) {
  try {
    const insertLog = db.prepare(`
      INSERT INTO access_logs (user_email, file_id, action, soba_verified, soba_role)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertLog.run(
      email,
      fileId || null,
      action,
      verified ? 1 : 0,
      role || 'guest'
    );
  } catch (error) {
    console.error('Failed to insert access log to SQLite:', error);
  }
}
