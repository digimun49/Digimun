// free.js
import { auth, db } from './firebase.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const submitBtn = document.getElementById("submit-btn");
const traderInput = document.getElementById("trader-id");
const statusText = document.getElementById("status-text");
const telegramLink = document.getElementById("telegram-link");
const whatsappLink = document.getElementById("whatsapp-link");

let userEmail = "";

onAuthStateChanged(auth, user => {
  if (user) {
    userEmail = user.email;
  } else {
    window.location.href = '/login';
  }
});

submitBtn.addEventListener("click", async () => {
  const traderId = traderInput.value.trim();
  if (!traderId) {
    statusText.textContent = "Please enter your Trader ID.";
    statusText.style.color = "red";
    return;
  }

  try {
    await updateDoc(doc(db, "users", userEmail), {
      quotexID: traderId,
      quotexStatus: "pending"
    });

    statusText.textContent = "Trader ID submitted successfully. Now verify below";
    statusText.style.color = "#00ff88";

    document.getElementById("verify-section").style.display = "block";

    const message = `Hello Admin, I have requested Free Access.\nMy Trader ID: ${traderId}\nMy Email: ${userEmail}`;

    telegramLink.href = `https://t.me/digimun49?text=${encodeURIComponent(message)}`;

  } catch (err) {
    statusText.textContent = "Error: " + err.message;
    statusText.style.color = "red";
  }
});