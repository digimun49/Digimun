const { db } = require('./firebase-admin-init.cjs');

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

  try {
    const { userEmail, limit, offset } = JSON.parse(event.body);

    if (!userEmail) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'userEmail is required' }) };
    }

    const queryLimit = limit || 20;
    const queryOffset = offset || 0;

    let query = db.collection('signals')
      .where('userEmail', '==', userEmail)
      .orderBy('createdAt', 'desc')
      .limit(queryLimit);

    if (queryOffset > 0) {
      const offsetSnap = await db.collection('signals')
        .where('userEmail', '==', userEmail)
        .orderBy('createdAt', 'desc')
        .limit(queryOffset)
        .get();

      if (!offsetSnap.empty) {
        const lastDoc = offsetSnap.docs[offsetSnap.docs.length - 1];
        query = db.collection('signals')
          .where('userEmail', '==', userEmail)
          .orderBy('createdAt', 'desc')
          .startAfter(lastDoc)
          .limit(queryLimit);
      }
    }

    const snap = await query.get();

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
