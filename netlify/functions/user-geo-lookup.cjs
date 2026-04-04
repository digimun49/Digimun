const fetch = globalThis.fetch || require('node-fetch');
const { admin, db, getCorsHeaders, verifyFirebaseToken } = require('./firebase-admin-init.cjs');
const { getClientIP, isRateLimited } = require('./rate-limiter.cjs');

async function lookupGeo(ip) {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') {
    return null;
  }
  try {
    const resp = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.error) {
      return {
        country: data.country_name || '',
        countryCode: data.country_code || '',
        region: data.region || '',
        city: data.city || '',
        isp: data.org || '',
        lat: data.latitude || 0,
        lng: data.longitude || 0
      };
    }
    return null;
  } catch (e) {
    console.error('GeoIP lookup failed:', e.message);
    return null;
  }
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

  try {
    const clientIP = getClientIP(event);
    const ipLimit = isRateLimited(`geo_ip:${clientIP}`, { maxRequests: 10, windowMs: 60 * 1000 });
    if (ipLimit.limited) {
      return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests' }) };
    }

    const authResult = await verifyFirebaseToken(event);
    if (!authResult.authenticated) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    const parsed = JSON.parse(event.body || '{}');
    const { deviceInfo, fingerprint, isSignup } = parsed;

    const emailLower = (authResult.email || '').trim().toLowerCase();
    if (!emailLower) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No email in token' }) };
    }
    const geo = await lookupGeo(clientIP);

    if (!db) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database unavailable' }) };
    }

    const userRef = db.collection('users').doc(emailLower);
    const userDoc = await userRef.get();

    function safeStr(val, maxLen = 100) {
      if (typeof val !== 'string') return '';
      return val.substring(0, maxLen);
    }

    const trackingMeta = {
      lastIP: safeStr(clientIP, 45),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      deviceFingerprint: safeStr(fingerprint, 128) || null,
      deviceInfo: {
        browser: safeStr(deviceInfo && deviceInfo.browser, 50),
        browserVersion: safeStr(deviceInfo && deviceInfo.browserVersion, 20),
        os: safeStr(deviceInfo && deviceInfo.os, 30),
        osVersion: safeStr(deviceInfo && deviceInfo.osVersion, 20),
        screen: safeStr(deviceInfo && deviceInfo.screen, 20),
        language: safeStr(deviceInfo && deviceInfo.language, 20),
        timezone: safeStr(deviceInfo && deviceInfo.timezone, 50),
        platform: safeStr(deviceInfo && deviceInfo.platform, 30),
        userAgent: safeStr(deviceInfo && deviceInfo.userAgent, 250)
      }
    };

    if (geo) {
      trackingMeta.lastGeo = geo;
    }

    let ipHistory = [];
    if (userDoc.exists) {
      const existingData = userDoc.data();
      const existingTracking = existingData.trackingMeta || {};
      ipHistory = existingTracking.ipHistory || [];
    }

    if (clientIP && clientIP !== 'unknown' && !ipHistory.includes(clientIP)) {
      ipHistory.push(clientIP);
      if (ipHistory.length > 5) {
        ipHistory = ipHistory.slice(-5);
      }
    }
    trackingMeta.ipHistory = ipHistory;

    if (isSignup) {
      trackingMeta.signupIP = clientIP;
      if (geo) trackingMeta.signupGeo = geo;
    }

    await userRef.set({ trackingMeta }, { merge: true });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, ip: clientIP, geo: geo || null })
    };
  } catch (err) {
    console.error('user-geo-lookup error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Tracking update failed' }) };
  }
};
