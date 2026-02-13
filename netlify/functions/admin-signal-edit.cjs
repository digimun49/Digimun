const { admin, db } = require('./firebase-admin-init.cjs');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const ADMIN_EMAIL = 'digimun249@gmail.com';
const VALID_RESULTS = ['WIN', 'LOSS', 'INVALID', 'REFUNDED'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { adminEmail, signalId, updates } = JSON.parse(event.body);

    if (adminEmail !== ADMIN_EMAIL) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    if (!signalId || !updates) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'signalId and updates are required' }) };
    }

    const signalRef = db.collection('signals').doc(signalId);
    const signalDoc = await signalRef.get();

    if (!signalDoc.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Signal not found' }) };
    }

    const currentData = signalDoc.data();
    const allowedFields = ['direction', 'signal', 'reason', 'result', 'pair', 'signalTime'];
    const updateData = { adminEdited: true };

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    if (updates.result && updates.result !== currentData.result) {
      if (!VALID_RESULTS.includes(updates.result)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid result value' }) };
      }

      const userRef = db.collection('users').doc(currentData.userEmail);

      if (currentData.result && VALID_RESULTS.includes(currentData.result)) {
        const oldField = currentData.result.toLowerCase() === 'win' ? 'wins' :
          currentData.result.toLowerCase() === 'loss' ? 'losses' :
          currentData.result.toLowerCase();
        await userRef.set({ [oldField]: admin.firestore.FieldValue.increment(-1) }, { merge: true });
      }

      if (!currentData.result) {
        updateData.status = 'completed';
        updateData.resultSubmittedAt = admin.firestore.FieldValue.serverTimestamp();
        await userRef.set({ totalSignals: admin.firestore.FieldValue.increment(1) }, { merge: true });
      }

      const newField = updates.result === 'WIN' ? 'wins' :
        updates.result === 'LOSS' ? 'losses' :
        updates.result.toLowerCase();
      await userRef.set({ [newField]: admin.firestore.FieldValue.increment(1) }, { merge: true });
    }

    await signalRef.update(updateData);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Signal updated successfully' })
    };
  } catch (err) {
    console.error('admin-signal-edit error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
