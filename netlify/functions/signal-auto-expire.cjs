const { db, initError, getCorsHeaders, verifyAdmin } = require('./firebase-admin-init.cjs');

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const adminAuth = await verifyAdmin(event);
  if (!adminAuth.authorized) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (!db) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service unavailable' }) };
  }

  try {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const snap = await db.collection('signals')
      .where('status', '==', 'pending')
      .where('createdAt', '<', twelveHoursAgo)
      .orderBy('createdAt', 'asc')
      .get();

    if (snap.empty) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, expiredCount: 0 })
      };
    }

    const batch = db.batch();
    snap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, expiredCount: snap.size })
    };
  } catch (err) {
    console.error('signal-auto-expire error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};
