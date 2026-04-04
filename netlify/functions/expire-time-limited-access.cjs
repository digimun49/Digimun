const { admin, db, getCorsHeaders, verifyAdmin } = require('./firebase-admin-init.cjs');

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const adminAuth = await verifyAdmin(event);
  if (!adminAuth.authorized) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    if (!db) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service unavailable' }) };
    }

    const now = new Date();
    let expiredCount = 0;
    const updates = [];
    
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
    
    const paymentSnapshot = await db.collection("users")
      .where("paymentStatus", "==", "approved")
      .get();
    const expiredPaymentDocs = paymentSnapshot.docs.filter(doc => {
      const expiry = doc.data().paymentStatusExpiry;
      if (!expiry) return false;
      const expiryDate = expiry.toDate ? expiry.toDate() : new Date(expiry);
      return expiryDate <= now;
    });
    
    expiredPaymentDocs.forEach((doc) => {
      updates.push(
        db.collection("users").doc(doc.id).update({
          paymentStatus: "pending",
          paymentStatusExpiry: admin.firestore.FieldValue.delete()
        })
      );
      expiredCount++;
    });
    
    const quotexSnapshot = await db.collection("users")
      .where("quotexStatus", "==", "approved")
      .get();
    const expiredQuotexDocs = quotexSnapshot.docs.filter(doc => {
      const expiry = doc.data().quotexStatusExpiry;
      if (!expiry) return false;
      const expiryDate = expiry.toDate ? expiry.toDate() : new Date(expiry);
      return expiryDate <= now;
    });
    
    expiredQuotexDocs.forEach((doc) => {
      updates.push(
        db.collection("users").doc(doc.id).update({
          quotexStatus: "pending",
          quotexStatusExpiry: admin.firestore.FieldValue.delete()
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
        expiredCount,
        timestamp: now.toISOString()
      })
    };
  } catch (err) {
    console.error("[Expire Access] Error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error' })
    };
  }
};
