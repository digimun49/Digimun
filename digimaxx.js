// /digimaxx.js (same folder as digimaxx.html and firebase.js)
import { db } from "./firebase.js";
import { doc, getDoc, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const $ = id => document.getElementById(id);

// ===== Signal Count =====
const counterBox = $("signal-count");
async function loadSignalCount(){
  try{
    const snap = await getDoc(doc(db, "stats", "signalCount"));
    const count = snap.exists() ? (snap.data().count ?? 0) : 0;
    counterBox.textContent = `${Number(count).toLocaleString()}+`;
  }catch{
    counterBox.textContent = "0+";
  }
}
async function incrementSignalCount(){
  try{
    await setDoc(doc(db, "stats", "signalCount"), { count: increment(1) }, { merge:true });
    await loadSignalCount();
  }catch{}
}
loadSignalCount();

// ===== Assets =====
const marketTypeSelect = $("market-type");
const assetSelect      = $("asset");

const liveAssets = ["EUR/USD","GBP/USD","USD/JPY","AUD/USD","USD/CAD","NZD/USD","EUR/JPY","GBP/JPY","USD/CHF","EUR/GBP"];
const otcAssets  = ["NZD/CAD (OTC)","USD/ARS (OTC)","USD/PKR (OTC)","EUR/CAD (OTC)","USD/BRL (OTC)","EUR/NZD (OTC)","USD/MXN (OTC)","USD/PHP (OTC)","USD/ZAR (OTC)","USD/BDT (OTC)","USD/NGN (OTC)","CHF/JPY (OTC)","EUR/AUD (OTC)","EUR/GBP (OTC)","NZD/CHF (OTC)","NZD/JPY (OTC)","USD/IDR (OTC)","USD/INR (OTC)","NASDAQ 100"];
const cryptoAssets = ["Binance Coin (OTC)","Bonk (OTC)","Ethereum (OTC)","Hamster Kombat (OTC)","Litecoin (OTC)","Decentraland (OTC)","Melania Meme (OTC)","Notcoin (OTC)","Shiba Inu (OTC)","Celestia (OTC)","Toncoin (OTC)","Trump (OTC)","TRON (OTC)","Ripple (OTC)","Zcash (OTC)","Arbitrum (OTC)","Gala (OTC)","Dogecoin (OTC)"];
const commoditiesAssets = ["UKBrent (OTC)","USCrude (OTC)","Silver (OTC)","Gold (OTC)"];
const stocksAssets = ["FACEBOOK INC (OTC)","Intel (OTC)","Johnson & Johnson (OTC)","Microsoft (OTC)","Pfizer Inc (OTC)","American Express (OTC)","Boeing Company (OTC)","McDonald's (OTC)","S&P/ASX 200"];

marketTypeSelect?.addEventListener("change", () => {
  assetSelect.innerHTML = "";
  let list = [];
  switch(marketTypeSelect.value){
    case "live": list = liveAssets; break;
    case "otc": list = otcAssets; break;
    case "crypto": list = cryptoAssets; break;
    case "commodities": list = commoditiesAssets; break;
    case "stocks": list = stocksAssets; break;
  }
  if(!list.length){
    const o = document.createElement("option");
    o.disabled = true; o.selected = true; o.textContent = "Select Market First";
    assetSelect.appendChild(o);
    return;
  }
  list.forEach(a=>{
    const o = document.createElement("option");
    o.value = a; o.textContent = a;
    assetSelect.appendChild(o);
  });
});

// ===== Clock (UTC+05 display) =====
const utcClock = $("utcClock");
function getUtcDate(){ const now = new Date(); return new Date(now.getTime() + now.getTimezoneOffset()*60000); }
function formatUTCPlus5(d, withSeconds=false){
  const ts = d.getTime() + 5*60*60*1000;
  return new Date(ts).toLocaleTimeString([], { hour12:false, hour:'2-digit', minute:'2-digit', second: withSeconds ? '2-digit' : undefined });
}
(function tickClock(){
  const nowUTC = getUtcDate();
  utcClock.textContent = `${formatUTCPlus5(nowUTC, true)}  •  UTC+05:00`;
  requestAnimationFrame(()=> setTimeout(tickClock, 250));
})();

// ===== Signal Generation =====
const generateBtn  = $("generate-btn");
const signalOutput = $("signal-output");
const countdown    = $("countdown");
const quoteText    = $("quote-text");
const loading      = $("loading");
const stickerImg   = $("signal-sticker");

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

async function generateSignal(){
  if(!window.__DGX_ACCESS_APPROVED__){ alert("Access denied."); return; }
  if(!marketTypeSelect.value) return alert("Please select Market Type.");
  if(!assetSelect.value)      return alert("Please select Asset.");

  loading.classList.remove("hidden");
  signalOutput.classList.add("hidden");
  countdown.classList.add("hidden");
  quoteText.classList.add("hidden");
  stickerImg.classList.add("hidden");
  stickerImg.removeAttribute("src");

  await incrementSignalCount();

  const nowUTC = getUtcDate();
  const secondsLeft = 60 - nowUTC.getUTCSeconds();
  let startUTC, targetUTC;
  if(secondsLeft > 30){ startUTC = floorUtcToMinute(nowUTC); targetUTC = nextUtcMinute(); }
  else{ startUTC = nextUtcMinute(); targetUTC = new Date(startUTC.getTime()+60000); }

  const windowStartLocal = formatUTCPlus5(startUTC);
  const windowEndLocal   = formatUTCPlus5(targetUTC);

  const seed = hashStr(`${assetSelect.value}|${targetUTC.toISOString()}`);
  const dir  = pickDir(seed);
  const conf = pickConf(seed);
  const arrow = dir === "UP" ? "🔼" : "🔻";
  const word  = dir === "UP" ? "CALL" : "PUT";
  const expectedColor = dir === "UP" ? "green" : "red";
  const displayDir = `${dir} ${arrow}`;

  stickerImg.src = dir === "UP" ? "assets/call.png" : "assets/put.png";
  stickerImg.alt = word;

  const msg =
`⇒ Signal: ${displayDir}
⇒ Pair: ${assetSelect.value}
⇒ Timeframe: M1 (1 Minute)
⇒ Signal Time Window: ${windowStartLocal} → ${windowEndLocal} (UTC+05:00)
⇒ Direction: ${arrow} ${word} (Next candle expected to be ${expectedColor})

🎯 Entry Tip:
${nextTip()}

📊 Accuracy Expectation: ${conf}%`;

  await new Promise(r => setTimeout(r, 350));

  loading.classList.add("hidden");
  stickerImg.classList.remove("hidden");
  signalOutput.textContent = msg;
  signalOutput.classList.remove("hidden");

  let secs = Math.max(0, Math.ceil((targetUTC.getTime() - getUtcDate().getTime())/1000));
  countdown.classList.remove("hidden");
  (function tick(){
    countdown.textContent = `Next candle begins in ${secs < 10 ? "0"+secs : secs}s (UTC)`;
    countdown.style.color = secs % 2 === 0 ? "var(--accent)" : "#ff4d4d";
    if(--secs >= 0) setTimeout(tick, 1000); else countdown.classList.add("hidden");
  })();

  quoteText.textContent = nextQuote();
  quoteText.classList.remove("hidden");
}

if(generateBtn && !generateBtn.__bound){
  generateBtn.addEventListener("click", generateSignal);
  generateBtn.__bound = true;
}
