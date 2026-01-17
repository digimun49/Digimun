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

    const displayName = to_name || "User";

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
        <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%); border-radius: 16px; overflow: hidden; border: 1px solid rgba(212, 175, 55, 0.3); box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
          
          <!-- Header with Gold Accent -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a2e 0%, #0d1117 100%); padding: 40px; text-align: center; border-bottom: 1px solid rgba(212, 175, 55, 0.2);">
              <div style="display: inline-block; background: linear-gradient(135deg, #d4af37 0%, #f4d03f 50%, #d4af37 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                <h1 style="margin: 0; font-size: 32px; font-weight: 800; letter-spacing: 2px;">
                  DigimunX
                </h1>
              </div>
              <p style="margin: 10px 0 0 0; color: #d4af37; font-size: 14px; letter-spacing: 3px; text-transform: uppercase;">
                Premium AI Trading Bot
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
                Thank you for purchasing <strong style="color: #d4af37;">DigimunX</strong>, our most premium AI trading bot offered under the Digimun platform.
              </p>
              
              <p style="margin: 0 0 20px 0; color: #94a3b8; font-size: 16px; line-height: 1.8;">
                Please find the complete access and usage details below:
              </p>
              
              <!-- Bot Access Section -->
              <div style="background: linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(212, 175, 55, 0.05) 100%); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 12px; padding: 25px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #d4af37; font-size: 16px; letter-spacing: 1px;">
                  🔐 BOT ACCESS
                </h3>
                <table width="100%" cellpadding="8" cellspacing="0">
                  <tr>
                    <td style="color: #94a3b8; font-size: 14px; padding: 5px 0;">Access Link:</td>
                    <td style="text-align: right;">
                      <a href="https://digimun.pro/DigimunX" style="color: #d4af37; text-decoration: none; font-weight: 600;">
                        digimun.pro/DigimunX
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #94a3b8; font-size: 14px; padding: 5px 0;">Access Duration:</td>
                    <td style="text-align: right; color: #ffffff; font-weight: 600;">24 Hours (Temporary)</td>
                  </tr>
                </table>
              </div>
              
              <!-- Usage Guide Section -->
              <div style="background-color: rgba(74, 222, 128, 0.08); border-left: 4px solid #4ade80; padding: 20px; border-radius: 0 12px 12px 0; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #4ade80; font-size: 16px;">
                  📘 Usage Guide & Instructions
                </h3>
                <p style="margin: 0 0 15px 0; color: #94a3b8; font-size: 15px; line-height: 1.7;">
                  A detailed usage guide, including signals explanation and best-practice instructions, is available in our official Telegram channel:
                </p>
                <a href="https://t.me/DigimunX" style="display: inline-block; color: #4ade80; font-size: 16px; font-weight: 600; text-decoration: none;">
                  👉 t.me/DigimunX
                </a>
              </div>
              
              <!-- How to Access Section -->
              <div style="background-color: rgba(255, 255, 255, 0.03); border-radius: 12px; padding: 25px; margin: 25px 0;">
                <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 16px;">
                  👤 How to Access the Bot
                </h3>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 10px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
                      <span style="display: inline-block; width: 28px; height: 28px; background: linear-gradient(135deg, #d4af37, #f4d03f); border-radius: 50%; text-align: center; line-height: 28px; color: #000; font-weight: 700; margin-right: 12px;">1</span>
                      Open our website and log in to your Digimun account.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
                      <span style="display: inline-block; width: 28px; height: 28px; background: linear-gradient(135deg, #d4af37, #f4d03f); border-radius: 50%; text-align: center; line-height: 28px; color: #000; font-weight: 700; margin-right: 12px;">2</span>
                      Navigate to your Dashboard.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
                      <span style="display: inline-block; width: 28px; height: 28px; background: linear-gradient(135deg, #d4af37, #f4d03f); border-radius: 50%; text-align: center; line-height: 28px; color: #000; font-weight: 700; margin-right: 12px;">3</span>
                      From there, you will be able to access and use the DigimunX bot.
                    </td>
                  </tr>
                </table>
                <p style="margin: 20px 0 0 0; color: #64748b; font-size: 14px; font-style: italic;">
                  If the direct access link does not open, or if you face any technical issues, our support team is available to assist you.
                </p>
              </div>
              
              <!-- Support Section -->
              <div style="background-color: rgba(59, 130, 246, 0.08); border-left: 4px solid #3b82f6; padding: 20px; border-radius: 0 12px 12px 0; margin: 25px 0;">
                <h3 style="margin: 0 0 12px 0; color: #3b82f6; font-size: 16px;">
                  📞 Support & Assistance
                </h3>
                <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
                  For further details, clarification, or support, please contact us via Telegram:
                </p>
                <a href="https://t.me/Digimun49" style="display: inline-block; color: #3b82f6; font-size: 16px; font-weight: 600; text-decoration: none;">
                  👉 t.me/Digimun49
                </a>
              </div>
              
              <!-- Warning Box -->
              <div style="background-color: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px; padding: 20px; margin: 25px 0; text-align: center;">
                <p style="margin: 0; color: #fbbf24; font-size: 14px; line-height: 1.7;">
                  ⚠️ We strongly advise not to place any trades without fully understanding the bot and its signals. If anything is unclear, please seek clarification before trading.
                </p>
              </div>
              
              <!-- Lifetime Access Eligibility -->
              <div style="background: linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.05) 100%); border: 2px solid rgba(212, 175, 55, 0.4); border-radius: 12px; padding: 25px; margin: 30px 0;">
                <h3 style="margin: 0 0 20px 0; color: #d4af37; font-size: 18px; text-align: center;">
                  ⭐ Lifetime Access Eligibility
                </h3>
                <p style="margin: 0 0 15px 0; color: #94a3b8; font-size: 15px; line-height: 1.8;">
                  Please note:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #94a3b8; font-size: 15px; line-height: 2;">
                  <li>Your one-time payment has already been received.</li>
                  <li style="color: #4ade80;"><strong>If, within these 24 hours, you create or link your broker account using our official referral, your DigimunX access will be upgraded to lifetime approval at no additional cost.</strong></li>
                </ul>
              </div>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 35px 0;">
                <tr>
                  <td align="center">
                    <a href="https://digimun.pro/DigimunX" 
                       style="display: inline-block; background: linear-gradient(135deg, #d4af37 0%, #f4d03f 50%, #d4af37 100%); color: #000000; text-decoration: none; padding: 18px 50px; border-radius: 10px; font-size: 16px; font-weight: 700; letter-spacing: 1px; box-shadow: 0 4px 20px rgba(212, 175, 55, 0.4);">
                      ACCESS DIGIMUNX NOW →
                    </a>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Risk Disclaimer -->
          <tr>
            <td style="background-color: rgba(0,0,0,0.3); padding: 25px 40px; border-top: 1px solid rgba(255,255,255,0.1);">
              <h4 style="margin: 0 0 10px 0; color: #ef4444; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">
                ⚠️ Risk Disclaimer
              </h4>
              <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.7;">
                Digimun and its services, including DigimunX, provide AI-based trading signals for educational and informational purposes only. We do not guarantee profits, and we are not responsible for any financial losses incurred. Trading in financial markets involves significant risk, and all trading decisions are made solely at the user's own discretion and responsibility.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: linear-gradient(135deg, #0d1117 0%, #1a1a2e 100%); padding: 30px 40px; text-align: center; border-top: 1px solid rgba(212, 175, 55, 0.2);">
              <p style="margin: 0 0 5px 0; color: #94a3b8; font-size: 14px;">
                Kind regards,
              </p>
              <p style="margin: 0 0 15px 0; color: #ffffff; font-size: 16px; font-weight: 600;">
                Digimun Support Team
              </p>
              <p style="margin: 0 0 5px 0; color: #64748b; font-size: 13px;">
                Official AI Trading Solutions
              </p>
              <a href="https://www.digimun.pro" style="color: #d4af37; text-decoration: none; font-size: 14px; font-weight: 500;">
                www.digimun.pro
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
      subject: "DigimunX Premium Bot Access – Usage Details & Lifetime Eligibility",
      html,
    });

    return { 
      statusCode: 200, 
      body: JSON.stringify({ success: true, message: "DigimunX access email sent successfully" })
    };
  } catch (err) {
    console.error("DigimunX email error:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
