import { auth, db } from "./firebase.js";
import { onAuthStateChanged, sendEmailVerification, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

window.handleLogout = async function() {
  try {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('digimunCurrentUserEmail');
    await signOut(auth);
    window.location.href = '/';
  } catch (error) {
    console.error('Logout error:', error);
    alert('Error logging out. Please try again.');
  }
};

const BADGE_STATE = {
  isLoggedIn: false,
  isPremium: false,
  userEmail: null,
  userData: null,
  sidebarLoaded: false,
  authResolved: false
};

function createBadgeElement(type, tooltipText = null) {
  const badge = document.createElement('span');
  badge.className = `digimun-badge digimun-badge-${type}`;
  
  if (type === 'user') {
    badge.innerHTML = `
      <span class="badge-icon">&#10003;</span>
      <span class="badge-text">Digimun User</span>
    `;
    if (tooltipText) {
      badge.setAttribute('data-tooltip', tooltipText);
    }
  } else if (type === 'premium') {
    badge.innerHTML = `
      <span class="badge-icon">&#9733;</span>
      <span class="badge-text">VIP Member</span>
    `;
    if (tooltipText) {
      badge.setAttribute('data-tooltip', tooltipText);
    }
  }
  
  return badge;
}

function getUserBadgeHTML(type, tooltip = null) {
  const tooltipAttr = tooltip ? `data-tooltip="${tooltip}"` : '';
  
  if (type === 'user') {
    return `<span class="digimun-badge digimun-badge-user" ${tooltipAttr}>
      <span class="badge-icon">&#10003;</span>
      <span class="badge-text">Digimun User</span>
    </span>`;
  } else if (type === 'premium') {
    return `<span class="digimun-badge digimun-badge-premium" ${tooltipAttr}>
      <span class="badge-icon">&#9733;</span>
      <span class="badge-text">VIP Member</span>
    </span>`;
  }
  return '';
}

function checkPremiumStatus(userData) {
  if (!userData) return false;
  
  const paymentStatus = String(userData.paymentStatus || '').toLowerCase();
  const quotexStatus = String(userData.quotexStatus || '').toLowerCase();
  const recoveryRequest = String(userData.recoveryRequest || '').toLowerCase();
  const digimaxStatus = String(userData.digimaxStatus || '').toLowerCase();
  
  const hasPaymentApproved = paymentStatus === 'approved';
  const hasQuotexApproved = quotexStatus === 'approved';
  const hasRecoveryApproved = recoveryRequest === 'approved' || recoveryRequest === 'active';
  const hasDigimaxApproved = digimaxStatus === 'approved' || digimaxStatus === 'active';
  
  return hasPaymentApproved || hasQuotexApproved || hasRecoveryApproved || hasDigimaxApproved;
}

function updateSidebarBadges() {
  const userSection = document.querySelector('.sidebar-user-section');
  const userInfo = document.querySelector('.sidebar-user-info');
  const userStatus = document.querySelector('.sidebar-user-status');
  const upgradeHint = document.querySelector('.upgrade-hint');
  
  if (!BADGE_STATE.isLoggedIn) {
    return;
  }
  
  if (userStatus) {
    userStatus.style.display = 'none';
  }
  
  let badgeContainer = document.querySelector('.sidebar-badge-container');
  if (!badgeContainer && userInfo) {
    badgeContainer = document.createElement('div');
    badgeContainer.className = 'sidebar-badge-container';
    userInfo.appendChild(badgeContainer);
  }
  
  if (badgeContainer) {
    badgeContainer.innerHTML = '';
    
    if (BADGE_STATE.isPremium) {
      badgeContainer.innerHTML = getUserBadgeHTML('premium', 'Premium members unlock advanced benefits');
    } else {
      badgeContainer.innerHTML = getUserBadgeHTML('user', 'Registered Digimun member');
    }
  }
  
  if (upgradeHint) {
    if (BADGE_STATE.isLoggedIn && !BADGE_STATE.isPremium) {
      upgradeHint.classList.add('visible');
    } else {
      upgradeHint.classList.remove('visible');
    }
  }
}

function updateNavbarBadges() {
  const navUserBadge = document.querySelector('.nav-user-badge');
  
  if (navUserBadge && BADGE_STATE.isLoggedIn) {
    navUserBadge.classList.add('visible');
    
    if (BADGE_STATE.isPremium) {
      navUserBadge.innerHTML = getUserBadgeHTML('premium');
    } else {
      navUserBadge.innerHTML = getUserBadgeHTML('user');
    }
  }
}

function updateBadgeTeasers() {
  const badgeTeasers = document.querySelectorAll('.badge-teaser');
  
  badgeTeasers.forEach(teaser => {
    if (!BADGE_STATE.isLoggedIn) {
      teaser.classList.add('visible');
    } else {
      teaser.classList.remove('visible');
    }
  });
}

function updateSidebarAuthState() {
  const userItems = document.querySelectorAll('.sidebar-user-item');
  const guestItems = document.querySelectorAll('.sidebar-guest-item');
  
  if (BADGE_STATE.isLoggedIn) {
    userItems.forEach(el => el.style.display = '');
    guestItems.forEach(el => el.style.display = 'none');
  } else {
    userItems.forEach(el => el.style.display = 'none');
    guestItems.forEach(el => el.style.display = '');
  }
}

function showRegistrationSuccessModal() {
  if (document.querySelector('.registration-modal-overlay')) return;
  
  const overlay = document.createElement('div');
  overlay.className = 'registration-modal-overlay';
  overlay.innerHTML = `
    <div class="registration-modal">
      <div class="registration-modal-icon">&#127881;</div>
      <h2>Registration Successful!</h2>
      <p>Welcome to Digimun Pro! You've officially joined our trading community.</p>
      <div class="earned-badge">
        ${getUserBadgeHTML('user')}
      </div>
      <p style="font-size: 13px; color: rgba(255,255,255,0.5); margin-bottom: 8px;">You've earned your Digimun User Badge</p>
      <button class="registration-modal-btn" onclick="this.closest('.registration-modal-overlay').remove()">
        <span>&#128640;</span> Continue to Dashboard
      </button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

function updateVerificationStatus() {
  const statusEl = document.getElementById('sidebarVerificationStatus');
  const textEl = document.getElementById('verificationText');
  
  if (!statusEl || !textEl) return;
  
  const user = auth.currentUser;
  
  if (user && BADGE_STATE.isLoggedIn) {
    statusEl.classList.add('visible');
    
    if (user.emailVerified) {
      statusEl.classList.remove('unverified');
      statusEl.classList.add('verified');
      textEl.textContent = 'Verified';
    } else {
      statusEl.classList.remove('verified');
      statusEl.classList.add('unverified');
      textEl.textContent = 'Unverified';
    }
  } else {
    statusEl.classList.remove('visible');
  }
}

let verificationCooldownActive = false;
let verificationCooldownTimer = null;

window.resendVerificationEmail = async function() {
  const resendLink = document.getElementById('resendVerificationLink');
  const user = auth.currentUser;
  
  if (!user || user.emailVerified) return;
  
  if (verificationCooldownActive) return;
  
  resendLink.classList.add('sending');
  resendLink.textContent = 'Sending...';
  
  try {
    await sendEmailVerification(user);
    startVerificationCooldown(resendLink, 30);
  } catch (err) {
    console.error('Error sending verification email:', err);
    if (err.code === 'auth/too-many-requests') {
      resendLink.textContent = 'Try later';
      startVerificationCooldown(resendLink, 60);
    } else {
      resendLink.textContent = 'Failed';
      setTimeout(() => {
        resendLink.textContent = 'Resend email';
        resendLink.classList.remove('sending');
      }, 3000);
    }
  }
};

function startVerificationCooldown(link, seconds) {
  verificationCooldownActive = true;
  let remaining = seconds;
  
  link.textContent = `Sent! Wait ${remaining}s`;
  link.style.pointerEvents = 'none';
  link.style.opacity = '0.6';
  
  verificationCooldownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(verificationCooldownTimer);
      verificationCooldownActive = false;
      link.textContent = 'Resend email';
      link.classList.remove('sending');
      link.style.pointerEvents = 'auto';
      link.style.opacity = '1';
    } else {
      link.textContent = `Wait ${remaining}s`;
    }
  }, 1000);
}

function applyAllUIUpdates() {
  if (BADGE_STATE.authResolved) {
    updateSidebarAuthState();
    updateSidebarBadges();
    updateNavbarBadges();
    updateBadgeTeasers();
    updateVerificationStatus();
  }
}

// Retry mechanism for sidebar updates (handles dynamic sidebar loading)
function retrySidebarUpdate(attempts = 0) {
  const maxAttempts = 10;
  const userItems = document.querySelectorAll('.sidebar-user-item');
  const guestItems = document.querySelectorAll('.sidebar-guest-item');
  
  if (userItems.length > 0 || guestItems.length > 0) {
    if (BADGE_STATE.authResolved) {
      updateSidebarAuthState();
      updateSidebarBadges();
      updateBadgeTeasers();
    }
  } else if (attempts < maxAttempts) {
    setTimeout(() => retrySidebarUpdate(attempts + 1), 200);
  }
}

async function initBadgeSystem() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      BADGE_STATE.isLoggedIn = true;
      BADGE_STATE.userEmail = user.email;
      
      try {
        const userDocRef = doc(db, "users", user.email);
        const userSnap = await getDoc(userDocRef);
        
        if (userSnap.exists()) {
          BADGE_STATE.userData = userSnap.data();
          BADGE_STATE.isPremium = checkPremiumStatus(BADGE_STATE.userData);
        }
      } catch (err) {
      }
    } else {
      BADGE_STATE.isLoggedIn = false;
      BADGE_STATE.isPremium = false;
      BADGE_STATE.userEmail = null;
      BADGE_STATE.userData = null;
    }
    
    BADGE_STATE.authResolved = true;
    applyAllUIUpdates();
  });
}

// Initialize immediately if DOM is already ready, otherwise wait
function startBadgeSystem() {
  initBadgeSystem();
  
  const justRegistered = sessionStorage.getItem('digimunJustRegistered');
  if (justRegistered === 'true') {
    sessionStorage.removeItem('digimunJustRegistered');
    setTimeout(showRegistrationSuccessModal, 500);
  }
  
  // Start retry mechanism
  setTimeout(() => retrySidebarUpdate(), 500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startBadgeSystem);
} else {
  // DOM already loaded, run immediately
  startBadgeSystem();
}

// Re-apply auth state when sidebar is loaded dynamically
window.addEventListener('sidebarLoaded', () => {
  BADGE_STATE.sidebarLoaded = true;
  applyAllUIUpdates();
});

window.DigimonBadges = {
  showRegistrationModal: showRegistrationSuccessModal,
  getState: () => BADGE_STATE,
  createBadge: createBadgeElement,
  getBadgeHTML: getUserBadgeHTML
};

export { 
  initBadgeSystem, 
  showRegistrationSuccessModal, 
  checkPremiumStatus, 
  getUserBadgeHTML,
  BADGE_STATE
};
