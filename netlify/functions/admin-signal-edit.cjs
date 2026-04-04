const { admin, db, initError, getCorsHeaders, verifyAdmin, logAdminAction } = require('./firebase-admin-init.cjs');

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

  const adminAuth = await verifyAdmin(event);
  if (!adminAuth.authorized) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { signalId, updates } = JSON.parse(event.body || '{}');

    if (!signalId || typeof signalId !== 'string' || signalId.length > 128) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid signalId is required' }) };
    }

    if (!updates || typeof updates !== 'object') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'updates object is required' }) };
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

      const userRef = db.collection('users').doc((currentData.userEmail || '').toLowerCase().trim());

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

    const clientIP = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    const beforeSnapshot = {};
    const afterSnapshot = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        beforeSnapshot[field] = currentData[field] || null;
        afterSnapshot[field] = updates[field];
      }
    }
    await logAdminAction({
      adminEmail: adminAuth.email,
      action: 'signal_edit',
      target: signalId,
      targetType: 'signal',
      details: { pair: currentData.pair, userEmail: currentData.userEmail },
      before: beforeSnapshot,
      after: afterSnapshot,
      ip: clientIP
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Signal updated successfully' })
    };
  } catch (err) {
    console.error('admin-signal-edit error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to update signal' }) };
  }
};
