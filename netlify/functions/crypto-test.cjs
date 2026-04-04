const fetch = globalThis.fetch || require('node-fetch');
const { getCorsHeaders, verifyAdmin } = require('./firebase-admin-init.cjs');

const TARGET_COINS = ['btc', 'eth', 'usdttrc20', 'ltc', 'bnbbsc', 'sol', 'doge', 'trx', 'xrp', 'matic'];

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const adminCheck = await verifyAdmin(event, { require2FA: false });
  if (!adminCheck.authorized) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin access required' }) };
  }

  const results = {
    apiKeySet: !!process.env.NOWPAYMENTS_API_KEY,
    apiKeyLength: (process.env.NOWPAYMENTS_API_KEY || '').length,
    ipnSecretSet: !!process.env.NOWPAYMENTS_IPN_SECRET,
    ipnSecretLength: (process.env.NOWPAYMENTS_IPN_SECRET || '').length,
    apiStatus: null,
    currencyCheck: null,
    coinEstimates: {},
    errors: []
  };

  const apiKey = process.env.NOWPAYMENTS_API_KEY;

  if (!apiKey) {
    results.errors.push('NOWPAYMENTS_API_KEY is not set in Netlify environment variables');
    return { statusCode: 200, headers, body: JSON.stringify(results, null, 2) };
  }

  try {
    const statusRes = await fetch('https://api.nowpayments.io/v1/status', {
      headers: { 'x-api-key': apiKey }
    });
    const statusData = await statusRes.json();
    results.apiStatus = statusData;
  } catch (e) {
    results.errors.push('Status check failed: ' + e.message);
  }

  try {
    const currRes = await fetch('https://api.nowpayments.io/v1/currencies', {
      headers: { 'x-api-key': apiKey }
    });
    const currData = await currRes.json();
    const allCurrencies = currData.currencies || [];
    const available = TARGET_COINS.filter(c => allCurrencies.includes(c));
    const missing = TARGET_COINS.filter(c => !allCurrencies.includes(c));
    results.currencyCheck = { available, missing, totalSupported: allCurrencies.length };
  } catch (e) {
    results.errors.push('Currencies check failed: ' + e.message);
  }

  const testAmount = 6;
  for (const coin of TARGET_COINS) {
    try {
      const estRes = await fetch(
        `https://api.nowpayments.io/v1/estimate?amount=${testAmount}&currency_from=usd&currency_to=${coin}`,
        { headers: { 'x-api-key': apiKey } }
      );
      if (!estRes.ok) {
        const errText = await estRes.text();
        results.coinEstimates[coin] = { status: 'FAIL', httpStatus: estRes.status, error: errText.substring(0, 200) };
      } else {
        const estData = await estRes.json();
        results.coinEstimates[coin] = {
          status: 'OK',
          estimatedAmount: estData.estimated_amount,
          currency: estData.currency_to
        };
      }
    } catch (e) {
      results.coinEstimates[coin] = { status: 'ERROR', error: e.message };
    }
  }

  const working = Object.entries(results.coinEstimates).filter(([_, v]) => v.status === 'OK').map(([k]) => k);
  const broken = Object.entries(results.coinEstimates).filter(([_, v]) => v.status !== 'OK').map(([k]) => k);
  results.summary = {
    workingCoins: working,
    brokenCoins: broken,
    totalWorking: working.length,
    totalBroken: broken.length
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(results, null, 2)
  };
};
