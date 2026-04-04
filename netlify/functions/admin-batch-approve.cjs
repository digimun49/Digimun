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
    const { batchId, approveForLive } = JSON.parse(event.body || '{}');

    if (!batchId || typeof batchId !== 'string' || batchId.length > 128) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid batchId is required' }) };
    }

    const batchRef = db.collection('signalBatches').doc(batchId);
    const batchDoc = await batchRef.get();

    if (!batchDoc.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Batch not found' }) };
    }

    const beforeData = batchDoc.data();

    await batchRef.update({
      status: 'approved',
      approvedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    if (approveForLive) {
      const batchData = batchDoc.data();
      const signalIds = batchData.signalIds || [];

      const batch = db.batch();
      signalIds.forEach(sid => {
        batch.update(db.collection('signals').doc(sid), { approvedForLive: true });
      });
      await batch.commit();
    }

    const clientIP = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    await logAdminAction({
      adminEmail: adminAuth.email,
      action: 'batch_approve',
      target: batchId,
      targetType: 'signalBatch',
      details: { approveForLive: !!approveForLive, signalCount: beforeData.signalIds?.length || 0 },
      before: { status: beforeData.status },
      after: { status: 'approved' },
      ip: clientIP
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Batch approved successfully' })
    };
  } catch (err) {
    console.error('admin-batch-approve error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to approve batch' }) };
  }
};
