const admin = require('firebase-admin');

let db = null;
let initError = null;

if (!admin.apps || !admin.apps.length) {
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson && serviceAccountJson !== '{}') {
      const serviceAccount = JSON.parse(serviceAccountJson);
      if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      db = admin.firestore();
      console.log('Firebase Admin initialized successfully');
    } else {
      initError = 'FIREBASE_SERVICE_ACCOUNT environment variable is missing or empty';
      console.error('Firebase Admin:', initError);
    }
  } catch (err) {
    initError = err.message;
    console.error('Firebase initialization error:', err.message);
  }
} else {
  db = admin.firestore();
}

module.exports = { admin, db, initError };
