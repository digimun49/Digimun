const { db, initError, getCorsHeaders } = require('./firebase-admin-init.cjs');

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (!db) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service temporarily unavailable' }) };
  }

  try {
    const snap = await db.collection('signals')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const signals = snap.docs.map(doc => {
      const data = doc.data();
      const emailParts = (data.userEmail || '').split('@');
      const name = emailParts[0] || 'User';
      const masked = name.length > 2 ? name[0] + '*'.repeat(name.length - 2) + name[name.length - 1] : '***';
      return {
        pair: data.pair,
        direction: data.direction,
        signal: data.signal,
        confidence: data.confidence,
        signalTime: data.signalTime,
        result: data.result,
        status: data.status,
        createdAt: data.createdAt,
        user: masked
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, signals, total: signals.length })
    };
  } catch (err) {
    console.error('all-signals error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to fetch signals' }) };
  }
};
