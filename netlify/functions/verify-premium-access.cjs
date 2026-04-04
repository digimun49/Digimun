const { admin, db } = require('./firebase-admin-init.cjs');

function isExpired(expiryValue) {
  if (!expiryValue) return false;
  let expiryDate;
  if (expiryValue.toDate) {
    expiryDate = expiryValue.toDate();
  } else if (expiryValue.seconds) {
    expiryDate = new Date(expiryValue.seconds * 1000);
  } else {
    expiryDate = new Date(expiryValue);
  }
  return expiryDate <= new Date();
}

async function verifyPremiumAccess(userEmail, requiredField) {
  if (!db) {
    return { allowed: false, reason: 'Service temporarily unavailable' };
  }

  const emailLower = (userEmail || '').toLowerCase().trim();
  if (!emailLower) {
    return { allowed: false, reason: 'Email is required' };
  }

  const userDoc = await db.collection('users').doc(emailLower).get();
  if (!userDoc.exists) {
    return { allowed: false, reason: 'User not found' };
  }

  const data = userDoc.data();

  const accountStatus = (data.status || '').toLowerCase();
  if (accountStatus === 'suspended' || accountStatus === 'banned' || accountStatus === 'pending') {
    return { allowed: false, reason: 'Account is not active' };
  }

  let firebaseUser;
  try {
    firebaseUser = await admin.auth().getUserByEmail(emailLower);
  } catch (e) {
    return { allowed: false, reason: 'User authentication error' };
  }

  if (!firebaseUser.emailVerified) {
    return { allowed: false, reason: 'Email verification required', requiresVerification: true };
  }

  if (requiredField) {
    const fieldValue = (data[requiredField] || '').toLowerCase();
    if (fieldValue !== 'approved' && fieldValue !== 'active') {
      return { allowed: false, reason: `${requiredField} access not approved` };
    }

    const expiryFieldMap = {
      'paymentStatus': 'paymentStatusExpiry',
      'quotexStatus': 'quotexStatusExpiry',
      'recoveryRequest': 'recoveryRequestExpiry',
      'digimaxStatus': 'digimaxStatusExpiry'
    };

    const expiryField = expiryFieldMap[requiredField];
    if (expiryField && data[expiryField]) {
      if (isExpired(data[expiryField])) {
        try {
          await db.collection('users').doc(emailLower).update({
            [requiredField]: 'pending',
            [expiryField]: admin.firestore.FieldValue.delete()
          });
        } catch (e) {
          console.error('Failed to expire access:', e.message);
        }
        return { allowed: false, reason: 'Access has expired' };
      }
    }
  }

  return { allowed: true, userData: data };
}

module.exports = { verifyPremiumAccess, isExpired };
