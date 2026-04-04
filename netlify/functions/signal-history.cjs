const { db, initError, getCorsHeaders, verifyFirebaseToken } = require('./firebase-admin-init.cjs');
const { verifyPremiumAccess } = require('./verify-premium-access.cjs');

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

  try {
    const parsed = JSON.parse(event.body);
    const userEmail = authResult.email.toLowerCase().trim();
    const maxResults = Math.min(Math.max(parseInt(parsed.limit) || 20, 1), 100);
    const startAfterId = parsed.startAfter || null;

    if (!userEmail) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'userEmail is required' }) };
    }

    const accessCheck = await verifyPremiumAccess(userEmail, 'paymentStatus');
    if (!accessCheck.allowed) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: accessCheck.reason }) };
    }

    let q = db.collection('signals')
      .where('userEmail', '==', userEmail)
      .orderBy('createdAt', 'desc')
      .limit(maxResults);

    if (startAfterId) {
      const startAfterDoc = await db.collection('signals').doc(startAfterId).get();
      if (startAfterDoc.exists && startAfterDoc.data()?.userEmail === userEmail) {
        q = db.collection('signals')
          .where('userEmail', '==', userEmail)
          .orderBy('createdAt', 'desc')
          .startAfter(startAfterDoc)
          .limit(maxResults);
      }
    }

    const snap = await q.get();

    const signals = snap.docs.map(doc => {
      const data = doc.data();
      return {
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
        batchId: data.batchId,
        createdAt: data.createdAt,
        resultSubmittedAt: data.resultSubmittedAt,
        approvedForLive: data.approvedForLive
      };
    });

    const lastSignal = signals.length > 0 ? signals[signals.length - 1] : null;
    const nextStartAfter = lastSignal ? lastSignal.signalId : null;

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
      body: JSON.stringify({ success: true, signals, stats, nextStartAfter, hasMore: signals.length === maxResults })
    };
  } catch (err) {
    console.error('signal-history error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to fetch signal history' }) };
  }
};
