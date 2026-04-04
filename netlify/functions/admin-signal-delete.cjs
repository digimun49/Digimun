const { admin, db, initError, getCorsHeaders, verifyAdmin, logAdminAction } = require('./firebase-admin-init.cjs');

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

  const adminAuth = await verifyAdmin(event, { requireSuperAdmin: true });
  if (!adminAuth.authorized) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: adminAuth.error || 'Unauthorized' }) };
  }

  try {
    const { signalId } = JSON.parse(event.body || '{}');

    if (!signalId || typeof signalId !== 'string' || signalId.length > 128) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid signalId is required' }) };
    }

    const signalRef = db.collection('signals').doc(signalId);
    const signalDoc = await signalRef.get();

    if (!signalDoc.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Signal not found' }) };
    }

    const signalData = signalDoc.data();

    if (signalData.result) {
      const userRef = db.collection('users').doc((signalData.userEmail || '').toLowerCase().trim());
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

    const clientIP = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    await logAdminAction({
      adminEmail: adminAuth.email,
      action: 'signal_delete',
      target: signalId,
      targetType: 'signal',
      details: { pair: signalData.pair, userEmail: signalData.userEmail, result: signalData.result },
      before: { pair: signalData.pair, direction: signalData.direction, result: signalData.result },
      after: null,
      ip: clientIP
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Signal deleted successfully' })
    };
  } catch (err) {
    console.error('admin-signal-delete error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to delete signal' }) };
  }
};
