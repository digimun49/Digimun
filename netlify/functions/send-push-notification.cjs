const { admin, db, initError, getCorsHeaders, verifyAdmin } = require('./firebase-admin-init.cjs');

const SEGMENTS = ['no_bots', 'has_pro_only', 'has_digimax_only', 'has_digimunx_only', 'missing_digimunx', 'vip'];

function getUserBotInfo(data) {
  const hasPro = (data.quotexStatus || '').toLowerCase() === 'approved';
  const hasDigimax = ['approved', 'active'].includes((data.digimaxStatus || '').toLowerCase());
  const hasDigimunx = ['approved', 'active'].includes((data.recoveryRequest || '').toLowerCase());
  return { hasPro, hasDigimax, hasDigimunx, count: (hasPro ? 1 : 0) + (hasDigimax ? 1 : 0) + (hasDigimunx ? 1 : 0) };
}

function matchesSegment(segment, botInfo) {
  const { hasPro, hasDigimax, hasDigimunx, count } = botInfo;
  switch (segment) {
    case 'no_bots': return count === 0;
    case 'has_pro_only': return hasPro && !hasDigimax && !hasDigimunx;
    case 'has_digimax_only': return hasDigimax && !hasPro && !hasDigimunx;
    case 'has_digimunx_only': return hasDigimunx && !hasPro && !hasDigimax;
    case 'missing_digimunx': return (hasPro || hasDigimax) && !hasDigimunx;
    case 'vip': return count >= 2;
    default: return false;
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

  if (!db) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service temporarily unavailable' }) };
  }

  const adminAuth = await verifyAdmin(event);
  if (!adminAuth.authorized) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const parsed = JSON.parse(event.body || '{}');
    const { title, body: notifBody, url, target, segment } = parsed;

    if (!title || typeof title !== 'string' || !notifBody || typeof notifBody !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Title and body are required and must be strings' }) };
    }

    if (title.length > 200) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Title must be 200 characters or less' }) };
    }

    if (notifBody.length > 2000) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body must be 2000 characters or less' }) };
    }

    if (url && (typeof url !== 'string' || url.length > 500 || (!url.startsWith('/') && !url.startsWith('https://')))) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid URL format' }) };
    }

    if (target && typeof target !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid target format' }) };
    }

    if (segment && typeof segment !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid segment format' }) };
    }

    const clickUrl = url || '/dashboard';
    let tokens = [];
    let notifTarget = 'all';

    if (segment && SEGMENTS.includes(segment)) {
      notifTarget = 'segment:' + segment;
      const usersSnap = await db.collection('users').where('fcmTokens', '!=', null).get();
      usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.fcmTokens && Array.isArray(data.fcmTokens) && data.fcmTokens.length > 0) {
          const botInfo = getUserBotInfo(data);
          if (matchesSegment(segment, botInfo)) {
            tokens.push(...data.fcmTokens);
          }
        }
      });
    } else if (target === 'all') {
      const usersSnap = await db.collection('users').where('fcmTokens', '!=', null).get();
      usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
          tokens.push(...data.fcmTokens);
        }
      });
    } else if (target && target.includes('@')) {
      notifTarget = target;
      const emailKey = target.toLowerCase();
      const userDoc = await db.collection('users').doc(emailKey).get();
      if (userDoc.exists && userDoc.data().fcmTokens) {
        tokens.push(...userDoc.data().fcmTokens);
      }
    } else {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid target. Use "all", an email address, or a segment.' }) };
    }

    tokens = [...new Set(tokens)];

    if (tokens.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, sent: 0, failed: 0, totalTokens: 0, staleCleaned: 0, message: 'No tokens found for target' })
      };
    }

    const message = {
      notification: { title, body: notifBody },
      data: { url: clickUrl, title, body: notifBody },
      webpush: {
        notification: {
          title,
          body: notifBody,
          icon: '/assets/web-app-manifest-192x192.png',
          badge: '/assets/web-app-manifest-192x192.png',
          click_action: clickUrl
        },
        fcmOptions: { link: clickUrl }
      }
    };

    let sent = 0;
    let failed = 0;
    const staleTokens = [];

    const batchSize = 500;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      const responses = await Promise.allSettled(
        batch.map(token =>
          admin.messaging().send({ ...message, token })
        )
      );

      responses.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          sent++;
        } else {
          failed++;
          const errCode = res.reason?.code;
          if (errCode === 'messaging/registration-token-not-registered' ||
              errCode === 'messaging/invalid-registration-token') {
            staleTokens.push(batch[idx]);
          }
        }
      });
    }

    if (staleTokens.length > 0) {
      for (let i = 0; i < staleTokens.length; i += 10) {
        const chunk = staleTokens.slice(i, i + 10);
        const usersSnap = await db.collection('users').where('fcmTokens', 'array-contains-any', chunk).get();
        const writeBatch = db.batch();
        usersSnap.forEach(doc => {
          const data = doc.data();
          const cleaned = data.fcmTokens.filter(t => !staleTokens.includes(t));
          writeBatch.update(doc.ref, { fcmTokens: cleaned });
        });
        await writeBatch.commit();
      }
    }

    const isBroadcast = notifTarget === 'all' || notifTarget.startsWith('segment:');
    try {
      await db.collection('notifications').add({
        title,
        body: notifBody,
        url: clickUrl,
        target: notifTarget,
        broadcast: isBroadcast,
        sent,
        failed,
        createdAt: new Date().toISOString(),
        timestamp: Date.now()
      });
    } catch (logErr) {
      console.warn('Failed to log notification:', logErr.message);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        sent,
        failed,
        totalTokens: tokens.length,
        staleCleaned: staleTokens.length
      })
    };
  } catch (err) {
    console.error('Push notification error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to send notifications' }) };
  }
};
