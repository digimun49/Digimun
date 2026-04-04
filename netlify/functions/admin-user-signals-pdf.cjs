const { admin, db, initError, getCorsHeaders, verifyAdmin } = require('./firebase-admin-init.cjs');

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
    const { userEmail } = JSON.parse(event.body);

    if (!userEmail) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'userEmail is required' }) };
    }

    const signalsSnap = await db.collection('signals')
      .where('userEmail', '==', userEmail)
      .get();

    const signals = signalsSnap.docs.map(doc => {
      const data = doc.data();
      const createdAt = data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : '';
      const resultSubmittedAt = data.resultSubmittedAt ? (data.resultSubmittedAt.toDate ? data.resultSubmittedAt.toDate().toISOString() : data.resultSubmittedAt) : '';
      return {
        signalId: doc.id,
        sequentialId: data.sequentialId || null,
        pair: data.pair || '',
        direction: data.direction || '',
        signal: data.signal || '',
        confidence: data.confidence || 0,
        reason: data.reason || '',
        failureReason: data.failureReason || '',
        entryTip: data.entryTip || '',
        signalTime: data.signalTime || '',
        result: data.result || '',
        status: data.status || '',
        createdAt,
        resultSubmittedAt
      };
    });

    signals.sort((a, b) => (b.sequentialId || 0) - (a.sequentialId || 0));

    let user = { email: userEmail, displayName: '', wins: 0, losses: 0, invalid: 0, refunded: 0, totalSignals: 0 };

    const usersSnap = await db.collection('users')
      .where('email', '==', userEmail)
      .limit(1)
      .get();

    if (!usersSnap.empty) {
      const userData = usersSnap.docs[0].data();
      user.displayName = userData.displayName || userData.name || '';
      user.wins = userData.wins || 0;
      user.losses = userData.losses || 0;
      user.invalid = userData.invalid || 0;
      user.refunded = userData.refunded || 0;
      user.totalSignals = userData.totalSignals || 0;
    }

    let wins = 0, losses = 0, invalid = 0, refunded = 0;
    signals.forEach(s => {
      if (s.result === 'WIN') wins++;
      if (s.result === 'LOSS') losses++;
      if (s.result === 'INVALID') invalid++;
      if (s.result === 'REFUNDED') refunded++;
    });

    const total = signals.length;
    const totalDecided = wins + losses;
    const winRate = totalDecided > 0 ? Math.round((wins / totalDecided) * 100) : 0;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        user,
        signals,
        stats: { total, wins, losses, invalid, refunded, winRate }
      })
    };
  } catch (err) {
    console.error('admin-user-signals-pdf error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to fetch user signals' }) };
  }
};
