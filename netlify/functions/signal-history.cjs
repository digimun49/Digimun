const { db, initError } = require('./firebase-admin-init.cjs');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  if (!db) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database not initialized: ' + (initError || 'FIREBASE_SERVICE_ACCOUNT env var missing') }) };
  }

  try {
    const { userEmail, limit: queryLimit, offset: queryOffset } = JSON.parse(event.body);

    if (!userEmail) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'userEmail is required' }) };
    }

    const maxResults = queryLimit || 20;
    const skipCount = queryOffset || 0;

    const snap = await db.collection('signals')
      .where('userEmail', '==', userEmail)
      .get();

    const allDocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    allDocs.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt || 0;
      return bTime - aTime;
    });

    const paged = allDocs.slice(skipCount, skipCount + maxResults);

    const signals = paged.map(data => ({
      signalId: data.id,
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
      batchId: data.batchId,
      createdAt: data.createdAt,
      resultSubmittedAt: data.resultSubmittedAt,
      approvedForLive: data.approvedForLive
    }));

    const userDoc = await db.collection('users').doc(userEmail).get();
    const stats = userDoc.exists ? {
      totalSignals: userDoc.data().totalSignals || 0,
      wins: userDoc.data().wins || 0,
      losses: userDoc.data().losses || 0,
      invalid: userDoc.data().invalid || 0,
      refunded: userDoc.data().refunded || 0
    } : { totalSignals: 0, wins: 0, losses: 0, invalid: 0, refunded: 0 };

    const winLossTotal = stats.wins + stats.losses;
    stats.winRate = winLossTotal > 0 ? Math.round((stats.wins / winLossTotal) * 100) : 0;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, signals, stats })
    };
  } catch (err) {
    console.error('signal-history error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
