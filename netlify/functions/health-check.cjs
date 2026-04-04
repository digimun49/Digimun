const { db, initError, getCorsHeaders } = require('./firebase-admin-init.cjs');

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const status = {
    functionsWorking: true,
    firebaseInitialized: !!db,
    timestamp: new Date().toISOString()
  };

  if (db) {
    try {
      const testSnap = await db.collection('signals').limit(1).get();
      status.firestoreConnected = true;
    } catch (err) {
      status.firestoreConnected = false;
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(status, null, 2)
  };
};
