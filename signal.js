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
const gateIcon     = document.getElementById("gate-icon");
const gateTitle    = document.getElementById("gate-title");
const gateText     = document.getElementById("gate-text");
const gateActions  = document.getElementById("gate-actions");
const logoutBtn    = document.getElementById("logout-btn");
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
let isApprovedForAffiliate = false;
let isApprovedForFinal     = false;

// --- Gate screens ---
function showGateScreen(icon, title, text, actions, email = '') {
  if (gateIcon) gateIcon.textContent = icon;
  if (gateTitle) gateTitle.textContent = title;
  if (gateText) gateText.innerHTML = text + (email ? `<div class="gate-email">${email}</div>` : '');
  if (gateActions) gateActions.innerHTML = actions;
  if (gateEl) gateEl.classList.remove("hidden");
  if (appEl) appEl.classList.add("hidden");
  if (generateBtn) generateBtn.disabled = true;
  
  document.getElementById('gateSignOut')?.addEventListener('click', () => signOut(auth).catch(()=>{}));
}

function openApp(){
  if (gateEl) {
    gateEl.style.opacity = '0';
    gateEl.style.transition = 'opacity 0.3s';
    setTimeout(() => gateEl.classList.add("hidden"), 300);
  }
  if (appEl) appEl.classList.remove("hidden");
  if (generateBtn) generateBtn.disabled = false;
}

logoutBtn?.addEventListener("click", () => signOut(auth).catch(()=>{}));

// --- Auth + Gate ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    userMail.textContent = "Not signed in";
    showGateScreen(
      '🔒',
      'Premium Access Required',
      'Digimun Pro Signal Bot is available exclusively for registered members. Please login or create an account to continue.',
      `<a href="login.html" class="gate-btn primary">Login to Continue</a>
       <a href="signup.html" class="gate-btn secondary">Create Free Account</a>`
    );
    return;
  }

  userMail.textContent = user.email || "Signed in";

  try {
    const EMAIL_DOC_KEY = (user.email || "").trim();
    const uRef  = doc(db, "users", EMAIL_DOC_KEY);
    let uSnap = await getDoc(uRef);

    if (!uSnap.exists()) {
      await setDoc(uRef, {
        paymentStatus: "pending",
        quotexStatus:  "pending",
        createdAt: Date.now()
      }, { merge: true });
      uSnap = await getDoc(uRef);
    }

    const d = uSnap.data() || {};
    const paymentStatus = String(d.paymentStatus || "").toLowerCase();
    const quotexStatus  = String(d.quotexStatus  || "").toLowerCase();
    const generalStatus = String(d.status || "").toLowerCase();

    if (generalStatus === 'suspended' || generalStatus === 'banned') {
      showGateScreen(
        '⛔',
        'Access Denied',
        'Your account has been suspended. Please contact admin for assistance.',
        `<a href="https://t.me/digimun49" target="_blank" class="gate-btn telegram">Contact Admin</a>`,
        user.email
      );
      return;
    }

    isApprovedForAffiliate = paymentStatus === "approved";
    isApprovedForFinal     = isApprovedForAffiliate && quotexStatus === "approved";

    if (PAGE_ROLE === "affiliate") {
      if (isApprovedForAffiliate) {
        openApp();
      } else {
        showGateScreen(
          '⏳',
          'Approval Pending',
          'Your payment is being verified. You will gain access once approved. This usually takes 1-24 hours.',
          `<a href="https://t.me/digimun49" target="_blank" class="gate-btn telegram">📱 Contact Support on Telegram</a>
           <a href="help.html" class="gate-btn secondary">🎫 Create Support Ticket</a>
           <div style="font-size:11px;color:#f59e0b;text-align:center;margin-top:8px;padding:8px 12px;background:rgba(245,158,11,0.1);border-radius:8px;">⚠️ WhatsApp support is temporarily unavailable. Please use Telegram.</div>
           <div style="font-size:12px;color:#60a5fa;text-align:center;margin-top:8px;">Having trouble? <a href="https://youtu.be/mROinTjkVGY" target="_blank" style="color:#60a5fa;">Watch Telegram Tutorial</a></div>
           <button id="gateSignOut" class="gate-btn secondary">Sign Out</button>`,
          user.email
        );
      }
    } else {
      if (isApprovedForFinal) {
        openApp();
        if (counterBox) await loadSignalCount();
      } else if (paymentStatus === 'pending' || generalStatus === 'pending') {
        showGateScreen(
          '⏳',
          'Approval Pending',
          'Your account is under review. You will gain access to Digimun Pro Signal Bot once admin approval is completed.',
          `<a href="https://t.me/digimun49" target="_blank" class="gate-btn telegram">📱 Contact Support on Telegram</a>
           <a href="help.html" class="gate-btn secondary">🎫 Create Support Ticket</a>
           <div style="font-size:11px;color:#f59e0b;text-align:center;margin-top:8px;padding:8px 12px;background:rgba(245,158,11,0.1);border-radius:8px;">⚠️ WhatsApp support is temporarily unavailable. Please use Telegram.</div>
           <div style="font-size:12px;color:#60a5fa;text-align:center;margin-top:8px;">Having trouble? <a href="https://youtu.be/mROinTjkVGY" target="_blank" style="color:#60a5fa;">Watch Telegram Tutorial</a></div>
           <a href="chooseAccountType.html" class="gate-btn secondary">View Account Status</a>
           <button id="gateSignOut" class="gate-btn secondary">Sign Out</button>`,
          user.email
        );
      } else {
        showGateScreen(
          '🔐',
          'Premium Tool Locked',
          'Digimun Pro Signal Bot is a premium tool. Choose how you want to unlock full access to this powerful trading system.',
          `<a href="digimax.html" class="gate-btn primary">View Signal Bot Details</a>
           <a href="chooseAccountType.html" class="gate-btn gold">💳 Go to Payment Portal</a>
           <a href="https://t.me/digimun49" target="_blank" class="gate-btn telegram">📱 Contact Support</a>
           <button id="gateSignOut" class="gate-btn secondary">Sign Out</button>`,
          user.email
        );
      }
    }
  } catch (e) {
    console.error('Firestore read error:', e?.code || e?.message || e);
    showGateScreen(
      '⚠️',
      'Something Went Wrong',
      'Unable to verify your access. Please try again or contact support.',
      `<button onclick="location.reload()" class="gate-btn primary">Try Again</button>
       <a href="login.html" class="gate-btn secondary">Back to Login</a>`
    );
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
