const { admin, db, initError, getCorsHeaders, verifyFirebaseToken } = require('./firebase-admin-init.cjs');
const { verifyPremiumAccess } = require('./verify-premium-access.cjs');

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  if (!db) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service temporarily unavailable' }) };
  }

  const authResult = await verifyFirebaseToken(event);
  if (!authResult.authenticated) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
  }

  try {
    const parsed = JSON.parse(event.body);
    const userEmail = authResult.email.toLowerCase().trim();
    const { pair, direction, signal, confidence, reason, failureReason, entryTip, signalTime, volatility, market_state, pattern_clarity, sr_proximity, mtg, patterns } = parsed;

    if (!userEmail) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'userEmail is required' }) };
    }

    const accessCheck = await verifyPremiumAccess(userEmail, 'paymentStatus');
    if (!accessCheck.allowed) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: accessCheck.reason, requiresVerification: accessCheck.requiresVerification || false }) };
    }

    const userSignalsSnap = await db.collection('signals')
      .where('userEmail', '==', userEmail)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    const pendingDocs = userSignalsSnap.docs;

    if (pendingDocs.length > 0) {
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
      confidence: confidence || 72,
      reason: reason || '',
      failureReason: failureReason || '',
      entryTip: entryTip || '',
      signalTime: signalTime || '',
      volatility: volatility || '',
      market_state: market_state || '',
      pattern_clarity: pattern_clarity || '',
      sr_proximity: sr_proximity || '',
      mtg: mtg || '',
      patterns: patterns || '',
      result: null,
      status: 'pending',
      batchId: null,
      approvedForLive: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('signals').add(signalData);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        signalId: docRef.id,
        sequentialId,
        message: 'Signal submitted successfully'
      })
    };
  } catch (err) {
    console.error('signal-analyze error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to submit signal' }) };
  }
};
