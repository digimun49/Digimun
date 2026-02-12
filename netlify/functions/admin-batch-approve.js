const { admin, db } = require('./firebase-admin-init');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const ADMIN_EMAIL = 'digimun249@gmail.com';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { adminEmail, batchId, approveForLive } = JSON.parse(event.body);

    if (adminEmail !== ADMIN_EMAIL) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    if (!batchId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'batchId is required' }) };
    }

    const batchRef = db.collection('signalBatches').doc(batchId);
    const batchDoc = await batchRef.get();

    if (!batchDoc.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Batch not found' }) };
    }

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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Batch approved successfully' })
    };
  } catch (err) {
    console.error('admin-batch-approve error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
