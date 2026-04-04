const fetch = globalThis.fetch || require('node-fetch');
const { admin, db, initError, getCorsHeaders, verifyFirebaseToken } = require('./firebase-admin-init.cjs');

const BASE_PRICES = {
  probot: 6,
  digimaxx_1day: 7,
  digimaxx_3day: 14,
  digimaxx_lifetime: 49.99,
  digimunx_standard: 20,
  digimunx_discount: 10
};

function getAutoPayPrice(basePrice) {
  return basePrice < 11 ? Math.round(basePrice * 2 * 100) / 100 : Math.round(basePrice * 1.25 * 100) / 100;
}

const PRODUCTS = {
  probot: {
    name: 'Digimun Pro Bot',
    price: getAutoPayPrice(BASE_PRICES.probot),
    firestoreField: 'quotexStatus',
    duration: 'lifetime',
    emailFunction: 'send-probot-access-email',
    tier: 'lifetime'
  },
  digimaxx_1day: {
    name: 'DigiMaxx 1-Day',
    price: getAutoPayPrice(BASE_PRICES.digimaxx_1day),
    firestoreField: 'digimaxStatus',
    duration: '1day',
    emailFunction: 'send-digimaxx-access-email',
    tier: '1day'
  },
  digimaxx_3day: {
    name: 'DigiMaxx 3-Day',
    price: getAutoPayPrice(BASE_PRICES.digimaxx_3day),
    firestoreField: 'digimaxStatus',
    duration: '3day',
    emailFunction: 'send-digimaxx-access-email',
    tier: '3day'
  },
  digimaxx_lifetime: {
    name: 'DigiMaxx Lifetime',
    price: getAutoPayPrice(BASE_PRICES.digimaxx_lifetime),
    firestoreField: 'digimaxStatus',
    duration: 'lifetime',
    emailFunction: 'send-digimaxx-access-email',
    tier: 'lifetime'
  },
  digimunx_standard: {
    name: 'DigimunX Standard',
    price: getAutoPayPrice(BASE_PRICES.digimunx_standard),
    firestoreField: 'recoveryRequest',
    duration: '24h',
    emailFunction: 'send-digimunx-access-email',
    tier: 'standard'
  },
  digimunx_discount: {
    name: 'DigimunX Discounted',
    price: getAutoPayPrice(BASE_PRICES.digimunx_discount),
    firestoreField: 'recoveryRequest',
    duration: '24h',
    emailFunction: 'send-digimunx-access-email',
    tier: 'discounted'
  }
};

const SUPPORTED_CURRENCIES = {
  btc: 'btc', eth: 'eth', ltc: 'ltc', sol: 'sol', doge: 'doge', trx: 'trx', xrp: 'xrp',
  usdttrc20: 'usdttrc20', usdterc20: 'usdterc20', usdtbsc: 'usdtbsc',
  bnbbsc: 'bnbbsc', bnb: 'bnbbsc',
  matic: 'matic', maticpolygon: 'matic',
  ada: 'ada', dot: 'dot', avaxcchain: 'avaxcchain', shib: 'shib',
  link: 'link', uni: 'uni', atom: 'atom', near: 'near', apt: 'apt',
  xlm: 'xlm', algo: 'algo', etc: 'etc', bch: 'bch', fil: 'fil',
  eos: 'eos', xtz: 'xtz', aave: 'aave', mkr: 'mkr', dai: 'dai',
  usdcbsc: 'usdcbsc', usdcerc20: 'usdcerc20', usdctrc20: 'usdctrc20',
  vet: 'vet', zec: 'zec', xmr: 'xmr', dash: 'dash', hbar: 'hbar',
  ftm: 'ftm', sand: 'sand', mana: 'mana', grt: 'grt', cake: 'cake',
  crv: 'crv', ldo: 'ldo', op: 'op', arb: 'arb', pepe: 'pepe',
  ton: 'ton', sei: 'sei', inj: 'inj', sui: 'sui', bonk: 'bonk',
  floki: 'floki', one: 'one', celo: 'celo', kava: 'kava', waves: 'waves',
  neo: 'neo', zil: 'zil', bat: 'bat', '1inch': '1inch', comp: 'comp',
  snx: 'snx', theta: 'theta', busd: 'busd', iota: 'iota', egld: 'egld',
  xdc: 'xdc', kas: 'kas', tusd: 'tusd', wbtc: 'wbtc', stx: 'stx',
  cfx: 'cfx', rose: 'rose', ksm: 'ksm',
  imx: 'imx', ape: 'ape', lrc: 'lrc', ens: 'ens', chz: 'chz',
  gala: 'gala', axs: 'axs', flow: 'flow', rndr: 'rndr', qtum: 'qtum',
  ankr: 'ankr', skl: 'skl', storj: 'storj', glm: 'glm', mask: 'mask',
  audio: 'audio', celr: 'celr', ctsi: 'ctsi', ocean: 'ocean', fet: 'fet',
  agix: 'agix', woo: 'woo', dydx: 'dydx', rune: 'rune', jasmy: 'jasmy',
  mina: 'mina', flux: 'flux'
};

function mapNowPaymentsError(errText, statusCode) {
  const lower = (errText || '').toLowerCase();
  if (lower.includes('string did not match') || lower.includes('expected pattern')) {
    return 'This cryptocurrency is temporarily unavailable. Please try another coin.';
  }
  if (lower.includes('pair is disabled') || lower.includes('inactive')) {
    return 'This cryptocurrency pair is currently disabled. Please select a different coin.';
  }
  if (lower.includes('minimal payment amount') || lower.includes('min_amount')) {
    return 'The payment amount is below the minimum for this cryptocurrency. Please try a different coin.';
  }
  if (lower.includes('not valid') || lower.includes('not found') || lower.includes('do not support')) {
    return 'This cryptocurrency is not supported. Please select a different coin.';
  }
  if (lower.includes('unauthorized') || lower.includes('forbidden') || lower.includes('api key')) {
    return 'Payment service configuration error. Please contact support.';
  }
  if (lower.includes('rate') || lower.includes('too many')) {
    return 'Too many payment requests. Please wait a moment and try again.';
  }
  if (statusCode === 429) {
    return 'Too many requests to payment service. Please wait a minute and try again.';
  }
  if (statusCode >= 500) {
    return 'Payment service is temporarily down. Please try again in a few minutes.';
  }
  return 'Payment service error. Please try a different cryptocurrency or try again later.';
}

const recentRequests = new Map();

function rateLimit(ip, email) {
  const key = `${ip}_${email}`;
  const now = Date.now();
  const entry = recentRequests.get(key);
  if (entry && now - entry < 30000) {
    return false;
  }
  recentRequests.set(key, now);
  if (recentRequests.size > 1000) {
    const cutoff = now - 60000;
    for (const [k, v] of recentRequests) {
      if (v < cutoff) recentRequests.delete(k);
    }
  }
  return true;
}

const FUNCTION_VERSION = '2026-04-04-v5';

exports.handler = async (event) => {
  const t0 = Date.now();
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  try {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        version: FUNCTION_VERSION,
        status: 'ok',
        db: !!db,
        initError: initError || null,
        envVars: {
          NOWPAYMENTS_API_KEY: !!process.env.NOWPAYMENTS_API_KEY,
          NOWPAYMENTS_API_KEY_LENGTH: (process.env.NOWPAYMENTS_API_KEY || '').length,
          NOWPAYMENTS_IPN_SECRET: !!process.env.NOWPAYMENTS_IPN_SECRET,
          FIREBASE_SERVICE_ACCOUNT: !!process.env.FIREBASE_SERVICE_ACCOUNT,
          NODE_VERSION: process.version
        }
      })
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  console.log("Function started");
  console.log("Body:", event.body);
  console.log('[TIMING] handler start v' + FUNCTION_VERSION + ', db=' + !!db + ', NOWPAYMENTS_API_KEY=' + !!process.env.NOWPAYMENTS_API_KEY + ', NOWPAYMENTS_IPN_SECRET=' + !!process.env.NOWPAYMENTS_IPN_SECRET + ', FIREBASE_SERVICE_ACCOUNT=' + !!(process.env.FIREBASE_SERVICE_ACCOUNT));

  if (!db) {
    console.error('crypto-create-invoice: db not initialized, initError=' + initError);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service temporarily unavailable' }) };
  }

    const parsed = JSON.parse(event.body || '{}');
    const { productId, promoCode, payCurrency } = parsed;
    console.log('[TIMING] +' + (Date.now() - t0) + 'ms parsed body, productId=' + productId + ', payCurrency=' + payCurrency);

    if (!productId || !PRODUCTS[productId]) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid product' }) };
    }

    const product = PRODUCTS[productId];
    const clientIP = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    const userAgent = event.headers['user-agent'] || 'unknown';

    const authHeader = event.headers && (event.headers.authorization || event.headers.Authorization || '');
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;
    if (!idToken) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
    }

    let preEmail = '';
    try {
      const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
      preEmail = (payload.email || '').toLowerCase().trim();
    } catch (e) { /* token decode failed, auth will catch it */ }

    console.log('[TIMING] +' + (Date.now() - t0) + 'ms starting parallel auth + userDoc + promo');
    const parallelOps = [verifyFirebaseToken(event)];
    if (preEmail && db) {
      parallelOps.push(db.collection('users').doc(preEmail).get());
    } else {
      parallelOps.push(Promise.resolve(null));
    }

    let promoPromise = Promise.resolve(null);
    if (promoCode && db) {
      const cleanCode = promoCode.trim().toUpperCase();
      if (/^[A-Z0-9_-]{2,20}$/.test(cleanCode)) {
        promoPromise = db.collection('promoCodes').doc(cleanCode).get().catch(e => {
          console.error('Promo code check failed:', e.message);
          return null;
        });
      }
    }
    parallelOps.push(promoPromise);

    const [auth, userDoc, promoDoc] = await Promise.all(parallelOps);
    console.log('[TIMING] +' + (Date.now() - t0) + 'ms auth done, authenticated=' + auth.authenticated);

    if (!auth.authenticated) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
    }

    console.log("User:", auth.uid);
    const userEmail = auth.email.toLowerCase().trim();

    if (!rateLimit(clientIP, userEmail)) {
      return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests. Please wait 30 seconds.' }) };
    }

    const actualUserDoc = (preEmail === userEmail && userDoc) ? userDoc : null;

    if (actualUserDoc && actualUserDoc.exists) {
      const userData = actualUserDoc.data();
      const accessField = product.firestoreField;
      if (userData[accessField] === 'approved') {
        const expiryFieldMap = {
          'quotexStatus': 'quotexStatusExpiry',
          'digimaxStatus': 'digimaxStatusExpiry',
          'recoveryRequest': 'recoveryRequestExpiry'
        };
        const expiryField = expiryFieldMap[accessField];
        if (expiryField && userData[expiryField]) {
          const expiryDate = userData[expiryField].toDate ? userData[expiryField].toDate() : new Date(userData[expiryField]);
          if (expiryDate > new Date()) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'You already have access to this product.' }) };
          }
        } else if (product.duration === 'lifetime') {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'You already have access to this product.' }) };
        }
      }
    }

    if (payCurrency) {
      const resolvedCurrency = SUPPORTED_CURRENCIES[payCurrency.toLowerCase()];
      if (!resolvedCurrency) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unsupported cryptocurrency. Please select a different coin.' }) };
      }

      const apiKey = process.env.NOWPAYMENTS_API_KEY;
      if (!apiKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Payment service not configured. Please contact support.' }) };
      }

      let finalPrice = product.price;
      let appliedPromo = null;

      if (promoDoc && promoDoc.exists) {
        const promoData = promoDoc.data();
        if (promoData.active !== false &&
            (!promoData.expiresAt || promoData.expiresAt.toDate() > new Date()) &&
            (!promoData.maxUses || (promoData.usedCount || 0) < promoData.maxUses)) {
          const discount = promoData.discount || 0;
          finalPrice = product.price * (1 - discount / 100);
          finalPrice = Math.round(finalPrice * 100) / 100;
          appliedPromo = promoCode.trim().toUpperCase();
        }
      }

      const orderTimestamp = Date.now();
      const emailHash = userEmail.replace(/[^a-zA-Z0-9]/g, '');
      const orderId = `${productId}_${emailHash.substring(0, 20)}_${orderTimestamp}`;

      const durationLabel = product.duration === 'lifetime' ? 'Lifetime' : product.duration === '3day' ? '3-Day' : product.duration === '1day' ? '1-Day' : '24-Hour';

      const paymentPayload = {
        price_amount: finalPrice,
        price_currency: 'usd',
        pay_currency: resolvedCurrency,
        order_id: orderId,
        order_description: `${product.name} - ${durationLabel} Access`,
        ipn_callback_url: 'https://digimun.pro/.netlify/functions/crypto-ipn-webhook'
      };

      console.log('[TIMING] +' + (Date.now() - t0) + 'ms calling NOWPayments /v1/payment');
      console.log('NOWPayments request payload:', JSON.stringify(paymentPayload));

      const remaining = 20000 - (Date.now() - t0);
      const fetchTimeout = Math.max(remaining, 5000);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), fetchTimeout);

      let payRes;
      try {
        payRes = await fetch('https://api.nowpayments.io/v1/payment', {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentPayload),
          signal: controller.signal
        });
      } catch (fetchErr) {
        clearTimeout(timer);
        console.error('[TIMING] +' + (Date.now() - t0) + 'ms NOWPayments fetch failed:', fetchErr.message);
        if (fetchErr.name === 'AbortError') {
          return { statusCode: 504, headers, body: JSON.stringify({ error: 'Payment service took too long. Please try again.' }) };
        }
        return { statusCode: 502, headers, body: JSON.stringify({ error: 'Could not reach payment service. Please try again.' }) };
      }
      clearTimeout(timer);
      console.log('[TIMING] +' + (Date.now() - t0) + 'ms NOWPayments responded, status=' + payRes.status);

      if (!payRes.ok) {
        const errText = await payRes.text();
        console.error('NOWPayments payment error:', payRes.status, errText);
        const userError = mapNowPaymentsError(errText, payRes.status);
        return { statusCode: 502, headers, body: JSON.stringify({ error: userError }) };
      }

      const payData = await payRes.json();
      console.log('NOWPayments response:', JSON.stringify({
        payment_id: payData.payment_id,
        pay_address: payData.pay_address,
        pay_amount: payData.pay_amount,
        pay_currency: payData.pay_currency,
        payment_status: payData.payment_status
      }));

      if (!payData.payment_id) {
        console.error('NOWPayments: No payment_id in response:', JSON.stringify(payData));
        return { statusCode: 502, headers, body: JSON.stringify({ error: 'Payment service returned invalid data. Please try a different cryptocurrency.' }) };
      }
      if (!payData.pay_address) {
        console.error('NOWPayments: No pay_address in response:', JSON.stringify(payData));
        return { statusCode: 502, headers, body: JSON.stringify({ error: 'No wallet address returned. This coin may not be available right now. Please try another.' }) };
      }
      if (!payData.pay_amount) {
        console.error('NOWPayments: No pay_amount in response:', JSON.stringify(payData));
        return { statusCode: 502, headers, body: JSON.stringify({ error: 'Could not calculate crypto amount. Please try again.' }) };
      }

      const docId = String(payData.payment_id);

      const paymentRecord = {
        invoiceId: docId,
        nowpaymentsPaymentId: docId,
        orderId: orderId,
        userEmail: userEmail,
        userUid: auth.uid,
        productId: productId,
        productName: product.name,
        productTier: product.tier,
        firestoreField: product.firestoreField,
        amountUSD: finalPrice,
        originalAmountUSD: product.price,
        cryptoAmount: payData.pay_amount,
        cryptoCurrency: (payData.pay_currency || '').toUpperCase(),
        payAddress: payData.pay_address,
        senderWallet: null,
        transactionHash: null,
        status: 'waiting',
        paymentUrl: null,
        nowpaymentsOrderId: payData.order_id || null,
        accessDuration: product.duration,
        accessGranted: false,
        accessGrantedAt: null,
        refundEligible: true,
        refundedAt: null,
        promoCode: appliedPromo,
        ipAddress: clientIP,
        userAgent: userAgent.substring(0, 500),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        confirmedAt: null,
        emailFunction: product.emailFunction,
        paymentMode: 'direct'
      };

      console.log('[TIMING] +' + (Date.now() - t0) + 'ms writing payment record to Firestore');
      await db.collection('cryptoPayments').doc(docId).set(paymentRecord);
      console.log('[TIMING] +' + (Date.now() - t0) + 'ms Firestore write done');

      if (appliedPromo) {
        db.collection('promoCodes').doc(appliedPromo).update({
          usedCount: admin.firestore.FieldValue.increment(1)
        }).catch(err => console.error('Promo counter update failed:', err.message));
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          invoiceId: docId,
          payAddress: payData.pay_address,
          payAmount: payData.pay_amount,
          payCurrency: (payData.pay_currency || '').toUpperCase(),
          amount: finalPrice,
          product: product.name,
          promoApplied: !!appliedPromo
        })
      };
    }

    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Payment service not configured. Please contact support.' }) };
    }

    let finalPrice = product.price;
    let appliedPromo = null;

    if (promoDoc && promoDoc.exists) {
      const promoData = promoDoc.data();
      if (promoData.active !== false &&
          (!promoData.expiresAt || promoData.expiresAt.toDate() > new Date()) &&
          (!promoData.maxUses || (promoData.usedCount || 0) < promoData.maxUses)) {
        const discount = promoData.discount || 0;
        finalPrice = product.price * (1 - discount / 100);
        finalPrice = Math.round(finalPrice * 100) / 100;
        appliedPromo = promoCode ? promoCode.trim().toUpperCase() : null;
      }
    }

    const orderTimestamp = Date.now();
    const emailHash = userEmail.replace(/[^a-zA-Z0-9]/g, '');
    const orderId = `${productId}_${emailHash.substring(0, 20)}_${orderTimestamp}`;
    const durationLabel = product.duration === 'lifetime' ? 'Lifetime' : product.duration === '3day' ? '3-Day' : product.duration === '1day' ? '1-Day' : '24-Hour';

    const invoicePayload = {
      price_amount: finalPrice,
      price_currency: 'usd',
      order_id: orderId,
      order_description: `${product.name} - ${durationLabel} Access`,
      ipn_callback_url: 'https://digimun.pro/.netlify/functions/crypto-ipn-webhook',
      success_url: 'https://digimun.pro/checkout?status=success',
      cancel_url: 'https://digimun.pro/checkout?status=cancelled'
    };

    console.log('[TIMING] +' + (Date.now() - t0) + 'ms calling NOWPayments /v1/invoice');
    console.log('NOWPayments invoice payload:', JSON.stringify(invoicePayload));

    const remaining = 20000 - (Date.now() - t0);
    const fetchTimeout = Math.max(remaining, 5000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), fetchTimeout);

    let invoiceRes;
    try {
      invoiceRes = await fetch('https://api.nowpayments.io/v1/invoice', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(invoicePayload),
        signal: controller.signal
      });
    } catch (fetchErr) {
      clearTimeout(timer);
      console.error('[TIMING] +' + (Date.now() - t0) + 'ms NOWPayments invoice fetch failed:', fetchErr.message);
      if (fetchErr.name === 'AbortError') {
        return { statusCode: 504, headers, body: JSON.stringify({ error: 'Payment service took too long. Please try again.' }) };
      }
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Could not reach payment service. Please try again.' }) };
    }
    clearTimeout(timer);
    console.log('[TIMING] +' + (Date.now() - t0) + 'ms NOWPayments invoice responded, status=' + invoiceRes.status);

    if (!invoiceRes.ok) {
      const errText = await invoiceRes.text();
      console.error('NOWPayments invoice error:', invoiceRes.status, errText);
      const userError = mapNowPaymentsError(errText, invoiceRes.status);
      return { statusCode: 502, headers, body: JSON.stringify({ error: userError }) };
    }

    const invoiceData = await invoiceRes.json();
    console.log('NOWPayments invoice response:', JSON.stringify({ id: invoiceData.id, invoice_url: invoiceData.invoice_url, order_id: invoiceData.order_id }));

    if (!invoiceData.id || !invoiceData.invoice_url) {
      console.error('NOWPayments: Missing id or invoice_url:', JSON.stringify(invoiceData));
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Payment service returned invalid data. Please try again.' }) };
    }

    const invoiceDocId = String(invoiceData.id);

    const paymentRecord = {
      invoiceId: invoiceDocId,
      orderId: orderId,
      userEmail: userEmail,
      userUid: auth.uid,
      productId: productId,
      productName: product.name,
      productTier: product.tier,
      firestoreField: product.firestoreField,
      amountUSD: finalPrice,
      originalAmountUSD: product.price,
      cryptoAmount: null,
      cryptoCurrency: null,
      senderWallet: null,
      transactionHash: null,
      status: 'waiting',
      paymentUrl: invoiceData.invoice_url,
      nowpaymentsOrderId: invoiceData.order_id || null,
      accessDuration: product.duration,
      accessGranted: false,
      accessGrantedAt: null,
      refundEligible: true,
      refundedAt: null,
      promoCode: appliedPromo,
      ipAddress: clientIP,
      userAgent: userAgent.substring(0, 500),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      confirmedAt: null,
      emailFunction: product.emailFunction,
      paymentMode: 'invoice'
    };

    console.log('[TIMING] +' + (Date.now() - t0) + 'ms writing invoice record to Firestore');
    await db.collection('cryptoPayments').doc(invoiceDocId).set(paymentRecord);
    console.log('[TIMING] +' + (Date.now() - t0) + 'ms Firestore write done, returning invoice_url');

    if (appliedPromo) {
      db.collection('promoCodes').doc(appliedPromo).update({
        usedCount: admin.firestore.FieldValue.increment(1)
      }).catch(err => console.error('Promo counter update failed:', err.message));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        invoiceId: invoiceDocId,
        paymentUrl: invoiceData.invoice_url,
        amount: finalPrice,
        product: product.name,
        promoApplied: !!appliedPromo
      })
    };
  } catch (err) {
    console.error('CREATE INVOICE ERROR:', err);
    console.error('crypto-create-invoice FATAL error:', err?.message || err, err?.stack || '');
    const safeHeaders = headers || { 'Content-Type': 'application/json' };
    return { statusCode: 500, headers: safeHeaders, body: JSON.stringify({ error: err?.message || 'Failed to create payment. Please try again.' }) };
  }
};
