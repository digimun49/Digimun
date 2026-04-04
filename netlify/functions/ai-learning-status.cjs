const { admin, db, initError, getCorsHeaders, verifyAdmin } = require('./firebase-admin-init.cjs');

async function getSignalLearningContext(pair) {
  if (!db) return '';
  try {
    const snapshot = await db.collection('signals').get();
    if (snapshot.empty) return '';
    
    const allSignals = [];
    snapshot.forEach(doc => allSignals.push(doc.data()));
    
    let filtered = allSignals.filter(s => s.status === 'completed');
    if (pair && pair !== 'Unknown' && pair !== '') {
      filtered = filtered.filter(s => s.pair === pair);
    }
    if (filtered.length === 0) return '';
    
    filtered.sort((a, b) => {
      const aTime = a.createdAt?._seconds || 0;
      const bTime = b.createdAt?._seconds || 0;
      return bTime - aTime;
    });
    const limitedSignals = filtered.slice(0, 30);

    const wins = limitedSignals.filter(s => s.result === 'WIN');
    const losses = limitedSignals.filter(s => s.result === 'LOSS');
    const total = wins.length + losses.length;
    const winRate = total > 0 ? ((wins.length / total) * 100).toFixed(1) : 0;

    const winReasons = wins.map(s => s.reason).filter(Boolean).slice(0, 10);
    const lossReasons = losses.map(s => s.failureReason || s.reason).filter(Boolean).slice(0, 10);

    const winDirections = wins.reduce((acc, s) => {
      acc[s.signal] = (acc[s.signal] || 0) + 1;
      return acc;
    }, {});

    const lossDirections = losses.reduce((acc, s) => {
      acc[s.signal] = (acc[s.signal] || 0) + 1;
      return acc;
    }, {});

    let context = `Past Signal Performance (${pair || 'all pairs'}):\n`;
    context += `Total completed: ${total} | Wins: ${wins.length} | Losses: ${losses.length} | Win Rate: ${winRate}%\n`;
    context += `Winning signal types: ${JSON.stringify(winDirections)}\n`;
    context += `Losing signal types: ${JSON.stringify(lossDirections)}\n`;

    if (winReasons.length > 0) {
      context += `Common WINNING patterns/reasons: ${winReasons.join(' | ')}\n`;
    }
    if (lossReasons.length > 0) {
      context += `Common LOSING patterns/reasons: ${lossReasons.join(' | ')}\n`;
    }

    const recentTimes = limitedSignals.slice(0, 5).map(s => `${s.signalTime || ''} ${s.pair || ''} ${s.signal || ''} → ${s.result || ''}`);
    if (recentTimes.length > 0) {
      context += `Recent signals: ${recentTimes.join('; ')}\n`;
    }

    return context;
  } catch (e) {
    console.error('Learning context fetch error:', e.message);
    return '';
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

  const adminAuth = await verifyAdmin(event);
  if (!adminAuth.authorized) {
    return { statusCode: 401, headers, body: JSON.stringify({ status: 'error', issues: ['Unauthorized'], details: {} }) };
  }

  try {
    const diagnostics = {
      status: 'unknown',
      issues: [],
      details: {}
    };

    if (!db) {
      diagnostics.status = 'error';
      diagnostics.issues.push('Firebase Admin SDK not initialized');
      return { statusCode: 200, headers, body: JSON.stringify(diagnostics) };
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      diagnostics.issues.push('OPENAI_API_KEY not set - AI cannot analyze charts or use learning data');
    } else {
      diagnostics.details.openai = 'API key configured';
    }

    const allCompletedSnap = await db.collection('signals')
      .where('status', '==', 'completed')
      .get();
    const allDocs = [];
    allCompletedSnap.forEach(doc => allDocs.push(doc.data()));
    allDocs.sort((a, b) => {
      const aTime = a.createdAt?._seconds || 0;
      const bTime = b.createdAt?._seconds || 0;
      return bTime - aTime;
    });
    const signals = allDocs.slice(0, 50);
    const totalCompleted = signals.length;
    diagnostics.details.totalCompletedSignals = totalCompleted;

    if (totalCompleted === 0) {
      diagnostics.issues.push('No completed signals found in Firestore - AI has zero data to learn from.');
    }

    const wins = signals.filter(s => s.result === 'WIN');
    const losses = signals.filter(s => s.result === 'LOSS');
    const invalidOrRefunded = signals.filter(s => s.result === 'INVALID' || s.result === 'REFUNDED');
    const noResult = signals.filter(s => !s.result);

    diagnostics.details.breakdown = {
      wins: wins.length,
      losses: losses.length,
      invalidOrRefunded: invalidOrRefunded.length,
      noResult: noResult.length
    };

    diagnostics.details.winRate = (wins.length + losses.length) > 0
      ? ((wins.length / (wins.length + losses.length)) * 100).toFixed(1) + '%'
      : 'N/A';

    const withReasons = signals.filter(s => s.reason && s.reason.trim() !== '');
    const withFailureReasons = losses.filter(s => s.failureReason && s.failureReason.trim() !== '');
    diagnostics.details.signalsWithReasons = withReasons.length;
    diagnostics.details.lossesWithFailureReasons = withFailureReasons.length;

    if (wins.length > 0 && withReasons.length === 0) {
      diagnostics.issues.push('Winning signals have no "reason" field');
    }
    if (losses.length > 0 && withFailureReasons.length === 0) {
      diagnostics.issues.push('Losing signals have no "failureReason" field');
    }

    const pairs = {};
    signals.forEach(s => {
      const p = s.pair || 'Unknown';
      if (!pairs[p]) pairs[p] = { wins: 0, losses: 0, total: 0 };
      pairs[p].total++;
      if (s.result === 'WIN') pairs[p].wins++;
      if (s.result === 'LOSS') pairs[p].losses++;
    });
    diagnostics.details.pairBreakdown = pairs;

    if (totalCompleted < 5) {
      diagnostics.issues.push(`Only ${totalCompleted} completed signals - AI needs at least 10-15 for meaningful learning`);
    }

    const testContext = await getSignalLearningContext('');
    if (!testContext || testContext.trim() === '') {
      diagnostics.issues.push('getSignalLearningContext() returned empty');
      diagnostics.details.learningContextGenerated = false;
    } else {
      diagnostics.details.learningContextGenerated = true;
      diagnostics.details.learningContextPreview = testContext.substring(0, 500);
    }

    const recentSignals = signals.slice(0, 5).map(s => ({
      pair: s.pair || 'Unknown',
      signal: s.signal || '?',
      result: s.result || 'none',
      hasReason: !!(s.reason && s.reason.trim()),
      hasFailureReason: !!(s.failureReason && s.failureReason.trim()),
      createdAt: s.createdAt ? (s.createdAt._seconds ? new Date(s.createdAt._seconds * 1000).toISOString() : s.createdAt) : 'unknown'
    }));
    diagnostics.details.recentSignals = recentSignals;

    if (diagnostics.issues.length === 0) {
      diagnostics.status = 'healthy';
    } else if (diagnostics.issues.some(i => i.includes('not initialized') || i.includes('OPENAI_API_KEY not set') || i.includes('returned empty'))) {
      diagnostics.status = 'error';
    } else {
      diagnostics.status = 'warning';
    }

    return { statusCode: 200, headers, body: JSON.stringify(diagnostics) };
  } catch (err) {
    console.error('ai-learning-status error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ status: 'error', issues: ['Internal server error'], details: {} }) };
  }
};
