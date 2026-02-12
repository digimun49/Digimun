const { admin, db } = require('./firebase-admin-init');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const VALID_RESULTS = ['WIN', 'LOSS', 'INVALID', 'REFUNDED'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { userEmail, signalId, result } = JSON.parse(event.body);

    if (!userEmail || !signalId || !result) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'userEmail, signalId, and result are required' }) };
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

    if (signalData.userEmail !== userEmail) {
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

    const completedSnap = await db.collection('signals')
      .where('userEmail', '==', userEmail)
      .where('status', '==', 'completed')
      .where('batchId', '==', null)
      .get();

    if (completedSnap.size >= 15) {
      const batchSignalIds = completedSnap.docs.slice(0, 15).map(d => d.id);

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
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
