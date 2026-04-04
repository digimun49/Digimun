const { db, initError, getCorsHeaders, verifyFirebaseToken, isAdminEmail } = require('./firebase-admin-init.cjs');

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (!db) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service temporarily unavailable' }) };
  }

  try {
    const isAdminRequest = event.headers?.authorization;
    const includeAdminFields = false;

    if (isAdminRequest) {
      const authResult = await verifyFirebaseToken(event);
      if (authResult.authenticated && isAdminEmail(authResult.email)) {
        var showAdminFields = true;
      }
    }

    const snap = await db.collection('notifications')
      .orderBy('timestamp', 'desc')
      .limit(30)
      .get();

    const notifications = [];
    snap.forEach(doc => {
      const d = doc.data();
      if (d.broadcast !== false) {
        const entry = {
          id: doc.id,
          title: d.title || 'Notification',
          body: d.body || '',
          url: d.url || '/dashboard',
          timestamp: d.timestamp || 0
        };
        if (showAdminFields) {
          entry.target = d.target || 'all';
          entry.sent = d.sent || 0;
          entry.failed = d.failed || 0;
        }
        notifications.push(entry);
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ notifications: notifications.slice(0, 20) })
    };
  } catch (err) {
    console.error('Get notifications error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to fetch notifications' }) };
  }
};
