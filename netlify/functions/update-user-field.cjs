const { admin, db, getCorsHeaders, verifyAdmin } = require('./firebase-admin-init.cjs');

const AUDITED_FIELDS = [
  'paymentStatus', 'quotexStatus', 'digimaxStatus',
  'recoveryRequest', 'DigimunXAdv', 'status', 'hedgerStatus'
];

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const adminAuth = await verifyAdmin(event);
  if (!adminAuth.authorized) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    if (!db) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service unavailable' }) };
    }

    const parsed = JSON.parse(event.body || '{}');
    const { userEmail, field, value, expiryData } = parsed;

    if (!userEmail || typeof userEmail !== 'string' || userEmail.length > 320) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid user email' }) };
    }

    if (!field || typeof field !== 'string' || !AUDITED_FIELDS.includes(field)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid field' }) };
    }

    if (!value || typeof value !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid value' }) };
    }

    const emailLower = userEmail.toLowerCase().trim();
    const userDoc = await db.collection('users').doc(emailLower).get();
    if (!userDoc.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'User not found' }) };
    }

    const previousData = userDoc.data();
    const previousValue = previousData[field] || 'unknown';

    const updateData = { [field]: value };

    if (expiryData && typeof expiryData === 'object' && expiryData.expiryField && expiryData.expiryValue) {
      updateData[expiryData.expiryField] = new Date(expiryData.expiryValue);
    }

    const expiryFieldMap = {
      'paymentStatus': 'paymentStatusExpiry',
      'quotexStatus': 'quotexStatusExpiry',
      'recoveryRequest': 'recoveryRequestExpiry',
      'digimaxStatus': 'digimaxStatusExpiry'
    };
    if (value === 'pending' && expiryFieldMap[field]) {
      updateData[expiryFieldMap[field]] = admin.firestore.FieldValue.delete();
    }

    await db.collection('users').doc(emailLower).update(updateData);

    await db.collection('auditLog').add({
      action: 'field_update',
      targetUser: emailLower,
      field: field,
      previousValue: previousValue,
      newValue: value,
      adminEmail: adminAuth.email.toLowerCase().trim(),
      adminUid: adminAuth.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      clientIP: event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown'
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        field,
        previousValue,
        newValue: value
      })
    };
  } catch (err) {
    console.error('update-user-field error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to update field' }) };
  }
};
