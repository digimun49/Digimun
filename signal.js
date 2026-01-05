// SECURE SIGNAL BOT - Real-time Firestore verification on every action
// PAGE ROLE: 'signal' => needs paymentStatus: 'approved' AND quotexStatus: 'approved'

import { db, auth } from "./firebase.js";
import {
  doc, getDoc, updateDoc, increment, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// --- Secure Access Controller (tamper-resistant) ---
const AccessController = (() => {
  const _key = Symbol('accessKey');
  let _state = { [_key]: false, email: null };
  
  return Object.freeze({
    grant(email) { _state = { [_key]: true, email }; },
    revoke() { _state = { [_key]: false, email: null }; },
    isGranted() { return _state[_key] === true; },
    getEmail() { return _state.email; },
    async verifyWithFirestore() {
      const user = auth.currentUser;
      if (!user || !user.email) return false;
      try {
        const snap = await getDoc(doc(db, "users", user.email.trim()));
        if (!snap.exists()) return false;
        const d = snap.data();
        const paymentStatus = String(d.paymentStatus || "").toLowerCase();
        const quotexStatus = String(d.quotexStatus || "").toLowerCase();
        const generalStatus = String(d.status || "").toLowerCase();
        if (generalStatus === 'suspended' || generalStatus === 'banned' || generalStatus === 'pending') return false;
        if (paymentStatus !== 'approved' || quotexStatus !== 'approved') return false;
        return true;
      } catch { return false; }
    }
  });
})();

// --- DOM refs ---
const appEl = document.getElementById("app") || document.body;
const gateEl = document.getElementById("gate");
const gateIcon = document.getElementById("gate-icon");
const gateTitle = document.getElementById("gate-title");
const gateText = document.getElementById("gate-text");
const gateActions = document.getElementById("gate-actions");
const logoutBtn = document.getElementById("logout-btn");
const userMail = document.getElementById("user-mail") || { textContent: "" };

const counterBox = document.getElementById("signal-count");
const marketType = document.getElementById("market-type");
const assetSelect = document.getElementById("asset");
const generateBtn = document.getElementById("generate-btn");
const signalOutput = document.getElementById("signal-output");
const countdown = document.getElementById("countdown");
const quoteText = document.getElementById("quote-text");
const loading = document.getElementById("loading");

// --- Ensure app is locked by default ---
if (appEl) appEl.classList.add("hidden");
if (generateBtn) generateBtn.disabled = true;

// --- Gate screens ---
function showGateScreen(icon, title, text, actions, email = '') {
  if (gateIcon) gateIcon.textContent = icon;
  if (gateTitle) gateTitle.textContent = title;
  if (gateText) gateText.innerHTML = text + (email ? `<div class="gate-email">${email}</div>` : '');
  if (gateActions) gateActions.innerHTML = actions;
  if (gateEl) gateEl.classList.remove("hidden");
  if (appEl) appEl.classList.add("hidden");
  if (generateBtn) generateBtn.disabled = true;
  AccessController.revoke();
  
  document.getElementById('gateSignOut')?.addEventListener('click', () => signOut(auth).catch(()=>{}));
}

function openApp() {
  if (gateEl) {
    gateEl.style.opacity = '0';
    gateEl.style.transition = 'opacity 0.3s';
    setTimeout(() => gateEl.classList.add("hidden"), 300);
  }
  if (appEl) appEl.classList.remove("hidden");
  if (generateBtn) generateBtn.disabled = false;
}

logoutBtn?.addEventListener("click", () => {
  AccessController.revoke();
  signOut(auth).catch(()=>{});
});

// --- Signal count ---
async function loadSignalCount() {
  try {
    const snap = await getDoc(doc(db, "stats", "signalCount"));
    const count = snap.exists() ? (snap.data().count ?? 0) : 0;
    if (counterBox) counterBox.textContent = `${Number(count).toLocaleString()}+`;
  } catch { if (counterBox) counterBox.textContent = "0+"; }
}

async function incrementSignalCount() {
  try {
    await setDoc(doc(db, "stats", "signalCount"), { count: increment(1) }, { merge: true });
    await loadSignalCount();
  } catch {}
}

// --- Auth + Gate ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    AccessController.revoke();
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
    const uRef = doc(db, "users", EMAIL_DOC_KEY);
    let uSnap = await getDoc(uRef);

    if (!uSnap.exists()) {
      await setDoc(uRef, {
        paymentStatus: "pending",
        quotexStatus: "pending",
        createdAt: Date.now()
      }, { merge: true });
      uSnap = await getDoc(uRef);
    }

    const d = uSnap.data() || {};
    const paymentStatus = String(d.paymentStatus || "").toLowerCase();
    const quotexStatus = String(d.quotexStatus || "").toLowerCase();
    const generalStatus = String(d.status || "").toLowerCase();

    if (generalStatus === 'suspended' || generalStatus === 'banned') {
      AccessController.revoke();
      showGateScreen(
        '⛔',
        'Access Denied',
        'Your account has been suspended. Please contact admin for assistance.',
        `<a href="https://t.me/digimun49" target="_blank" class="gate-btn telegram">Contact Admin</a>`,
        user.email
      );
      return;
    }

    const isFullyApproved = paymentStatus === 'approved' && quotexStatus === 'approved';

    if (isFullyApproved) {
      AccessController.grant(user.email);
      openApp();
      if (counterBox) await loadSignalCount();
    } else if (paymentStatus === 'pending' || generalStatus === 'pending') {
      AccessController.revoke();
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
      AccessController.revoke();
      showGateScreen(
        '🔐',
        'Premium Tool Locked',
        'Digimun Pro Signal Bot is a premium tool. Choose how you want to unlock full access to this powerful trading system.',
        `<a href="digimax.html" class="gate-btn primary">View Signal Bot Details</a>
         <a href="chooseAccountType.html" class="gate-btn secondary">Account Dashboard</a>
         <button id="gateSignOut" class="gate-btn secondary">Sign Out</button>`,
        user.email
      );
    }

  } catch (e) {
    console.error("[Signal] Auth error:", e);
    AccessController.revoke();
    showGateScreen(
      '⚠️',
      'Connection Error',
      'Unable to verify your account. Please check your internet connection and try again.',
      `<button onclick="location.reload()" class="gate-btn primary">Retry</button>
       <button id="gateSignOut" class="gate-btn secondary">Sign Out</button>`
    );
  }
});

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

// --- Signal generation with REAL-TIME verification ---
const signals = ["Strong Buy","Strong Sell","Buy","Sell"];
const quotes = [
  "Success is earned, not given.",
  "Discipline beats motivation.",
  "Manage risk, maximize profit.",
  "Follow strategy, not emotion.",
  "Patience turns trades into profits."
];

generateBtn?.addEventListener("click", async () => {
  if (generateBtn) generateBtn.disabled = true;
  
  // CRITICAL: Re-verify with Firestore on EVERY signal generation
  const isVerified = await AccessController.verifyWithFirestore();
  
  if (!isVerified) {
    AccessController.revoke();
    if (appEl) appEl.classList.add("hidden");
    if (generateBtn) generateBtn.disabled = true;
    showGateScreen(
      '⛔',
      'Access Revoked',
      'Your access could not be verified. Please contact support if you believe this is an error.',
      `<a href="https://t.me/digimun49" target="_blank" class="gate-btn telegram">Contact Support</a>
       <button onclick="location.reload()" class="gate-btn secondary">Refresh Page</button>`
    );
    return;
  }

  loading?.classList.remove("hidden");
  signalOutput?.classList.add("hidden");
  countdown?.classList.add("hidden");
  quoteText?.classList.add("hidden");

  await incrementSignalCount();

  setTimeout(() => {
    loading?.classList.add("hidden");
    if (generateBtn) generateBtn.disabled = false;

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
