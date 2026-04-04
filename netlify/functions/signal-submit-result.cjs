const { admin, db, initError, getCorsHeaders, verifyFirebaseToken } = require('./firebase-admin-init.cjs');
const { verifyPremiumAccess } = require('./verify-premium-access.cjs');

const VALID_RESULTS = ['WIN', 'LOSS', 'INVALID', 'REFUNDED'];

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

    const accessCheck = await verifyPremiumAccess(userEmail, 'paymentStatus');
    if (!accessCheck.allowed) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: accessCheck.reason }) };
    }

    const signalId = parsed.signalId;
    const result = parsed.result;

    if (!userEmail || !signalId || !result) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'signalId and result are required' }) };
    }

    if (!VALID_RESULTS.includes(result)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'result must be WIN, LOSS, INVALID, or REFUNDED' }) };
    }

    const signalRef = db.collection('signals').doc(signalId);
    const signalDoc = await signalRef.get();

    if (!signalDoc.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Signal not found' }) };
    }

    const signalData = signalDoc.data();

    if ((signalData.userEmail || '').toLowerCase().trim() !== userEmail) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    if (signalData.status === 'completed') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Signal already completed' }) };
    }

    await signalRef.update({
      result,
      status: 'completed',
      resultSubmittedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const userRef = db.collection('users').doc(userEmail);
    const statsUpdate = {
      totalSignals: admin.firestore.FieldValue.increment(1)
    };

    if (result === 'WIN') statsUpdate.wins = admin.firestore.FieldValue.increment(1);
    if (result === 'LOSS') statsUpdate.losses = admin.firestore.FieldValue.increment(1);
    if (result === 'INVALID') statsUpdate.invalid = admin.firestore.FieldValue.increment(1);
    if (result === 'REFUNDED') statsUpdate.refunded = admin.firestore.FieldValue.increment(1);

    await userRef.set(statsUpdate, { merge: true });

    const userSignalsSnap = await db.collection('signals')
      .where('userEmail', '==', userEmail)
      .get();
    const unbatchedCompleted = userSignalsSnap.docs.filter(d => {
      const data = d.data();
      return data.status === 'completed' && (data.batchId === null || data.batchId === undefined);
    });

    if (unbatchedCompleted.length >= 15) {
      const batchSignalIds = unbatchedCompleted.slice(0, 15).map(d => d.id);

      const batchRef = await db.collection('signalBatches').add({
        userEmail,
        signalIds: batchSignalIds,
        signalCount: 15,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedAt: null,
        emailSent: false
      });

      const batch = db.batch();
      batchSignalIds.forEach(id => {
        batch.update(db.collection('signals').doc(id), { batchId: batchRef.id });
      });
      await batch.commit();
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Result submitted successfully' })
    };
  } catch (err) {
    console.error('signal-submit-result error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to submit result' }) };
  }
};
