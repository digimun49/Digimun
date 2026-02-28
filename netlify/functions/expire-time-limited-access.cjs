const admin = require("firebase-admin");

let firebaseApp = null;

function initializeFirebase() {
  if (firebaseApp) return firebaseApp;
  
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable not set");
  }
  
  try {
    const credentials = JSON.parse(serviceAccount);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(credentials)
    });
    return firebaseApp;
  } catch (e) {
    throw new Error("Failed to parse FIREBASE_SERVICE_ACCOUNT: " + e.message);
  }
}

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  };
  
  try {
    initializeFirebase();
    const db = admin.firestore();
    const now = new Date();
    
    let expiredCount = 0;
    const updates = [];
    const nowTimestamp = admin.firestore.Timestamp.now();
    
    const recoverySnapshot = await db.collection("users")
      .where("recoveryRequest", "==", "approved")
      .get();
    const expiredRecoveryDocs = recoverySnapshot.docs.filter(doc => {
      const expiry = doc.data().recoveryRequestExpiry;
      if (!expiry) return false;
      const expiryDate = expiry.toDate ? expiry.toDate() : new Date(expiry);
      return expiryDate <= now;
    });
    
    expiredRecoveryDocs.forEach((doc) => {
      updates.push(
        db.collection("users").doc(doc.id).update({
          recoveryRequest: "pending",
          recoveryRequestExpiry: admin.firestore.FieldValue.delete()
        })
      );
      expiredCount++;
    });
    
    const digimaxSnapshot = await db.collection("users")
      .where("digimaxStatus", "==", "approved")
      .get();
    const expiredDigimaxDocs = digimaxSnapshot.docs.filter(doc => {
      const expiry = doc.data().digimaxStatusExpiry;
      if (!expiry) return false;
      const expiryDate = expiry.toDate ? expiry.toDate() : new Date(expiry);
      return expiryDate <= now;
    });
    
    expiredDigimaxDocs.forEach((doc) => {
      updates.push(
        db.collection("users").doc(doc.id).update({
          digimaxStatus: "pending",
          digimaxStatusExpiry: admin.firestore.FieldValue.delete()
        })
      );
      expiredCount++;
    });
    
    if (updates.length > 0) {
      await Promise.all(updates);
    }
    
    console.log(`[Expire Access] Processed ${expiredCount} expired accesses`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Processed ${expiredCount} expired accesses`,
        timestamp: now.toISOString()
      })
    };
  } catch (err) {
    console.error("[Expire Access] Error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message
      })
    };
  }
};
