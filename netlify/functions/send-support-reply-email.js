const nodemailer = require("nodemailer");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { to_email, to_name, subject, message, ticket_id } = JSON.parse(event.body);

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
      <h2>Hello ${to_name}</h2>
      <p>Your support ticket <b>#${ticket_id}</b> has a new reply:</p>
      <p>${message}</p>
      <a href="https://digimun.pro/my-tickets">View Ticket</a>
    `;

    await transporter.sendMail({
      from: `"Digimun Pro" <${process.env.FROM_EMAIL}>`,
      to: to_email,
      subject,
      html,
    });

    return { statusCode: 200, body: "Email sent successfully" };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
