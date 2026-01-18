// User Contact System - Allows users to add private contact details
// FIXED: Now uses shared firebase.js to sync auth state across the app
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;
let userContactData = null;
let authResolved = false;

// Modal HTML Template
const contactModalHTML = `
<div class="contact-modal-overlay" id="contactModalOverlay">
  <div class="contact-modal" id="contactModal">
    <div class="contact-modal-header">
      <button class="contact-modal-close" onclick="closeContactModal()">&times;</button>
      <div class="contact-modal-icon">📞</div>
      <h2>Your Contact Details</h2>
      <p>Add at least one contact method so we can reach you for support and updates.</p>
    </div>
    
    <div class="contact-modal-body" id="contactModalBody">
      <div class="contact-privacy-notice">
        <span class="privacy-icon">🛡️</span>
        <p><strong>100% Private & Secure</strong> — Your information is only visible to our admin team.</p>
      </div>
      
      <div class="contact-form-fields">
        <div class="contact-input-group">
          <label>
            <span class="field-icon">✈️</span>
            Telegram Username
          </label>
          <div class="contact-input-wrapper">
            <span class="input-prefix">@</span>
            <input type="text" class="contact-input has-prefix" id="telegramUsername" 
                   placeholder="your_username" autocomplete="off" />
          </div>
        </div>
        
        <div class="contact-input-group">
          <label>
            <span class="field-icon">📱</span>
            Telegram Phone Number
          </label>
          <div class="contact-input-wrapper">
            <span class="input-prefix">+</span>
            <input type="tel" class="contact-input has-prefix" id="telegramPhone" 
                   placeholder="92 300 1234567" autocomplete="off" />
          </div>
          <span class="input-hint">Include country code (e.g., +92, +1, +44)</span>
        </div>
        
        <div class="contact-input-group">
          <label>
            <span class="field-icon">💬</span>
            WhatsApp Number
          </label>
          <div class="contact-input-wrapper">
            <span class="input-prefix">+</span>
            <input type="tel" class="contact-input has-prefix" id="whatsappNumber" 
                   placeholder="92 300 1234567" autocomplete="off" />
          </div>
          <span class="input-hint">Include country code (e.g., +92, +1, +44)</span>
        </div>
      </div>
      
      <div class="contact-requirement-notice">
        <span>ℹ️</span>
        <span>Please fill at least one contact method to save.</span>
      </div>
    </div>
    
    <div class="contact-modal-footer">
      <button class="contact-btn contact-btn-secondary" onclick="closeContactModal()">Later</button>
      <button class="contact-btn contact-btn-primary" id="saveContactBtn" onclick="saveContactDetails()">Save Contact</button>
    </div>
  </div>
</div>
`;

// Success State HTML
const successStateHTML = `
<div class="contact-success-state">
  <div class="contact-success-icon">✅</div>
  <h3>Contact Saved!</h3>
  <p>Your contact details have been securely saved. We'll use this to reach you for important updates.</p>
  <div class="contact-success-details" id="savedContactDetails"></div>
</div>
`;

// Initialize contact system
function initContactSystem() {
  
  // Inject modal into page if not already present
  if (!document.getElementById('contactModalOverlay')) {
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = contactModalHTML;
    document.body.appendChild(modalContainer.firstElementChild);
  }
  
  // Inject CSS if not present
  if (!document.querySelector('link[href*="user-contact.css"]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/user-contact.css';
    document.head.appendChild(css);
  }
  
  // Listen for auth state using the SHARED auth instance
  onAuthStateChanged(auth, async (user) => {
    authResolved = true;
    
    if (user && !user.isAnonymous) {
      currentUser = user;
      await loadUserContactData();
      updateContactUI();
    } else {
      currentUser = null;
      userContactData = null;
      updateContactUI();
    }
    
    // Dispatch event so other scripts know auth is ready
    window.dispatchEvent(new CustomEvent('contactAuthReady', { 
      detail: { user: currentUser, authResolved: true } 
    }));
  });
}

// Load user's contact data from Firestore
async function loadUserContactData() {
  if (!currentUser) return;
  
  try {
    const userRef = doc(db, "users", currentUser.email);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const data = userSnap.data();
      userContactData = {
        telegram: data.telegramUsername || null,
        telegramPhone: data.telegramPhone || null,
        whatsapp: data.whatsappNumber || null,
        linkedAt: data.contactLinkedAt || null
      };
    } else {
      userContactData = { telegram: null, telegramPhone: null, whatsapp: null, linkedAt: null };
    }
  } catch (err) {
    console.warn("[Contact] Could not load contact data:", err);
    userContactData = { telegram: null, telegramPhone: null, whatsapp: null, linkedAt: null };
  }
}

// Check if user has any contact method saved
function hasContactSaved() {
  return userContactData && (userContactData.telegram || userContactData.telegramPhone || userContactData.whatsapp);
}

// Check if user is logged in
function isUserLoggedIn() {
  return authResolved && currentUser !== null;
}

// Update all contact-related UI elements
function updateContactUI() {
  const hasContact = hasContactSaved();
  const loggedIn = isUserLoggedIn();
  
  
  // Update sidebar contact buttons (add vs update)
  const addBtn = document.getElementById('sidebarContactBtnAdd');
  const updateBtn = document.getElementById('sidebarContactBtnUpdate');
  
  if (loggedIn) {
    if (hasContact) {
      // Hide add button, show update button
      if (addBtn) addBtn.style.display = 'none';
      if (updateBtn) updateBtn.style.display = '';
    } else {
      // Show add button, hide update button
      if (addBtn) addBtn.style.display = '';
      if (updateBtn) updateBtn.style.display = 'none';
    }
  } else {
    // Not logged in - hide both
    if (addBtn) addBtn.style.display = 'none';
    if (updateBtn) updateBtn.style.display = 'none';
  }
  
  // Update contact prompt card visibility
  const promptCard = document.getElementById('contactPromptCard');
  if (promptCard) {
    if (!loggedIn || hasContact) {
      promptCard.classList.add('hidden');
      promptCard.style.display = 'none';
    } else {
      promptCard.classList.remove('hidden');
      promptCard.style.display = 'flex';
    }
  }
  
  // Dispatch event for other scripts to react
  window.dispatchEvent(new CustomEvent('contactStatusChanged', { 
    detail: { hasContact: hasContact, data: userContactData, isLoggedIn: loggedIn } 
  }));
}

// Switch between Telegram and WhatsApp tabs
window.switchContactTab = function(tab) {
  document.querySelectorAll('.contact-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.contact-form-section').forEach(s => s.classList.remove('active'));
  
  document.querySelector(`.contact-tab[data-tab="${tab}"]`)?.classList.add('active');
  document.getElementById(tab === 'telegram' ? 'telegramSection' : 'whatsappSection')?.classList.add('active');
};

// Open contact modal
window.openContactModal = async function() {
  
  // Wait for auth to resolve if not already
  if (!authResolved) {
    await new Promise(resolve => {
      const checkAuth = () => {
        if (authResolved) {
          resolve();
        } else {
          setTimeout(checkAuth, 100);
        }
      };
      checkAuth();
    });
  }
  
  // Check if user is logged in
  if (!currentUser) {
    // Show a nice toast or redirect to login
    if (typeof showToast === 'function') {
      showToast('Please login first to add contact details', 'warning');
    } else {
      alert('Please login first to add contact details.');
    }
    return;
  }
  
  const overlay = document.getElementById('contactModalOverlay');
  if (overlay) {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Reload contact data to ensure it's fresh
    await loadUserContactData();
    
    // Pre-fill existing data
    const telegramInput = document.getElementById('telegramUsername');
    const telegramPhoneInput = document.getElementById('telegramPhone');
    const whatsappInput = document.getElementById('whatsappNumber');
    
    if (telegramInput) {
      telegramInput.value = userContactData?.telegram ? userContactData.telegram.replace('@', '') : '';
    }
    if (telegramPhoneInput) {
      telegramPhoneInput.value = userContactData?.telegramPhone ? userContactData.telegramPhone.replace('+', '') : '';
    }
    if (whatsappInput) {
      whatsappInput.value = userContactData?.whatsapp ? userContactData.whatsapp.replace('+', '') : '';
    }
    
  }
};

// Close contact modal
window.closeContactModal = function() {
  const overlay = document.getElementById('contactModalOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
};

// Open Telegram bot for binding
window.openTelegramBot = function() {
  // Open Telegram bot with start parameter containing user email (base64 encoded)
  const userEmail = currentUser ? currentUser.email : '';
  const startParam = btoa(userEmail).replace(/[+/=]/g, c => c === '+' ? '-' : c === '/' ? '_' : '');
  
  // For now, link to the admin Telegram - in future this could be a bot
  const telegramUrl = `https://t.me/digimun49?start=${startParam}`;
  window.open(telegramUrl, '_blank');
  
  // Show message in modal
  showTelegramBindInstructions();
};

function showTelegramBindInstructions() {
  const section = document.getElementById('telegramSection');
  const bindSection = section?.querySelector('.telegram-bind-section');
  
  if (bindSection) {
    bindSection.innerHTML = `
      <h4>Almost Done!</h4>
      <p>We opened Telegram for you. Send any message to start, then come back here and save your username below.</p>
      <div style="margin-top: 12px;">
        <input type="text" class="contact-input" id="telegramUsernameAfterBind" 
               placeholder="Enter your Telegram username" style="width: 100%;" />
      </div>
    `;
  }
}

// Save contact details to Firestore
window.saveContactDetails = async function() {
  
  if (!currentUser) {
    if (typeof showToast === 'function') {
      showToast('Please login first to save contact details', 'error');
    } else {
      alert('Please log in to save your contact details.');
    }
    return;
  }
  
  const saveBtn = document.getElementById('saveContactBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }
  
  // Get values
  let telegram = document.getElementById('telegramUsername')?.value?.trim() || '';
  let telegramPhone = document.getElementById('telegramPhone')?.value?.trim() || '';
  let whatsapp = document.getElementById('whatsappNumber')?.value?.trim() || '';
  
  // Clean values
  telegram = telegram.replace('@', '').replace(/\s/g, '');
  telegramPhone = telegramPhone.replace(/[^\d]/g, ''); // Keep only digits
  whatsapp = whatsapp.replace(/[^\d]/g, ''); // Keep only digits
  
  if (!telegram && !telegramPhone && !whatsapp) {
    if (typeof showToast === 'function') {
      showToast('Please enter at least one contact method', 'warning');
    } else {
      alert('Please enter at least one contact method.');
    }
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Contact';
    }
    return;
  }
  
  try {
    const userRef = doc(db, "users", currentUser.email);
    const userSnap = await getDoc(userRef);
    
    const contactUpdate = {};
    if (telegram) contactUpdate.telegramUsername = telegram;
    if (telegramPhone) contactUpdate.telegramPhone = '+' + telegramPhone;
    if (whatsapp) contactUpdate.whatsappNumber = '+' + whatsapp;
    contactUpdate.contactLinkedAt = serverTimestamp();
    
    
    
    if (userSnap.exists()) {
      await updateDoc(userRef, contactUpdate);
    } else {
      await setDoc(userRef, {
        email: currentUser.email,
        ...contactUpdate,
        createdAt: serverTimestamp()
      }, { merge: true });
    }
    
    // Update local data
    userContactData = {
      telegram: telegram || null,
      telegramPhone: telegramPhone ? '+' + telegramPhone : null,
      whatsapp: whatsapp ? '+' + whatsapp : null,
      linkedAt: new Date()
    };
    
    
    // Show success state
    showSuccessState(telegram, telegramPhone, whatsapp);
    updateContactUI();
    
  } catch (err) {
    console.error("[Contact] Error saving contact:", err);
    if (typeof showToast === 'function') {
      showToast('Failed to save contact. Please try again.', 'error');
    } else {
      alert('Failed to save contact. Please try again.');
    }
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Contact';
    }
  }
};

function showSuccessState(telegram, telegramPhone, whatsapp) {
  const body = document.getElementById('contactModalBody');
  const footer = document.querySelector('.contact-modal-footer');
  
  if (body) {
    body.innerHTML = successStateHTML;
    
    // Populate saved details
    const detailsContainer = document.getElementById('savedContactDetails');
    let detailsHTML = '';
    
    if (telegram) {
      detailsHTML += `
        <div class="contact-success-item">
          <span class="contact-success-item-icon">✈️</span>
          <div>
            <div class="contact-success-item-label">Telegram Username</div>
            <div class="contact-success-item-value">@${telegram}</div>
          </div>
        </div>
      `;
    }
    
    if (telegramPhone) {
      detailsHTML += `
        <div class="contact-success-item">
          <span class="contact-success-item-icon">📱</span>
          <div>
            <div class="contact-success-item-label">Telegram Phone</div>
            <div class="contact-success-item-value">+${telegramPhone}</div>
          </div>
        </div>
      `;
    }
    
    if (whatsapp) {
      detailsHTML += `
        <div class="contact-success-item">
          <span class="contact-success-item-icon">💬</span>
          <div>
            <div class="contact-success-item-label">WhatsApp</div>
            <div class="contact-success-item-value">+${whatsapp}</div>
          </div>
        </div>
      `;
    }
    
    if (detailsContainer) {
      detailsContainer.innerHTML = detailsHTML;
    }
  }
  
  if (footer) {
    footer.innerHTML = `
      <button class="contact-btn contact-btn-primary" style="width: 100%;" onclick="closeContactModal()">Done</button>
    `;
  }
}

// Create contact prompt card HTML
function createContactPromptCard() {
  return `
    <div class="contact-prompt-card" id="contactPromptCard" onclick="openContactModal()">
      <div class="contact-prompt-icon">🔐</div>
      <div class="contact-prompt-content">
        <h4>Add Your Contact</h4>
        <p>Add your Telegram or WhatsApp for faster support and important updates</p>
      </div>
      <div class="contact-prompt-arrow">→</div>
    </div>
  `;
}

// Create sidebar contact button HTML
function createSidebarContactButton() {
  const hasContact = hasContactSaved();
  return `
    <button class="sidebar-contact-btn sidebar-user-item ${hasContact ? 'contact-added' : ''}" 
            onclick="openContactModal()" style="display: none;">
      <span class="sidebar-contact-icon">🔐</span>
      Your Contact
      <span class="sidebar-contact-badge">${hasContact ? 'Saved' : 'Add'}</span>
    </button>
  `;
}

// Export functions for external use
window.initContactSystem = initContactSystem;
window.hasContactSaved = hasContactSaved;
window.isUserLoggedIn = isUserLoggedIn;
window.loadUserContactData = loadUserContactData;
window.createContactPromptCard = createContactPromptCard;
window.updateContactUI = updateContactUI;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContactSystem);
} else {
  initContactSystem();
}
