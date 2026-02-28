const nodemailer = require("nodemailer");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { to_email, to_name } = JSON.parse(event.body);

    if (!to_email) {
      return { statusCode: 400, body: "Missing required field: to_email" };
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

    const displayName = to_name || "Valued Customer";

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
                Digimun Pro
              </h1>
              <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 14px;">
                Support Request Confirmation
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 25px 0; color: #1e293b; font-size: 22px;">
                Hello,
              </h2>
              
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.7;">
                Thank you for contacting Digimun Pro Support.
              </p>
              
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.7;">
                We confirm that your request has been received successfully. Our support team is currently reviewing your query and will respond with a detailed update at the earliest possible time.
              </p>
              
              <!-- Telegram Info Box -->
              <div style="background-color: #f0fdf4; border-left: 4px solid #4ade80; padding: 20px; border-radius: 0 8px 8px 0; margin: 25px 0;">
                <p style="margin: 0 0 10px 0; color: #475569; font-size: 15px; line-height: 1.6;">
                  If you require quicker assistance or have an urgent concern, you may reach us directly via Telegram:
                </p>
                <a href="https://t.me/digimun49" style="display: inline-block; color: #15803d; font-size: 16px; font-weight: 600; text-decoration: none;">
                  t.me/digimun49
                </a>
              </div>
              
              <p style="margin: 25px 0; color: #475569; font-size: 16px; line-height: 1.7;">
                We appreciate your patience and thank you for choosing Digimun Pro.
              </p>
              
              <!-- My Tickets Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="https://digimun.pro/my-tickets" 
                       style="display: inline-block; background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(74, 222, 128, 0.4);">
                      My Tickets
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Sign off -->
              <p style="margin: 30px 0 5px 0; color: #475569; font-size: 16px;">
                Kind regards,
              </p>
              <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">
                Digimun Pro Support Team
              </p>
              <a href="https://www.digimun.pro" style="color: #4ade80; font-size: 14px; text-decoration: none;">
                www.digimun.pro
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1e293b; padding: 30px 40px; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 14px;">
                © ${new Date().getFullYear()} Digimun Pro. All rights reserved.
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
          This is an automated message from Digimun Pro Support System
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    await transporter.sendMail({
      from: `"Digimun Pro Support" <${process.env.FROM_EMAIL}>`,
      to: to_email,
      subject: "Support Request Received – Digimun Pro",
      html,
    });

    return { statusCode: 200, body: "Auto-reply email sent successfully" };
  } catch (err) {
    console.error("Auto-reply email error:", err);
    return { statusCode: 500, body: err.message };
  }
};
