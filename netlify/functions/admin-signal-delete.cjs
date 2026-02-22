const { admin, db } = require('./firebase-admin-init.cjs');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  if (!db) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database not initialized. Check FIREBASE_SERVICE_ACCOUNT environment variable.' }) };
  }

  try {
    const { adminEmail, signalId } = JSON.parse(event.body);

    if (adminEmail !== ADMIN_EMAIL) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    if (!signalId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'signalId is required' }) };
    }

    const signalRef = db.collection('signals').doc(signalId);
    const signalDoc = await signalRef.get();

    if (!signalDoc.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Signal not found' }) };
    }

    const signalData = signalDoc.data();

    if (signalData.result) {
      const userRef = db.collection('users').doc(signalData.userEmail);
      const statsUpdate = {
        totalSignals: admin.firestore.FieldValue.increment(-1)
      };

      if (signalData.result === 'WIN') statsUpdate.wins = admin.firestore.FieldValue.increment(-1);
      if (signalData.result === 'LOSS') statsUpdate.losses = admin.firestore.FieldValue.increment(-1);
      if (signalData.result === 'INVALID') statsUpdate.invalid = admin.firestore.FieldValue.increment(-1);
      if (signalData.result === 'REFUNDED') statsUpdate.refunded = admin.firestore.FieldValue.increment(-1);

      await userRef.set(statsUpdate, { merge: true });
    }

    if (signalData.batchId) {
      const batchRef = db.collection('signalBatches').doc(signalData.batchId);
      const batchDoc = await batchRef.get();
      if (batchDoc.exists) {
        const batchData = batchDoc.data();
        const updatedIds = (batchData.signalIds || []).filter(id => id !== signalId);
        await batchRef.update({
          signalIds: updatedIds,
          signalCount: updatedIds.length
        });
      }
    }

    await signalRef.delete();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Signal deleted successfully' })
    };
  } catch (err) {
    console.error('admin-signal-delete error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
