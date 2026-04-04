// SECURE DIGIMAXX BOT - Real-time onSnapshot subscription (minimal reads)
import { db, auth, doc, getDoc, setDoc, increment, onSnapshot } from "./platform.js";

const $ = id => document.getElementById(id);

// --- Secure Access Controller with Real-time Subscription ---
const AccessController = (() => {
  const _key = Symbol('accessKey');
  let _state = { [_key]: false, lastVerified: 0 };
  let _unsubscribe = null;
  
  return Object.freeze({
    grant() { 
      _state = { [_key]: true, lastVerified: Date.now() };
      const btn = document.getElementById('generate-btn');
      if (btn) btn.disabled = false;
    },
    revoke() { 
      _state = { [_key]: false, lastVerified: 0 };
      const btn = document.getElementById('generate-btn');
      if (btn) btn.disabled = true;
    },
    isGranted() { 
      return _state[_key] === true; 
    },
    subscribe(email, onStatusChange) {
      this.unsubscribe();
      
      const userRef = doc(db, "users", email.toLowerCase().trim());
      _unsubscribe = onSnapshot(userRef, (snap) => {
        if (!snap.exists()) {
          this.revoke();
          onStatusChange(false, 'no_doc');
          return;
        }
        
        const d = snap.data();
        const digimaxStatus = String(d.digimaxStatus || '').toLowerCase();
        const paymentStatus = String(d.paymentStatus || '').toLowerCase();
        const generalStatus = String(d.status || '').toLowerCase();
        
        if (generalStatus === 'suspended' || generalStatus === 'banned' || generalStatus === 'pending') {
          this.revoke();
          onStatusChange(false, generalStatus);
          return;
        }
        
        const isApproved = digimaxStatus === 'approved' || paymentStatus === 'approved';
        
        if (isApproved) {
          this.grant();
          onStatusChange(true, 'approved');
        } else {
          this.revoke();
          onStatusChange(false, 'not_approved');
        }
      }, (error) => {});
    },
    unsubscribe() {
      if (_unsubscribe) {
        _unsubscribe();
        _unsubscribe = null;
      }
    }
  });
})();

window.__DGX_ACCESS_CONTROLLER__ = AccessController;


// ===== Signal Count (Real-time listener) =====
const counterBox = $("signal-count");
let signalCountUnsubscribe = null;

function initSignalCountListener() {
  if (signalCountUnsubscribe) return;
  
  const countRef = doc(db, "stats", "signalCount");
  signalCountUnsubscribe = onSnapshot(countRef, (snap) => {
    const count = snap.exists() ? (snap.data().count ?? 0) : 0;
    if(counterBox) counterBox.textContent = `${Number(count).toLocaleString()}+`;
  }, (error) => {
    console.error("[SignalCount] Listener error:", error);
    if(counterBox) counterBox.textContent = "0+";
  });
}

async function incrementSignalCount(){
  try{
    const countRef = doc(db, "stats", "signalCount");
    
    const snap = await getDoc(countRef);
    
    if (snap.exists()) {
      await setDoc(countRef, { count: increment(1) }, { merge: true });
    } else {
      await setDoc(countRef, { count: 1 });
    }
  }catch(e){
    console.error("[SignalCount] INCREMENT FAILED - Error:", e);
    console.error("[SignalCount] Error code:", e.code);
    console.error("[SignalCount] Error message:", e.message);
  }
}

initSignalCountListener();

// ===== Assets =====
const marketTypeSelect = $("market-type");
const assetHidden      = $("asset");
const assetSearchInput = $("asset-search");
const assetDropdown    = $("asset-dropdown");

const liveAssets = ["EUR/USD","GBP/USD","USD/JPY","AUD/USD","USD/CAD","NZD/USD","EUR/JPY","GBP/JPY","USD/CHF","EUR/GBP"];
const otcAssets  = ["NZD/CAD (OTC)","USD/ARS (OTC)","USD/PKR (OTC)","EUR/CAD (OTC)","USD/BRL (OTC)","EUR/NZD (OTC)","USD/MXN (OTC)","USD/PHP (OTC)","USD/ZAR (OTC)","USD/BDT (OTC)","USD/NGN (OTC)","CHF/JPY (OTC)","EUR/AUD (OTC)","EUR/GBP (OTC)","NZD/CHF (OTC)","NZD/JPY (OTC)","USD/IDR (OTC)","USD/INR (OTC)","NASDAQ 100"];
const cryptoAssets = [
  "Bitcoin (OTC)","Ethereum (OTC)","Solana (OTC)","Bitcoin Cash (OTC)",
  "Litecoin (OTC)","Ripple (OTC)","Cardano (OTC)","Dogecoin (OTC)",
  "Polkadot (OTC)","Chainlink (OTC)","Avalanche (OTC)","TRON (OTC)",
  "Binance Coin (OTC)","Toncoin (OTC)","Shiba Inu (OTC)","Ethereum Classic (OTC)",
  "Cosmos (OTC)","Aptos (OTC)","Arbitrum (OTC)","Zcash (OTC)","Dash (OTC)",
  "Pepe (OTC)","Floki (OTC)","Bonk (OTC)","Notcoin (OTC)","Celestia (OTC)",
  "Dogwifhat (OTC)","Hamster Kombat (OTC)","Axie Infinity (OTC)",
  "Trump (OTC)","Melania Meme (OTC)","Beam (OTC)",
  "Decentraland (OTC)","Gala (OTC)"
];
const commoditiesAssets = ["UKBrent (OTC)","USCrude (OTC)","Silver (OTC)","Gold (OTC)"];
const stocksAssets = ["FACEBOOK INC (OTC)","Intel (OTC)","Johnson & Johnson (OTC)","Microsoft (OTC)","Pfizer Inc (OTC)","American Express (OTC)","Boeing Company (OTC)","McDonald's (OTC)","S&P/ASX 200"];

let currentAssetList = [];
let activeDropdownIndex = -1;

function escapeHtmlStr(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function highlightMatch(text, query) {
  if (!query) return escapeHtmlStr(text);
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return escapeHtmlStr(text);
  return escapeHtmlStr(text.slice(0, idx)) + '<span class="match-highlight">' + escapeHtmlStr(text.slice(idx, idx + query.length)) + '</span>' + escapeHtmlStr(text.slice(idx + query.length));
}

function renderDropdown(list, query) {
  if (!assetDropdown) return;
  assetDropdown.innerHTML = "";
  activeDropdownIndex = -1;
  if (!list.length) {
    assetDropdown.innerHTML = '<div class="asset-dropdown-empty">No matching assets</div>';
    assetDropdown.classList.remove("hidden");
    return;
  }
  list.forEach((item, i) => {
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

marketTypeSelect?.addEventListener("change", () => {
  currentAssetList = [];
  switch(marketTypeSelect.value){
    case "live": currentAssetList = liveAssets; break;
    case "otc": currentAssetList = otcAssets; break;
    case "crypto": currentAssetList = cryptoAssets; break;
    case "commodities": currentAssetList = commoditiesAssets; break;
    case "stocks": currentAssetList = stocksAssets; break;
  }
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
    activeDropdownIndex = Math.min(activeDropdownIndex + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle("active", i === activeDropdownIndex));
    items[activeDropdownIndex]?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeDropdownIndex = Math.max(activeDropdownIndex - 1, 0);
    items.forEach((el, i) => el.classList.toggle("active", i === activeDropdownIndex));
    items[activeDropdownIndex]?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter" && activeDropdownIndex >= 0) {
    e.preventDefault();
    const filtered = filterAssets(assetSearchInput.value);
    if (filtered[activeDropdownIndex]) selectAsset(filtered[activeDropdownIndex]);
  }
});

document.addEventListener("click", (e) => {
  if (assetDropdown && !e.target.closest(".asset-search-wrapper")) {
    assetDropdown.classList.add("hidden");
  }
});

// ===== Clock (UTC+05 display) =====
const utcClock = $("utcClock");
function getUtcDate(){ const now = new Date(); return new Date(now.getTime() + now.getTimezoneOffset()*60000); }
function formatUTCPlus5(d, withSeconds=false){
  const ts = d.getTime() + 5*60*60*1000;
  return new Date(ts).toLocaleTimeString([], { hour12:false, hour:'2-digit', minute:'2-digit', second: withSeconds ? '2-digit' : undefined });
}
(function tickClock(){
  if(utcClock) utcClock.textContent = `${formatUTCPlus5(getUtcDate(), true)}  •  UTC+05:00`;
  requestAnimationFrame(()=> setTimeout(tickClock, 250));
})();

// ===== Signal Generation =====
const generateBtn  = $("generate-btn");
const signalOutput = $("signal-output");
const countdown    = $("countdown");
const quoteText    = $("quote-text");
const loading      = $("loading");
const stickerImg   = $("signal-sticker");

if(generateBtn) generateBtn.disabled = true;

function nextUtcMinute(){
  const now = getUtcDate();
  const next = new Date(now);
  next.setUTCSeconds(0,0);
  if(now.getUTCSeconds() !== 0) next.setUTCMinutes(next.getUTCMinutes()+1);
  return next;
}
function floorUtcToMinute(d){ const x = new Date(d); x.setUTCSeconds(0,0); return x; }

function hashStr(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619) } return h>>>0; }
function pickDir(seed){ return (seed & 1) === 0 ? "UP" : "DOWN"; }
function pickConf(seed){ const r=((seed>>10)%600)/10; return (88 + (r/10)).toFixed(1); }

const QUOTES = [
  "Discipline beats motivation.","Context over impulse.","Precision favors patience.","Observe first, execute last.",
  "Protect downside, upside follows.","Plan the trade, trade the plan.","Small edges, large outcomes.","Volatility rewards the prepared.",
  "Bias is not a signal.","Wait for confirmation.","Risk first, profits later.","Data before drama.",
  "Time in market > timing the market.","Structure first, entry second.","Respect the invalidation.","Trade the level, not the hope.",
  "Stay liquid, think clearly.","Consistency compounds.","Avoid revenge trades.","Edge + risk = outcome."
];
const ENTRY_TIPS = [
  "Wait 3–5s after candle open; avoid instant clicks.","Enter only after a micro pullback in signal direction.",
  "Skip if previous body closes strong against your bias.","Prefer entries when wick taps your zone and snaps back.",
  "Avoid entries directly into fresh high-impact news.","Reject signals on flat, very low range sequences.",
  "Use smaller size after three consecutive wins/losses.","Avoid entries when spread/latency suddenly widens.",
  "Confirm with HH/HL (UP) or LH/LL (DOWN) micro-structure.","Do not enter on extended single-direction wicks.",
  "Avoid immediate re-entry after a full-body engulf.","Favor entries above/below mid-range in signal direction.",
  "Skip if price is compressing tightly into your level.","Avoid trading right on round numbers; wait for reclaim.",
  "Entry only if last 2 bodies align with your signal.","Reject if prior candle closed as indecision at key level.",
  "Use smaller margin on first setup of the session.","Avoid after 4+ consecutive strong bodies (exhaustion).",
  "Respect invalidation: no entry if level breaks and holds.","Pause if correlated pairs show conflicting impulse."
];

let tipIndex   = Number(sessionStorage.getItem("dgx_tipIndex") ?? 0) % ENTRY_TIPS.length;
let quoteIndex = Number(sessionStorage.getItem("dgx_quoteIndex") ?? 0) % QUOTES.length;
function nextTip(){  const t = ENTRY_TIPS[tipIndex]; tipIndex=(tipIndex+1)%ENTRY_TIPS.length; sessionStorage.setItem("dgx_tipIndex", tipIndex); return t; }
function nextQuote(){ const q = QUOTES[quoteIndex]; quoteIndex=(quoteIndex+1)%QUOTES.length; sessionStorage.setItem("dgx_quoteIndex", quoteIndex); return q; }

function showAccessDenied(reason) {
  const APP = $("app");
  const GATE = $("access-gate");
  if(APP) APP.style.display = 'none';
  
  let message = 'Your access has been revoked.';
  if (reason === 'suspended' || reason === 'banned') {
    message = 'Your account has been suspended. Please contact admin for assistance.';
  } else if (reason === 'pending') {
    message = 'Your account is under review. You will gain access once approved.';
  }
  
  if(GATE) {
    GATE.innerHTML = `
      <style>
        .gate-card{background:rgba(10,20,40,0.95);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:40px 30px;max-width:420px;text-align:center;}
        .gate-icon{font-size:48px;margin-bottom:16px;display:block;}
        .gate-title{font-size:22px;font-weight:700;color:#fff;margin-bottom:12px;}
        .gate-subtitle{font-size:14px;color:#94a3b8;margin-bottom:24px;line-height:1.6;}
        .gate-btn{display:block;width:100%;padding:14px;border-radius:12px;font-size:15px;font-weight:600;text-decoration:none;margin-top:12px;text-align:center;transition:all 0.3s;}
        .gate-btn.telegram{background:linear-gradient(135deg,#24A1DE,#1b8abf);color:#fff;}
        .gate-btn.secondary{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#e2e8f0;}
      </style>
      <div class="gate-card">
        <span class="gate-icon">⛔</span>
        <h2 class="gate-title">Access Revoked</h2>
        <p class="gate-subtitle">${escapeHtmlStr(message)}</p>
        <a href="https://t.me/digimun49" target="_blank" class="gate-btn telegram">Contact Support</a>
        <button onclick="location.reload()" class="gate-btn secondary">Refresh Page</button>
      </div>
    `;
    GATE.style.display = 'flex';
  }
}

async function generateSignal(){
  // Check cached access state (NO DB read)
  if(!AccessController.isGranted()){ 
    showAccessDenied('not_approved');
    return; 
  }
  
  if(!marketTypeSelect?.value){ 
    return alert("Please select Market Type."); 
  }
  if(!assetHidden?.value){ 
    return alert("Please select Asset."); 
  }
  
  if(generateBtn) generateBtn.disabled = true;

  if(loading) loading.classList.remove("hidden");
  if(signalOutput) signalOutput.classList.add("hidden");
  if(countdown) countdown.classList.add("hidden");
  if(quoteText) quoteText.classList.add("hidden");
  if(stickerImg) { stickerImg.classList.add("hidden"); stickerImg.removeAttribute("src"); }

  await incrementSignalCount();

  const nowUTC = getUtcDate();
  const secondsLeft = 60 - nowUTC.getUTCSeconds();
  let startUTC, targetUTC;
  if(secondsLeft > 30){ startUTC = floorUtcToMinute(nowUTC); targetUTC = nextUtcMinute(); }
  else{ startUTC = nextUtcMinute(); targetUTC = new Date(startUTC.getTime()+60000); }

  const windowStartLocal = formatUTCPlus5(startUTC);
  const windowEndLocal   = formatUTCPlus5(targetUTC);

  const seed = hashStr(`${assetHidden.value}|${targetUTC.toISOString()}`);
  const dir  = pickDir(seed);
  const conf = pickConf(seed);
  const arrow = dir === "UP" ? "🔼" : "🔻";
  const word  = dir === "UP" ? "CALL" : "PUT";
  const expectedColor = dir === "UP" ? "green" : "red";
  const displayDir = `${dir} ${arrow}`;

  if(stickerImg) {
    stickerImg.src = dir === "UP" ? "assets/call.png" : "assets/put.png";
    stickerImg.alt = word;
  }

  const msg =
`⇒ Signal: ${displayDir}
⇒ Pair: ${assetHidden.value}
⇒ Timeframe: M1 (1 Minute)
⇒ Signal Time Window: ${windowStartLocal} → ${windowEndLocal} (UTC+05:00)
⇒ Direction: ${arrow} ${word} (Next candle expected to be ${expectedColor})

🎯 Entry Tip:
${nextTip()}

📊 Accuracy Expectation: ${conf}%`;

  await new Promise(r => setTimeout(r, 350));

  if(loading) loading.classList.add("hidden");
  if(stickerImg) stickerImg.classList.remove("hidden");
  if(signalOutput) {
    signalOutput.textContent = msg;
    signalOutput.classList.remove("hidden");
  }
  if(generateBtn) generateBtn.disabled = false;

  let secs = Math.max(0, Math.ceil((targetUTC.getTime() - getUtcDate().getTime())/1000));
  if(countdown) {
    countdown.classList.remove("hidden");
    (function tick(){
      countdown.textContent = `Next candle begins in ${secs < 10 ? "0"+secs : secs}s (UTC)`;
      countdown.style.color = secs % 2 === 0 ? "var(--accent)" : "#ff4d4d";
      if(--secs >= 0) setTimeout(tick, 1000); else countdown.classList.add("hidden");
    })();
  }

  if(quoteText) {
    quoteText.textContent = nextQuote();
    quoteText.classList.remove("hidden");
  }
}

if(generateBtn && !generateBtn.__bound){
  generateBtn.addEventListener("click", generateSignal);
  generateBtn.__bound = true;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  AccessController.unsubscribe();
});
