const { db } = require('./firebase-admin-init.cjs');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  if (!db) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database not initialized. Check FIREBASE_SERVICE_ACCOUNT environment variable.' }) };
  }

  try {
    const { adminEmail, searchType, searchValue } = JSON.parse(event.body);

    if (adminEmail !== ADMIN_EMAIL) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

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
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
