const { admin, db } = require('./firebase-admin-init.cjs');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, message: 'Method not allowed' }) };
  }

  try {
    const { adminEmail, userEmail } = JSON.parse(event.body || '{}');

    if (adminEmail !== 'digimun249@gmail.com') {
      return { statusCode: 403, headers, body: JSON.stringify({ success: false, message: 'Unauthorized' }) };
    }

    if (!userEmail || userEmail.toLowerCase().trim() === adminEmail.toLowerCase().trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Invalid user email provided' }) };
    }

    const emailLower = userEmail.toLowerCase().trim();

    try {
      const userRecord = await admin.auth().getUserByEmail(emailLower);
      await admin.auth().deleteUser(userRecord.uid);
    } catch (authErr) {
      if (authErr.code !== 'auth/user-not-found') {
        console.error('Firebase Auth delete error:', authErr.message);
      }
    }

    await db.collection('users').doc(emailLower).delete();

    await db.collection('deletedAccounts').doc(emailLower).set({
      email: emailLower,
      deletedAt: new Date(),
      deletedBy: adminEmail,
      reason: 'Deleted by admin upon user request'
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Account deleted successfully' }) };
  } catch (err) {
    console.error('Delete account error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: 'Failed to delete account: ' + err.message }) };
  }
};
