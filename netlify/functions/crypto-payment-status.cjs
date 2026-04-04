const fetch = globalThis.fetch || require('node-fetch');
const { admin, db, getCorsHeaders, verifyFirebaseToken } = require('./firebase-admin-init.cjs');

const PRODUCTS = {
  probot: { firestoreField: 'quotexStatus', duration: 'lifetime' },
  digimaxx_1day: { firestoreField: 'digimaxStatus', duration: '1day' },
  digimaxx_3day: { firestoreField: 'digimaxStatus', duration: '3day' },
  digimaxx_lifetime: { firestoreField: 'digimaxStatus', duration: 'lifetime' },
  digimunx_standard: { firestoreField: 'recoveryRequest', duration: '24h' },
  digimunx_discount: { firestoreField: 'recoveryRequest', duration: '24h' }
};

async function checkNowPaymentsDirectly(paymentId) {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey || !paymentId) return null;

  try {
    const res = await fetch(`https://api.nowpayments.io/v1/payment/${paymentId}`, {
      headers: { 'x-api-key': apiKey }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('NOWPayments direct check failed:', e.message);
    return null;
  }
}

async function autoGrantAccess(paymentRef, paymentData) {
  const product = PRODUCTS[paymentData.productId];
  if (!product) {
    console.error('Auto-grant: Unknown product:', paymentData.productId);
    return false;
  }

  const userEmail = paymentData.userEmail;
  const firestoreField = paymentData.firestoreField || product.firestoreField;
  const accessDuration = paymentData.accessDuration || product.duration;

  try {
    const userDoc = await db.collection('users').doc(userEmail).get();
    if (!userDoc.exists) {
      console.error('Auto-grant: User not found:', userEmail);
      return false;
    }

    const updateData = { [firestoreField]: 'approved' };

    if (accessDuration === '24h' || accessDuration === '1day') {
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 24);
      const expiryFieldMap = {
        'quotexStatus': 'quotexStatusExpiry',
        'digimaxStatus': 'digimaxStatusExpiry',
        'recoveryRequest': 'recoveryRequestExpiry'
      };
      if (expiryFieldMap[firestoreField]) {
        updateData[expiryFieldMap[firestoreField]] = expiry;
      }
    } else if (accessDuration === '3day') {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 3);
      const expiryFieldMap = {
        'quotexStatus': 'quotexStatusExpiry',
        'digimaxStatus': 'digimaxStatusExpiry',
        'recoveryRequest': 'recoveryRequestExpiry'
      };
      if (expiryFieldMap[firestoreField]) {
        updateData[expiryFieldMap[firestoreField]] = expiry;
      }
    }

    await db.collection('users').doc(userEmail).update(updateData);

    await paymentRef.update({
      status: 'confirmed',
      accessGranted: true,
      accessGrantedAt: admin.firestore.FieldValue.serverTimestamp(),
      confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
      grantedVia: 'status_poll_backup',
      refundEligible: false
    });

    console.log('Auto-grant: Access granted for', userEmail, 'product:', paymentData.productId);
    return true;
  } catch (e) {
    console.error('Auto-grant failed:', e.message);
    return false;
  }
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  if (!db) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service temporarily unavailable' }) };
  }

  const auth = await verifyFirebaseToken(event);
  if (!auth.authenticated) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
  }

  try {
    const invoiceId = event.queryStringParameters?.invoiceId;
    if (!invoiceId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invoice ID required' }) };
    }

    const paymentDoc = await db.collection('cryptoPayments').doc(String(invoiceId)).get();
    if (!paymentDoc.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Payment not found' }) };
    }

    let data = paymentDoc.data();

    if (data.userEmail !== auth.email.toLowerCase().trim()) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Access denied' }) };
    }

    if (!data.accessGranted && ['waiting', 'confirming', 'sending', 'partially_paid'].includes(data.status)) {
      const npPaymentId = data.nowpaymentsPaymentId || data.invoiceId;
      const npData = await checkNowPaymentsDirectly(npPaymentId);

      if (npData) {
        const npStatus = npData.payment_status;
        console.log('NOWPayments live status for', npPaymentId, ':', npStatus, '| Our status:', data.status);

        if (npData.pay_address && !data.payAddress) {
          await paymentDoc.ref.update({
            payAddress: npData.pay_address,
            cryptoAmount: npData.pay_amount || data.cryptoAmount,
            cryptoCurrency: (npData.pay_currency || '').toUpperCase() || data.cryptoCurrency
          });
          data.payAddress = npData.pay_address;
          data.cryptoAmount = npData.pay_amount || data.cryptoAmount;
          data.cryptoCurrency = (npData.pay_currency || '').toUpperCase() || data.cryptoCurrency;
        }

        if (npStatus === 'finished' || npStatus === 'confirmed') {
          const paidUSD = parseFloat(npData.price_amount);
          const expectedUSD = data.amountUSD || 0;
          if (!isNaN(paidUSD) && paidUSD >= expectedUSD * 0.98) {
            console.log('NOWPayments confirms payment! Auto-granting access for:', npPaymentId);
            const granted = await autoGrantAccess(paymentDoc.ref, data);
            if (granted) {
              data.status = 'confirmed';
              data.accessGranted = true;
            }
          } else {
            console.warn('NOWPayments amount mismatch. Expected:', expectedUSD, 'Got:', paidUSD);
            await paymentDoc.ref.update({
              status: 'amount_mismatch',
              amountMismatch: true,
              expectedUSD,
              paidUSD
            });
            data.status = 'amount_mismatch';
          }
        } else if (npStatus === 'confirming' || npStatus === 'sending') {
          if (data.status !== 'confirming') {
            await paymentDoc.ref.update({ status: 'confirming' });
            data.status = 'confirming';
          }
        } else if (npStatus === 'expired' || npStatus === 'failed' || npStatus === 'refunded') {
          await paymentDoc.ref.update({ status: npStatus });
          data.status = npStatus;
        } else if (npStatus === 'partially_paid') {
          if (data.status !== 'partially_paid') {
            await paymentDoc.ref.update({ status: 'partially_paid' });
            data.status = 'partially_paid';
          }
        }
      }
    }

    const statusMap = {
      'waiting': { step: 1, label: 'Waiting for Payment', description: 'Send crypto to the payment address', eta: 'Waiting for you to send payment' },
      'confirming': { step: 2, label: 'Confirming', description: 'Payment received, waiting for blockchain confirmations', eta: 'Usually 5-30 minutes depending on network' },
      'sending': { step: 2, label: 'Processing', description: 'Payment is being processed', eta: 'Almost done, finalizing...' },
      'confirmed': { step: 3, label: 'Confirmed', description: 'Payment confirmed! Access granted.', eta: 'Complete' },
      'finished': { step: 3, label: 'Complete', description: 'Payment confirmed! Access granted.', eta: 'Complete' },
      'partially_paid': { step: 1, label: 'Partial Payment', description: 'Insufficient amount received. Please send the remaining amount.', eta: 'Waiting for remaining funds' },
      'failed': { step: -1, label: 'Failed', description: 'Payment failed. Please try again.', eta: null },
      'expired': { step: -1, label: 'Expired', description: 'Payment window expired. Please create a new order.', eta: null },
      'refunded': { step: -1, label: 'Refunded', description: 'Payment has been refunded.', eta: null },
      'amount_mismatch': { step: -1, label: 'Amount Mismatch', description: 'Payment amount does not match. Contact support.', eta: null },
      'currency_mismatch': { step: -1, label: 'Currency Error', description: 'Currency mismatch detected. Contact support.', eta: null }
    };

    const statusInfo = statusMap[data.status] || { step: 0, label: data.status, description: '', eta: null };

    const confirmationsInfo = {
      current: data.status === 'confirmed' || data.status === 'finished' ? 'complete' : (data.status === 'confirming' ? 'in_progress' : 'pending'),
      estimated: data.cryptoCurrency === 'BTC' ? '2-6' : data.cryptoCurrency === 'ETH' ? '12-30' : '5-20'
    };

    const createdTime = data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().getTime() : new Date(data.createdAt).getTime()) : null;
    const elapsedMs = createdTime ? Date.now() - createdTime : 0;
    const elapsedMinutes = Math.floor(elapsedMs / 60000);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        invoiceId: data.invoiceId,
        status: data.status,
        step: statusInfo.step,
        label: statusInfo.label,
        description: statusInfo.description,
        eta: statusInfo.eta,
        confirmations: confirmationsInfo,
        elapsedMinutes,
        productName: data.productName,
        amountUSD: data.amountUSD,
        cryptoAmount: data.cryptoAmount,
        cryptoCurrency: data.cryptoCurrency,
        accessGranted: data.accessGranted || false,
        paymentUrl: data.paymentUrl,
        payAddress: data.payAddress || null,
        paymentMode: data.paymentMode || 'invoice',
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : null
      })
    };
  } catch (err) {
    console.error('crypto-payment-status error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to check status' }) };
  }
};
