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
    const { userEmail } = JSON.parse(event.body);

    if (!userEmail) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'userEmail is required' }) };
    }

    const snap = await db.collection('signals')
      .where('userEmail', '==', userEmail)
      .get();

    const pendingDocs = snap.docs.filter(d => d.data().status === 'pending');

    if (pendingDocs.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ hasPending: false }) };
    }

    const doc = pendingDocs[0];
    const data = doc.data();

    const signal = {
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
      createdAt: data.createdAt
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ hasPending: true, signal })
    };
  } catch (err) {
    console.error('signal-get-pending error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
