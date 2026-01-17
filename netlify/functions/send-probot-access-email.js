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

    const displayName = to_name || "Valued User";

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0f;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f; padding: 30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%); border-radius: 16px; overflow: hidden; border: 1px solid rgba(74, 222, 128, 0.3); box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a2e 0%, #0d1117 100%); padding: 40px; text-align: center; border-bottom: 1px solid rgba(74, 222, 128, 0.2);">
              <h1 style="margin: 0; color: #4ade80; font-size: 32px; font-weight: 800; letter-spacing: 2px;">
                Digimun Pro
              </h1>
              <p style="margin: 10px 0 0 0; color: #4ade80; font-size: 14px; letter-spacing: 3px; text-transform: uppercase;">
                Lifetime Access Granted
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 25px 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                Dear ${displayName},
              </h2>
              
              <p style="margin: 0 0 25px 0; color: #94a3b8; font-size: 16px; line-height: 1.8;">
                We are pleased to inform you that <strong style="color: #4ade80;">lifetime access</strong> to the <strong style="color: #ffffff;">Digimun Pro Bot</strong> has been successfully granted to your account.
              </p>
              
              <!-- How to Access Section -->
              <div style="background: linear-gradient(135deg, rgba(74, 222, 128, 0.1) 0%, rgba(74, 222, 128, 0.05) 100%); border: 1px solid rgba(74, 222, 128, 0.3); border-radius: 12px; padding: 25px; margin: 25px 0;">
                <h3 style="margin: 0 0 20px 0; color: #4ade80; font-size: 18px;">
                  How to Access the Bot
                </h3>
                <p style="margin: 0 0 15px 0; color: #94a3b8; font-size: 15px; line-height: 1.8;">
                  You can use the Digimun Pro Bot through any of the following methods:
                </p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 12px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
                      <span style="display: inline-block; width: 28px; height: 28px; background: linear-gradient(135deg, #4ade80, #22c55e); border-radius: 50%; text-align: center; line-height: 28px; color: #000; font-weight: 700; margin-right: 12px;">1</span>
                      Visit our official website: 
                      <a href="https://digimun.pro" style="color: #4ade80; text-decoration: none; font-weight: 600;">digimun.pro</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
                      <span style="display: inline-block; width: 28px; height: 28px; background: linear-gradient(135deg, #4ade80, #22c55e); border-radius: 50%; text-align: center; line-height: 28px; color: #000; font-weight: 700; margin-right: 12px;">2</span>
                      If logged in, directly access signals: 
                      <a href="https://digimun.pro/signal" style="color: #4ade80; text-decoration: none; font-weight: 600;">digimun.pro/signal</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
                      <span style="display: inline-block; width: 28px; height: 28px; background: linear-gradient(135deg, #4ade80, #22c55e); border-radius: 50%; text-align: center; line-height: 28px; color: #000; font-weight: 700; margin-right: 12px;">3</span>
                      Or log in and navigate to your Dashboard, where your bot approval status is active.
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Important Guidelines Section -->
              <div style="background-color: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px; padding: 25px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #fbbf24; font-size: 16px;">
                  ⚠️ Important Usage Guidelines
                </h3>
                <p style="margin: 0 0 15px 0; color: #94a3b8; font-size: 14px; line-height: 1.7;">
                  Before using the Digimun Pro Bot, it is mandatory to carefully understand and follow all rules:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #94a3b8; font-size: 14px; line-height: 2;">
                  <li>This bot is designed strictly for <strong style="color: #ffffff;">double confirmation and analysis validation only</strong>.</li>
                  <li>It must not be used blindly or as a standalone decision-making tool.</li>
                  <li>Proper risk management is essential at all times.</li>
                </ul>
                <p style="margin: 20px 0 0 0; color: #94a3b8; font-size: 14px;">
                  Review the complete rules here: 
                  <a href="https://digimun.pro/signal-rules" style="color: #fbbf24; text-decoration: none; font-weight: 600;">digimun.pro/signal-rules</a>
                </p>
              </div>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 35px 0;">
                <tr>
                  <td align="center">
                    <a href="https://digimun.pro/signal" 
                       style="display: inline-block; background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); color: #000000; text-decoration: none; padding: 18px 50px; border-radius: 10px; font-size: 16px; font-weight: 700; letter-spacing: 1px; box-shadow: 0 4px 20px rgba(74, 222, 128, 0.4);">
                      ACCESS SIGNALS NOW →
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Support Section -->
              <div style="background-color: rgba(59, 130, 246, 0.08); border-left: 4px solid #3b82f6; padding: 20px; border-radius: 0 12px 12px 0; margin: 25px 0;">
                <h3 style="margin: 0 0 12px 0; color: #3b82f6; font-size: 16px;">
                  📞 Support & Assistance
                </h3>
                <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
                  If you need any clarification or assistance:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #94a3b8; font-size: 14px; line-height: 2;">
                  <li>Contact Telegram support: <a href="https://t.me/Digimun49" style="color: #3b82f6; text-decoration: none; font-weight: 600;">t.me/Digimun49</a></li>
                  <li>Or reply directly to this email</li>
                </ul>
              </div>
              
              <!-- Stay Connected -->
              <div style="background-color: rgba(255, 255, 255, 0.03); border-radius: 12px; padding: 20px; margin: 25px 0; text-align: center;">
                <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 14px;">
                  Stay Connected – Join our official public Telegram channel:
                </p>
                <a href="https://t.me/DigimunPro" style="display: inline-block; color: #4ade80; font-size: 16px; font-weight: 600; text-decoration: none;">
                  📢 t.me/DigimunPro
                </a>
              </div>
              
              <p style="margin: 25px 0 0 0; color: #94a3b8; font-size: 15px; line-height: 1.8;">
                If you are interested in accessing more powerful and advanced trading bots, please visit 
                <a href="https://digimun.pro" style="color: #4ade80; text-decoration: none;">digimun.pro</a>
              </p>
              
            </td>
          </tr>
          
          <!-- Risk Disclaimer -->
          <tr>
            <td style="background-color: rgba(0,0,0,0.3); padding: 25px 40px; border-top: 1px solid rgba(255,255,255,0.1);">
              <h4 style="margin: 0 0 10px 0; color: #ef4444; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">
                ⚠️ Trading Risk Disclaimer
              </h4>
              <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.7;">
                Trading in binary options and financial markets involves significant risk and may result in the loss of all invested capital. The Digimun Pro Bot is provided strictly for analytical and confirmation purposes only and does not constitute financial advice or guarantee any profits. Past performance does not guarantee future results. Users are fully responsible for their own trading decisions, risk management, and compliance with applicable laws. Trade only with funds you can afford to lose.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: linear-gradient(135deg, #0d1117 0%, #1a1a2e 100%); padding: 30px 40px; text-align: center; border-top: 1px solid rgba(74, 222, 128, 0.2);">
              <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 14px;">
                Thank you for choosing Digimun. We wish you disciplined and responsible trading.
              </p>
              <p style="margin: 15px 0 5px 0; color: #94a3b8; font-size: 14px;">
                Kind regards,
              </p>
              <p style="margin: 0 0 15px 0; color: #ffffff; font-size: 16px; font-weight: 600;">
                Digimun Support Team
              </p>
              <a href="https://www.digimun.pro" style="color: #4ade80; text-decoration: none; font-size: 14px; font-weight: 500;">
                Digimun.pro
              </a>
              <p style="margin: 20px 0 0 0; color: #475569; font-size: 12px;">
                © ${new Date().getFullYear()} Digimun Pro. All rights reserved.
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
      from: `"Digimun Pro" <${process.env.FROM_EMAIL}>`,
      to: to_email,
      subject: "Lifetime Access Granted – Digimun Pro Bot",
      html,
    });

    return { 
      statusCode: 200, 
      body: JSON.stringify({ success: true, message: "Pro Bot access email sent successfully" })
    };
  } catch (err) {
    console.error("Pro Bot email error:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
