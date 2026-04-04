import { auth, db, signOut } from "./platform.js";
import { onProfileChange } from "./auth-profile.js";

function ensureGateStylesheet() {
  if (!document.getElementById('access-gate-styles')) {
    const link = document.createElement('link');
    link.id = 'access-gate-styles';
    link.rel = 'stylesheet';
    link.href = '/access-gate.css';
    document.head.appendChild(link);
  }
}

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
      <a href="dashboard" class="gate-btn secondary">View Account Status</a>
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
      <a href="dashboard" class="gate-btn gold">
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
  ensureGateStylesheet();
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

  onProfileChange((profile) => {
    try {
      if (!profile.isLoggedIn) {
        showScreen(gate, SCREENS.notLoggedIn(toolName));
        return;
      }

      const userData = profile.userData;
      const email = profile.email;

      if (!userData) {
        showScreen(gate, SCREENS.notLoggedIn(toolName));
        return;
      }

      const status = String(userData[requiredField] || '').toLowerCase();
      const generalStatus = String(userData.status || '').toLowerCase();

      if (generalStatus === 'suspended' || generalStatus === 'banned') {
        showScreen(gate, SCREENS.accountSuspended(email));
        return;
      }

      if (generalStatus === 'pending') {
        showScreen(gate, SCREENS.accountSuspended(email));
        return;
      }

      if (status === requiredValue || status === 'approved' || status === 'active') {
        removeGate();
        if (appElementId) {
          const appEl = document.getElementById(appElementId);
          if (appEl) appEl.style.display = '';
        }
        if (onApproved && typeof onApproved === 'function') {
          onApproved(profile.user, userData);
        }
        return;
      }

      if (status === 'pending' || generalStatus === 'pending') {
        showScreen(gate, SCREENS.pendingApproval(email, toolName));
        return;
      }

      showScreen(gate, SCREENS.paymentRequired(email, toolName, detailsPage));

    } catch (error) {
      console.error('Access gate error:', error);
      showScreen(gate, SCREENS.error('Failed to verify access. Please refresh the page or try again later.'));
    }
  });
}

export { SCREENS, showScreen, removeGate, createGateElement, injectStyles };
