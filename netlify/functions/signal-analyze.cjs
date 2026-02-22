const { admin, db, initError } = require('./firebase-admin-init.cjs');

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
    const { userEmail, pair, direction, signal, confidence, reason, failureReason, entryTip, signalTime } = JSON.parse(event.body);

    if (!userEmail) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'userEmail is required' }) };
    }

    const pendingSnap = await db.collection('signals')
      .where('userEmail', '==', userEmail)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!pendingSnap.empty) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Complete your pending signal first' }) };
    }

    let sequentialId;
    const counterRef = db.collection('signalCounters').doc('main');

    await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      if (!counterDoc.exists) {
        sequentialId = 1;
        transaction.set(counterRef, { lastSequentialId: 1 });
      } else {
        sequentialId = (counterDoc.data().lastSequentialId || 0) + 1;
        transaction.update(counterRef, { lastSequentialId: sequentialId });
      }
    });

    const signalData = {
      sequentialId,
      userEmail,
      pair: pair || 'Unknown',
      direction: direction || 'UP',
      signal: signal || 'CALL',
      confidence: confidence || 0,
      reason: reason || '',
      failureReason: failureReason || '',
      entryTip: entryTip || '',
      signalTime: signalTime || '',
      result: null,
      status: 'pending',
      batchId: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      resultSubmittedAt: null,
      adminEdited: false,
      approvedForLive: false
    };

    const docRef = await db.collection('signals').add(signalData);

    const responseSignal = {
      signalId: docRef.id,
      userEmail: signalData.userEmail,
      pair: signalData.pair,
      direction: signalData.direction,
      signal: signalData.signal,
      confidence: signalData.confidence,
      reason: signalData.reason,
      failureReason: signalData.failureReason,
      entryTip: signalData.entryTip,
      signalTime: signalData.signalTime,
      result: signalData.result,
      status: signalData.status
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, signal: responseSignal })
    };
  } catch (err) {
    console.error('signal-analyze error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
