// discount.js
import { auth, db, onAuthStateChanged, doc, updateDoc } from './platform.js';

const submitBtn = document.getElementById("submit-btn");
const traderInput = document.getElementById("trader-id");
const statusText = document.getElementById("status");
const telegramLink = document.getElementById("telegram-link");
const verifySection = document.getElementById("verify-section");

let userEmail = "";

onAuthStateChanged(auth, user => {
  if (user) {
    userEmail = (user.email || '').toLowerCase().trim();
  } else {
    window.location.href = '/login';
  }
});

submitBtn.addEventListener("click", async () => {
  const traderID = traderInput.value.trim();

  if (!traderID) {
    statusText.textContent = "Please enter your Trader ID.";
    statusText.style.color = "red";
    return;
  }

  try {
    await updateDoc(doc(db, "users", userEmail), {
      quotexID: traderID,
      quotexStatus: "pending"
    });

    statusText.textContent = "Submitted successfully. Now verify below 👇";
    statusText.style.color = "#00ffc3";
    verifySection.style.display = "block";

    const message = `Hi Admin, I applied for 50% Discount access.\nTrader ID: ${traderID}\nEmail: ${userEmail}`;
    telegramLink.href = `https://t.me/digimun49?text=${encodeURIComponent(message)}`;

  } catch (err) {
    statusText.textContent = "Error: " + err.message;
    statusText.style.color = "red";
  }
});