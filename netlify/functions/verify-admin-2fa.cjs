const crypto = require('crypto');
const { db, getCorsHeaders, verifyFirebaseToken, isAdminEmail } = require('./firebase-admin-init.cjs');

const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const record = rateLimitStore.get(ip);
  
  if (!record) {
    rateLimitStore.set(ip, { attempts: 1, firstAttempt: now, lockedUntil: 0 });
    return false;
  }
  
  if (record.lockedUntil > now) {
    return true;
  }
  
  if (now - record.firstAttempt > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(ip, { attempts: 1, firstAttempt: now, lockedUntil: 0 });
    return false;
  }
  
  if (record.attempts >= MAX_ATTEMPTS_PER_WINDOW) {
    record.lockedUntil = now + LOCKOUT_DURATION;
    return true;
  }
  
  record.attempts++;
  return false;
}

function resetRateLimit(ip) {
  rateLimitStore.delete(ip);
}

function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  
  for (const char of base32.toUpperCase().replace(/=+$/, '')) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  
  return Buffer.from(bytes);
}

function verifyTOTP(secret, code) {
  for (let window = -1; window <= 1; window++) {
    const time = Math.floor(Date.now() / 1000 / 30) + window;
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigInt64BE(BigInt(time));
    
    const key = base32Decode(secret);
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(timeBuffer);
    const hash = hmac.digest();
    
    const offset = hash[hash.length - 1] & 0xf;
    const binary = ((hash[offset] & 0x7f) << 24) |
                   ((hash[offset + 1] & 0xff) << 16) |
                   ((hash[offset + 2] & 0xff) << 8) |
                   (hash[offset + 3] & 0xff);
    
    const expectedCode = (binary % 1000000).toString().padStart(6, '0');
    
    if (expectedCode === code) {
      return true;
    }
  }
  return false;
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const clientIP = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                   event.headers['client-ip'] || 
                   'unknown';

  if (isRateLimited(clientIP)) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({ error: 'Too many attempts. Please try again later.' })
    };
  }

  try {
    const authResult = await verifyFirebaseToken(event);
    if (!authResult.authenticated) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
    }

    if (!isAdminEmail(authResult.email)) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const parsed = JSON.parse(event.body);
    const code = parsed.code;
    const trustDevice = parsed.trustDevice === true;
    const TOTP_SECRET = process.env.ADMIN_TOTP_SECRET;
    
    if (!TOTP_SECRET) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'TOTP not configured' }) };
    }
    
    if (!code || code.length !== 6) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid code format' }) };
    }
    
    const isValid = verifyTOTP(TOTP_SECRET, code);
    
    if (isValid) {
      resetRateLimit(clientIP);
      
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const sessionDuration = trustDevice ? (7 * 24 * 60 * 60 * 1000) : (3 * 60 * 60 * 1000);
      const sessionExpiry = Date.now() + sessionDuration;

      if (db) {
        try {
          await db.collection('admin2faSessions').doc(sessionToken).set({
            adminUid: authResult.uid,
            adminEmail: authResult.email,
            createdAt: new Date(),
            expiresAt: new Date(sessionExpiry),
            ip: clientIP
          });
        } catch (dbErr) {
          console.error('Failed to store 2FA session:', dbErr.message);
        }
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Verified',
          sessionToken,
          expiresAt: sessionExpiry,
          trusted: trustDevice
        })
      };
    } else {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid code' }) };
    }
    
  } catch (err) {
    console.error('2FA verification error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};
