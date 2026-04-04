const nodemailer = require("nodemailer");
const { getCorsHeaders, verifyAdmin } = require('./firebase-admin-init.cjs');

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const adminAuth = await verifyAdmin(event);
  if (!adminAuth.authorized) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { to_email, to_name, subject, message, ticket_id } = JSON.parse(event.body || '{}');

    if (!to_email || typeof to_email !== 'string' || !ticket_id || typeof ticket_id !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    if (to_email.trim().length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to_email.trim())) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email format' }) };
    }

    if (ticket_id.length > 128) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid ticket ID' }) };
    }

    if (to_name && (typeof to_name !== 'string' || to_name.length > 200)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid name format' }) };
    }

    if (subject && (typeof subject !== 'string' || subject.length > 500)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Subject too long' }) };
    }

    if (message && (typeof message !== 'string' || message.length > 5000)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message too long' }) };
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const shortTicketId = (ticket_id || '').substring(0, 8).toUpperCase();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #4ade80; font-size: 28px; font-weight: 700; letter-spacing: 1px;">
                DigiMun Pro
              </h1>
              <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 14px;">
                Trading Signals & Support Platform
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 22px;">
                Hello ${to_name || 'Valued Customer'},
              </h2>
              
              <p style="margin: 0 0 15px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                There is a new update on your support ticket.
              </p>
              
              <!-- Ticket Badge -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 25px 0;">
                <tr>
                  <td>
                    <div style="background-color: #f0fdf4; border-left: 4px solid #4ade80; padding: 15px 20px; border-radius: 0 8px 8px 0;">
                      <span style="color: #166534; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Ticket ID</span>
                      <p style="margin: 5px 0 0 0; color: #15803d; font-size: 20px; font-weight: 700; font-family: monospace;">
                        #DM-${shortTicketId}
                      </p>
                    </div>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 25px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Our support team has responded to your ticket. Please log in to your dashboard to view the reply.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="https://digimun.pro/my-tickets" 
                       style="display: inline-block; background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(74, 222, 128, 0.4);">
                      View Ticket in Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 25px 0 0 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                For security reasons, the reply content is only available inside your dashboard.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1e293b; padding: 30px 40px; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 14px;">
                © ${new Date().getFullYear()} DigiMun Pro. All rights reserved.
              </p>
              <p style="margin: 0;">
                <a href="https://digimun.pro" style="color: #4ade80; text-decoration: none; font-size: 14px;">
                  digimun.pro
                </a>
              </p>
            </td>
          </tr>
          
        </table>
        
        <!-- Bottom Text -->
        <p style="margin: 20px 0 0 0; color: #94a3b8; font-size: 12px; text-align: center;">
          This is an automated message from DigiMun Pro Support System
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    await transporter.sendMail({
      from: `"DigiMun Pro Support" <${process.env.FROM_EMAIL}>`,
      to: to_email,
      subject: `[Ticket #DM-${shortTicketId}] ${subject}`,
      html,
    });

    return { statusCode: 200, body: "Email sent successfully" };
  } catch (err) {
    console.error('Support reply email error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to send email' }) };
  }
};
