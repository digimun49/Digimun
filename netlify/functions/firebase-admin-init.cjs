const admin = require('firebase-admin');

let db = null;

if (!admin.apps || !admin.apps.length) {
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson && serviceAccountJson !== '{}') {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      db = admin.firestore();
    } else {
      console.error('Firebase Admin: FIREBASE_SERVICE_ACCOUNT environment variable is missing or empty');
    }
  } catch (err) {
    console.error('Firebase initialization error:', err.message);
  }
} else {
  db = admin.firestore();
}

module.exports = { admin, db };
