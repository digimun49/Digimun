const { admin, db, getCorsHeaders } = require('./firebase-admin-init.cjs');
const { isRateLimited, getClientIP } = require('./rate-limiter.cjs');

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const clientIP = getClientIP(event);

  const ipCheck = isRateLimited(`signup_ip:${clientIP}`, { maxRequests: 5, windowMs: 15 * 60 * 1000 });
  if (ipCheck.limited) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({
        error: 'Too many signup attempts. Please try again later.',
        retryAfterMs: ipCheck.retryAfterMs
      })
    };
  }

  try {
    const parsed = JSON.parse(event.body || '{}');
    const { email, fingerprint } = parsed;

    if (!email || typeof email !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email is required' }) };
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedEmail.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email format' }) };
    }

    const emailCheck = isRateLimited(`signup_email:${trimmedEmail}`, { maxRequests: 3, windowMs: 30 * 60 * 1000 });
    if (emailCheck.limited) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({
          error: 'Too many attempts for this email. Please try again later.',
          retryAfterMs: emailCheck.retryAfterMs
        })
      };
    }

    if (!db) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service temporarily unavailable' }) };
    }

    const deletedDoc = await db.collection('deletedAccounts').doc(trimmedEmail).get();
    if (deletedDoc.exists) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          error: 'This account has been deleted and cannot be re-registered.',
          isDeleted: true
        })
      };
    }

    if (fingerprint && typeof fingerprint === 'object') {
      const fpHash = fingerprint.hash || '';
      if (fpHash && typeof fpHash === 'string' && fpHash.length <= 128) {
        try {
          const existingUsersSnap = await db.collection('users')
            .where('deviceFingerprint', '==', fpHash)
            .limit(3)
            .get();

          if (!existingUsersSnap.empty) {
            const matchedEmails = existingUsersSnap.docs.map(d => d.id);
            try {
              await db.collection('flaggedSignups').add({
                email: trimmedEmail,
                fingerprint: fpHash,
                matchedAccounts: matchedEmails,
                clientIP: clientIP,
                flagReason: 'duplicate_fingerprint',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              });
            } catch (logErr) {
              console.error('Failed to log flagged signup:', logErr.message);
            }
          }
        } catch (fpErr) {
          console.error('Fingerprint check error:', fpErr.message);
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ allowed: true })
    };
  } catch (err) {
    console.error('validate-signup error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Validation failed' }) };
  }
};
