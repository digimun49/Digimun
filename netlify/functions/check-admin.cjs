const { getCorsHeaders, verifyFirebaseToken, isAdminOrModerator, getAdminRole } = require('./firebase-admin-init.cjs');
const { isRateLimited, getClientIP } = require('./rate-limiter.cjs');

const ADMIN_ROUTE = process.env.ADMIN_PANEL_ROUTE || '';

if (!ADMIN_ROUTE) {
  console.warn('[check-admin] ADMIN_PANEL_ROUTE environment variable is not set. Admin panel route will be unavailable.');
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const clientIP = getClientIP(event);
  const ipCheck = isRateLimited(`check_admin_ip:${clientIP}`, { maxRequests: 20, windowMs: 60 * 1000 });
  if (ipCheck.limited) {
    return { statusCode: 429, headers, body: JSON.stringify({ isAdmin: false, error: 'Too many requests' }) };
  }

  try {
    const authResult = await verifyFirebaseToken(event);
    if (!authResult.authenticated) {
      return { statusCode: 200, headers, body: JSON.stringify({ isAdmin: false }) };
    }

    const role = getAdminRole(authResult.email);

    if (role) {
      if (!ADMIN_ROUTE) {
        return { statusCode: 200, headers, body: JSON.stringify({ isAdmin: true, role }) };
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ isAdmin: true, r: ADMIN_ROUTE, role })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ isAdmin: false })
    };
  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ isAdmin: false }) };
  }
};
