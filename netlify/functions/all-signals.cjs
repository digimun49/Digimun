const { db, initError } = require('./firebase-admin-init.cjs');

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

  if (!db) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database not initialized: ' + (initError || 'FIREBASE_SERVICE_ACCOUNT env var missing') }) };
  }

  try {
    const snap = await db.collection('signals')
      .get();

    const allDocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    allDocs.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt || 0;
      return bTime - aTime;
    });

    const limited = allDocs.slice(0, 100);

    const signals = limited.map(data => {
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
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
