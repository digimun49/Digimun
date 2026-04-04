const { getCorsHeaders, verifyAdmin, logAdminAction } = require('./firebase-admin-init.cjs');

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const adminResult = await verifyAdmin(event);
    if (!adminResult.authorized) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: adminResult.error }) };
    }

    const body = JSON.parse(event.body || '{}');
    const { action, target, targetType, details, before, after } = body;

    if (!action) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing action field' }) };
    }

    await logAdminAction({
      adminEmail: adminResult.email,
      action,
      target: target || null,
      targetType: targetType || null,
      details: details || null,
      before: before || null,
      after: after || null,
      ip: event.headers?.['x-forwarded-for'] || event.headers?.['client-ip'] || null
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('Audit log error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
