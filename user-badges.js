import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const BADGE_STATE = {
  isLoggedIn: false,
  isPremium: false,
  userEmail: null,
  userData: null
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
    userStatus.textContent = BADGE_STATE.isPremium ? 'VIP Member' : 'Digimun User';
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
        console.log("Badge system: Could not fetch user data", err);
      }
    } else {
      BADGE_STATE.isLoggedIn = false;
      BADGE_STATE.isPremium = false;
      BADGE_STATE.userEmail = null;
      BADGE_STATE.userData = null;
    }
    
    updateSidebarAuthState();
    updateSidebarBadges();
    updateNavbarBadges();
    updateBadgeTeasers();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initBadgeSystem();
  
  const justRegistered = sessionStorage.getItem('digimunJustRegistered');
  if (justRegistered === 'true') {
    sessionStorage.removeItem('digimunJustRegistered');
    setTimeout(showRegistrationSuccessModal, 500);
  }
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
