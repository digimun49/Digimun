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

  if (!db) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service temporarily unavailable' }) };
  }

  const adminAuth = await verifyAdmin(event);
  if (!adminAuth.authorized) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { searchType, searchValue } = JSON.parse(event.body);

    if (!searchType || !searchValue) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'searchType and searchValue are required' }) };
    }

    let snap;

    if (searchType === 'id') {
      snap = await db.collection('signals')
        .where('sequentialId', '==', Number(searchValue))
        .get();
    } else if (searchType === 'pair') {
      snap = await db.collection('signals')
        .where('pair', '==', searchValue)
        .get();
    } else if (searchType === 'email') {
      snap = await db.collection('signals')
        .where('userEmail', '==', searchValue)
        .get();
    } else {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'searchType must be id, pair, or email' }) };
    }

    let sortedDocs = snap.docs.sort((a, b) => {
      const aTime = a.data().createdAt?.toMillis?.() || a.data().createdAt || 0;
      const bTime = b.data().createdAt?.toMillis?.() || b.data().createdAt || 0;
      return bTime - aTime;
    });
    if (searchType !== 'id') {
      sortedDocs = sortedDocs.slice(0, 50);
    }

    const signals = sortedDocs.map(doc => {
      const data = doc.data();
      return {
        signalId: doc.id,
        sequentialId: data.sequentialId,
        userEmail: data.userEmail,
        pair: data.pair,
        direction: data.direction,
        signal: data.signal,
        confidence: data.confidence,
        reason: data.reason,
        failureReason: data.failureReason,
        entryTip: data.entryTip,
        signalTime: data.signalTime,
        volatility: data.volatility || '',
        market_state: data.market_state || '',
        pattern_clarity: data.pattern_clarity || '',
        sr_proximity: data.sr_proximity || '',
        mtg: data.mtg || '',
        patterns: data.patterns || '',
        result: data.result,
        status: data.status,
        batchId: data.batchId,
        createdAt: data.createdAt,
        resultSubmittedAt: data.resultSubmittedAt,
        adminEdited: data.adminEdited,
        approvedForLive: data.approvedForLive
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, signals })
    };
  } catch (err) {
    console.error('admin-signals-search error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to search signals' }) };
  }
};
