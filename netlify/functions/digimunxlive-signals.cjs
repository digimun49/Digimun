const { db } = require('./firebase-admin-init.cjs');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
      .limit(100)
      .get();

    const signals = snap.docs.map(doc => {
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
    console.error('digimunxlive-signals error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
