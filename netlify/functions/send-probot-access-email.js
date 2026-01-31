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

    const displayName = to_name || "Valued Trader";

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #050508;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #050508; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #0a0e14 0%, #050508 100%); border-radius: 20px; overflow: hidden; border: 1px solid rgba(74, 222, 128, 0.2); box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #0a0e14 0%, #111827 100%); padding: 50px 40px; text-align: center; border-bottom: 1px solid rgba(74, 222, 128, 0.15);">
              <img src="https://digimun.pro/assets/digimun-logo.png" alt="Digimun Pro" style="height: 50px; margin-bottom: 20px;">
              <div style="background: rgba(74, 222, 128, 0.12); border: 1px solid rgba(74, 222, 128, 0.3); display: inline-block; padding: 8px 24px; border-radius: 50px; margin-bottom: 15px;">
                <span style="color: #4ade80; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">
                  LIFETIME ACCESS GRANTED
                </span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">
                Digimun Pro Bot
              </h1>
              <p style="margin: 12px 0 0 0; color: #9ca3af; font-size: 15px;">
                AI-Powered Trading Signal Generator
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 45px 40px;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">
                Dear
              </p>
              <h2 style="margin: 0 0 30px 0; color: #ffffff; font-size: 24px; font-weight: 700;">
                ${displayName}
              </h2>
              
              <p style="margin: 0 0 25px 0; color: #9ca3af; font-size: 16px; line-height: 1.8;">
                Congratulations! Your <strong style="color: #4ade80;">lifetime access</strong> to the <strong style="color: #ffffff;">Digimun Pro Bot</strong> has been successfully activated. You now have permanent access to our AI-powered trading signal generator.
              </p>
              
              <!-- Access Details Card -->
              <div style="background: linear-gradient(135deg, rgba(74, 222, 128, 0.08) 0%, rgba(74, 222, 128, 0.02) 100%); border: 1px solid rgba(74, 222, 128, 0.2); border-radius: 16px; padding: 28px; margin: 30px 0;">
                <h3 style="margin: 0 0 20px 0; color: #4ade80; font-size: 15px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">
                  Your Access Details
                </h3>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                      <span style="color: #6b7280; font-size: 14px;">Service</span>
                    </td>
                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06); text-align: right;">
                      <span style="color: #ffffff; font-size: 14px; font-weight: 600;">Digimun Pro Bot</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                      <span style="color: #6b7280; font-size: 14px;">Access Duration</span>
                    </td>
                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06); text-align: right;">
                      <span style="color: #4ade80; font-size: 14px; font-weight: 700;">Lifetime</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                      <span style="color: #6b7280; font-size: 14px;">Markets Available</span>
                    </td>
                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06); text-align: right;">
                      <span style="color: #ffffff; font-size: 14px;">Live & OTC Markets</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0;">
                      <span style="color: #6b7280; font-size: 14px;">Direct Access</span>
                    </td>
                    <td style="padding: 12px 0; text-align: right;">
                      <a href="https://digimun.pro/signal" style="color: #4ade80; font-size: 14px; font-weight: 600; text-decoration: none;">digimun.pro/signal</a>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- How to Access -->
              <div style="background: rgba(255,255,255,0.02); border-radius: 16px; padding: 28px; margin: 30px 0;">
                <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 15px; font-weight: 700;">
                  How to Access the Bot
                </h3>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 14px 0; vertical-align: top;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width: 36px; vertical-align: top;">
                            <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #4ade80, #22c55e); border-radius: 50%; text-align: center; line-height: 28px; color: #000; font-weight: 700; font-size: 13px;">1</div>
                          </td>
                          <td style="color: #9ca3af; font-size: 15px; line-height: 1.6; padding-left: 8px;">
                            Log in to your account at <a href="https://digimun.pro/login" style="color: #4ade80; text-decoration: none; font-weight: 600;">digimun.pro/login</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 14px 0; vertical-align: top;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width: 36px; vertical-align: top;">
                            <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #4ade80, #22c55e); border-radius: 50%; text-align: center; line-height: 28px; color: #000; font-weight: 700; font-size: 13px;">2</div>
                          </td>
                          <td style="color: #9ca3af; font-size: 15px; line-height: 1.6; padding-left: 8px;">
                            Go to your <a href="https://digimun.pro/dashboard" style="color: #4ade80; text-decoration: none; font-weight: 600;">Dashboard</a> to see your active services
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 14px 0; vertical-align: top;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width: 36px; vertical-align: top;">
                            <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #4ade80, #22c55e); border-radius: 50%; text-align: center; line-height: 28px; color: #000; font-weight: 700; font-size: 13px;">3</div>
                          </td>
                          <td style="color: #9ca3af; font-size: 15px; line-height: 1.6; padding-left: 8px;">
                            Access signals directly: <a href="https://digimun.pro/signal" style="color: #4ade80; text-decoration: none; font-weight: 600;">digimun.pro/signal</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Important Rules Warning -->
              <div style="background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(251, 191, 36, 0.05) 100%); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 16px; padding: 28px; margin: 30px 0;">
                <h3 style="margin: 0 0 15px 0; color: #fbbf24; font-size: 15px; font-weight: 700;">
                  ⚠️ Important Usage Guidelines
                </h3>
                <p style="margin: 0 0 15px 0; color: #9ca3af; font-size: 15px; line-height: 1.7;">
                  Before using the Digimun Pro Bot, please understand:
                </p>
                <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #9ca3af; font-size: 14px; line-height: 2;">
                  <li>This bot is for <strong style="color: #ffffff;">double confirmation and analysis validation only</strong></li>
                  <li>It must not be used blindly or as a standalone decision tool</li>
                  <li>Proper risk management is essential at all times</li>
                </ul>
                <a href="https://digimun.pro/signal-rules" style="display: inline-block; background: rgba(251, 191, 36, 0.2); border: 1px solid rgba(251, 191, 36, 0.4); color: #fbbf24; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">
                  📋 View Signal Rules →
                </a>
              </div>
              
              <!-- CTA Buttons -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 40px 0;">
                <tr>
                  <td align="center" style="padding-bottom: 15px;">
                    <a href="https://digimun.pro/signal" 
                       style="display: inline-block; background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); color: #000000; text-decoration: none; padding: 18px 60px; border-radius: 12px; font-size: 15px; font-weight: 700; letter-spacing: 0.5px; box-shadow: 0 8px 30px rgba(74, 222, 128, 0.3);">
                      ACCESS SIGNALS NOW →
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="https://digimun.pro/dashboard" 
                       style="display: inline-block; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 10px; font-size: 14px; font-weight: 600;">
                      Go to Dashboard
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Support Section -->
              <div style="background: rgba(59, 130, 246, 0.08); border-left: 4px solid #3b82f6; padding: 24px; border-radius: 0 12px 12px 0; margin: 30px 0;">
                <h3 style="margin: 0 0 12px 0; color: #3b82f6; font-size: 15px; font-weight: 700;">
                  Need Help?
                </h3>
                <p style="margin: 0 0 15px 0; color: #9ca3af; font-size: 15px; line-height: 1.6;">
                  Our support team is available 24/7 to assist you:
                </p>
                <a href="https://t.me/Digimun49" style="color: #3b82f6; font-size: 15px; font-weight: 600; text-decoration: none;">
                  📱 Contact Support on Telegram →
                </a>
              </div>
              
              <!-- Stay Connected -->
              <div style="background: rgba(255,255,255,0.02); border-radius: 12px; padding: 20px; margin: 25px 0; text-align: center;">
                <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px;">
                  Stay Connected – Join our official Telegram channel
                </p>
                <a href="https://t.me/DigimunPro" style="display: inline-block; color: #4ade80; font-size: 15px; font-weight: 600; text-decoration: none;">
                  📢 t.me/DigimunPro
                </a>
              </div>
              
            </td>
          </tr>
          
          <!-- Risk Disclaimer -->
          <tr>
            <td style="background: rgba(0,0,0,0.4); padding: 30px 40px; border-top: 1px solid rgba(255,255,255,0.06);">
              <h4 style="margin: 0 0 12px 0; color: #ef4444; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">
                ⚠️ Trading Risk Disclaimer
              </h4>
              <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.8;">
                Trading in binary options and financial markets involves significant risk and may result in the loss of all invested capital. The Digimun Pro Bot is provided for analytical and educational purposes only and does not constitute financial advice or guarantee profits. Past performance does not guarantee future results. Users are fully responsible for their own trading decisions. Trade only with funds you can afford to lose.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: linear-gradient(135deg, #050508 0%, #0a0e14 100%); padding: 35px 40px; text-align: center; border-top: 1px solid rgba(74, 222, 128, 0.1);">
              <img src="https://digimun.pro/assets/digimun-logo.png" alt="Digimun Pro" style="height: 32px; margin-bottom: 15px; opacity: 0.8;">
              <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 14px;">
                Thank you for choosing Digimun Pro
              </p>
              <p style="margin: 0 0 20px 0; color: #ffffff; font-size: 15px; font-weight: 600;">
                The Digimun Team
              </p>
              <div style="margin: 20px 0;">
                <a href="https://digimun.pro" style="color: #4ade80; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Website</a>
                <span style="color: #374151;">|</span>
                <a href="https://t.me/DigimunPro" style="color: #4ade80; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Telegram</a>
                <span style="color: #374151;">|</span>
                <a href="https://digimun.pro/signal-rules" style="color: #4ade80; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Rules</a>
              </div>
              <p style="margin: 20px 0 0 0; color: #4b5563; font-size: 11px;">
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
      subject: "Lifetime Access Granted – Digimun Pro Bot | Digimun Pro",
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
