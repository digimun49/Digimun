const nodemailer = require("nodemailer");
const { db, getCorsHeaders, verifyAdmin } = require('./firebase-admin-init.cjs');

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function buildEmail(type, toName) {
  const name = toName || 'Valued Customer';
  
  if (type === 'reminder') {
    return {
      subject: 'Update Required on Your Support Ticket – Digimun Pro',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; background-color:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%); padding:30px 40px; text-align:center;">
              <h1 style="margin:0; color:#4ade80; font-size:28px; font-weight:700; letter-spacing:1px;">DigiMun Pro</h1>
              <p style="margin:8px 0 0 0; color:#94a3b8; font-size:14px;">Trading Signals & Support Platform</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 20px 0; color:#1e293b; font-size:22px;">Dear ${name},</h2>
              <p style="margin:0 0 15px 0; color:#475569; font-size:16px; line-height:1.6;">
                We hope you are doing well.
              </p>
              <p style="margin:0 0 15px 0; color:#475569; font-size:16px; line-height:1.6;">
                Our support team previously responded to your support request, but we have not yet received any response from your side.
              </p>
              <p style="margin:0 0 15px 0; color:#475569; font-size:16px; line-height:1.6;">
                If you still need assistance, please reply to your support ticket so we can continue helping you.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;">
                <tr>
                  <td align="center">
                    <a href="https://digimun.pro/my-tickets" style="display:inline-block; background:linear-gradient(135deg,#4ade80 0%,#22c55e 100%); color:#ffffff; text-decoration:none; padding:16px 40px; border-radius:8px; font-size:16px; font-weight:600; box-shadow:0 4px 12px rgba(74,222,128,0.4);">
                      View Your Tickets →
                    </a>
                  </td>
                </tr>
              </table>
              <div style="background-color:#fef3c7; border-left:4px solid #f59e0b; padding:15px 20px; border-radius:0 8px 8px 0; margin:25px 0;">
                <p style="margin:0; color:#92400e; font-size:14px; line-height:1.6;">
                  <strong>Please note:</strong> If we do not receive a response within the next 24 hours, the ticket may be automatically closed due to inactivity.
                </p>
              </div>
              <p style="margin:25px 0 0 0; color:#475569; font-size:16px; line-height:1.6;">
                Thank you for choosing Digimun Pro.
              </p>
              <p style="margin:15px 0 0 0; color:#475569; font-size:16px; line-height:1.6;">
                Best regards,<br>Digimun Pro Support Team<br>
                <a href="https://digimun.pro" style="color:#4ade80; text-decoration:none;">https://digimun.pro</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#1e293b; padding:30px 40px; text-align:center;">
              <p style="margin:0 0 10px 0; color:#94a3b8; font-size:14px;">
                &copy; ${new Date().getFullYear()} DigiMun Pro. All rights reserved.
              </p>
              <p style="margin:0;"><a href="https://digimun.pro" style="color:#4ade80; text-decoration:none; font-size:14px;">digimun.pro</a></p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0 0; color:#94a3b8; font-size:12px; text-align:center;">
          This is an automated message from DigiMun Pro Support System
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
    };
  }
  
  if (type === 'closed') {
    return {
      subject: 'Your Support Ticket Has Been Closed – Digimun Pro',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; background-color:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%); padding:30px 40px; text-align:center;">
              <h1 style="margin:0; color:#4ade80; font-size:28px; font-weight:700; letter-spacing:1px;">DigiMun Pro</h1>
              <p style="margin:8px 0 0 0; color:#94a3b8; font-size:14px;">Trading Signals & Support Platform</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 20px 0; color:#1e293b; font-size:22px;">Dear ${name},</h2>
              <p style="margin:0 0 15px 0; color:#475569; font-size:16px; line-height:1.6;">
                We previously contacted you regarding your support request but did not receive any response from your side.
              </p>
              <p style="margin:0 0 15px 0; color:#475569; font-size:16px; line-height:1.6;">
                Due to inactivity for the past 4 days, your support ticket has now been automatically closed.
              </p>
              <p style="margin:0 0 15px 0; color:#475569; font-size:16px; line-height:1.6;">
                If your issue has not been resolved or you still need assistance, you may reopen your ticket using the link below:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;">
                <tr>
                  <td align="center">
                    <a href="https://digimun.pro/help" style="display:inline-block; background:linear-gradient(135deg,#4ade80 0%,#22c55e 100%); color:#ffffff; text-decoration:none; padding:16px 40px; border-radius:8px; font-size:16px; font-weight:600; box-shadow:0 4px 12px rgba(74,222,128,0.4);">
                      Submit New Ticket →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:25px 0 0 0; color:#475569; font-size:16px; line-height:1.6;">
                Our support team will be happy to assist you.
              </p>
              <p style="margin:15px 0 0 0; color:#475569; font-size:16px; line-height:1.6;">
                Thank you for being part of Digimun Pro.
              </p>
              <p style="margin:15px 0 0 0; color:#475569; font-size:16px; line-height:1.6;">
                Best regards,<br>Digimun Pro Support Team<br>
                <a href="https://digimun.pro" style="color:#4ade80; text-decoration:none;">https://digimun.pro</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#1e293b; padding:30px 40px; text-align:center;">
              <p style="margin:0 0 10px 0; color:#94a3b8; font-size:14px;">
                &copy; ${new Date().getFullYear()} DigiMun Pro. All rights reserved.
              </p>
              <p style="margin:0;"><a href="https://digimun.pro" style="color:#4ade80; text-decoration:none; font-size:14px;">digimun.pro</a></p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0 0; color:#94a3b8; font-size:12px; text-align:center;">
          This is an automated message from DigiMun Pro Support System
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
    };
  }
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  const isScheduled = !event.httpMethod || event.headers?.['x-netlify-event'] === 'schedule';

  if (!isScheduled) {
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
  }

  if (!db) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database unavailable' }) };
  }

  try {
    const now = Date.now();
    const ticketsRef = db.collection('tickets');
    
    const openTickets = await ticketsRef
      .where('status', 'in', ['replied', 'waiting-user', 'open'])
      .get();
    
    if (openTickets.empty) {
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'No tickets to process', reminders: 0, closed: 0 }) };
    }

    const transporter = getTransporter();
    let remindersSent = 0;
    let ticketsClosed = 0;

    for (const ticketDoc of openTickets.docs) {
      const ticket = ticketDoc.data();
      const ticketId = ticketDoc.id;
      
      const replies = ticket.replies || [];
      if (replies.length === 0) continue;
      
      const lastReply = replies[replies.length - 1];
      const isLastReplyAdmin = lastReply.adminEmail || lastReply.isAdmin || lastReply.from === 'admin';
      if (!isLastReplyAdmin) continue;
      
      const lastReplyTime = lastReply.createdAt?.toMillis?.() || 
        (lastReply.createdAt?.toDate ? lastReply.createdAt.toDate().getTime() : 
        (lastReply.createdAt ? new Date(lastReply.createdAt).getTime() : 0));
      
      if (!lastReplyTime) continue;
      
      const timeSinceReply = now - lastReplyTime;
      
      if (timeSinceReply >= FOUR_DAYS_MS) {
        try {
          await ticketsRef.doc(ticketId).update({
            status: 'closed',
            closedReason: 'auto-inactivity',
            closedAt: new Date(),
            updatedAt: new Date()
          });
          
          const emailData = buildEmail('closed', ticket.name);
          await transporter.sendMail({
            from: `"DigiMun Pro Support" <${process.env.FROM_EMAIL}>`,
            to: ticket.email,
            subject: emailData.subject,
            html: emailData.html
          });
          
          ticketsClosed++;
          console.log(`[Auto-Close] Ticket ${ticketId} closed after 4 days inactivity`);
        } catch (err) {
          console.error(`[Auto-Close] Error processing ticket ${ticketId}:`, err.message);
        }
      } else if (timeSinceReply >= THREE_DAYS_MS && !ticket.reminderSentAt) {
        try {
          const emailData = buildEmail('reminder', ticket.name);
          await transporter.sendMail({
            from: `"DigiMun Pro Support" <${process.env.FROM_EMAIL}>`,
            to: ticket.email,
            subject: emailData.subject,
            html: emailData.html
          });
          
          await ticketsRef.doc(ticketId).update({
            reminderSentAt: new Date(),
            updatedAt: new Date()
          });
          
          remindersSent++;
          console.log(`[Auto-Manage] Reminder sent for ticket ${ticketId}`);
        } catch (err) {
          console.error(`[Auto-Manage] Error sending reminder for ticket ${ticketId}:`, err.message);
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Ticket auto-management complete',
        reminders: remindersSent,
        closed: ticketsClosed
      })
    };

  } catch (err) {
    console.error('[Auto-Manage] Error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to process tickets' }) };
  }
};
