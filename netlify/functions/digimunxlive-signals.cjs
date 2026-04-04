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
      .where('approvedForLive', '==', true)
      .get();

    const sortedDocs = snap.docs.sort((a, b) => {
      const aTime = a.data().createdAt?.toMillis?.() || a.data().createdAt || 0;
      const bTime = b.data().createdAt?.toMillis?.() || b.data().createdAt || 0;
      return bTime - aTime;
    }).slice(0, 100);

    const signals = sortedDocs.map(doc => {
      const data = doc.data();
      const emailParts = (data.userEmail || '').split('@');
      const name = emailParts[0] || 'User';
      const masked = name.length > 2 ? name[0] + '*'.repeat(name.length - 2) + name[name.length - 1] : '***';
      return {
        signalId: doc.id,
        pair: data.pair,
        direction: data.direction,
        signal: data.signal,
        confidence: data.confidence,
        reason: data.reason || '',
        signalTime: data.signalTime,
        volatility: data.volatility || '',
        market_state: data.market_state || '',
        pattern_clarity: data.pattern_clarity || '',
        sr_proximity: data.sr_proximity || '',
        mtg: data.mtg || '',
        patterns: data.patterns || '',
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
    console.error('digimunxlive-signals error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to fetch signals' }) };
  }
};
