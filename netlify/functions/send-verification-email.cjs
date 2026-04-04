const { admin, db, getCorsHeaders } = require('./firebase-admin-init.cjs');
const { isRateLimited, getClientIP } = require('./rate-limiter.cjs');
const nodemailer = require("nodemailer");

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const clientIP = getClientIP(event);
  const ipCheck = isRateLimited(`verify_email_ip:${clientIP}`, { maxRequests: 5, windowMs: 15 * 60 * 1000 });
  if (ipCheck.limited) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests. Please try again later.' }) };
  }

  try {
    const { email } = JSON.parse(event.body);

    if (!email) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email is required' }) };
    }

    const emailCheck = isRateLimited(`verify_email:${email.toLowerCase().trim()}`, { maxRequests: 3, windowMs: 10 * 60 * 1000 });
    if (emailCheck.limited) {
      return { statusCode: 429, headers, body: JSON.stringify({ error: 'Verification email already sent. Please check your inbox.' }) };
    }

    const verificationLink = await admin.auth().generateEmailVerificationLink(email);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

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
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0d1117 0%, #111827 50%, #0d1117 100%); padding: 36px 40px; text-align: center; border-bottom: 1px solid rgba(0, 212, 170, 0.1);">
              <h1 style="margin: 0; color: #00D4AA; font-size: 26px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">
                DIGIMUN PRO
              </h1>
              <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 13px; letter-spacing: 1px;">
                AI-Powered Trading Signals
              </p>
            </td>
          </tr>
          
          <!-- Shield/Checkmark Icon -->
          <tr>
            <td style="padding: 32px 40px 0 40px; text-align: center;">
              <div style="display: inline-block; width: 72px; height: 72px; line-height: 72px; font-size: 36px; background: rgba(0, 212, 170, 0.1); border: 2px solid rgba(0, 212, 170, 0.25); border-radius: 50%;">
                &#9989;
              </div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 24px 40px 36px 40px;">
              <h2 style="margin: 0 0 12px 0; color: #ffffff; font-size: 22px; text-align: center; font-weight: 700;">
                Verify Your Email Address
              </h2>
              
              <p style="margin: 0 0 8px 0; color: #00D4AA; font-size: 16px; text-align: center; font-weight: 600;">
                Welcome to Digimun Pro!
              </p>
              
              <p style="margin: 0 0 28px 0; color: #9ca3af; font-size: 15px; line-height: 1.7; text-align: center;">
                Thank you for signing up. Please verify your email address to activate your account and get full access to our AI-powered trading signals platform.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center">
                    <a href="${verificationLink}" 
                       style="display: inline-block; background: linear-gradient(135deg, #00D4AA 0%, #00b894 100%); color: #000000; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-size: 16px; font-weight: 700; letter-spacing: 0.5px;">
                      Verify My Email
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Raw Link -->
              <p style="margin: 0 0 28px 0; color: #6b7280; font-size: 12px; line-height: 1.6; text-align: center; word-break: break-all;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${verificationLink}" style="color: #00D4AA; text-decoration: underline;">${verificationLink}</a>
              </p>
              
              <!-- Security Notice -->
              <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 16px 20px; text-align: center;">
                <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                  &#128274; If you didn't create this account, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Support -->
          <tr>
            <td style="padding: 0 40px 28px 40px; text-align: center;">
              <p style="margin: 0; color: #4b5563; font-size: 13px; line-height: 1.6;">
                Need help? Reach out anytime on 
                <a href="https://t.me/Digimun49" style="color: #00D4AA; text-decoration: none;">Telegram @Digimun49</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: rgba(0, 0, 0, 0.3); padding: 24px 40px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05);">
              <p style="margin: 0 0 6px 0; color: #4b5563; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Digimun Pro. All rights reserved.
              </p>
              <p style="margin: 0; color: #374151; font-size: 11px;">
                You received this email because you signed up for a Digimun Pro account.
              </p>
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
      from: `"Digimun Pro" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `✅ Verify Your Email — Digimun Pro`,
      html: html,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: "Verification email sent" })
    };
  } catch (err) {
    console.error("Error sending verification email:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to send verification email' })
    };
  }
};
