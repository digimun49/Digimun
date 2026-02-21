const nodemailer = require('nodemailer');
const { admin, db } = require('./firebase-admin-init.cjs');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { adminEmail, batchId, userEmail } = JSON.parse(event.body);

    if (adminEmail !== ADMIN_EMAIL) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    if (!batchId || !userEmail) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'batchId and userEmail are required' }) };
    }

    const batchRef = db.collection('signalBatches').doc(batchId);
    const batchDoc = await batchRef.get();

    if (!batchDoc.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Batch not found' }) };
    }

    const batchData = batchDoc.data();
    const signalIds = batchData.signalIds || [];
    const signals = [];

    for (const sid of signalIds) {
      const sigDoc = await db.collection('signals').doc(sid).get();
      if (sigDoc.exists) {
        signals.push({ signalId: sigDoc.id, ...sigDoc.data() });
      }
    }

    let wins = 0, losses = 0, invalid = 0, refunded = 0;
    signals.forEach(s => {
      if (s.result === 'WIN') wins++;
      if (s.result === 'LOSS') losses++;
      if (s.result === 'INVALID') invalid++;
      if (s.result === 'REFUNDED') refunded++;
    });

    const totalDecided = wins + losses;
    const winRate = totalDecided > 0 ? Math.round((wins / totalDecided) * 100) : 0;

    const signalRowsHtml = signals.map((s, i) => `
      <tr>
        <td style="padding: 14px 16px; background-color: ${i % 2 === 0 ? '#111827' : '#0f1520'}; color: #9ca3af; font-size: 13px; border-bottom: 1px solid #1e2736;">${i + 1}</td>
        <td style="padding: 14px 16px; background-color: ${i % 2 === 0 ? '#111827' : '#0f1520'}; color: #e5e7eb; font-size: 13px; font-weight: 600; border-bottom: 1px solid #1e2736;">${s.pair || 'N/A'}</td>
        <td style="padding: 14px 16px; background-color: ${i % 2 === 0 ? '#111827' : '#0f1520'}; color: ${s.direction === 'UP' ? '#00D4AA' : '#ef4444'}; font-size: 13px; font-weight: 600; border-bottom: 1px solid #1e2736;">${s.signal || 'N/A'} (${s.direction || 'N/A'})</td>
        <td style="padding: 14px 16px; background-color: ${i % 2 === 0 ? '#111827' : '#0f1520'}; color: #d1d5db; font-size: 13px; border-bottom: 1px solid #1e2736;">${s.confidence || 0}%</td>
        <td style="padding: 14px 16px; background-color: ${i % 2 === 0 ? '#111827' : '#0f1520'}; color: ${s.result === 'WIN' ? '#00D4AA' : s.result === 'LOSS' ? '#ef4444' : '#f59e0b'}; font-size: 13px; font-weight: 700; border-bottom: 1px solid #1e2736;">${s.result || 'N/A'}</td>
      </tr>
    `).join('');

    const userName = userEmail.split('@')[0].charAt(0).toUpperCase() + userEmail.split('@')[0].slice(1);
    const winRateColor = winRate >= 60 ? '#00D4AA' : winRate >= 40 ? '#f59e0b' : '#ef4444';
    const winRateBorderColor = winRate >= 60 ? '#00D4AA' : winRate >= 40 ? '#f59e0b' : '#ef4444';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b0f14; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0b0f14; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #111827; max-width: 600px; width: 100%; border-collapse: collapse;">
          <!-- Gradient Accent Line -->
          <tr>
            <td style="height: 3px; background: linear-gradient(90deg, #00D4AA 0%, #3B82F6 100%); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="background-color: #0d1117; padding: 40px 40px 32px 40px; text-align: center;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0; color: #00D4AA; font-size: 28px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">DIGIMUN PRO</p>
                    <table cellpadding="0" cellspacing="0" border="0" style="margin: 12px auto 0 auto;">
                      <tr>
                        <td style="width: 40px; height: 1px; background-color: #1e2736;"></td>
                        <td style="padding: 0 12px;">
                          <p style="margin: 0; color: #6b7280; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Performance Report</p>
                        </td>
                        <td style="width: 40px; height: 1px; background-color: #1e2736;"></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 40px 8px 40px;">
              <p style="margin: 0 0 6px 0; color: #ffffff; font-size: 20px; font-weight: 700; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Hi ${userName},</p>
              <p style="margin: 0; color: #9ca3af; font-size: 14px; line-height: 1.7; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Here is your latest trading performance breakdown from Digimun Pro. Review your stats and signal results below.</p>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding: 24px 40px 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height: 1px; background-color: #1e2736; font-size: 0; line-height: 0;">&nbsp;</td></tr></table>
            </td>
          </tr>
          <!-- Performance Cards -->
          <tr>
            <td style="padding: 28px 40px 0 40px;">
              <p style="margin: 0 0 16px 0; color: #ffffff; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Performance Overview</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="48%" style="padding-bottom: 12px; padding-right: 6px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0d1117; border: 1px solid #14532d; border-radius: 12px;">
                      <tr>
                        <td style="padding: 20px 16px; text-align: center;">
                          <p style="margin: 0; color: #00D4AA; font-size: 32px; font-weight: 800; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${wins}</p>
                          <p style="margin: 6px 0 0 0; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Wins</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="48%" style="padding-bottom: 12px; padding-left: 6px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0d1117; border: 1px solid #7f1d1d; border-radius: 12px;">
                      <tr>
                        <td style="padding: 20px 16px; text-align: center;">
                          <p style="margin: 0; color: #ef4444; font-size: 32px; font-weight: 800; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${losses}</p>
                          <p style="margin: 6px 0 0 0; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Losses</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td width="48%" style="padding-right: 6px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0d1117; border: 1px solid #78350f; border-radius: 12px;">
                      <tr>
                        <td style="padding: 20px 16px; text-align: center;">
                          <p style="margin: 0; color: #f59e0b; font-size: 32px; font-weight: 800; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${invalid}</p>
                          <p style="margin: 6px 0 0 0; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Invalid</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="48%" style="padding-left: 6px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0d1117; border: 1px solid #312e81; border-radius: 12px;">
                      <tr>
                        <td style="padding: 20px 16px; text-align: center;">
                          <p style="margin: 0; color: #6366f1; font-size: 32px; font-weight: 800; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${refunded}</p>
                          <p style="margin: 6px 0 0 0; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Refunded</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Win Rate Badge -->
          <tr>
            <td style="padding: 32px 40px 28px 40px; text-align: center;">
              <table cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td align="center" style="padding: 0;">
                    <table cellpadding="0" cellspacing="0" border="0" style="background-color: #0d1117; border: 3px solid ${winRateBorderColor}; border-radius: 50%; width: 130px; height: 130px;">
                      <tr>
                        <td align="center" valign="middle" style="width: 130px; height: 130px; text-align: center; vertical-align: middle;">
                          <p style="margin: 0; color: ${winRateColor}; font-size: 40px; font-weight: 800; line-height: 1; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${winRate}%</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 14px;">
                    <p style="margin: 0; color: #9ca3af; font-size: 11px; text-transform: uppercase; letter-spacing: 2.5px; font-weight: 700; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Overall Win Rate</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height: 1px; background-color: #1e2736; font-size: 0; line-height: 0;">&nbsp;</td></tr></table>
            </td>
          </tr>
          <!-- Signal Details Table -->
          <tr>
            <td style="padding: 28px 40px 28px 40px;">
              <p style="margin: 0 0 16px 0; color: #ffffff; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Signal Details</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius: 12px; overflow: hidden; border: 1px solid #1e2736;">
                <tr>
                  <td style="padding: 12px 16px; background-color: #0a0e13; color: #00D4AA; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; border-bottom: 2px solid #00D4AA; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">#</td>
                  <td style="padding: 12px 16px; background-color: #0a0e13; color: #00D4AA; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; border-bottom: 2px solid #00D4AA; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Pair</td>
                  <td style="padding: 12px 16px; background-color: #0a0e13; color: #00D4AA; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; border-bottom: 2px solid #00D4AA; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Signal</td>
                  <td style="padding: 12px 16px; background-color: #0a0e13; color: #00D4AA; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; border-bottom: 2px solid #00D4AA; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Conf.</td>
                  <td style="padding: 12px 16px; background-color: #0a0e13; color: #00D4AA; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; border-bottom: 2px solid #00D4AA; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Result</td>
                </tr>
                ${signalRowsHtml}
              </table>
            </td>
          </tr>
          <!-- CTA Button -->
          <tr>
            <td style="padding: 8px 40px 36px 40px; text-align: center;">
              <table width="80%" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, #00D4AA 0%, #00b894 100%); border-radius: 12px; mso-padding-alt: 18px 40px;">
                    <a href="https://digimun.pro/my-profile" target="_blank" style="display: block; padding: 18px 40px; color: #0b0f14; text-decoration: none; font-size: 16px; font-weight: 800; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; letter-spacing: 1px; text-transform: uppercase; text-align: center;">VIEW MY PROFILE &rarr;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height: 1px; background-color: #1e2736; font-size: 0; line-height: 0;">&nbsp;</td></tr></table>
            </td>
          </tr>
          <!-- Social Links -->
          <tr>
            <td style="padding: 28px 40px 16px 40px; text-align: center;">
              <table cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td style="padding: 0 10px;">
                    <a href="https://t.me/Digimun49" target="_blank" style="color: #00D4AA; text-decoration: none; font-size: 13px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">&#9992; Telegram</a>
                  </td>
                  <td style="color: #374151; font-size: 13px;">|</td>
                  <td style="padding: 0 10px;">
                    <a href="https://digimun.pro" target="_blank" style="color: #00D4AA; text-decoration: none; font-size: 13px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">&#127760; Website</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #0a0d12; padding: 24px 40px; text-align: center;">
              <p style="margin: 0 0 6px 0; color: #4b5563; font-size: 12px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                &copy; ${new Date().getFullYear()} Digimun Pro. All rights reserved.
              </p>
              <p style="margin: 0; color: #374151; font-size: 11px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                You received this email because you are a registered Digimun Pro user.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Digimun Pro" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: 'Your Trading Performance Report - Digimun Pro',
      html,
    });

    await batchRef.update({ emailSent: true });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Performance report email sent successfully' })
    };
  } catch (err) {
    console.error('admin-send-report error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
