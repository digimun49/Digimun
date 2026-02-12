const { db } = require('./firebase-admin-init');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const snap = await db.collection('signals')
      .where('approvedForLive', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

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
        createdAt: data.createdAt,
        approvedForLive: data.approvedForLive
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, signals })
    };
  } catch (err) {
    console.error('digimunxlive-signals error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
