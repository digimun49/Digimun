const { db, initError, getCorsHeaders, verifyFirebaseToken } = require('./firebase-admin-init.cjs');

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  if (!db) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service temporarily unavailable' }) };
  }

  const authResult = await verifyFirebaseToken(event);
  if (!authResult.authenticated) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
  }

  // Note: No premium access check here — users must be able to recover and submit
  // results on existing pending signals even if their subscription has lapsed.
  // Premium access is enforced in signal-analyze.cjs when creating new signals.
  try {
    const userEmail = authResult.email.toLowerCase().trim();

    if (!userEmail) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'userEmail is required' }) };
    }

    const snap = await db.collection('signals')
      .where('userEmail', '==', userEmail)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    const pendingDocs = snap.docs;

    if (pendingDocs.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ hasPending: false }) };
    }

    const doc = pendingDocs[0];
    const data = doc.data();

    const signal = {
      signalId: doc.id,
      userEmail: data.userEmail,
      pair: data.pair,
      direction: data.direction,
      signal: data.signal,
      confidence: data.confidence,
      reason: data.reason,
      failureReason: data.failureReason,
      entryTip: data.entryTip,
      signalTime: data.signalTime,
      result: data.result,
      status: data.status,
      createdAt: data.createdAt
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ hasPending: true, signal })
    };
  } catch (err) {
    console.error('signal-get-pending error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to fetch pending signal' }) };
  }
};
