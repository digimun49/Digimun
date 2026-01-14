import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const GATE_STYLES = `
<style id="access-gate-styles">
.access-gate {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, rgba(5,8,16,0.97) 0%, rgba(10,15,28,0.98) 100%);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 20px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  -webkit-text-size-adjust: 100%;
}

.gate-card {
  width: min(480px, 94vw);
  background: linear-gradient(180deg, rgba(15,22,41,0.95) 0%, rgba(10,15,28,0.98) 100%);
  border: 1px solid rgba(56,189,248,0.15);
  border-radius: 24px;
  padding: clamp(28px, 6vw, 44px);
  text-align: center;
  box-shadow: 0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(56,189,248,0.05);
  position: relative;
  overflow: hidden;
}

.gate-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(34,211,238,0.5), rgba(168,85,247,0.5), transparent);
}

.gate-icon {
  font-size: 64px;
  margin-bottom: 20px;
  display: block;
  filter: drop-shadow(0 0 20px rgba(34,211,238,0.3));
}

.gate-icon.warning { filter: drop-shadow(0 0 20px rgba(251,191,36,0.4)); }
.gate-icon.locked { filter: drop-shadow(0 0 20px rgba(255,51,102,0.3)); }
.gate-icon.suspended { filter: drop-shadow(0 0 25px rgba(239,68,68,0.5)); }

.suspended-title {
  color: #ef4444 !important;
  text-shadow: 0 0 20px rgba(239,68,68,0.3);
}

.suspended-text {
  color: #fca5a5 !important;
}

.suspended-notice {
  display: flex;
  gap: 14px;
  background: linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(185,28,28,0.1) 100%);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 14px;
  padding: 18px;
  margin: 20px 0;
  text-align: left;
}

.suspended-notice-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.suspended-notice-content strong {
  display: block;
  color: #fca5a5;
  font-size: 14px;
  margin-bottom: 6px;
}

.suspended-notice-content p {
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
}

.suspended-footer {
  color: #ef4444 !important;
}

.gate-title {
  font-size: clamp(22px, 5vw, 28px);
  font-weight: 800;
  color: #f1f5f9;
  margin: 0 0 12px;
  letter-spacing: -0.5px;
  line-height: 1.2;
}

.gate-subtitle {
  font-size: clamp(14px, 3vw, 16px);
  color: #94a3b8;
  margin: 0 0 28px;
  line-height: 1.6;
}

.gate-email {
  display: inline-block;
  font-size: 12px;
  color: #64748b;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  padding: 8px 16px;
  border-radius: 999px;
  margin-bottom: 24px;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.gate-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gate-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 24px;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: inherit;
}

.gate-btn.primary {
  background: linear-gradient(135deg, #22d3ee 0%, #3b82f6 50%, #a855f7 100%);
  color: #fff;
  box-shadow: 0 8px 24px rgba(34,211,238,0.25);
}

.gate-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(34,211,238,0.35);
}

.gate-btn.secondary {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.1);
  color: #94a3b8;
}

.gate-btn.secondary:hover {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.15);
  color: #f1f5f9;
}

.gate-btn.telegram {
  background: linear-gradient(135deg, #0088cc, #00a2e8);
  color: #fff;
  box-shadow: 0 8px 24px rgba(0,136,204,0.25);
}

.gate-btn.whatsapp-disabled {
  background: rgba(100, 100, 100, 0.2);
  border: 1px solid rgba(100, 100, 100, 0.3);
  color: #6b7280;
  cursor: not-allowed;
  opacity: 0.6;
}

.gate-wa-notice {
  font-size: 11px;
  color: #f59e0b;
  text-align: center;
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(245, 158, 11, 0.1);
  border-radius: 8px;
  line-height: 1.4;
}

.gate-tutorial-link {
  font-size: 12px;
  color: #60a5fa;
  text-align: center;
  margin-top: 8px;
}

.gate-tutorial-link a {
  color: #60a5fa;
  text-decoration: underline;
}

.gate-btn.gold {
  background: linear-gradient(135deg, #fbbf24, #d97706);
  color: #000;
  box-shadow: 0 8px 24px rgba(251,191,36,0.3);
}

.gate-divider {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 16px 0;
  color: #475569;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.gate-divider::before,
.gate-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
}

.gate-footer {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid rgba(255,255,255,0.05);
}

.gate-footer-text {
  font-size: 12px;
  color: #64748b;
  margin: 0;
}

.gate-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.gate-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(34,211,238,0.15);
  border-top-color: #22d3ee;
  border-radius: 50%;
  animation: gateSpin 0.8s linear infinite;
}

@keyframes gateSpin {
  to { transform: rotate(360deg); }
}

.gate-loading-text {
  font-size: 14px;
  color: #94a3b8;
  font-weight: 500;
}

@media (max-width: 480px) {
  .gate-card { padding: 24px 20px; }
  .gate-icon { font-size: 52px; }
  .gate-actions { gap: 10px; }
  .gate-btn { padding: 14px 20px; font-size: 14px; }
}
</style>
`;

const SCREENS = {
  loading: () => `
    <div class="gate-loading">
      <div class="gate-spinner"></div>
      <div class="gate-loading-text">Verifying Access...</div>
    </div>
  `,

  notLoggedIn: (toolName) => `
    <span class="gate-icon locked">🔒</span>
    <h2 class="gate-title">Premium Access Required</h2>
    <p class="gate-subtitle">
      ${toolName} is available exclusively for registered Digimun Pro members. 
      Please login or create an account to continue.
    </p>
    <div class="gate-actions">
      <a href="login" class="gate-btn primary">Login to Continue</a>
      <a href="signup" class="gate-btn secondary">Create Free Account</a>
    </div>
    <div class="gate-footer">
      <p class="gate-footer-text">Need help? Contact support via Telegram</p>
    </div>
  `,

  pendingApproval: (email, toolName) => `
    <span class="gate-icon warning">⏳</span>
    <h2 class="gate-title">Approval Pending</h2>
    <p class="gate-subtitle">
      Your account is currently under review. You will gain access to ${toolName} 
      once admin approval is completed. This usually takes 1-24 hours.
    </p>
    <div class="gate-email">${email}</div>
    <div class="gate-actions">
      <a href="https://t.me/digimun49" target="_blank" rel="noopener" class="gate-btn telegram">
        <span>📱</span> Contact Support on Telegram
      </a>
      <a href="help" class="gate-btn secondary">
        <span>🎫</span> Create Support Ticket
      </a>
    </div>
    <div class="gate-divider">or</div>
    <div class="gate-actions">
      <a href="chooseAccountType" class="gate-btn secondary">View Account Status</a>
      <button onclick="window.__gateSignOut()" class="gate-btn secondary">Sign Out</button>
    </div>
  `,

  paymentRequired: (email, toolName, detailsPage) => `
    <span class="gate-icon locked">🔐</span>
    <h2 class="gate-title">Premium Tool Locked</h2>
    <p class="gate-subtitle">
      ${toolName} is a premium Digimun Pro tool. Choose how you want to unlock full access 
      to this powerful trading system.
    </p>
    <div class="gate-email">${email}</div>
    <div class="gate-actions">
      ${detailsPage ? `<a href="${detailsPage}" class="gate-btn primary">View ${toolName} Details</a>` : ''}
      <a href="chooseAccountType" class="gate-btn gold">
        <span>💳</span> Go to Payment Portal
      </a>
      <a href="https://t.me/digimun49" target="_blank" rel="noopener" class="gate-btn telegram">
        <span>📱</span> Contact Support
      </a>
    </div>
    <div class="gate-divider">need help?</div>
    <div class="gate-actions">
      <a href="help" class="gate-btn secondary">
        <span>🎫</span> Create Support Ticket
      </a>
      <button onclick="window.__gateSignOut()" class="gate-btn secondary">Sign Out</button>
    </div>
  `,

  accessDenied: (email, reason) => `
    <span class="gate-icon locked">⛔</span>
    <h2 class="gate-title">Access Denied</h2>
    <p class="gate-subtitle">
      ${reason || 'Your account does not have permission to access this tool. Please contact support for assistance.'}
    </p>
    <div class="gate-email">${email}</div>
    <div class="gate-actions">
      <a href="https://t.me/digimun49" target="_blank" rel="noopener" class="gate-btn telegram">
        <span>📱</span> Contact Admin on Telegram
      </a>
      <button onclick="window.__gateSignOut()" class="gate-btn secondary">Sign Out</button>
    </div>
  `,

  accountSuspended: (email) => `
    <span class="gate-icon suspended">🚫</span>
    <h2 class="gate-title suspended-title">Account Suspended</h2>
    <p class="gate-subtitle suspended-text">
      Your account has been temporarily suspended by our administration team. 
      This action may have been taken due to a policy violation or account review.
    </p>
    <div class="gate-email">${email}</div>
    <div class="suspended-notice">
      <div class="suspended-notice-icon">⚠️</div>
      <div class="suspended-notice-content">
        <strong>What can you do?</strong>
        <p>If you believe this was a mistake or would like to understand the reason for this suspension, please contact our support team. We're here to help resolve any issues.</p>
      </div>
    </div>
    <div class="gate-actions">
      <a href="https://t.me/digimun49" target="_blank" rel="noopener" class="gate-btn telegram">
        <span>📱</span> Contact Support on Telegram
      </a>
      <button onclick="window.__gateSignOut()" class="gate-btn secondary">Sign Out</button>
    </div>
    <div class="gate-footer">
      <p class="gate-footer-text suspended-footer">Reference: ${email} | Please mention your email when contacting support</p>
    </div>
  `,

  error: (message) => `
    <span class="gate-icon locked">⚠️</span>
    <h2 class="gate-title">Something Went Wrong</h2>
    <p class="gate-subtitle">${message || 'Unable to verify your access. Please try again or contact support.'}</p>
    <div class="gate-actions">
      <button onclick="location.reload()" class="gate-btn primary">Try Again</button>
      <a href="login" class="gate-btn secondary">Back to Login</a>
    </div>
  `
};

function injectStyles() {
  if (!document.getElementById('access-gate-styles')) {
    document.head.insertAdjacentHTML('beforeend', GATE_STYLES);
  }
}

function createGateElement() {
  let gate = document.getElementById('access-gate');
  if (!gate) {
    gate = document.createElement('div');
    gate.id = 'access-gate';
    gate.className = 'access-gate';
    document.body.insertBefore(gate, document.body.firstChild);
  }
  return gate;
}

function showScreen(gate, screenHtml) {
  gate.innerHTML = `<div class="gate-card">${screenHtml}</div>`;
}

function removeGate() {
  const gate = document.getElementById('access-gate');
  if (gate) {
    gate.style.opacity = '0';
    gate.style.transition = 'opacity 0.3s ease-out';
    setTimeout(() => gate.remove(), 300);
  }
}

window.__gateSignOut = async function() {
  try {
    await signOut(auth);
    window.location.href = '/login';
  } catch (e) {
    console.error('Sign out error:', e);
    window.location.href = '/login';
  }
};

export function initAccessGate(config = {}) {
  const {
    toolName = 'This Tool',
    requiredField = 'paymentStatus',
    requiredValue = 'approved',
    detailsPage = null,
    onApproved = null,
    appElementId = null
  } = config;

  injectStyles();
  const gate = createGateElement();
  showScreen(gate, SCREENS.loading());

  if (appElementId) {
    const appEl = document.getElementById(appElementId);
    if (appEl) appEl.style.display = 'none';
  }

  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        showScreen(gate, SCREENS.notLoggedIn(toolName));
        return;
      }

      const userDocRef = doc(db, "users", user.email);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        showScreen(gate, SCREENS.notLoggedIn(toolName));
        return;
      }

      const userData = userSnap.data();
      const status = String(userData[requiredField] || '').toLowerCase();
      const generalStatus = String(userData.status || '').toLowerCase();

      if (generalStatus === 'suspended' || generalStatus === 'banned') {
        showScreen(gate, SCREENS.accountSuspended(user.email));
        return;
      }

      if (generalStatus === 'pending') {
        showScreen(gate, SCREENS.accountSuspended(user.email));
        return;
      }

      if (status === requiredValue || status === 'approved' || status === 'active') {
        removeGate();
        if (appElementId) {
          const appEl = document.getElementById(appElementId);
          if (appEl) appEl.style.display = '';
        }
        if (onApproved && typeof onApproved === 'function') {
          onApproved(user, userData);
        }
        return;
      }

      if (status === 'pending' || generalStatus === 'pending') {
        showScreen(gate, SCREENS.pendingApproval(user.email, toolName));
        return;
      }

      showScreen(gate, SCREENS.paymentRequired(user.email, toolName, detailsPage));

    } catch (error) {
      console.error('Access gate error:', error);
      showScreen(gate, SCREENS.error('Failed to verify access. Please refresh the page or try again later.'));
    }
  });
}

export { SCREENS, showScreen, removeGate, createGateElement, injectStyles };
