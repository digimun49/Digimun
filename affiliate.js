// affiliate.js
import { auth, db } from './firebase.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Elements
const submitBtn = document.getElementById("submit-id-btn");
const tradingIdInput = document.getElementById("trading-id");
const statusText = document.getElementById("id-status");
const telegramBtn = document.getElementById("telegram-link");
const approvalSection = document.getElementById("approval-section");

let userEmail = null;

// Check if user is logged in
onAuthStateChanged(auth, user => {
  if (user) {
    userEmail = user.email;
  } else {
    window.location.href = '/login';
  }
});

// Submit Trader ID Handler
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

    const message = `Hello Admin,\nI have submitted my Quotex Trader ID: ${id}.\nMy Email: ${userEmail}\nPlease approve my Digimun Signal access.`;

    telegramBtn.href = `https://t.me/digimun49?text=${encodeURIComponent(message)}`;;

    approvalSection.style.display = "block";

  } catch (err) {
    statusText.textContent = "Error: " + err.message;
    statusText.style.color = "red";
  }
});