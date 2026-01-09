// iq-option.js
import { auth, db } from './firebase.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Elements
const submitBtn = document.getElementById("submit-id-btn");
const tradingIdInput = document.getElementById("trading-id");
const statusText = document.getElementById("id-status");
const telegramBtn = document.getElementById("telegram-link");
const whatsappBtn = document.getElementById("WhatsApp-link");
const approvalSection = document.getElementById("approval-section");

let userEmail = null;

// Check login and redirect if already approved
onAuthStateChanged(auth, async user => {
  if (user) {
    userEmail = user.email;

    const userRef = doc(db, "users", user.email);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data.paymentStatus === "approved" && data.quotexStatus === "approved") {
        window.location.href = '/signal';
      }
    }
  } else {
    window.location.href = '/login';
  }
});

// Submit Trader ID
submitBtn.addEventListener("click", async () => {
  const id = tradingIdInput.value.trim();
  if (!id) {
    statusText.textContent = "Please enter your Trader ID.";
    statusText.style.color = "red";
    return;
  }

  try {
    await updateDoc(doc(db, "users", userEmail), {
      quotexID: id,
      quotexStatus: "pending"
    });

    statusText.textContent = "Trader ID submitted successfully!";
    statusText.style.color = "#00ff88";

    const message = `Hello Admin,\nI have submitted my IQ Option Trader ID: ${id}.\nMy Email: ${userEmail}\nPlease approve my Digimun Signal access.`;

    telegramBtn.href = `https://t.me/digimun49?text=${encodeURIComponent(message)}`;

    approvalSection.style.display = "block";

  } catch (err) {
    statusText.textContent = "Error: " + err.message;
    statusText.style.color = "red";
  }
});