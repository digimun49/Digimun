const nodemailer = require('nodemailer');
const { admin, db } = require('./firebase-admin-init');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const ADMIN_EMAIL = 'digimun249@gmail.com';

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
        <td style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #9ca3af; font-size: 13px;">${i + 1}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #d1d5db; font-size: 13px; font-weight: 600;">${s.pair || 'N/A'}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); color: ${s.direction === 'UP' ? '#00D4AA' : '#ef4444'}; font-size: 13px; font-weight: 600;">${s.signal || 'N/A'} (${s.direction || 'N/A'})</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #d1d5db; font-size: 13px;">${s.confidence || 0}%</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); color: ${s.result === 'WIN' ? '#00D4AA' : s.result === 'LOSS' ? '#ef4444' : '#f59e0b'}; font-size: 13px; font-weight: 700;">${s.result || 'N/A'}</td>
      </tr>
    `).join('');

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
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #111827; border-radius: 16px; overflow: hidden; border: 1px solid rgba(0, 212, 170, 0.15);">
          <tr>
            <td style="background: linear-gradient(135deg, #0d1117 0%, #111827 50%, #0d1117 100%); padding: 36px 40px; text-align: center; border-bottom: 1px solid rgba(0, 212, 170, 0.1);">
              <h1 style="margin: 0; color: #00D4AA; font-size: 26px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">
                DIGIMUN PRO
              </h1>
              <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 13px; letter-spacing: 1px;">
                Trading Performance Report
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px 0 40px; text-align: center;">
              <div style="display: inline-block; width: 72px; height: 72px; line-height: 72px; font-size: 36px; background: rgba(0, 212, 170, 0.1); border: 2px solid rgba(0, 212, 170, 0.25); border-radius: 50%;">
                📊
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 16px 40px;">
              <h2 style="margin: 0 0 12px 0; color: #ffffff; font-size: 22px; text-align: center; font-weight: 700;">
                Your Performance Summary
              </h2>
              <p style="margin: 0 0 24px 0; color: #9ca3af; font-size: 15px; line-height: 1.7; text-align: center;">
                Here's a detailed breakdown of your recent trading signals performance on Digimun Pro.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="25%" style="text-align: center; padding: 16px 8px; background: rgba(0, 212, 170, 0.06); border-radius: 12px 0 0 12px; border: 1px solid rgba(0, 212, 170, 0.1);">
                    <p style="margin: 0; color: #00D4AA; font-size: 28px; font-weight: 800;">${wins}</p>
                    <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Wins</p>
                  </td>
                  <td width="25%" style="text-align: center; padding: 16px 8px; background: rgba(239, 68, 68, 0.06); border-top: 1px solid rgba(239, 68, 68, 0.1); border-bottom: 1px solid rgba(239, 68, 68, 0.1);">
                    <p style="margin: 0; color: #ef4444; font-size: 28px; font-weight: 800;">${losses}</p>
                    <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Losses</p>
                  </td>
                  <td width="25%" style="text-align: center; padding: 16px 8px; background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.1);">
                    <p style="margin: 0; color: #f59e0b; font-size: 28px; font-weight: 800;">${invalid}</p>
                    <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Invalid</p>
                  </td>
                  <td width="25%" style="text-align: center; padding: 16px 8px; background: rgba(99, 102, 241, 0.06); border-radius: 0 12px 12px 0; border: 1px solid rgba(99, 102, 241, 0.1);">
                    <p style="margin: 0; color: #6366f1; font-size: 28px; font-weight: 800;">${refunded}</p>
                    <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Refunded</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 24px 40px; text-align: center;">
              <div style="display: inline-block; background: rgba(0, 212, 170, 0.08); border: 1px solid rgba(0, 212, 170, 0.2); border-radius: 12px; padding: 16px 32px;">
                <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px;">Win Rate</p>
                <p style="margin: 4px 0 0 0; color: #00D4AA; font-size: 36px; font-weight: 800;">${winRate}%</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <p style="margin: 0 0 12px 0; color: #ffffff; font-size: 16px; font-weight: 700;">Signal Details</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(0,0,0,0.2); border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="padding: 10px 16px; background: rgba(0, 212, 170, 0.08); color: #00D4AA; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">#</td>
                  <td style="padding: 10px 16px; background: rgba(0, 212, 170, 0.08); color: #00D4AA; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Pair</td>
                  <td style="padding: 10px 16px; background: rgba(0, 212, 170, 0.08); color: #00D4AA; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Signal</td>
                  <td style="padding: 10px 16px; background: rgba(0, 212, 170, 0.08); color: #00D4AA; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Conf.</td>
                  <td style="padding: 10px 16px; background: rgba(0, 212, 170, 0.08); color: #00D4AA; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Result</td>
                </tr>
                ${signalRowsHtml}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 28px 40px; text-align: center;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://digimun.pro/my-profile"
                       style="display: inline-block; background: linear-gradient(135deg, #00D4AA 0%, #00b894 100%); color: #000000; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-size: 15px; font-weight: 700; letter-spacing: 0.5px;">
                      View Your Profile
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 28px 40px; text-align: center;">
              <a href="https://t.me/Digimun49"
                 style="display: inline-block; background: transparent; color: #00D4AA; text-decoration: none; padding: 10px 28px; border-radius: 8px; font-size: 13px; font-weight: 600; border: 1px solid rgba(0, 212, 170, 0.3);">
                Contact Us on Telegram
              </a>
            </td>
          </tr>
          <tr>
            <td style="background: rgba(0, 0, 0, 0.3); padding: 24px 40px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05);">
              <p style="margin: 0 0 6px 0; color: #4b5563; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Digimun Pro. All rights reserved.
              </p>
              <p style="margin: 0; color: #374151; font-size: 11px;">
                You received this email because you are a Digimun Pro user.
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
