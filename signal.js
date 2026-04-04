// SECURE SIGNAL BOT - Real-time onSnapshot subscription (minimal reads)
// Uses shared auth-profile for auth state and user doc reads

import { db, auth, doc, getDoc, setDoc, increment, onSnapshot, signOut } from "./platform.js";
import { onProfileChange, getProfileSnapshot } from "./auth-profile.js";

// --- Access state (derived from shared profile) ---
let _accessGranted = false;
let _accessEmail = null;

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
const assetHidden = document.getElementById("asset");
const assetSearchInput = document.getElementById("asset-search");
const assetDropdown = document.getElementById("asset-dropdown");
const generateBtn = document.getElementById("generate-btn");
const signalOutput = document.getElementById("signal-output");
const countdown = document.getElementById("countdown");
const quoteText = document.getElementById("quote-text");
const loading = document.getElementById("loading");

// --- Ensure app is locked by default ---
if (appEl) appEl.classList.add("hidden");
if (generateBtn) generateBtn.disabled = true;

// --- Gate screens ---
function escapeHtmlStr(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showGateScreen(icon, title, text, actions, email = '') {
  if (gateIcon) gateIcon.textContent = icon;
  if (gateTitle) gateTitle.textContent = title;
  if (gateText) gateText.innerHTML = text + (email ? `<div class="gate-email">${escapeHtmlStr(email)}</div>` : '');
  if (gateActions) gateActions.innerHTML = actions;
  if (gateEl) gateEl.classList.remove("hidden");
  if (appEl) appEl.classList.add("hidden");
  if (generateBtn) generateBtn.disabled = true;
  
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

function lockApp(reason) {
  _accessGranted = false;
  if (appEl) appEl.classList.add("hidden");
  if (generateBtn) generateBtn.disabled = true;
  
  let icon = '⛔', title = 'Access Revoked', text = 'Your access has been revoked.';
  
  if (reason === 'suspended' || reason === 'banned') {
    text = 'Your account has been suspended. Please contact admin for assistance.';
  } else if (reason === 'pending') {
    icon = '⏳';
    title = 'Approval Pending';
    text = 'Your account is under review. You will gain access once approved.';
  }
  
  showGateScreen(
    icon,
    title,
    text,
    `<a href="https://t.me/digimun49" target="_blank" class="gate-btn telegram">Contact Support</a>
     <button onclick="location.reload()" class="gate-btn secondary">Refresh Page</button>`
  );
}

logoutBtn?.addEventListener("click", () => {
  _accessGranted = false;
  _accessEmail = null;
  signOut(auth).catch(()=>{});
});

// --- Signal count (Real-time listener) ---
let signalCountUnsubscribe = null;

function initSignalCountListener() {
  if (signalCountUnsubscribe) return;
  
  const countRef = doc(db, "stats", "signalCount");
  signalCountUnsubscribe = onSnapshot(countRef, (snap) => {
    const count = snap.exists() ? (snap.data().count ?? 0) : 0;
    if (counterBox) counterBox.textContent = `${Number(count).toLocaleString()}+`;
  }, (error) => {
    console.error("[SignalCount] Listener error:", error);
    if (counterBox) counterBox.textContent = "0+";
  });
}

async function incrementSignalCount() {
  try {
    const countRef = doc(db, "stats", "signalCount");
    
    const snap = await getDoc(countRef);
    
    if (snap.exists()) {
      await setDoc(countRef, { count: increment(1) }, { merge: true });
    } else {
      await setDoc(countRef, { count: 1 });
    }
  } catch (e) {
    console.error("[SignalCount] INCREMENT FAILED - Error:", e);
    console.error("[SignalCount] Error code:", e.code);
    console.error("[SignalCount] Error message:", e.message);
  }
}

initSignalCountListener();

// --- Auth + Gate via shared profile ---
let _initialCheckDone = false;

onProfileChange(async (profile) => {
  if (!profile.authResolved) return;

  if (!profile.isLoggedIn) {
    _accessGranted = false;
    _accessEmail = null;
    userMail.textContent = "Not signed in";
    showGateScreen(
      '🔒',
      'Premium Access Required',
      'Digimun Pro Signal Bot is available exclusively for registered members. Please login or create an account to continue.',
      `<a href="login" class="gate-btn primary">Login to Continue</a>
       <a href="signup" class="gate-btn secondary">Create Free Account</a>`
    );
    return;
  }

  userMail.textContent = profile.email || "Signed in";

  try {
    const userData = profile.userData;

    if (!userData && !_initialCheckDone) {
      _initialCheckDone = true;
      const uRef = doc(db, "users", profile.email);
      await setDoc(uRef, {
        paymentStatus: "pending",
        quotexStatus: "pending",
        createdAt: Date.now()
      }, { merge: true });
      return;
    }

    if (!userData) {
      _accessGranted = false;
      showGateScreen(
        '⏳',
        'Approval Pending',
        'Your account is being set up. Please wait a moment...',
        `<button onclick="location.reload()" class="gate-btn primary">Refresh</button>`
      );
      return;
    }

    _initialCheckDone = true;

    const d = userData;
    const paymentStatus = String(d.paymentStatus || "").toLowerCase();
    const quotexStatus = String(d.quotexStatus || "").toLowerCase();
    const generalStatus = String(d.status || "").toLowerCase();

    if (generalStatus === 'suspended' || generalStatus === 'banned') {
      _accessGranted = false;
      _accessEmail = null;
      showGateScreen(
        '⛔',
        'Access Denied',
        'Your account has been suspended. Please contact admin for assistance.',
        `<a href="https://t.me/digimun49" target="_blank" class="gate-btn telegram">Contact Admin</a>`,
        profile.email
      );
      return;
    }

    const isFullyApproved = paymentStatus === 'approved' && quotexStatus === 'approved';

    if (isFullyApproved) {
      _accessGranted = true;
      _accessEmail = profile.email;
      openApp();
      if (counterBox) initSignalCountListener();
    } else if (paymentStatus === 'pending' || generalStatus === 'pending') {
      _accessGranted = false;
      _accessEmail = null;
      showGateScreen(
        '⏳',
        'Approval Pending',
        'Your account is under review. You will gain access to Digimun Pro Signal Bot once admin approval is completed.',
        `<a href="https://t.me/digimun49" target="_blank" class="gate-btn telegram">📱 Contact Support on Telegram</a>
         <a href="help" class="gate-btn secondary">🎫 Create Support Ticket</a>
         <a href="dashboard" class="gate-btn secondary">View Account Status</a>
         <button id="gateSignOut" class="gate-btn secondary">Sign Out</button>`,
        profile.email
      );
    } else {
      _accessGranted = false;
      _accessEmail = null;
      showGateScreen(
        '🔐',
        'Premium Tool Locked',
        'Digimun Pro Signal Bot is a premium tool. Choose how you want to unlock full access to this powerful trading system.',
        `<a href="digimax" class="gate-btn primary">View Signal Bot Details</a>
         <a href="dashboard" class="gate-btn secondary">Account Dashboard</a>
         <button id="gateSignOut" class="gate-btn secondary">Sign Out</button>`,
        profile.email
      );
    }

  } catch (e) {
    _accessGranted = false;
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
  "USD/IDR (OTC)","USD/INR (OTC)",
  "Bitcoin (OTC)","Ethereum (OTC)","Solana (OTC)","Bitcoin Cash (OTC)",
  "Litecoin (OTC)","Ripple (OTC)","Cardano (OTC)","Dogecoin (OTC)",
  "Polkadot (OTC)","Chainlink (OTC)","Avalanche (OTC)","TRON (OTC)",
  "Binance Coin (OTC)","Toncoin (OTC)","Shiba Inu (OTC)","Ethereum Classic (OTC)",
  "Cosmos (OTC)","Aptos (OTC)","Arbitrum (OTC)","Zcash (OTC)","Dash (OTC)",
  "Pepe (OTC)","Floki (OTC)","Bonk (OTC)","Notcoin (OTC)","Celestia (OTC)",
  "Dogwifhat (OTC)","Hamster Kombat (OTC)","Axie Infinity (OTC)",
  "Trump (OTC)","Melania Meme (OTC)","Beam (OTC)",
  "Johnson & Johnson (OTC)","Microsoft (OTC)","Pfizer Inc (OTC)","Intel (OTC)",
  "American Express (OTC)","Boeing Company (OTC)","FACEBOOK INC (OTC)","McDonald's (OTC)","NASDAQ 100"
];

let currentAssetList = [];
let activeDropdownIdx = -1;

function highlightMatch(text, query) {
  if (!query) return escapeHtmlStr(text);
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return escapeHtmlStr(text);
  return escapeHtmlStr(text.slice(0, idx)) + '<span class="match-highlight">' + escapeHtmlStr(text.slice(idx, idx + query.length)) + '</span>' + escapeHtmlStr(text.slice(idx + query.length));
}

function renderDropdown(list, query) {
  if (!assetDropdown) return;
  assetDropdown.innerHTML = "";
  activeDropdownIdx = -1;
  if (!list.length) {
    assetDropdown.innerHTML = '<div class="asset-dropdown-empty">No matching assets</div>';
    assetDropdown.classList.remove("hidden");
    return;
  }
  list.forEach((item) => {
    const div = document.createElement("div");
    div.className = "asset-dropdown-item";
    div.innerHTML = highlightMatch(item, query);
    div.addEventListener("click", () => selectAsset(item));
    assetDropdown.appendChild(div);
  });
  assetDropdown.classList.remove("hidden");
}

function selectAsset(value) {
  if (assetHidden) assetHidden.value = value;
  if (assetSearchInput) assetSearchInput.value = value;
  if (assetDropdown) assetDropdown.classList.add("hidden");
}

function filterAssets(query) {
  if (!query) return currentAssetList;
  return currentAssetList.filter(a => a.toLowerCase().includes(query.toLowerCase()));
}

marketType?.addEventListener("change", () => {
  currentAssetList = marketType.value === "otc" ? otcAssets : liveAssets;
  if (assetSearchInput) {
    assetSearchInput.disabled = !currentAssetList.length;
    assetSearchInput.value = "";
    assetSearchInput.placeholder = currentAssetList.length ? "Type to search..." : "Select Market First";
  }
  if (assetHidden) assetHidden.value = "";
  if (assetDropdown) assetDropdown.classList.add("hidden");
});

assetSearchInput?.addEventListener("focus", () => {
  if (currentAssetList.length) {
    renderDropdown(filterAssets(assetSearchInput.value), assetSearchInput.value);
  }
});

assetSearchInput?.addEventListener("input", () => {
  const q = assetSearchInput.value;
  if (assetHidden) assetHidden.value = "";
  renderDropdown(filterAssets(q), q);
});

assetSearchInput?.addEventListener("keydown", (e) => {
  const items = assetDropdown?.querySelectorAll(".asset-dropdown-item") || [];
  if (!items.length) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeDropdownIdx = Math.min(activeDropdownIdx + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle("active", i === activeDropdownIdx));
    items[activeDropdownIdx]?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeDropdownIdx = Math.max(activeDropdownIdx - 1, 0);
    items.forEach((el, i) => el.classList.toggle("active", i === activeDropdownIdx));
    items[activeDropdownIdx]?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter" && activeDropdownIdx >= 0) {
    e.preventDefault();
    const filtered = filterAssets(assetSearchInput.value);
    if (filtered[activeDropdownIdx]) selectAsset(filtered[activeDropdownIdx]);
  }
});

document.addEventListener("click", (e) => {
  if (assetDropdown && !e.target.closest(".asset-search-wrapper")) {
    assetDropdown.classList.add("hidden");
  }
});

// --- Signal generation (uses cached access state, NO per-click reads) ---
const signals = ["Strong Buy","Strong Sell","Buy","Sell"];
const quotes = [
  "Success is earned, not given.",
  "Discipline beats motivation.",
  "Manage risk, maximize profit.",
  "Follow strategy, not emotion.",
  "Patience turns trades into profits."
];

generateBtn?.addEventListener("click", async () => {
  if (!_accessGranted) {
    lockApp('not_approved');
    return;
  }

  if (generateBtn) generateBtn.disabled = true;

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
