const nodemailer = require("nodemailer");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { to_email, to_name, reply_message, review_message } = JSON.parse(event.body);

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

    const firstName = (to_name || 'Trader').split(' ')[0];

    const truncatedReview = review_message && review_message.length > 120 
      ? review_message.substring(0, 120) + '...' 
      : (review_message || 'Your review');

    const truncatedReply = reply_message && reply_message.length > 300 
      ? reply_message.substring(0, 300) + '...' 
      : (reply_message || '');

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
          
          <!-- Reply Icon -->
          <tr>
            <td style="padding: 32px 40px 0 40px; text-align: center;">
              <div style="display: inline-block; width: 72px; height: 72px; line-height: 72px; font-size: 36px; background: rgba(0, 212, 170, 0.1); border: 2px solid rgba(0, 212, 170, 0.25); border-radius: 50%;">
                💬
              </div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 24px 40px 36px 40px;">
              <h2 style="margin: 0 0 12px 0; color: #ffffff; font-size: 22px; text-align: center; font-weight: 700;">
                The Digimun Team Responded!
              </h2>
              
              <p style="margin: 0 0 24px 0; color: #9ca3af; font-size: 15px; line-height: 1.7; text-align: center;">
                Hi ${firstName}, our team has responded to your feedback. We value every piece of input from our community.
              </p>
              
              <!-- Original Review -->
              <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 18px; margin: 0 0 16px 0;">
                <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">
                  Your Feedback
                </p>
                <p style="margin: 0; color: #9ca3af; font-size: 14px; line-height: 1.6; font-style: italic;">
                  "${truncatedReview}"
                </p>
              </div>
              
              <!-- Team Reply -->
              <div style="background: rgba(0, 212, 170, 0.06); border: 1px solid rgba(0, 212, 170, 0.15); border-radius: 12px; padding: 20px; margin: 0 0 28px 0;">
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                  <div style="width: 32px; height: 32px; background: rgba(0, 212, 170, 0.15); border-radius: 50%; text-align: center; line-height: 32px; font-size: 14px; margin-right: 10px; color: #00D4AA; font-weight: 700;">DP</div>
                  <div>
                    <p style="margin: 0; color: #00D4AA; font-size: 13px; font-weight: 700;">Digimun Pro Team</p>
                    <p style="margin: 0; color: #4b5563; font-size: 11px;">Official Response</p>
                  </div>
                </div>
                <p style="margin: 0; color: #d1d5db; font-size: 15px; line-height: 1.7;">
                  ${truncatedReply}
                </p>
              </div>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 28px 0;">
                <tr>
                  <td align="center">
                    <a href="https://digimun.pro/reviews" 
                       style="display: inline-block; background: linear-gradient(135deg, #00D4AA 0%, #00b894 100%); color: #000000; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-size: 15px; font-weight: 700; letter-spacing: 0.5px;">
                      View Full Conversation
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
                Have more questions? We're always here to help.
              </p>
            </td>
          </tr>
          
          <!-- Support -->
          <tr>
            <td style="padding: 0 40px 28px 40px; text-align: center;">
              <a href="https://t.me/Digimun49" 
                 style="display: inline-block; background: transparent; color: #00D4AA; text-decoration: none; padding: 10px 28px; border-radius: 8px; font-size: 13px; font-weight: 600; border: 1px solid rgba(0, 212, 170, 0.3);">
                Contact Us on Telegram →
              </a>
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
      subject: `💬 ${firstName}, the Digimun Team Responded to Your Feedback!`,
      html: html,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Review reply notification email sent" })
    };
  } catch (err) {
    console.error("Error sending review reply email:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
