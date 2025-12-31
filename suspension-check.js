import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const SUSPENDED_STATUSES = ['pending', 'suspended', 'banned'];
const CACHE_KEY = 'digimun_status_cache';
const CACHE_DURATION_MS = 3 * 60 * 1000;

const CRITICAL_PAGES = [
  'signal.html', 'digimaxx.html', 'future-signals.html', 
  'digimax.html', 'affiliate.html', 'free.html',
  'iq-option.html', 'exnova.html', 'digimunx-ai.html'
];

function isCriticalPage() {
  const path = window.location.pathname.toLowerCase();
  return CRITICAL_PAGES.some(page => path.includes(page));
}

function getCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (Date.now() - cache.timestamp > CACHE_DURATION_MS) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cache;
  } catch {
    return null;
  }
}

function setCache(email, status, isSuspended) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      email,
      status,
      isSuspended,
      timestamp: Date.now()
    }));
  } catch {}
}

function clearCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {}
}

const SUSPENSION_OVERLAY_STYLES = `
<style id="suspension-overlay-styles">
.suspension-overlay {
  position: fixed;
  inset: 0;
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, rgba(8,10,18,0.98) 0%, rgba(12,8,8,0.99) 100%);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  padding: 16px;
  font-family: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.suspension-card {
  width: 100%;
  max-width: 420px;
  background: linear-gradient(180deg, rgba(18,12,12,0.97) 0%, rgba(14,10,10,0.99) 100%);
  border: 1.5px solid rgba(239,68,68,0.35);
  border-radius: 20px;
  padding: 32px 24px;
  text-align: center;
  box-shadow: 
    0 25px 60px rgba(0,0,0,0.5), 
    0 0 100px rgba(239,68,68,0.08),
    inset 0 1px 0 rgba(255,255,255,0.03);
  position: relative;
  margin: auto;
}

.suspension-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, #ef4444, #dc2626, #ef4444, transparent);
  border-radius: 20px 20px 0 0;
}

.suspension-icon-wrap {
  width: 80px;
  height: 80px;
  margin: 0 auto 20px;
  background: linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(185,28,28,0.1) 100%);
  border: 2px solid rgba(239,68,68,0.25);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pulse-glow 2.5s ease-in-out infinite;
}

.suspension-icon-wrap svg {
  width: 40px;
  height: 40px;
  stroke: #ef4444;
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@keyframes pulse-glow {
  0%, 100% { 
    box-shadow: 0 0 20px rgba(239,68,68,0.2);
    transform: scale(1);
  }
  50% { 
    box-shadow: 0 0 35px rgba(239,68,68,0.35);
    transform: scale(1.02);
  }
}

.suspension-title {
  font-size: 24px;
  font-weight: 700;
  color: #ef4444;
  margin: 0 0 12px;
  letter-spacing: -0.3px;
}

.suspension-subtitle {
  font-size: 15px;
  color: rgba(255,255,255,0.7);
  margin: 0 0 20px;
  line-height: 1.6;
}

.suspension-email {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(255,255,255,0.6);
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  padding: 10px 18px;
  border-radius: 100px;
  margin-bottom: 20px;
  font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
  word-break: break-all;
  max-width: 100%;
}

.suspension-email svg {
  width: 14px;
  height: 14px;
  stroke: rgba(255,255,255,0.5);
  fill: none;
  flex-shrink: 0;
}

.suspension-info-box {
  background: linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(185,28,28,0.05) 100%);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 16px;
  text-align: left;
}

.suspension-info-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.suspension-info-header svg {
  width: 18px;
  height: 18px;
  stroke: #fbbf24;
  fill: none;
  flex-shrink: 0;
}

.suspension-info-header span {
  font-size: 14px;
  font-weight: 600;
  color: #fca5a5;
}

.suspension-info-text {
  font-size: 13px;
  color: rgba(255,255,255,0.6);
  line-height: 1.55;
  margin: 0;
}

.suspension-warning-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(251,191,36,0.08);
  border: 1px solid rgba(251,191,36,0.2);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 20px;
}

.suspension-warning-banner svg {
  width: 16px;
  height: 16px;
  stroke: #fbbf24;
  fill: none;
  flex-shrink: 0;
}

.suspension-warning-banner span {
  font-size: 12px;
  color: #fbbf24;
  font-weight: 500;
  line-height: 1.4;
}

.suspension-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.suspension-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 20px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  text-decoration: none;
  transition: all 0.25s ease;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}

.suspension-btn svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.suspension-btn.telegram {
  background: linear-gradient(135deg, #0088cc 0%, #00a0dc 100%);
  color: #fff;
  box-shadow: 0 4px 16px rgba(0,136,204,0.3);
}

.suspension-btn.telegram svg {
  stroke: #fff;
  fill: none;
}

.suspension-btn.telegram:hover,
.suspension-btn.telegram:active {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(0,136,204,0.4);
}

.suspension-btn.logout {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(239,68,68,0.25);
  color: #ef4444;
}

.suspension-btn.logout svg {
  stroke: #ef4444;
  fill: none;
}

.suspension-btn.logout:hover,
.suspension-btn.logout:active {
  background: rgba(239,68,68,0.1);
  border-color: rgba(239,68,68,0.4);
}

.suspension-footer {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.06);
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  line-height: 1.5;
}

.suspension-footer strong {
  color: rgba(255,255,255,0.5);
}

@media (max-width: 480px) {
  .suspension-overlay {
    padding: 12px;
    align-items: flex-start;
    padding-top: 40px;
  }
  
  .suspension-card {
    padding: 28px 20px;
    border-radius: 18px;
  }
  
  .suspension-icon-wrap {
    width: 70px;
    height: 70px;
    margin-bottom: 16px;
  }
  
  .suspension-icon-wrap svg {
    width: 34px;
    height: 34px;
  }
  
  .suspension-title {
    font-size: 22px;
  }
  
  .suspension-subtitle {
    font-size: 14px;
  }
  
  .suspension-email {
    font-size: 12px;
    padding: 8px 14px;
  }
  
  .suspension-btn {
    padding: 13px 18px;
    font-size: 13px;
  }
  
  .suspension-info-box {
    padding: 14px;
  }
  
  .suspension-info-header span {
    font-size: 13px;
  }
  
  .suspension-info-text {
    font-size: 12px;
  }
}

@media (max-width: 360px) {
  .suspension-card {
    padding: 24px 16px;
  }
  
  .suspension-title {
    font-size: 20px;
  }
  
  .suspension-warning-banner {
    flex-direction: column;
    gap: 6px;
    text-align: center;
  }
}

@media (min-width: 768px) {
  .suspension-card {
    max-width: 440px;
    padding: 40px 36px;
    border-radius: 24px;
  }
  
  .suspension-icon-wrap {
    width: 90px;
    height: 90px;
  }
  
  .suspension-icon-wrap svg {
    width: 46px;
    height: 46px;
  }
  
  .suspension-title {
    font-size: 28px;
  }
  
  .suspension-subtitle {
    font-size: 16px;
  }
}
</style>
`;

function injectStyles() {
  if (!document.getElementById('suspension-overlay-styles')) {
    document.head.insertAdjacentHTML('beforeend', SUSPENSION_OVERLAY_STYLES);
  }
}

function showSuspensionScreen(email) {
  injectStyles();
  
  document.body.style.overflow = 'hidden';
  
  const overlay = document.createElement('div');
  overlay.id = 'suspension-overlay';
  overlay.className = 'suspension-overlay';
  
  const encodedMessage = encodeURIComponent(
    `Hello Digimun Support Team,

My account has been suspended and I need assistance.

Account Email: ${email}

I would like to understand the reason for this suspension and request help to resolve this issue.

Thank you.`
  );
  const telegramLink = `https://t.me/digimun49?text=${encodedMessage}`;
  
  overlay.innerHTML = `
    <div class="suspension-card">
      <div class="suspension-icon-wrap">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
        </svg>
      </div>
      
      <h2 class="suspension-title">Account Suspended</h2>
      <p class="suspension-subtitle">
        Your account has been temporarily suspended. You cannot access any bots or features with this email.
      </p>
      
      <div class="suspension-email">
        <svg viewBox="0 0 24 24">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
        ${email}
      </div>
      
      <div class="suspension-info-box">
        <div class="suspension-info-header">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <span>What can you do?</span>
        </div>
        <p class="suspension-info-text">
          If you believe this was a mistake or would like to understand the reason, please contact our support team. We're here to help resolve any issues.
        </p>
      </div>
      
      <div class="suspension-warning-banner">
        <svg viewBox="0 0 24 24">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <span>BEWARE OF SCAMMERS - Only @digimun49 is our official Telegram!</span>
      </div>
      
      <div class="suspension-actions">
        <a href="${telegramLink}" target="_blank" rel="noopener" class="suspension-btn telegram">
          <svg viewBox="0 0 24 24">
            <path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-8.609 3.33c-2.068.8-4.133 1.598-5.724 2.21a405.15 405.15 0 0 1-2.849 1.09c-.42.147-.99.332-1.473.901-.728.855.066 1.747.462 2.018.968.660 2.098 1.026 3.205 1.573.22.112.452.224.686.333.153.71.186 1.456.219 2.188.023.512.045 1.002.12 1.449.017.1.055.299.143.525.094.242.259.54.564.789.306.249.705.394 1.067.384.302-.01.562-.116.745-.21.162-.082.334-.181.472-.266.127-.078.248-.153.355-.221l-.002-.001 3.07 2.268a.74.74 0 0 0 .045.029c.196.124.564.378.963.378.277 0 .524-.104.711-.229.18-.121.316-.273.41-.384a2.2 2.2 0 0 0 .242-.36c.027-.05.081-.141.149-.271.068-.13.155-.302.26-.508.166-.326.392-.772.641-1.287.496-1.028 1.092-2.335 1.596-3.538.246-.588.472-1.146.655-1.641.192-.52.339-.974.395-1.318.08-.504.037-.952-.196-1.299l.012.005c-.154-.259-.375-.476-.588-.654l5.605-3.205c.35-.199.718-.516.87-.88.167-.402.083-.768-.014-1.052a2.117 2.117 0 0 0-.543-.863 2.164 2.164 0 0 0-.812-.521z"/>
          </svg>
          Contact Support on Telegram
        </a>
        <button id="suspension-logout-btn" class="suspension-btn logout">
          <svg viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          Sign Out
        </button>
      </div>
      
      <div class="suspension-footer">
        <strong>Reference:</strong> ${email}<br>
        Please mention your email when contacting support
      </div>
    </div>
  `;
  
  document.body.insertBefore(overlay, document.body.firstChild);
  
  document.getElementById('suspension-logout-btn').addEventListener('click', async () => {
    try {
      clearCache();
      await signOut(auth);
      localStorage.removeItem('userEmail');
      localStorage.removeItem('digimunCurrentUserEmail');
      window.location.href = 'login.html';
    } catch (e) {
      console.error('Logout error:', e);
      window.location.href = 'login.html';
    }
  });
}

async function forceLogoutSuspendedUser(user) {
  try {
    clearCache();
    await signOut(auth);
    localStorage.removeItem('userEmail');
    localStorage.removeItem('digimunCurrentUserEmail');
  } catch (e) {
    console.error('Force logout error:', e);
  }
  showSuspensionScreen(user.email);
}

export function initSuspensionCheck() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      clearCache();
      return;
    }
    
    const userEmail = user.email;
    const isCritical = isCriticalPage();
    
    const cache = getCache();
    if (cache && cache.email === userEmail && !isCritical) {
      if (cache.isSuspended) {
        console.log('SUSPENSION CHECK: Using cache - account is suspended');
        await forceLogoutSuspendedUser(user);
      }
      return;
    }
    
    try {
      const userDocRef = doc(db, "users", userEmail);
      const userSnap = await getDoc(userDocRef);
      
      if (!userSnap.exists()) {
        setCache(userEmail, 'unknown', false);
        return;
      }
      
      const userData = userSnap.data();
      const status = String(userData.status || '').toLowerCase().trim();
      const isSuspended = SUSPENDED_STATUSES.includes(status);
      
      setCache(userEmail, status, isSuspended);
      
      if (isSuspended) {
        console.log('SUSPENSION CHECK: Account is suspended, forcing logout');
        await forceLogoutSuspendedUser(user);
      }
    } catch (error) {
      console.error('Suspension check error:', error);
      if (isCritical) {
        showSuspensionScreen(userEmail);
      }
    }
  });
}

initSuspensionCheck();
