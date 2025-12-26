// User Contact System - Allows users to add private contact details
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAI-lKT74279xe2N2euE1KbvRKFhMqHjuw",
  authDomain: "digimun-49.firebaseapp.com",
  projectId: "digimun-49",
  storageBucket: "digimun-49.appspot.com",
  messagingSenderId: "989564072723",
  appId: "1:989564072723:web:ce58e8ebbbbe72e9ce0cab"
};

let app, auth, db;
try {
  app = initializeApp(firebaseConfig, 'user-contact-app');
} catch (e) {
  app = initializeApp(firebaseConfig);
}
auth = getAuth(app);
db = getFirestore(app);

let currentUser = null;
let userContactData = null;

// Modal HTML Template
const contactModalHTML = `
<div class="contact-modal-overlay" id="contactModalOverlay">
  <div class="contact-modal" id="contactModal">
    <div class="contact-modal-header">
      <button class="contact-modal-close" onclick="closeContactModal()">&times;</button>
      <div class="contact-modal-icon">🔐</div>
      <h2>Your Contact</h2>
      <p>Add your private contact details so we can reach you quickly for important updates and support.</p>
    </div>
    
    <div class="contact-modal-body" id="contactModalBody">
      <div class="contact-privacy-notice">
        <span class="privacy-icon">🛡️</span>
        <p><strong>100% Private & Secure</strong> — Your contact information is encrypted and only visible to our admin team. We never share or sell your data.</p>
      </div>
      
      <div class="contact-tabs">
        <button class="contact-tab active" data-tab="telegram" onclick="switchContactTab('telegram')">
          <span class="contact-tab-icon">✈️</span>
          Telegram
        </button>
        <button class="contact-tab" data-tab="whatsapp" onclick="switchContactTab('whatsapp')">
          <span class="contact-tab-icon">📱</span>
          WhatsApp
        </button>
      </div>
      
      <div class="contact-form-section active" id="telegramSection">
        <div class="contact-input-group">
          <label>Telegram Username <span class="input-hint">(without @)</span></label>
          <div class="contact-input-wrapper">
            <span class="input-prefix">@</span>
            <input type="text" class="contact-input has-prefix" id="telegramUsername" 
                   placeholder="your_username" autocomplete="off" />
          </div>
        </div>
        
        <div class="telegram-bind-section">
          <h4>✨ Quick Connect</h4>
          <p>Connect your Telegram directly for the fastest experience. It's completely safe!</p>
          <button class="telegram-bind-btn" onclick="openTelegramBot()">
            <span>✈️</span>
            Connect via Telegram Bot
          </button>
        </div>
      </div>
      
      <div class="contact-form-section" id="whatsappSection">
        <div class="contact-input-group">
          <label>WhatsApp Number <span class="input-hint">(with country code)</span></label>
          <div class="contact-input-wrapper">
            <span class="input-prefix">+</span>
            <input type="tel" class="contact-input has-prefix" id="whatsappNumber" 
                   placeholder="1234567890" autocomplete="off" />
          </div>
        </div>
        
        <div class="contact-privacy-notice" style="background: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.2);">
          <span class="privacy-icon">💡</span>
          <p style="color: #f59e0b;">Enter your full number with country code (e.g., +44 for UK, +1 for US)</p>
        </div>
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
  
  // Listen for auth state
  onAuthStateChanged(auth, async (user) => {
    if (user && !user.isAnonymous) {
      currentUser = user;
      await loadUserContactData();
      updateContactUI();
    } else {
      currentUser = null;
      userContactData = null;
    }
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
        whatsapp: data.whatsappNumber || null,
        linkedAt: data.contactLinkedAt || null
      };
    } else {
      userContactData = { telegram: null, whatsapp: null, linkedAt: null };
    }
  } catch (err) {
    console.warn("Could not load contact data:", err);
    userContactData = { telegram: null, whatsapp: null, linkedAt: null };
  }
}

// Check if user has any contact method saved
function hasContactSaved() {
  return userContactData && (userContactData.telegram || userContactData.whatsapp);
}

// Update all contact-related UI elements
function updateContactUI() {
  const hasContact = hasContactSaved();
  
  // Update sidebar contact buttons (add vs update)
  const addBtn = document.getElementById('sidebarContactBtnAdd');
  const updateBtn = document.getElementById('sidebarContactBtnUpdate');
  
  if (hasContact) {
    // Hide add button, show update button
    if (addBtn) addBtn.style.display = 'none';
    if (updateBtn) updateBtn.style.display = '';
  } else {
    // Show add button, hide update button
    if (addBtn) addBtn.style.display = '';
    if (updateBtn) updateBtn.style.display = 'none';
  }
  
  // Update contact prompt card visibility
  const promptCard = document.getElementById('contactPromptCard');
  if (promptCard) {
    if (hasContact) {
      promptCard.classList.add('hidden');
      promptCard.style.display = 'none';
    } else {
      promptCard.classList.remove('hidden');
      promptCard.style.display = 'flex';
    }
  }
  
  // Dispatch event for other scripts to react
  window.dispatchEvent(new CustomEvent('contactStatusChanged', { 
    detail: { hasContact: hasContact, data: userContactData } 
  }));
}

// Switch between Telegram and WhatsApp tabs
window.switchContactTab = function(tab) {
  document.querySelectorAll('.contact-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.contact-form-section').forEach(s => s.classList.remove('active'));
  
  document.querySelector(`.contact-tab[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(tab === 'telegram' ? 'telegramSection' : 'whatsappSection').classList.add('active');
};

// Open contact modal
window.openContactModal = async function() {
  const overlay = document.getElementById('contactModalOverlay');
  if (overlay) {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Reload contact data to ensure it's fresh
    await loadUserContactData();
    
    // Pre-fill existing data
    const telegramInput = document.getElementById('telegramUsername');
    const whatsappInput = document.getElementById('whatsappNumber');
    
    if (telegramInput) {
      telegramInput.value = userContactData?.telegram ? userContactData.telegram.replace('@', '') : '';
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
  const bindSection = section.querySelector('.telegram-bind-section');
  
  if (bindSection) {
    bindSection.innerHTML = `
      <h4>✅ Almost Done!</h4>
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
    alert('Please log in to save your contact details.');
    return;
  }
  
  const saveBtn = document.getElementById('saveContactBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  
  // Get values
  let telegram = document.getElementById('telegramUsername')?.value?.trim() || 
                 document.getElementById('telegramUsernameAfterBind')?.value?.trim() || '';
  let whatsapp = document.getElementById('whatsappNumber')?.value?.trim() || '';
  
  // Clean values
  telegram = telegram.replace('@', '').replace(/\s/g, '');
  whatsapp = whatsapp.replace(/[^\d]/g, ''); // Keep only digits
  
  if (!telegram && !whatsapp) {
    alert('Please enter at least one contact method.');
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Contact';
    return;
  }
  
  try {
    const userRef = doc(db, "users", currentUser.email);
    const userSnap = await getDoc(userRef);
    
    const contactUpdate = {};
    if (telegram) contactUpdate.telegramUsername = telegram;
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
      whatsapp: whatsapp ? '+' + whatsapp : null,
      linkedAt: new Date()
    };
    
    // Show success state
    showSuccessState(telegram, whatsapp);
    updateContactUI();
    
  } catch (err) {
    console.error("Error saving contact:", err);
    alert('Failed to save contact. Please try again.');
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Contact';
  }
};

function showSuccessState(telegram, whatsapp) {
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
            <div class="contact-success-item-label">Telegram</div>
            <div class="contact-success-item-value">@${telegram}</div>
          </div>
        </div>
      `;
    }
    
    if (whatsapp) {
      detailsHTML += `
        <div class="contact-success-item">
          <span class="contact-success-item-icon">📱</span>
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
window.loadUserContactData = loadUserContactData;
window.createContactPromptCard = createContactPromptCard;
window.updateContactUI = updateContactUI;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContactSystem);
} else {
  initContactSystem();
}
