import { db } from "./firebase.js";
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const form = document.getElementById("ticket-form");
const submitBtn = document.getElementById("submit-btn");
const successMsg = document.getElementById("success-msg");
const errorMsg = document.getElementById("error-msg");

const EMAILJS_SERVICE_ID = "service_digimun";
const EMAILJS_TEMPLATE_ID = "template_ticket";
const EMAILJS_PUBLIC_KEY = "";
const ADMIN_EMAIL = "digimun49@gmail.com";

const emailJsEnabled = EMAILJS_PUBLIC_KEY && EMAILJS_PUBLIC_KEY.length > 5;

if (emailJsEnabled && typeof emailjs !== "undefined") {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = "block";
  setTimeout(() => { errorMsg.style.display = "none"; }, 5000);
}

function hideForm() {
  form.style.display = "none";
  successMsg.style.display = "block";
}

async function sendEmailNotification(ticketData) {
  if (!emailJsEnabled || typeof emailjs === "undefined") {
    console.log("EmailJS not configured - skipping email notification");
    return;
  }

  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: ADMIN_EMAIL,
      from_name: ticketData.name,
      from_email: ticketData.email,
      subject: ticketData.subject,
      message: ticketData.message,
      ticket_id: ticketData.ticketId || "N/A"
    });
    console.log("Email notification sent successfully");
  } catch (err) {
    console.warn("Email notification failed (non-critical):", err);
  }
}

function cleanTelegramUsername(input) {
  if (!input) return '';
  let cleaned = input.trim();
  cleaned = cleaned.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '');
  if (!cleaned.startsWith('@') && cleaned.length > 0) {
    cleaned = '@' + cleaned;
  }
  return cleaned;
}

function cleanWhatsAppNumber(input) {
  if (!input) return '';
  let cleaned = input.trim();
  cleaned = cleaned.replace(/[^0-9+]/g, '');
  if (cleaned && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

async function updateUserContactInfo(email, telegram, whatsapp) {
  if (!telegram && !whatsapp) return;
  
  try {
    const userRef = doc(db, "users", email);
    const userSnap = await getDoc(userRef);
    
    const contactUpdate = {};
    if (telegram) contactUpdate.telegramUsername = telegram;
    if (whatsapp) contactUpdate.whatsappNumber = whatsapp;
    contactUpdate.contactLinkedAt = serverTimestamp();
    
    if (userSnap.exists()) {
      await updateDoc(userRef, contactUpdate);
    } else {
      await setDoc(userRef, {
        email: email,
        ...contactUpdate,
        createdAt: serverTimestamp()
      }, { merge: true });
    }
    console.log("User contact info updated");
  } catch (err) {
    console.warn("Could not update user contact info (non-critical):", err);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const subject = document.getElementById("subject").value;
  const message = document.getElementById("message").value.trim();
  
  const telegramRaw = document.getElementById("telegram")?.value || '';
  const whatsappRaw = document.getElementById("whatsapp")?.value || '';
  const telegram = cleanTelegramUsername(telegramRaw);
  const whatsapp = cleanWhatsAppNumber(whatsappRaw);

  if (!name || !email || !subject || !message) {
    showError("Please fill in all fields.");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showError("Please enter a valid email address.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  try {
    const ticketData = {
      name,
      email,
      subject,
      message,
      status: "open",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      replies: []
    };
    
    if (telegram) ticketData.telegramUsername = telegram;
    if (whatsapp) ticketData.whatsappNumber = whatsapp;

    const docRef = await addDoc(collection(db, "tickets"), ticketData);
    console.log("Ticket created with ID:", docRef.id);

    ticketData.ticketId = docRef.id;
    
    updateUserContactInfo(email, telegram, whatsapp);
    sendEmailNotification(ticketData);

    hideForm();

  } catch (err) {
    console.error("Error submitting ticket:", err);
    showError("Failed to submit ticket. Please try again or contact us on Telegram.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Ticket";
  }
});
