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
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const snap = await db.collection('signals')
      .where('status', '==', 'pending')
      .get();
    const expiredDocs = snap.docs.filter(d => {
      const createdAt = d.data().createdAt;
      if (!createdAt) return false;
      const createdDate = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
      return createdDate < twelveHoursAgo;
    });

    if (expiredDocs.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, expiredCount: 0 })
      };
    }

    const batch = db.batch();
    expiredDocs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, expiredCount: expiredDocs.length })
    };
  } catch (err) {
    console.error('signal-auto-expire error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
