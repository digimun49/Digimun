const { admin, db, getCorsHeaders, verifyAdmin } = require('./firebase-admin-init.cjs');

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (!db) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service temporarily unavailable' }) };
  }

  const adminAuth = await verifyAdmin(event);
  if (!adminAuth.authorized) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const action = event.queryStringParameters?.action || '';

  if (event.httpMethod === 'GET' && action === 'list') {
    try {
      const dateFrom = event.queryStringParameters?.dateFrom;
      const dateTo = event.queryStringParameters?.dateTo;
      const statusFilter = event.queryStringParameters?.status;

      let query = db.collection('cryptoPayments').orderBy('createdAt', 'desc');

      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        if (!isNaN(fromDate.getTime())) {
          query = query.where('createdAt', '>=', fromDate);
        }
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        if (!isNaN(toDate.getTime())) {
          toDate.setHours(23, 59, 59, 999);
          query = query.where('createdAt', '<=', toDate);
        }
      }

      query = query.limit(500);
      const snap = await query.get();
      const payments = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (statusFilter && d.status !== statusFilter) return;
        payments.push({
          id: doc.id,
          invoiceId: d.invoiceId,
          userEmail: d.userEmail,
          productId: d.productId,
          productName: d.productName,
          productTier: d.productTier,
          amountUSD: d.amountUSD,
          cryptoAmount: d.cryptoAmount,
          cryptoCurrency: d.cryptoCurrency,
          status: d.status,
          accessGranted: d.accessGranted || false,
          refundEligible: d.refundEligible || false,
          promoCode: d.promoCode || null,
          transactionHash: d.transactionHash || null,
          senderWallet: d.senderWallet || null,
          nowpaymentsPaymentId: d.nowpaymentsPaymentId || null,
          lastIpnStatus: d.lastIpnStatus || null,
          amountMismatch: d.amountMismatch || false,
          expectedUSD: d.expectedUSD || null,
          paidUSD: d.paidUSD || null,
          firestoreField: d.firestoreField || null,
          accessDuration: d.accessDuration || null,
          createdAt: d.createdAt ? (d.createdAt.toDate ? d.createdAt.toDate().toISOString() : d.createdAt) : null,
          confirmedAt: d.confirmedAt ? (d.confirmedAt.toDate ? d.confirmedAt.toDate().toISOString() : d.confirmedAt) : null,
          accessGrantedAt: d.accessGrantedAt ? (d.accessGrantedAt.toDate ? d.accessGrantedAt.toDate().toISOString() : d.accessGrantedAt) : null,
          refundedAt: d.refundedAt ? (d.refundedAt.toDate ? d.refundedAt.toDate().toISOString() : d.refundedAt) : null
        });
      });
      return { statusCode: 200, headers, body: JSON.stringify({ payments }) };
    } catch (err) {
      console.error('crypto-admin list error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to list payments' }) };
    }
  }

  if (event.httpMethod === 'GET' && action === 'detail') {
    try {
      const invoiceId = event.queryStringParameters?.invoiceId;
      if (!invoiceId || typeof invoiceId !== 'string' || invoiceId.length > 128) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid invoice ID required' }) };
      }
      const doc = await db.collection('cryptoPayments').doc(String(invoiceId)).get();
      if (!doc.exists) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Payment not found' }) };
      }
      const d = doc.data();
      const tsFields = ['createdAt', 'confirmedAt', 'accessGrantedAt', 'refundedAt', 'lastIpnAt'];
      const result = { id: doc.id };
      for (const [key, val] of Object.entries(d)) {
        if (tsFields.includes(key) && val && val.toDate) {
          result[key] = val.toDate().toISOString();
        } else {
          result[key] = val;
        }
      }
      return { statusCode: 200, headers, body: JSON.stringify({ payment: result }) };
    } catch (err) {
      console.error('crypto-admin detail error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to load payment detail' }) };
    }
  }

  if (event.httpMethod === 'GET' && action === 'revenue') {
    try {
      const now = new Date();
      const todayKey = now.toISOString().split('T')[0];
      const monthKey = todayKey.substring(0, 7);

      const [dailyDoc, monthlyDoc, totalDoc] = await Promise.all([
        db.collection('paymentSummary').doc(`daily_${todayKey}`).get(),
        db.collection('paymentSummary').doc(`monthly_${monthKey}`).get(),
        db.collection('paymentSummary').doc('all_time').get()
      ]);

      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      let weekRevenue = 0;
      for (let i = 0; i <= dayOfWeek; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const dk = d.toISOString().split('T')[0];
        if (dk === todayKey && dailyDoc.exists) {
          weekRevenue += dailyDoc.data().totalRevenue || 0;
        } else {
          const dayDoc = await db.collection('paymentSummary').doc(`daily_${dk}`).get();
          if (dayDoc.exists) weekRevenue += dayDoc.data().totalRevenue || 0;
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          today: dailyDoc.exists ? (dailyDoc.data().totalRevenue || 0) : 0,
          week: weekRevenue,
          month: monthlyDoc.exists ? (monthlyDoc.data().totalRevenue || 0) : 0,
          total: totalDoc.exists ? (totalDoc.data().totalRevenue || 0) : 0,
          todayCount: dailyDoc.exists ? (dailyDoc.data().totalTransactions || 0) : 0,
          monthCount: monthlyDoc.exists ? (monthlyDoc.data().totalTransactions || 0) : 0,
          totalCount: totalDoc.exists ? (totalDoc.data().totalTransactions || 0) : 0
        })
      };
    } catch (err) {
      console.error('crypto-admin revenue error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to load revenue' }) };
    }
  }

  if (event.httpMethod === 'POST' && action === 'toggle-refund') {
    try {
      const { invoiceId } = JSON.parse(event.body || '{}');
      if (!invoiceId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invoice ID required' }) };
      }

      const ref = db.collection('cryptoPayments').doc(String(invoiceId));
      const doc = await ref.get();
      if (!doc.exists) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Payment not found' }) };
      }

      const data = doc.data();
      if (data.accessGranted) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot toggle refund for activated payment' }) };
      }

      const newRefundEligible = !data.refundEligible;
      await ref.update({
        refundEligible: newRefundEligible,
        ...(newRefundEligible ? {} : { refundedAt: admin.firestore.FieldValue.serverTimestamp(), status: 'refunded' })
      });

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, refundEligible: newRefundEligible }) };
    } catch (err) {
      console.error('crypto-admin toggle-refund error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to toggle refund' }) };
    }
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action' }) };
};
