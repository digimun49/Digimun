const admin = require('firebase-admin');

let db = null;
let initError = null;

if (!admin.apps || !admin.apps.length) {
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson && serviceAccountJson !== '{}') {
      const serviceAccount = JSON.parse(serviceAccountJson);
      if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      db = admin.firestore();
      console.log('Firebase Admin initialized successfully');
    } else {
      initError = 'FIREBASE_SERVICE_ACCOUNT environment variable is missing or empty';
      console.error('Firebase Admin:', initError);
    }
  } catch (err) {
    initError = err.message;
    console.error('Firebase initialization error:', err.message);
  }
} else {
  db = admin.firestore();
}

const ALLOWED_ORIGINS = [
  'https://digimun.pro',
  'https://www.digimun.pro'
];

function getCorsHeaders(origin) {
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  const allowed = [...ALLOWED_ORIGINS];
  if (devDomain) {
    allowed.push('https://' + devDomain);
  }
  if (origin && allowed.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-2FA-Session',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Content-Type': 'application/json',
      'Vary': 'Origin'
    };
  }
  return {
    'Content-Type': 'application/json',
    'Vary': 'Origin'
  };
}

async function verifyFirebaseToken(event) {
  const authHeader = event.headers && (event.headers.authorization || event.headers.Authorization);
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, error: 'Missing or invalid Authorization header' };
  }
  const idToken = authHeader.split('Bearer ')[1];
  if (!idToken) {
    return { authenticated: false, error: 'Missing token' };
  }
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return { authenticated: true, uid: decodedToken.uid, email: decodedToken.email || '', token: decodedToken };
  } catch (err) {
    return { authenticated: false, error: 'Invalid or expired token' };
  }
}

function isAdminEmail(email) {
  const adminEmail = process.env.ADMIN_EMAIL || '';
  return adminEmail && email && email.toLowerCase().trim() === adminEmail.toLowerCase().trim();
}

function getAdminRole(email) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const moderatorEmails = (process.env.MODERATOR_EMAILS || '').split(',').map(e => e.toLowerCase().trim()).filter(Boolean);
  if (email && email.toLowerCase().trim() === adminEmail) {
    return 'super-admin';
  }
  if (moderatorEmails.includes((email || '').toLowerCase().trim())) {
    return 'moderator';
  }
  return null;
}

function isAdminOrModerator(email) {
  const role = getAdminRole(email);
  return role === 'super-admin' || role === 'moderator';
}

async function verifyAdmin(event, options = {}) {
  const authResult = await verifyFirebaseToken(event);
  if (!authResult.authenticated) {
    return { authorized: false, error: authResult.error };
  }
  const role = getAdminRole(authResult.email);
  if (!role) {
    return { authorized: false, error: 'Unauthorized' };
  }
  if (options.requireSuperAdmin && role !== 'super-admin') {
    return { authorized: false, error: 'Super-admin access required' };
  }
  if (options.require2FA !== false && db) {
    const sessionToken = event.headers && (event.headers['x-admin-2fa-session'] || event.headers['X-Admin-2FA-Session']);
    if (!sessionToken) {
      return { authorized: false, error: '2FA session required' };
    }
    try {
      const sessionDoc = await db.collection('admin2faSessions').doc(sessionToken).get();
      if (!sessionDoc.exists) {
        return { authorized: false, error: '2FA session invalid' };
      }
      const session = sessionDoc.data();
      if (session.adminUid !== authResult.uid || session.adminEmail !== authResult.email.toLowerCase().trim()) {
        return { authorized: false, error: '2FA session mismatch' };
      }
      if (session.expiresAt && session.expiresAt.toDate() < new Date()) {
        return { authorized: false, error: '2FA session expired' };
      }
    } catch (err) {
      console.error('2FA session check error:', err.message);
      return { authorized: false, error: '2FA verification failed' };
    }
  }
  return { authorized: true, email: authResult.email, uid: authResult.uid, role };
}

async function logAdminAction(actionData) {
  if (!db) return;
  try {
    await db.collection('adminLogs').add({
      adminEmail: actionData.adminEmail || 'unknown',
      action: actionData.action || 'unknown',
      target: actionData.target || null,
      targetType: actionData.targetType || null,
      details: actionData.details || null,
      before: actionData.before || null,
      after: actionData.after || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ip: actionData.ip || null
    });
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

module.exports = { admin, db, initError, getCorsHeaders, verifyFirebaseToken, verifyAdmin, isAdminEmail, isAdminOrModerator, getAdminRole, logAdminAction };
