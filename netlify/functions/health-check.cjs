const { db, initError } = require('./firebase-admin-init.cjs');

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

  const status = {
    functionsWorking: true,
    firebaseInitialized: !!db,
    initError: initError || null,
    envVars: {
      FIREBASE_SERVICE_ACCOUNT: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      ADMIN_EMAIL: !!process.env.ADMIN_EMAIL,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY
    },
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  };

  if (db) {
    try {
      const testSnap = await db.collection('signals').limit(1).get();
      status.firestoreConnected = true;
      status.firestoreTestDocs = testSnap.size;
    } catch (err) {
      status.firestoreConnected = false;
      status.firestoreError = err.message;
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(status, null, 2)
  };
};
