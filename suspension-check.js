import { auth, signOut } from "./platform.js";
import { onProfileChange } from "./auth-profile.js";

const CRITICAL_PAGES = [
  'signal', 'digimaxx', 'digimunx-ai',
  'digimax', 'affiliate', 'free',
  'iq-option', 'exnova'
];

const CACHE_KEY = 'dg_suspension_cache';
const CACHE_DURATION_MS = 5 * 60 * 1000;

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

function ensureSuspensionStylesheet() {
  if (!document.getElementById('suspension-overlay-styles')) {
    const link = document.createElement('link');
    link.id = 'suspension-overlay-styles';
    link.rel = 'stylesheet';
    link.href = '/suspension-overlay.css';
    document.head.appendChild(link);
  }
}

function injectStyles() {
  ensureSuspensionStylesheet();
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
      localStorage.removeItem('userEmail');
      localStorage.removeItem('digimunCurrentUserEmail');
      await signOut(auth);
      window.location.href = '/login';
    } catch (e) {
      console.error('Logout error:', e);
      window.location.href = '/login';
    }
  });
}

async function forceLogoutSuspendedUser(user) {
  try {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('digimunCurrentUserEmail');
    await signOut(auth);
  } catch (e) {
    console.error('Force logout error:', e);
  }
  showSuspensionScreen(user.email);
}

let _suspensionShown = false;

export function initSuspensionCheck() {
  onProfileChange((profile) => {
    if (!profile.isLoggedIn || !profile.email) {
      _suspensionShown = false;
      return;
    }

    if (profile.isSuspended && !_suspensionShown) {
      _suspensionShown = true;
      forceLogoutSuspendedUser(profile.user);
    }
  });
}

initSuspensionCheck();
