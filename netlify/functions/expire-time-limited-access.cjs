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
      .where("recoveryRequestExpiry", "<=", nowTimestamp)
      .orderBy("recoveryRequestExpiry")
      .get();
    
    recoverySnapshot.forEach((doc) => {
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
      .where("digimaxStatusExpiry", "<=", nowTimestamp)
      .orderBy("digimaxStatusExpiry")
      .get();
    
    digimaxSnapshot.forEach((doc) => {
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
