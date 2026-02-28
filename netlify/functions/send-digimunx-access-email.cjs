const nodemailer = require("nodemailer");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { to_email, to_name, access_type } = JSON.parse(event.body);

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
    const isPermanent = access_type === "permanent";
    const is3Day = access_type === "3day";
    const accessDuration = isPermanent ? "Lifetime" : is3Day ? "3 Days" : "24 Hours";
    const accessBadgeColor = isPermanent ? "#d4af37" : is3Day ? "#f97316" : "#fbbf24";
    const accessBadgeBg = isPermanent ? "rgba(212, 175, 55, 0.15)" : is3Day ? "rgba(249, 115, 22, 0.15)" : "rgba(251, 191, 36, 0.15)";

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
        <table width="640" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #0a0e14 0%, #050508 100%); border-radius: 20px; overflow: hidden; border: 1px solid rgba(212, 175, 55, 0.2); box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #0a0e14 0%, #111827 100%); padding: 50px 40px; text-align: center; border-bottom: 1px solid rgba(212, 175, 55, 0.15);">
              <img src="https://digimun.pro/assets/digimun-logo.png" alt="Digimun Pro" style="height: 50px; margin-bottom: 20px;">
              <div style="background: ${accessBadgeBg}; border: 1px solid ${accessBadgeColor}; display: inline-block; padding: 8px 24px; border-radius: 50px; margin-bottom: 15px;">
                <span style="color: ${accessBadgeColor}; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">
                  ${accessDuration} ACCESS GRANTED
                </span>
              </div>
              <h1 style="margin: 0; color: #d4af37; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">
                DigimunX
              </h1>
              <p style="margin: 12px 0 0 0; color: #9ca3af; font-size: 15px;">
                Premium AI Trading Bot
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
                Thank you for choosing <strong style="color: #d4af37;">DigimunX</strong>, our most premium AI trading bot. 
                ${isPermanent 
                  ? 'Your <strong style="color: #d4af37;">lifetime access</strong> has been successfully activated.' 
                  : is3Day
                    ? 'Your <strong style="color: #f97316;">3-day access</strong> has been activated. Complete the broker referral to upgrade to lifetime access.'
                    : 'Your <strong style="color: #fbbf24;">24-hour access</strong> has been activated. Complete the broker referral to upgrade to lifetime access.'}
              </p>
              
              <!-- Access Details Card -->
              <div style="background: linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(212, 175, 55, 0.02) 100%); border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 16px; padding: 28px; margin: 30px 0;">
                <h3 style="margin: 0 0 20px 0; color: #d4af37; font-size: 15px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">
                  Your Access Details
                </h3>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                      <span style="color: #6b7280; font-size: 14px;">Service</span>
                    </td>
                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06); text-align: right;">
                      <span style="color: #ffffff; font-size: 14px; font-weight: 600;">DigimunX Premium</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                      <span style="color: #6b7280; font-size: 14px;">Access Duration</span>
                    </td>
                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06); text-align: right;">
                      <span style="color: ${accessBadgeColor}; font-size: 14px; font-weight: 700;">${accessDuration}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                      <span style="color: #6b7280; font-size: 14px;">Telegram Channel</span>
                    </td>
                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06); text-align: right;">
                      <a href="https://t.me/DigimunX" style="color: #d4af37; font-size: 14px; font-weight: 600; text-decoration: none;">t.me/DigimunX</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0;">
                      <span style="color: #6b7280; font-size: 14px;">Direct Access</span>
                    </td>
                    <td style="padding: 12px 0; text-align: right;">
                      <a href="https://digimun.pro/DigimunX" style="color: #d4af37; font-size: 14px; font-weight: 600; text-decoration: none;">digimun.pro/DigimunX</a>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- How to Access -->
              <div style="background: rgba(255,255,255,0.02); border-radius: 16px; padding: 28px; margin: 30px 0;">
                <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 15px; font-weight: 700;">
                  How to Access DigimunX
                </h3>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 14px 0; vertical-align: top;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width: 36px; vertical-align: top;">
                            <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #d4af37, #f4d03f); border-radius: 50%; text-align: center; line-height: 28px; color: #000; font-weight: 700; font-size: 13px;">1</div>
                          </td>
                          <td style="color: #9ca3af; font-size: 15px; line-height: 1.6; padding-left: 8px;">
                            Log in to your account at <a href="https://digimun.pro/login" style="color: #d4af37; text-decoration: none; font-weight: 600;">digimun.pro/login</a>
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
                            <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #d4af37, #f4d03f); border-radius: 50%; text-align: center; line-height: 28px; color: #000; font-weight: 700; font-size: 13px;">2</div>
                          </td>
                          <td style="color: #9ca3af; font-size: 15px; line-height: 1.6; padding-left: 8px;">
                            Go to your <a href="https://digimun.pro/dashboard" style="color: #d4af37; text-decoration: none; font-weight: 600;">Dashboard</a> to see your active services
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
                            <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #d4af37, #f4d03f); border-radius: 50%; text-align: center; line-height: 28px; color: #000; font-weight: 700; font-size: 13px;">3</div>
                          </td>
                          <td style="color: #9ca3af; font-size: 15px; line-height: 1.6; padding-left: 8px;">
                            Access DigimunX directly: <a href="https://digimun.pro/DigimunX" style="color: #d4af37; text-decoration: none; font-weight: 600;">digimun.pro/DigimunX</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Important Rules Warning -->
              <div style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 16px; padding: 28px; margin: 30px 0;">
                <h3 style="margin: 0 0 15px 0; color: #ef4444; font-size: 15px; font-weight: 700;">
                  ⚠️ MANDATORY: Read Signal Rules
                </h3>
                <p style="margin: 0 0 20px 0; color: #9ca3af; font-size: 15px; line-height: 1.7;">
                  Before using DigimunX, you <strong style="color: #ffffff;">MUST</strong> read and understand our signal rules and guidelines. Do not place trades without fully understanding the signals.
                </p>
                <a href="https://digimun.pro/signal-rules" style="display: inline-block; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #ef4444; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">
                  📋 View Signal Rules →
                </a>
              </div>
              
              <!-- Usage Guide -->
              <div style="background: rgba(74, 222, 128, 0.08); border-left: 4px solid #4ade80; padding: 24px; border-radius: 0 12px 12px 0; margin: 30px 0;">
                <h3 style="margin: 0 0 12px 0; color: #4ade80; font-size: 15px; font-weight: 700;">
                  📘 Usage Guide & Instructions
                </h3>
                <p style="margin: 0 0 15px 0; color: #9ca3af; font-size: 15px; line-height: 1.7;">
                  A detailed usage guide with signals explanation is available in our official Telegram channel:
                </p>
                <a href="https://t.me/DigimunX" style="color: #4ade80; font-size: 15px; font-weight: 600; text-decoration: none;">
                  👉 Join t.me/DigimunX
                </a>
              </div>
              
              ${!isPermanent ? `
              <!-- Lifetime Upgrade Notice -->
              <div style="background: linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.05) 100%); border: 2px solid rgba(212, 175, 55, 0.4); border-radius: 16px; padding: 28px; margin: 30px 0;">
                <h3 style="margin: 0 0 15px 0; color: #d4af37; font-size: 16px; text-align: center;">
                  ⭐ Upgrade to Lifetime Access
                </h3>
                <p style="margin: 0 0 15px 0; color: #9ca3af; font-size: 15px; line-height: 1.8; text-align: center;">
                  Within these 24 hours, create or link your broker account using our official referral to receive <strong style="color: #d4af37;">lifetime access at no additional cost</strong>.
                </p>
              </div>
              ` : ''}
              
              <!-- CTA Buttons -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 40px 0;">
                <tr>
                  <td align="center" style="padding-bottom: 15px;">
                    <a href="https://digimun.pro/DigimunX" 
                       style="display: inline-block; background: linear-gradient(135deg, #d4af37 0%, #f4d03f 50%, #d4af37 100%); color: #000000; text-decoration: none; padding: 18px 60px; border-radius: 12px; font-size: 15px; font-weight: 700; letter-spacing: 0.5px; box-shadow: 0 8px 30px rgba(212, 175, 55, 0.3);">
                      ACCESS DIGIMUNX NOW →
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
              
            </td>
          </tr>
          
          <!-- Risk Disclaimer -->
          <tr>
            <td style="background: rgba(0,0,0,0.4); padding: 30px 40px; border-top: 1px solid rgba(255,255,255,0.06);">
              <h4 style="margin: 0 0 12px 0; color: #ef4444; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">
                ⚠️ Risk Disclaimer
              </h4>
              <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.8;">
                Digimun and its services, including DigimunX, provide AI-based trading signals for educational and informational purposes only. We do not guarantee profits, and we are not responsible for any financial losses. Trading in financial markets involves significant risk. All trading decisions are made solely at the user's own discretion and responsibility.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: linear-gradient(135deg, #050508 0%, #0a0e14 100%); padding: 35px 40px; text-align: center; border-top: 1px solid rgba(212, 175, 55, 0.1);">
              <img src="https://digimun.pro/assets/digimun-logo.png" alt="Digimun Pro" style="height: 32px; margin-bottom: 15px; opacity: 0.8;">
              <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 14px;">
                Thank you for choosing Digimun Pro
              </p>
              <p style="margin: 0 0 20px 0; color: #ffffff; font-size: 15px; font-weight: 600;">
                The Digimun Team
              </p>
              <div style="margin: 20px 0;">
                <a href="https://digimun.pro" style="color: #d4af37; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Website</a>
                <span style="color: #374151;">|</span>
                <a href="https://t.me/DigimunPro" style="color: #d4af37; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Telegram</a>
                <span style="color: #374151;">|</span>
                <a href="https://digimun.pro/signal-rules" style="color: #d4af37; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Rules</a>
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

    const subject = isPermanent 
      ? "Lifetime Access Granted – DigimunX Premium Bot | Digimun Pro"
      : is3Day
        ? "3-Day Access Activated – DigimunX Premium Bot | Digimun Pro"
        : "24-Hour Access Activated – DigimunX Premium Bot | Digimun Pro";

    await transporter.sendMail({
      from: `"Digimun Pro" <${process.env.FROM_EMAIL}>`,
      to: to_email,
      subject,
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
