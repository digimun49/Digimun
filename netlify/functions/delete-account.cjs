const { admin, db, getCorsHeaders, verifyAdmin } = require('./firebase-admin-init.cjs');
const nodemailer = require("nodemailer");

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, message: 'Method not allowed' }) };
  }

  const adminAuth = await verifyAdmin(event);
  if (!adminAuth.authorized) {
    return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Unauthorized' }) };
  }

  try {
    const { userEmail } = JSON.parse(event.body || '{}');

    if (!userEmail || typeof userEmail !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Invalid user email provided' }) };
    }

    if (userEmail.trim().length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim())) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Invalid email format' }) };
    }

    if (userEmail.toLowerCase().trim() === adminAuth.email.toLowerCase().trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Cannot delete your own admin account' }) };
    }

    const emailLower = userEmail.toLowerCase().trim();

    let userName = '';
    try {
      const userDoc = await db.collection('users').doc(emailLower).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        userName = data.name || data.displayName || data.firstName || '';
      }
    } catch (e) {}

    try {
      const userRecord = await admin.auth().getUserByEmail(emailLower);
      if (!userName && userRecord.displayName) userName = userRecord.displayName;
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
      deletedBy: adminAuth.email,
      reason: 'Deleted by admin upon user request'
    });

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const firstName = (userName || 'User').split(' ')[0];
      const deletionDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const deletionTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b0f14;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0b0f14; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #111827; border-radius: 16px; overflow: hidden; border: 1px solid rgba(239, 68, 68, 0.2);">
          
          <tr>
            <td style="background: linear-gradient(135deg, #1a0a0a 0%, #111827 50%, #1a0a0a 100%); padding: 36px 40px; text-align: center; border-bottom: 1px solid rgba(239, 68, 68, 0.15);">
              <h1 style="margin: 0; color: #00D4AA; font-size: 26px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">DIGIMUN PRO</h1>
              <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 13px; letter-spacing: 1px;">AI-Powered Trading Signals</p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 32px 40px 0 40px; text-align: center;">
              <div style="display: inline-block; width: 80px; height: 80px; line-height: 80px; font-size: 40px; background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(185, 28, 28, 0.1) 100%); border: 2px solid rgba(239, 68, 68, 0.3); border-radius: 50%;">&#128274;</div>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 24px 40px 12px 40px;">
              <h2 style="margin: 0 0 8px 0; color: #ffffff; font-size: 24px; text-align: center; font-weight: 700;">Account Permanently Deleted</h2>
              <p style="margin: 0 0 24px 0; color: #9ca3af; font-size: 14px; line-height: 1.6; text-align: center;">Dear ${firstName}, this email confirms that your Digimun Pro account has been permanently deleted as requested.</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.06) 0%, rgba(185, 28, 28, 0.04) 100%); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="padding: 18px 20px; border-bottom: 1px solid rgba(239, 68, 68, 0.08);">
                    <p style="margin: 0; color: #ef4444; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">Deletion Summary</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280; font-size: 13px; width: 40%;">Account Email</td>
                        <td style="padding: 6px 0; color: #ffffff; font-size: 13px; font-weight: 600; text-align: right;">${emailLower}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280; font-size: 13px; border-top: 1px solid rgba(255,255,255,0.04);">Date</td>
                        <td style="padding: 6px 0; color: #ffffff; font-size: 13px; font-weight: 600; text-align: right; border-top: 1px solid rgba(255,255,255,0.04);">${deletionDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280; font-size: 13px; border-top: 1px solid rgba(255,255,255,0.04);">Time</td>
                        <td style="padding: 6px 0; color: #ffffff; font-size: 13px; font-weight: 600; text-align: right; border-top: 1px solid rgba(255,255,255,0.04);">${deletionTime}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280; font-size: 13px; border-top: 1px solid rgba(255,255,255,0.04);">Status</td>
                        <td style="padding: 6px 0; text-align: right; border-top: 1px solid rgba(255,255,255,0.04);">
                          <span style="display: inline-block; background: rgba(239, 68, 68, 0.15); color: #ef4444; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">Permanently Deleted</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px;">
                <tr>
                  <td style="padding: 18px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
                    <p style="margin: 0; color: #ffffff; font-size: 13px; font-weight: 700;">What Has Been Removed</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; vertical-align: top; width: 28px;"><span style="color: #ef4444; font-size: 14px;">&#10005;</span></td>
                        <td style="padding: 8px 0; color: #d1d5db; font-size: 13px; line-height: 1.5;"><strong style="color: #ffffff;">Login Credentials</strong> &#8212; Your email and password have been permanently removed from our authentication system</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; vertical-align: top; width: 28px; border-top: 1px solid rgba(255,255,255,0.04);"><span style="color: #ef4444; font-size: 14px;">&#10005;</span></td>
                        <td style="padding: 8px 0; color: #d1d5db; font-size: 13px; line-height: 1.5; border-top: 1px solid rgba(255,255,255,0.04);"><strong style="color: #ffffff;">Profile &amp; Settings</strong> &#8212; All personal information, preferences, and configurations have been erased</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; vertical-align: top; width: 28px; border-top: 1px solid rgba(255,255,255,0.04);"><span style="color: #ef4444; font-size: 14px;">&#10005;</span></td>
                        <td style="padding: 8px 0; color: #d1d5db; font-size: 13px; line-height: 1.5; border-top: 1px solid rgba(255,255,255,0.04);"><strong style="color: #ffffff;">Trading Data</strong> &#8212; Signal history, performance records, and money management profiles have been deleted</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; vertical-align: top; width: 28px; border-top: 1px solid rgba(255,255,255,0.04);"><span style="color: #ef4444; font-size: 14px;">&#10005;</span></td>
                        <td style="padding: 8px 0; color: #d1d5db; font-size: 13px; line-height: 1.5; border-top: 1px solid rgba(255,255,255,0.04);"><strong style="color: #ffffff;">Subscription &amp; Access</strong> &#8212; All active passes, subscriptions, and platform access have been revoked</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 40px 28px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.04) 100%); border: 1px solid rgba(245, 158, 11, 0.15); border-radius: 12px;">
                <tr>
                  <td style="padding: 18px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align: top; width: 30px;"><span style="font-size: 18px;">&#9888;&#65039;</span></td>
                        <td>
                          <p style="margin: 0 0 4px 0; color: #f59e0b; font-size: 13px; font-weight: 700;">Important Notice</p>
                          <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">This action is <strong style="color: #f59e0b;">irreversible</strong>. You will not be able to recover your account or create a new account with this email address. If you believe this was done in error, please contact our support team immediately.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 40px 32px 40px; text-align: center;">
              <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px;">Have questions or concerns?</p>
              <a href="https://t.me/Digimun49" style="display: inline-block; background: transparent; color: #00D4AA; text-decoration: none; padding: 12px 32px; border-radius: 10px; font-size: 14px; font-weight: 600; border: 1px solid rgba(0, 212, 170, 0.3);">Contact Support on Telegram &#8594;</a>
            </td>
          </tr>
          
          <tr>
            <td style="background: rgba(0, 0, 0, 0.3); padding: 24px 40px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05);">
              <p style="margin: 0 0 6px 0; color: #4b5563; font-size: 12px;">&copy; ${new Date().getFullYear()} Digimun Pro. All rights reserved.</p>
              <p style="margin: 0; color: #374151; font-size: 11px;">This is a one-time notification regarding your account deletion. No further emails will be sent to this address.</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

      await transporter.sendMail({
        from: '"Digimun Pro" <' + process.env.SMTP_USER + '>',
        to: emailLower,
        subject: 'Account Deletion Confirmation - Digimun Pro',
        html: html,
      });
    } catch (emailErr) {
      console.error('Deletion email send error:', emailErr.message);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Account deleted successfully' }) };
  } catch (err) {
    console.error('Delete account error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: 'Failed to delete account' }) };
  }
};
