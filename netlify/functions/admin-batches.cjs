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
    const { status } = JSON.parse(event.body);

    let query = db.collection('signalBatches');

    if (status && status !== 'all') {
      query = db.collection('signalBatches')
        .where('status', '==', status);
    }

    const batchSnap = await query.get();

    const sortedDocs = batchSnap.docs.sort((a, b) => {
      const aTime = a.data().createdAt?.toMillis?.() || a.data().createdAt || 0;
      const bTime = b.data().createdAt?.toMillis?.() || b.data().createdAt || 0;
      return bTime - aTime;
    });

    const batches = [];

    for (const batchDoc of sortedDocs) {
      const batchData = batchDoc.data();
      const signalIds = batchData.signalIds || [];
      const signals = [];

      for (const sid of signalIds) {
        const sigDoc = await db.collection('signals').doc(sid).get();
        if (sigDoc.exists) {
          const sigData = sigDoc.data();
          signals.push({
            signalId: sigDoc.id,
            sequentialId: sigData.sequentialId,
            userEmail: sigData.userEmail,
            pair: sigData.pair,
            direction: sigData.direction,
            signal: sigData.signal,
            confidence: sigData.confidence,
            reason: sigData.reason,
            failureReason: sigData.failureReason,
            entryTip: sigData.entryTip,
            signalTime: sigData.signalTime,
            volatility: sigData.volatility || '',
            market_state: sigData.market_state || '',
            pattern_clarity: sigData.pattern_clarity || '',
            sr_proximity: sigData.sr_proximity || '',
            mtg: sigData.mtg || '',
            patterns: sigData.patterns || '',
            result: sigData.result,
            status: sigData.status,
            createdAt: sigData.createdAt,
            resultSubmittedAt: sigData.resultSubmittedAt,
            adminEdited: sigData.adminEdited,
            approvedForLive: sigData.approvedForLive
          });
        }
      }

      batches.push({
        batchId: batchDoc.id,
        userEmail: batchData.userEmail,
        signalCount: batchData.signalCount,
        status: batchData.status,
        createdAt: batchData.createdAt,
        approvedAt: batchData.approvedAt,
        emailSent: batchData.emailSent,
        signals
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, batches })
    };
  } catch (err) {
    console.error('admin-batches error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to fetch batches' }) };
  }
};
