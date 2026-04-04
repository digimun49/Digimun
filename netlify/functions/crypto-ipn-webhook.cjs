const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { admin, db } = require('./firebase-admin-init.cjs');

const PRODUCTS = {
  probot: { name: 'Digimun Pro Bot', price: 6, firestoreField: 'quotexStatus', duration: 'lifetime', emailFunction: 'send-probot-access-email', tier: 'lifetime' },
  digimaxx_1day: { name: 'DigiMaxx 1-Day', price: 7, firestoreField: 'digimaxStatus', duration: '1day', emailFunction: 'send-digimaxx-access-email', tier: '1day' },
  digimaxx_3day: { name: 'DigiMaxx 3-Day', price: 14, firestoreField: 'digimaxStatus', duration: '3day', emailFunction: 'send-digimaxx-access-email', tier: '3day' },
  digimaxx_lifetime: { name: 'DigiMaxx Lifetime', price: 49.99, firestoreField: 'digimaxStatus', duration: 'lifetime', emailFunction: 'send-digimaxx-access-email', tier: 'lifetime' },
  digimunx_standard: { name: 'DigimunX Standard', price: 20, firestoreField: 'recoveryRequest', duration: '24h', emailFunction: 'send-digimunx-access-email', tier: 'standard' },
  digimunx_discount: { name: 'DigimunX Discounted', price: 10, firestoreField: 'recoveryRequest', duration: '24h', emailFunction: 'send-digimunx-access-email', tier: 'discounted' }
};

function verifyHMAC(rawBody, signature, secret) {
  try {
    const sorted = JSON.parse(rawBody);
    const sortedKeys = Object.keys(sorted).sort();
    const sortedObj = {};
    for (const key of sortedKeys) {
      sortedObj[key] = sorted[key];
    }
    const hmac = crypto.createHmac('sha512', secret);
    hmac.update(JSON.stringify(sortedObj));
    const computed = hmac.digest('hex');
    if (computed.length !== signature.length) {
      console.error('IPN HMAC: Length mismatch. Computed length:', computed.length, 'Signature length:', signature.length);
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(signature, 'hex'));
  } catch (e) {
    console.error('IPN HMAC: Verification error:', e.message);
    return false;
  }
}

async function grantAccess(paymentRef, paymentData) {
  const { userEmail, firestoreField, accessDuration, productName, emailFunction, productTier } = paymentData;

  console.log('IPN grantAccess: Starting for', userEmail, '| product:', productName, '| duration:', accessDuration, '| field:', firestoreField);

  const userDoc = await db.collection('users').doc(userEmail).get();
  if (!userDoc.exists) {
    console.error('IPN grantAccess: User doc not found:', userEmail);
    throw new Error('User document not found: ' + userEmail);
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
    const expiryField = expiryFieldMap[firestoreField];
    if (expiryField) {
      updateData[expiryField] = expiry;
      console.log('IPN grantAccess: Setting', expiryField, 'to', expiry.toISOString());
    }
  } else if (accessDuration === '3day') {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 3);
    const expiryFieldMap = {
      'quotexStatus': 'quotexStatusExpiry',
      'digimaxStatus': 'digimaxStatusExpiry',
      'recoveryRequest': 'recoveryRequestExpiry'
    };
    const expiryField = expiryFieldMap[firestoreField];
    if (expiryField) {
      updateData[expiryField] = expiry;
      console.log('IPN grantAccess: Setting', expiryField, 'to', expiry.toISOString());
    }
  }

  await db.collection('users').doc(userEmail).update(updateData);
  console.log('IPN grantAccess: User doc updated for', userEmail);

  await paymentRef.update({
    accessGrantedAt: admin.firestore.FieldValue.serverTimestamp(),
    refundEligible: false
  });

  try {
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpPort = process.env.SMTP_PORT || 587;

    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: false,
        auth: { user: smtpUser, pass: smtpPass }
      });

      const accessLabel = accessDuration === 'lifetime' ? 'Lifetime' : accessDuration === '3day' ? '3-Day' : accessDuration === '1day' ? '1-Day' : '24-Hour';
      const mailOptions = {
        from: `"Digimun Pro" <${smtpUser}>`,
        to: userEmail,
        subject: `${productName} - Access Granted!`,
        html: `
          <div style="font-family: 'Segoe UI', sans-serif; background: #050508; color: #fff; padding: 40px; text-align: center;">
            <img src="https://digimun.pro/assets/digimun-logo.png" alt="Digimun Pro" style="height: 40px; margin-bottom: 20px;">
            <div style="background: rgba(74,222,128,0.12); border: 1px solid rgba(74,222,128,0.3); display: inline-block; padding: 8px 24px; border-radius: 50px; margin-bottom: 15px;">
              <span style="color: #4ade80; font-size: 12px; font-weight: 700; letter-spacing: 2px;">${accessLabel.toUpperCase()} ACCESS GRANTED</span>
            </div>
            <h1 style="color: #fff; font-size: 24px; margin: 15px 0;">${productName}</h1>
            <p style="color: #9ca3af; font-size: 15px;">Your crypto payment has been confirmed and your access has been activated.</p>
            <p style="color: #9ca3af; font-size: 14px;">Access Type: <strong style="color: #4ade80;">${accessLabel}</strong></p>
            <a href="https://digimun.pro/dashboard" style="display: inline-block; margin-top: 20px; background: linear-gradient(135deg, #4ade80, #22c55e); color: #000; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px;">Go to Dashboard</a>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">This is an automated notification from Digimun Pro.</p>
          </div>`
      };

      await transporter.sendMail(mailOptions);
      console.log('IPN grantAccess: Email sent to', userEmail);
    } else {
      console.warn('IPN grantAccess: SMTP not configured, skipping email for', userEmail);
    }
  } catch (emailErr) {
    console.error('IPN grantAccess: Email error:', emailErr.message);
  }

  try {
    const userData = userDoc.data();
    if (userData.fcmTokens && Array.isArray(userData.fcmTokens) && userData.fcmTokens.length > 0) {
      const message = {
        notification: {
          title: 'Access Granted!',
          body: `Your ${productName} access has been activated. Start trading now!`
        },
        data: {
          url: '/dashboard',
          title: 'Access Granted!',
          body: `Your ${productName} access has been activated.`
        },
        webpush: {
          notification: {
            title: 'Access Granted!',
            body: `Your ${productName} access has been activated. Start trading now!`,
            icon: '/assets/web-app-manifest-192x192.png',
            badge: '/assets/web-app-manifest-192x192.png'
          },
          fcmOptions: { link: '/dashboard' }
        }
      };

      let sent = 0;
      let failed = 0;
      for (const token of userData.fcmTokens.slice(0, 5)) {
        try {
          await admin.messaging().send({ ...message, token });
          sent++;
        } catch (pushErr) {
          failed++;
          if (pushErr.code === 'messaging/registration-token-not-registered') {
            console.log('IPN grantAccess: Stale FCM token removed');
          }
        }
      }
      console.log('IPN grantAccess: Push notifications sent:', sent, 'failed:', failed);
    }
  } catch (pushErr) {
    console.error('IPN grantAccess: Push notification error:', pushErr.message);
  }

  try {
    await db.collection('notifications').add({
      title: 'Payment Confirmed',
      body: `${productName} access granted to ${userEmail} via crypto payment`,
      url: '/dashboard',
      target: userEmail,
      broadcast: false,
      sent: 1,
      failed: 0,
      createdAt: new Date().toISOString(),
      timestamp: Date.now()
    });
  } catch (notifErr) {
    console.error('IPN grantAccess: Notification record error:', notifErr.message);
  }

  await updatePaymentSummary(paymentData);
  console.log('IPN grantAccess: Complete for', userEmail);
}

async function updatePaymentSummary(paymentData) {
  const now = new Date();
  const dateKey = now.toISOString().split('T')[0];
  const monthKey = dateKey.substring(0, 7);

  const dailyRef = db.collection('paymentSummary').doc(`daily_${dateKey}`);
  const monthlyRef = db.collection('paymentSummary').doc(`monthly_${monthKey}`);
  const totalRef = db.collection('paymentSummary').doc('all_time');

  const increment = admin.firestore.FieldValue.increment;
  const amountInc = increment(paymentData.amountUSD);
  const countInc = increment(1);

  const productField = paymentData.productId.replace(/[^a-zA-Z0-9_]/g, '_');

  const updateObj = {
    totalRevenue: amountInc,
    totalTransactions: countInc,
    [`products.${productField}.revenue`]: amountInc,
    [`products.${productField}.count`]: countInc,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await Promise.all([
    dailyRef.set({ ...updateObj, date: dateKey }, { merge: true }),
    monthlyRef.set({ ...updateObj, month: monthKey }, { merge: true }),
    totalRef.set(updateObj, { merge: true })
  ]);
}

exports.handler = async (event) => {
  console.log('IPN webhook: Received request. Method:', event.httpMethod, 'Headers:', JSON.stringify({
    'x-nowpayments-sig': event.headers['x-nowpayments-sig'] ? event.headers['x-nowpayments-sig'].substring(0, 20) + '...' : 'MISSING',
    'content-type': event.headers['content-type'] || 'MISSING'
  }));

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  if (!db) {
    console.error('IPN webhook: Database not available');
    return { statusCode: 500, body: JSON.stringify({ error: 'Service unavailable' }) };
  }

  try {
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
    if (!ipnSecret) {
      console.error('IPN webhook: NOWPAYMENTS_IPN_SECRET not configured');
      return { statusCode: 500, body: JSON.stringify({ error: 'IPN not configured' }) };
    }

    const signature = event.headers['x-nowpayments-sig'];
    if (!signature) {
      console.error('IPN webhook: Missing x-nowpayments-sig header');
      console.error('IPN webhook: All headers:', JSON.stringify(Object.keys(event.headers)));
      return { statusCode: 401, body: JSON.stringify({ error: 'Missing signature' }) };
    }

    console.log('IPN webhook: Verifying HMAC. Body length:', (event.body || '').length, 'Sig length:', signature.length);

    if (!verifyHMAC(event.body, signature, ipnSecret)) {
      console.error('IPN webhook: HMAC FAILED. Sig prefix:', signature.substring(0, 30));
      console.error('IPN webhook: Body preview (first 300 chars):', (event.body || '').substring(0, 300));
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid signature' }) };
    }

    console.log('IPN webhook: HMAC verification PASSED');

    const payload = JSON.parse(event.body);
    const {
      invoice_id,
      payment_id,
      payment_status,
      pay_amount,
      pay_currency,
      price_amount,
      price_currency,
      order_id,
      outcome_amount,
      outcome_currency
    } = payload;

    console.log('IPN webhook: Payload:', JSON.stringify({
      invoice_id, payment_id, payment_status, pay_amount, pay_currency,
      price_amount, price_currency, order_id, outcome_amount, outcome_currency
    }));

    let invoiceStr = null;
    let paymentRef = null;
    let lookupPath = '';

    if (payment_id) {
      invoiceStr = String(payment_id);
      paymentRef = db.collection('cryptoPayments').doc(invoiceStr);
      const checkDoc = await paymentRef.get();
      if (checkDoc.exists) {
        lookupPath = 'payment_id';
        console.log('IPN webhook: Found doc by payment_id:', invoiceStr);
      } else {
        paymentRef = null;
        invoiceStr = null;
        console.log('IPN webhook: No doc found by payment_id:', String(payment_id));
      }
    }

    if (!paymentRef && invoice_id) {
      invoiceStr = String(invoice_id);
      paymentRef = db.collection('cryptoPayments').doc(invoiceStr);
      const checkDoc = await paymentRef.get();
      if (checkDoc.exists) {
        lookupPath = 'invoice_id';
        console.log('IPN webhook: Found doc by invoice_id:', invoiceStr);
      } else {
        paymentRef = null;
        invoiceStr = null;
        console.log('IPN webhook: No doc found by invoice_id:', String(invoice_id));
      }
    }

    if (!paymentRef && order_id) {
      const orderSnap = await db.collection('cryptoPayments')
        .where('orderId', '==', order_id)
        .limit(1)
        .get();
      if (!orderSnap.empty) {
        const doc = orderSnap.docs[0];
        invoiceStr = doc.id;
        paymentRef = doc.ref;
        lookupPath = 'order_id';
        console.log('IPN webhook: Found doc by order_id:', order_id, '-> docId:', invoiceStr);
      } else {
        console.log('IPN webhook: No doc found by order_id:', order_id);
      }
    }

    if (!paymentRef || !invoiceStr) {
      console.error('IPN webhook: FAILED to find payment doc. payment_id:', payment_id, 'invoice_id:', invoice_id, 'order_id:', order_id);
      return { statusCode: 404, body: JSON.stringify({ error: 'Payment not found' }) };
    }

    console.log('IPN webhook: Processing status:', payment_status, 'for doc:', invoiceStr, '(found via', lookupPath + ')');

    const updateFields = {
      nowpaymentsPaymentId: String(payment_id || ''),
      cryptoAmount: pay_amount || null,
      cryptoCurrency: (pay_currency || '').toUpperCase(),
      lastIpnStatus: payment_status,
      lastIpnAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (payload.payin_address) {
      updateFields.senderWallet = payload.payin_address;
    }
    if (payload.purchase_id) {
      updateFields.transactionHash = String(payload.purchase_id);
    }
    if (payload.pay_address) {
      updateFields.payAddress = payload.pay_address;
    }

    if (payment_status === 'finished' || payment_status === 'confirmed') {
      console.log('IPN webhook: Payment finished/confirmed. Running transaction for:', invoiceStr);

      const claimResult = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(paymentRef);
        if (!doc.exists) return { error: 'not_found' };
        const data = doc.data();
        if (data.accessGranted) return { skipped: true, reason: 'already_granted' };
        if (data.processingClaim) return { skipped: true, reason: 'processing_in_progress' };

        const product = PRODUCTS[data.productId];
        if (!product) return { error: 'unknown_product', productId: data.productId };

        const expectedUSD = data.amountUSD || product.price;
        const paidUSD = parseFloat(price_amount);
        if (isNaN(paidUSD) || paidUSD < expectedUSD * 0.98) {
          console.error('IPN webhook: Amount mismatch. Expected:', expectedUSD, 'Got:', paidUSD, 'Invoice:', invoiceStr);
          transaction.update(paymentRef, {
            ...updateFields,
            status: 'amount_mismatch',
            amountMismatch: true,
            expectedUSD,
            paidUSD
          });
          return { error: 'amount_mismatch', expectedUSD, paidUSD };
        }

        if (price_currency && price_currency.toLowerCase() !== 'usd') {
          console.error('IPN webhook: Currency mismatch. Expected USD, got:', price_currency);
          transaction.update(paymentRef, {
            ...updateFields,
            status: 'currency_mismatch',
            currencyMismatch: true
          });
          return { error: 'currency_mismatch' };
        }

        transaction.update(paymentRef, {
          ...updateFields,
          status: 'confirmed',
          processingClaim: true,
          confirmedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { proceed: true, paymentData: data };
      });

      if (claimResult.error === 'not_found') {
        console.error('IPN webhook: Transaction found no doc for:', invoiceStr);
        return { statusCode: 404, body: JSON.stringify({ error: 'Payment not found' }) };
      }
      if (claimResult.error === 'unknown_product') {
        console.error('IPN webhook: Unknown product:', claimResult.productId);
        return { statusCode: 200, body: JSON.stringify({ success: false, error: 'Unknown product' }) };
      }
      if (claimResult.error === 'amount_mismatch') {
        console.error('IPN webhook: Amount mismatch held for review. Expected:', claimResult.expectedUSD, 'Paid:', claimResult.paidUSD);
        return { statusCode: 200, body: JSON.stringify({ success: false, error: 'Amount mismatch' }) };
      }
      if (claimResult.error === 'currency_mismatch') {
        console.error('IPN webhook: Currency mismatch held for review');
        return { statusCode: 200, body: JSON.stringify({ success: false, error: 'Currency mismatch' }) };
      }
      if (claimResult.skipped) {
        console.log('IPN webhook: Skipped -', claimResult.reason, 'for:', invoiceStr);
        return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Already processed' }) };
      }

      try {
        console.log('IPN webhook: Granting access for:', invoiceStr);
        await grantAccess(paymentRef, { ...claimResult.paymentData, ...updateFields });
        await paymentRef.update({ accessGranted: true, processingClaim: false });
        console.log('IPN webhook: ACCESS GRANTED successfully for:', invoiceStr);
      } catch (grantErr) {
        console.error('IPN webhook: grantAccess FAILED for:', invoiceStr, 'Error:', grantErr.message);
        await paymentRef.update({ processingClaim: false, grantError: grantErr.message });
        return { statusCode: 500, body: JSON.stringify({ error: 'Access grant failed, will retry on next IPN' }) };
      }
    } else {
      const paymentDoc = await paymentRef.get();
      if (!paymentDoc.exists) {
        console.error('IPN webhook: Payment not found for status update:', invoiceStr);
        return { statusCode: 404, body: JSON.stringify({ error: 'Payment not found' }) };
      }
      if (paymentDoc.data().accessGranted) {
        console.log('IPN webhook: Access already granted, ignoring status:', payment_status, 'for:', invoiceStr);
        return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Already processed' }) };
      }

      if (payment_status === 'partially_paid') {
        updateFields.status = 'partially_paid';
      } else if (payment_status === 'confirming' || payment_status === 'sending') {
        updateFields.status = 'confirming';
      } else if (payment_status === 'waiting') {
        updateFields.status = 'waiting';
      } else if (payment_status === 'failed' || payment_status === 'expired' || payment_status === 'refunded') {
        updateFields.status = payment_status;
        if (payment_status === 'refunded') {
          updateFields.refundedAt = admin.firestore.FieldValue.serverTimestamp();
        }
      } else {
        updateFields.status = payment_status;
      }
      await paymentRef.update(updateFields);
      console.log('IPN webhook: Status updated to', updateFields.status, 'for:', invoiceStr);
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('IPN webhook: CRITICAL ERROR:', err.message, err.stack);
    return { statusCode: 500, body: JSON.stringify({ error: 'Webhook processing failed' }) };
  }
};
