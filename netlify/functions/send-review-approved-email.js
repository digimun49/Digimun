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
                Trading Signals Platform
              </p>
            </td>
          </tr>
          
          <!-- Success Badge -->
          <tr>
            <td style="padding: 30px 40px 0 40px; text-align: center;">
              <div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; width: 80px; height: 80px; line-height: 80px; font-size: 40px;">
                ✓
              </div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px 40px 40px 40px;">
              <h2 style="margin: 0 0 10px 0; color: #1e293b; font-size: 24px; text-align: center;">
                Your Review is Live!
              </h2>
              
              <p style="margin: 0 0 25px 0; color: #475569; font-size: 16px; line-height: 1.6; text-align: center;">
                Thank you, <strong>${to_name || 'Valued Trader'}</strong>! Your review has been approved and is now visible to the Digimun community.
              </p>
              
              <!-- Review Preview -->
              <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 1px solid #86efac; border-radius: 12px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0 0 8px 0; color: #166534; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                  Your Review
                </p>
                <p style="margin: 0; color: #15803d; font-size: 15px; line-height: 1.6; font-style: italic;">
                  "${truncatedReview}"
                </p>
              </div>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="https://digimun.pro/reviews" 
                       style="display: inline-block; background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(74, 222, 128, 0.4);">
                      View Your Review →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 25px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6; text-align: center;">
                Your feedback helps other traders make informed decisions. We truly appreciate your contribution to our community!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 25px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px;">
                Thank you for being part of the Digimun family!
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                &copy; ${new Date().getFullYear()} DigiMun Pro. All rights reserved.
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
      from: `"DigiMun Pro" <${process.env.SMTP_USER}>`,
      to: to_email,
      subject: "🎉 Your Review Has Been Approved!",
      html: html,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Review approval email sent" })
    };
  } catch (err) {
    console.error("Error sending review approval email:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
