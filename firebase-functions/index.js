const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

const transporter = nodemailer.createTransport({
  host: "mail.privateemail.com",
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: functions.config().smtp.user,
    pass: functions.config().smtp.pass
  }
});

exports.sendEmailNotification = functions.firestore
  .document("emailNotifications/{docId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const docId = context.params.docId;

    if (data.status !== "pending") {
      console.log(`Skipping notification ${docId}: status is ${data.status}`);
      return null;
    }

    const siteUrl = functions.config().site?.url || "https://digimunpro.com";

    let htmlContent = "";
    
    switch (data.type) {
      case "ticket_reply":
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">Digimun Pro</h1>
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
              <h2 style="color: #333;">Hello ${data.to_name},</h2>
              <p style="color: #666; line-height: 1.6;">We've replied to your support ticket.</p>
              <div style="background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0;">
                <p style="color: #333; margin: 0;">${data.message}</p>
              </div>
              <a href="${siteUrl}${data.link}" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Ticket</a>
            </div>
            <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
              <p>Digimun Pro - Trading Signals & Support</p>
            </div>
          </div>
        `;
        break;
        
      case "review_approved":
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">Digimun Pro</h1>
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
              <h2 style="color: #333;">Hello ${data.to_name},</h2>
              <p style="color: #666; line-height: 1.6;">${data.message}</p>
              <a href="${siteUrl}${data.link}" style="display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Reviews</a>
            </div>
            <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
              <p>Digimun Pro - Trading Signals & Support</p>
            </div>
          </div>
        `;
        break;
        
      case "review_reply":
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">Digimun Pro</h1>
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
              <h2 style="color: #333;">Hello ${data.to_name},</h2>
              <p style="color: #666; line-height: 1.6;">The Digimun team has replied to your review:</p>
              <div style="background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0;">
                <p style="color: #333; margin: 0;">${data.message}</p>
              </div>
              <a href="${siteUrl}${data.link}" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Review</a>
            </div>
            <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
              <p>Digimun Pro - Trading Signals & Support</p>
            </div>
          </div>
        `;
        break;
        
      default:
        console.log(`Unknown notification type: ${data.type}`);
        await snap.ref.update({ status: "error", error: "Unknown notification type" });
        return null;
    }

    const mailOptions = {
      from: `"Digimun Pro" <${functions.config().smtp.user}>`,
      to: data.to_email,
      subject: data.subject,
      html: htmlContent
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${data.to_email}`);
      await snap.ref.update({ 
        status: "sent", 
        sentAt: admin.firestore.FieldValue.serverTimestamp() 
      });
    } catch (error) {
      console.error(`Failed to send email to ${data.to_email}:`, error);
      await snap.ref.update({ 
        status: "error", 
        error: error.message,
        errorAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return null;
  });
