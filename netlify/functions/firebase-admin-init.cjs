const admin = require('firebase-admin');

if (!admin.apps || !admin.apps.length) {
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson && serviceAccountJson !== '{}') {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      console.warn('Firebase Admin init: No valid FIREBASE_SERVICE_ACCOUNT environment variable provided');
    }
  } catch (err) {
    console.error('Firebase initialization error:', err.message);
  }
}

const db = admin.firestore();

module.exports = { admin, db };
