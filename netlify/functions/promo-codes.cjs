const { admin, db, initError, getCorsHeaders, verifyAdmin, verifyFirebaseToken } = require('./firebase-admin-init.cjs');

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (!db) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service temporarily unavailable' }) };
  }

  const action = event.queryStringParameters?.action || '';

  if (event.httpMethod === 'GET' && action === 'validate') {
    const code = (event.queryStringParameters?.code || '').trim().toUpperCase();
    if (!code || !/^[A-Z0-9_-]{2,20}$/.test(code)) {
      return { statusCode: 400, headers, body: JSON.stringify({ valid: false, error: 'Invalid code format' }) };
    }

    try {
      const docRef = db.collection('promoCodes').doc(code);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return { statusCode: 200, headers, body: JSON.stringify({ valid: false, error: 'Invalid promo code' }) };
      }

      const data = docSnap.data();

      if (data.active === false) {
        return { statusCode: 200, headers, body: JSON.stringify({ valid: false, error: 'This promo code has expired' }) };
      }

      if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
        return { statusCode: 200, headers, body: JSON.stringify({ valid: false, error: 'This promo code has expired' }) };
      }

      if (data.maxUses && data.usedCount >= data.maxUses) {
        return { statusCode: 200, headers, body: JSON.stringify({ valid: false, error: 'This promo code has reached its usage limit' }) };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          valid: true,
          code: code,
          discount: data.discount || 0,
          label: data.label || (data.discount + '% OFF'),
          expiresAt: data.expiresAt ? data.expiresAt.toDate().toISOString() : null
        })
      };
    } catch (err) {
      console.error('Promo validate error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ valid: false, error: 'Server error' }) };
    }
  }

  if (event.httpMethod === 'GET' && action === 'list') {
    const adminAuth = await verifyAdmin(event);
    if (!adminAuth.authorized) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    try {
      const snap = await db.collection('promoCodes').orderBy('createdAt', 'desc').get();
      const codes = [];
      snap.forEach(doc => {
        const d = doc.data();
        codes.push({
          code: doc.id,
          discount: d.discount || 0,
          label: d.label || '',
          active: d.active !== false,
          maxUses: d.maxUses || null,
          usedCount: d.usedCount || 0,
          expiresAt: d.expiresAt ? d.expiresAt.toDate().toISOString() : null,
          createdAt: d.createdAt ? d.createdAt.toDate().toISOString() : null
        });
      });
      return { statusCode: 200, headers, body: JSON.stringify({ codes }) };
    } catch (err) {
      console.error('Promo list error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to list promo codes' }) };
    }
  }

  if (event.httpMethod === 'POST') {
    const adminAuth = await verifyAdmin(event);
    if (!adminAuth.authorized) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    try {
      const { action: postAction, code, discount, label, maxUses, expiresInDays } = JSON.parse(event.body);

      if (postAction === 'create') {
        if (!code || !discount) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Code and discount percentage are required' }) };
        }

        const cleanCode = code.trim().toUpperCase();
        if (!/^[A-Z0-9_-]{2,20}$/.test(cleanCode)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Code must be 2-20 alphanumeric characters' }) };
        }
        const discountVal = Math.min(100, Math.max(1, parseInt(discount)));
        const safeLabel = (label || '').replace(/[<>"'&]/g, '').substring(0, 50) || (discountVal + '% OFF');

        const docData = {
          discount: discountVal,
          label: safeLabel,
          active: true,
          usedCount: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (maxUses && parseInt(maxUses) > 0) {
          docData.maxUses = parseInt(maxUses);
        }

        if (expiresInDays && parseInt(expiresInDays) > 0) {
          const expiry = new Date();
          expiry.setDate(expiry.getDate() + parseInt(expiresInDays));
          docData.expiresAt = expiry;
        }

        await db.collection('promoCodes').doc(cleanCode).set(docData);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, code: cleanCode }) };
      }

      if (postAction === 'delete') {
        if (!code) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Code is required' }) };
        }
        await db.collection('promoCodes').doc(code.trim().toUpperCase()).delete();
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }

      if (postAction === 'toggle') {
        if (!code) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Code is required' }) };
        }
        const ref = db.collection('promoCodes').doc(code.trim().toUpperCase());
        const snap = await ref.get();
        if (!snap.exists) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: 'Code not found' }) };
        }
        const currentActive = snap.data().active !== false;
        await ref.update({ active: !currentActive });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, active: !currentActive }) };
      }

      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action' }) };
    } catch (err) {
      console.error('Promo create/delete error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
