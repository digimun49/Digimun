// PAGE ROLE:
// - 'affiliate' => needs paymentStatus: 'approved'
// - 'signal'    => needs paymentStatus: 'approved' AND quotexStatus: 'approved'
const PAGE_ROLE = 'signal'; // affiliate page par 'affiliate' set karna

// --- Firebase ---
import { db, auth } from "./firebase.js";
import {
  doc, getDoc, updateDoc, increment, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// --- DOM refs ---
const appEl        = document.getElementById("app") || document.body;
const gateEl       = document.getElementById("gate");
const gateText     = document.getElementById("gate-text") || { textContent: "" };
const logoutBtn    = document.getElementById("logout-btn");
const gateLogout   = document.getElementById("gate-logout");
const userMail     = document.getElementById("user-mail") || { textContent: "" };

const counterBox   = document.getElementById("signal-count");
const marketType   = document.getElementById("market-type");
const assetSelect  = document.getElementById("asset");
const generateBtn  = document.getElementById("generate-btn");
const signalOutput = document.getElementById("signal-output");
const countdown    = document.getElementById("countdown");
const quoteText    = document.getElementById("quote-text");
const loading      = document.getElementById("loading");

// --- Local flags ---
let isApprovedForAffiliate = false; // paymentStatus approved
let isApprovedForFinal     = false; // paymentStatus + quotexStatus approved

// --- Helpers ---
function showGate(message){
  if (gateEl) {
    if (message) gateText.textContent = message;
    gateEl.classList.remove("hidden");
  }
  if (appEl) appEl.classList.add("hidden");
  if (generateBtn) generateBtn.disabled = true;
}
function openApp(){
  if (gateEl) gateEl.classList.add("hidden");
  if (appEl) appEl.classList.remove("hidden");
  if (generateBtn) generateBtn.disabled = false;
}

logoutBtn?.addEventListener("click", () => signOut(auth).catch(()=>{}));
gateLogout?.addEventListener("click", () => signOut(auth).catch(()=>{}));

// --- Auth + Gate ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    userMail.textContent = "Not signed in";
    showGate("Sign-in required. Please login to continue.");
    return;
  }

  userMail.textContent = user.email || "Signed in";

  try {
    // IMPORTANT: rules email-based hain → email ko doc ID ki tarah use karein
    const EMAIL_DOC_KEY = (user.email || "").trim();
    const uRef  = doc(db, "users", EMAIL_DOC_KEY);
    const uSnap = await getDoc(uRef);

    // (Optional) Agar doc missing ho to bootstrap karo:
    if (!uSnap.exists()) {
      await setDoc(uRef, {
        paymentStatus: "pending",
        quotexStatus:  "pending",
        createdAt: Date.now()
      }, { merge: true });
    }

    const d = (await getDoc(uRef)).data() || {};
    const paymentStatus = String(d.paymentStatus || "").toLowerCase();
    const quotexStatus  = String(d.quotexStatus  || "").toLowerCase();

    isApprovedForAffiliate = paymentStatus === "approved";
    isApprovedForFinal     = isApprovedForAffiliate && quotexStatus === "approved";

    if (PAGE_ROLE === "affiliate") {
      if (isApprovedForAffiliate) {
        openApp();
      } else {
        showGate("Your payment is pending. Access to Affiliate page is restricted until payment is approved.");
      }
    } else {
      // PAGE_ROLE === 'signal'
      if (isApprovedForFinal) {
        openApp();
        if (counterBox) await loadSignalCount();
      } else {
        showGate("Payment and Quotex approval required. Please contact support to get access.");
      }
    }
  } catch (e) {
    console.error('Firestore read error:', e?.code || e?.message || e);
    if (e?.code === 'permission-denied') {
      showGate("Permission denied: users/{email} rules match nahi ho rahi. Ensure doc ID = exact email.");
    } else {
      showGate("We couldn't verify your access right now. Please try again later.");
    }
  }
});

// --- Stats (signal page) ---
async function loadSignalCount() {
  try {
    const countRef  = doc(db, "stats", "signalCount");
    const countSnap = await getDoc(countRef);
    if (countSnap.exists()) {
      const count = Number(countSnap.data().count || 0);
      if (counterBox) counterBox.textContent = count.toLocaleString();
    } else {
      if (counterBox) counterBox.textContent = "0";
    }
  } catch {
    if (counterBox) counterBox.textContent = "0";
  }
}

async function incrementSignalCount() {
  const countRef = doc(db, "stats", "signalCount");
  try {
    await updateDoc(countRef, { count: increment(1) });
  } catch {
    await setDoc(countRef, { count: 1 }, { merge: true });
  }
  if (counterBox) await loadSignalCount();
}

// --- Assets ---
const liveAssets = [
  "EUR/USD","GBP/USD","USD/JPY","AUD/USD","USD/CAD",
  "NZD/USD","EUR/JPY","GBP/JPY","USD/CHF","EUR/GBP"
];
const otcAssets = [
  "NZD/CAD (OTC)","USD/ARS (OTC)","USD/PKR (OTC)","EUR/CAD (OTC)",
  "USD/BRL (OTC)","EUR/NZD (OTC)","USD/MXN (OTC)","USD/PHP (OTC)",
  "USD/ZAR (OTC)","USD/BDT (OTC)","USD/NGN (OTC)","CHF/JPY (OTC)",
  "EUR/AUD (OTC)","EUR/GBP (OTC)","NZD/CHF (OTC)","NZD/JPY (OTC)",
  "USD/IDR (OTC)","USD/INR (OTC)","Johnson & Johnson (OTC)",
  "Microsoft (OTC)","Pfizer Inc (OTC)","Intel (OTC)",
  "American Express (OTC)","Boeing Company (OTC)","FACEBOOK INC (OTC)","McDonald's (OTC)","NASDAQ 100"
];

marketType?.addEventListener("change", () => {
  if (!assetSelect) return;
  assetSelect.innerHTML = "";
  const assets = marketType.value === "otc" ? otcAssets : liveAssets;
  assets.forEach((asset) => {
    const option = document.createElement("option");
    option.value = asset;
    option.textContent = asset;
    assetSelect.appendChild(option);
  });
});

// --- Signal generation (signal page only) ---
const signals = ["Strong Buy","Strong Sell","Buy","Sell"];
const quotes = [
  "Success is earned, not given.",
  "Discipline beats motivation.",
  "Manage risk, maximize profit.",
  "Follow strategy, not emotion.",
  "Patience turns trades into profits."
];

generateBtn?.addEventListener("click", async () => {
  if (PAGE_ROLE !== "affiliate" && !isApprovedForFinal) {
    showGate("Payment and Quotex approval required. Please contact support.");
    return;
  }

  loading?.classList.remove("hidden");
  signalOutput?.classList.add("hidden");
  countdown?.classList.add("hidden");
  quoteText?.classList.add("hidden");

  await incrementSignalCount();

  setTimeout(() => {
    loading?.classList.add("hidden");

    const signal = signals[Math.floor(Math.random() * signals.length)];
    if (signalOutput) {
      signalOutput.textContent = signal;
      signalOutput.className = "";
      signalOutput.classList.add("show", "signal-output");
      if (signal.toLowerCase().includes("buy")) signalOutput.classList.add("buy");
      else signalOutput.classList.add("sell");
      signalOutput.classList.remove("hidden");
    }

    const tfSel = document.getElementById("time-frame");
    const selected = tfSel ? tfSel.value : "1m";
    let duration = 5;
    if (selected.endsWith("s")) duration = parseInt(selected);
    if (selected.endsWith("m")) duration = parseInt(selected) * 60;

    let remaining = duration;
    if (countdown) {
      countdown.classList.remove("hidden");
      updateCountdown();
      const interval = setInterval(() => {
        remaining--;
        updateCountdown();
        if (remaining <= 0) { clearInterval(interval); countdown.textContent = ""; }
      }, 1000);

      function updateCountdown() {
        countdown.textContent = `${remaining < 10 ? "0" : ""}${remaining}`;
        countdown.style.color = remaining % 2 === 0 ? "#00ffc3" : "#ff4d4d";
      }
    }

    if (quoteText) {
      const quote = quotes[Math.floor(Math.random() * quotes.length)];
      quoteText.textContent = quote;
      quoteText.classList.remove("hidden");
    }
  }, 2000);
});
