const fetch = globalThis.fetch || require('node-fetch');
const { admin, db, getCorsHeaders, verifyFirebaseToken } = require('./firebase-admin-init.cjs');

const PRODUCTS = {
  probot: {
    name: 'Digimun Pro Bot',
    price: 6,
    firestoreField: 'quotexStatus',
    duration: 'lifetime',
    emailFunction: 'send-probot-access-email',
    tier: 'lifetime'
  },
  digimaxx_1day: {
    name: 'DigiMaxx 1-Day',
    price: 7,
    firestoreField: 'digimaxStatus',
    duration: '1day',
    emailFunction: 'send-digimaxx-access-email',
    tier: '1day'
  },
  digimaxx_3day: {
    name: 'DigiMaxx 3-Day',
    price: 14,
    firestoreField: 'digimaxStatus',
    duration: '3day',
    emailFunction: 'send-digimaxx-access-email',
    tier: '3day'
  },
  digimaxx_lifetime: {
    name: 'DigiMaxx Lifetime',
    price: 49.99,
    firestoreField: 'digimaxStatus',
    duration: 'lifetime',
    emailFunction: 'send-digimaxx-access-email',
    tier: 'lifetime'
  },
  digimunx_standard: {
    name: 'DigimunX Standard',
    price: 20,
    firestoreField: 'recoveryRequest',
    duration: '24h',
    emailFunction: 'send-digimunx-access-email',
    tier: 'standard'
  },
  digimunx_discount: {
    name: 'DigimunX Discounted',
    price: 10,
    firestoreField: 'recoveryRequest',
    duration: '24h',
    emailFunction: 'send-digimunx-access-email',
    tier: 'discounted'
  }
};

const SUPPORTED_CURRENCIES = {
  btc: 'btc',
  eth: 'eth',
  usdttrc20: 'usdttrc20',
  ltc: 'ltc',
  bnbbsc: 'bnbbsc',
  bnb: 'bnbbsc',
  sol: 'sol',
  doge: 'doge',
  trx: 'trx',
  xrp: 'xrp',
  matic: 'matic',
  maticpolygon: 'matic'
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

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  try {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  if (!db) {
    console.error('crypto-create-invoice: db not initialized');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service temporarily unavailable' }) };
  }

  const auth = await verifyFirebaseToken(event);
  if (!auth.authenticated) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
  }

    const parsed = JSON.parse(event.body || '{}');
    const { productId, promoCode, payCurrency } = parsed;

    if (!productId || !PRODUCTS[productId]) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid product' }) };
    }

    const product = PRODUCTS[productId];
    const userEmail = auth.email.toLowerCase().trim();
    const clientIP = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    const userAgent = event.headers['user-agent'] || 'unknown';

    if (!rateLimit(clientIP, userEmail)) {
      return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests. Please wait 30 seconds.' }) };
    }

    const userDoc = await db.collection('users').doc(userEmail).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
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

      const pendingSnap = await db.collection('cryptoPayments')
        .where('userEmail', '==', userEmail)
        .where('productId', '==', productId)
        .where('status', 'in', ['waiting', 'confirming', 'sending', 'partially_paid'])
        .limit(1)
        .get();

      if (!pendingSnap.empty) {
        const existingDoc = pendingSnap.docs[0];
        const existing = existingDoc.data();
        const existingMode = existing.paymentMode || 'invoice';

        if (existingMode === 'direct' && existing.payAddress && existing.cryptoAmount && existing.cryptoCurrency) {
          const existingCoinLower = (existing.cryptoCurrency || '').toLowerCase();
          if (existingCoinLower === resolvedCurrency) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                success: true,
                invoiceId: existing.invoiceId,
                existing: true,
                paymentMode: 'direct',
                payAddress: existing.payAddress,
                payAmount: existing.cryptoAmount,
                payCurrency: existing.cryptoCurrency
              })
            };
          }
        }
        await existingDoc.ref.update({
          status: 'expired',
          expiredReason: existingMode === 'invoice' ? 'replaced_by_direct_payment' : 'replaced_by_new_coin',
          expiredAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      let finalPrice = product.price;
      let appliedPromo = null;

      if (promoCode) {
        const cleanCode = promoCode.trim().toUpperCase();
        if (/^[A-Z0-9_-]{2,20}$/.test(cleanCode)) {
          const promoDoc = await db.collection('promoCodes').doc(cleanCode).get();
          if (promoDoc.exists) {
            const promoData = promoDoc.data();
            if (promoData.active !== false &&
                (!promoData.expiresAt || promoData.expiresAt.toDate() > new Date()) &&
                (!promoData.maxUses || (promoData.usedCount || 0) < promoData.maxUses)) {
              const discount = promoData.discount || 0;
              finalPrice = product.price * (1 - discount / 100);
              finalPrice = Math.round(finalPrice * 100) / 100;
              appliedPromo = cleanCode;
            }
          }
        }
      }

      const apiKey = process.env.NOWPAYMENTS_API_KEY;
      if (!apiKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Payment service not configured. Please contact support.' }) };
      }

      const orderTimestamp = Date.now();
      const emailHash = userEmail.replace(/[^a-zA-Z0-9]/g, '');
      const orderId = `${productId}_${emailHash.substring(0, 20)}_${orderTimestamp}`;

      const durationLabel = product.duration === 'lifetime' ? 'Lifetime' : product.duration === '3day' ? '3-Day' : product.duration === '1day' ? '1-Day' : '24-Hour';

      try {
        const estRes = await fetch(
          `https://api.nowpayments.io/v1/estimate?amount=${finalPrice}&currency_from=usd&currency_to=${resolvedCurrency}`,
          { headers: { 'x-api-key': apiKey } }
        );
        if (!estRes.ok) {
          const estErr = await estRes.text();
          console.error('NOWPayments estimate preflight failed:', estRes.status, estErr);
          const userError = mapNowPaymentsError(estErr, estRes.status);
          return { statusCode: 502, headers, body: JSON.stringify({ error: userError }) };
        }
        const estData = await estRes.json();
        console.log('NOWPayments estimate preflight OK:', JSON.stringify({ currency: resolvedCurrency, estimated_amount: estData.estimated_amount }));
        if (!estData.estimated_amount) {
          return { statusCode: 502, headers, body: JSON.stringify({ error: 'Could not estimate crypto amount for this coin. Please try another.' }) };
        }
      } catch (estErr) {
        console.error('NOWPayments estimate preflight error:', estErr.message);
        return { statusCode: 502, headers, body: JSON.stringify({ error: 'Unable to verify cryptocurrency availability. Please try again.' }) };
      }

      const paymentPayload = {
        price_amount: finalPrice,
        price_currency: 'usd',
        pay_currency: resolvedCurrency,
        order_id: orderId,
        order_description: `${product.name} - ${durationLabel} Access`,
        ipn_callback_url: 'https://digimun.pro/.netlify/functions/crypto-ipn-webhook'
      };

      console.log('NOWPayments request payload:', JSON.stringify(paymentPayload));

      const payRes = await fetch('https://api.nowpayments.io/v1/payment', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentPayload)
      });

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

      await db.collection('cryptoPayments').doc(docId).set(paymentRecord);

      if (appliedPromo) {
        await db.collection('promoCodes').doc(appliedPromo).update({
          usedCount: admin.firestore.FieldValue.increment(1)
        });
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

    const pendingSnap = await db.collection('cryptoPayments')
      .where('userEmail', '==', userEmail)
      .where('productId', '==', productId)
      .where('status', 'in', ['waiting', 'confirming', 'sending', 'partially_paid'])
      .limit(1)
      .get();

    if (!pendingSnap.empty) {
      const existingDoc = pendingSnap.docs[0];
      const existing = existingDoc.data();
      const existingMode = existing.paymentMode || 'invoice';
      if (existingMode === 'invoice' && existing.paymentUrl) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            invoiceId: existing.invoiceId,
            paymentUrl: existing.paymentUrl,
            existing: true,
            paymentMode: 'invoice'
          })
        };
      }
      await existingDoc.ref.update({
        status: 'expired',
        expiredReason: 'replaced_by_new_invoice',
        expiredAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    let finalPrice = product.price;
    let appliedPromo = null;

    if (promoCode) {
      const cleanCode = promoCode.trim().toUpperCase();
      if (/^[A-Z0-9_-]{2,20}$/.test(cleanCode)) {
        const promoDoc = await db.collection('promoCodes').doc(cleanCode).get();
        if (promoDoc.exists) {
          const promoData = promoDoc.data();
          if (promoData.active !== false &&
              (!promoData.expiresAt || promoData.expiresAt.toDate() > new Date()) &&
              (!promoData.maxUses || (promoData.usedCount || 0) < promoData.maxUses)) {
            const discount = promoData.discount || 0;
            finalPrice = product.price * (1 - discount / 100);
            finalPrice = Math.round(finalPrice * 100) / 100;
            appliedPromo = cleanCode;
          }
        }
      }
    }

    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Payment service not configured. Please contact support.' }) };
    }

    const orderTimestamp = Date.now();
    const emailHash = userEmail.replace(/[^a-zA-Z0-9]/g, '');
    const orderId = `${productId}_${emailHash.substring(0, 20)}_${orderTimestamp}`;

    const invoicePayload = {
      price_amount: finalPrice,
      price_currency: 'usd',
      order_id: orderId,
      order_description: `${product.name} - ${product.duration === 'lifetime' ? 'Lifetime Access' : '24-Hour Access'}`,
      ipn_callback_url: 'https://digimun.pro/.netlify/functions/crypto-ipn-webhook',
      success_url: 'https://digimun.pro/checkout?status=success',
      cancel_url: 'https://digimun.pro/checkout?status=cancelled'
    };

    const invoiceRes = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invoicePayload)
    });

    if (!invoiceRes.ok) {
      const errText = await invoiceRes.text();
      console.error('NOWPayments invoice error:', invoiceRes.status, errText);
      const userError = mapNowPaymentsError(errText, invoiceRes.status);
      return { statusCode: 502, headers, body: JSON.stringify({ error: userError }) };
    }

    const invoiceData = await invoiceRes.json();

    const paymentRecord = {
      invoiceId: String(invoiceData.id),
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

    await db.collection('cryptoPayments').doc(String(invoiceData.id)).set(paymentRecord);

    if (appliedPromo) {
      await db.collection('promoCodes').doc(appliedPromo).update({
        usedCount: admin.firestore.FieldValue.increment(1)
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        invoiceId: String(invoiceData.id),
        paymentUrl: invoiceData.invoice_url,
        amount: finalPrice,
        product: product.name,
        promoApplied: !!appliedPromo
      })
    };
  } catch (err) {
    console.error('crypto-create-invoice FATAL error:', err?.message || err, err?.stack || '');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to create payment. Please try again.' }) };
  }
};
