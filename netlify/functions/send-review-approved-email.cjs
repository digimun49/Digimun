const nodemailer = require("nodemailer");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { to_email, to_name, review_message } = JSON.parse(event.body);

    if (!to_email) {
      return { statusCode: 400, body: JSON.stringify({ error: "Email is required" }) };
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

    const truncatedReview = review_message && review_message.length > 150 
      ? review_message.substring(0, 150) + '...' 
      : (review_message || 'Your review');

    const firstName = (to_name || 'Trader').split(' ')[0];

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
          
          <!-- Thank You Icon -->
          <tr>
            <td style="padding: 32px 40px 0 40px; text-align: center;">
              <div style="display: inline-block; width: 72px; height: 72px; line-height: 72px; font-size: 36px; background: rgba(0, 212, 170, 0.1); border: 2px solid rgba(0, 212, 170, 0.25); border-radius: 50%;">
                🌟
              </div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 24px 40px 36px 40px;">
              <h2 style="margin: 0 0 12px 0; color: #ffffff; font-size: 22px; text-align: center; font-weight: 700;">
                Thank You for Your Feedback, ${firstName}!
              </h2>
              
              <p style="margin: 0 0 24px 0; color: #9ca3af; font-size: 15px; line-height: 1.7; text-align: center;">
                We truly appreciate you taking the time to share your experience with the Digimun Pro community. Your insights help fellow traders make better decisions.
              </p>
              
              <!-- Review Quote -->
              <div style="background: rgba(0, 212, 170, 0.06); border: 1px solid rgba(0, 212, 170, 0.12); border-radius: 12px; padding: 20px; margin: 0 0 28px 0;">
                <p style="margin: 0 0 8px 0; color: #00D4AA; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">
                  Your Review
                </p>
                <p style="margin: 0; color: #d1d5db; font-size: 14px; line-height: 1.7; font-style: italic;">
                  "${truncatedReview}"
                </p>
              </div>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 28px 0;">
                <tr>
                  <td align="center">
                    <a href="https://digimun.pro/reviews" 
                       style="display: inline-block; background: linear-gradient(135deg, #00D4AA 0%, #00b894 100%); color: #000000; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-size: 15px; font-weight: 700; letter-spacing: 0.5px;">
                      See All Community Reviews
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Engagement Section -->
              <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 20px; text-align: center;">
                <p style="margin: 0 0 6px 0; color: #ffffff; font-size: 14px; font-weight: 600;">
                  Want to explore more?
                </p>
                <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                  Check out our latest AI trading signals and money management tools.
                </p>
                <a href="https://digimun.pro/dashboard" 
                   style="display: inline-block; background: transparent; color: #00D4AA; text-decoration: none; padding: 10px 28px; border-radius: 8px; font-size: 13px; font-weight: 600; border: 1px solid rgba(0, 212, 170, 0.3);">
                  Go to Dashboard →
                </a>
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
                You received this email because you shared feedback on Digimun Pro.
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
      to: to_email,
      subject: `🌟 Thank You for Your Feedback, ${firstName}!`,
      html: html,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Review appreciation email sent" })
    };
  } catch (err) {
    console.error("Error sending review email:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
