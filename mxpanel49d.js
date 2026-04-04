// admin.js — Digimun Admin Panel (Users, Tickets, Reviews Management)
import {
  auth, db, onAuthStateChanged,
  doc, getDoc, setDoc, updateDoc, serverTimestamp, deleteDoc, addDoc,
  collection, query, where, orderBy, limit, startAfter, getDocs, documentId, arrayUnion
} from "./platform.js";

let ADMIN_EMAIL = '';
let ADMIN_ROLE = 'super-admin';
const PAGE_SIZE = 50;
const USER_CACHE_DURATION_MS = 5 * 60 * 1000;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_WARNING_MS = 60 * 1000;

function get2FASessionToken() {
  return localStorage.getItem('admin2FASessionToken') || sessionStorage.getItem('admin2FASessionToken') || '';
}

async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  const hdrs = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  };
  const s2fa = get2FASessionToken();
  if (s2fa) hdrs['X-Admin-2FA-Session'] = s2fa;
  return hdrs;
}

async function getAuthHeadersOnly() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  const hdrs = { 'Authorization': 'Bearer ' + token };
  const s2fa = get2FASessionToken();
  if (s2fa) hdrs['X-Admin-2FA-Session'] = s2fa;
  return hdrs;
}

let allUsersCache = null;
let usersCacheTimestamp = 0;

const USERS_PAGE_SIZE = 200;

let _usersPageCursor = null;
let _usersPageHasMore = true;

function resetUsersPagination() {
  _usersPageCursor = null;
  _usersPageHasMore = true;
}

async function loadUsersPage(pageSize = USERS_PAGE_SIZE) {
  if (!_usersPageHasMore) return { users: [], hasMore: false };

  let q;
  if (_usersPageCursor) {
    q = query(collection(db, "users"), orderBy(documentId()), startAfter(_usersPageCursor), limit(pageSize));
  } else {
    q = query(collection(db, "users"), orderBy(documentId()), limit(pageSize));
  }

  const fetchPromise = getDocs(q);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Database request timed out after 60 seconds.")), 60000)
  );

  const snapshot = await Promise.race([fetchPromise, timeoutPromise]);

  if (snapshot.empty) {
    _usersPageHasMore = false;
    return { users: [], hasMore: false };
  }

  const users = [];
  snapshot.forEach(docSnap => {
    users.push({ id: docSnap.id, data: docSnap.data() });
  });

  _usersPageCursor = snapshot.docs[snapshot.docs.length - 1];
  _usersPageHasMore = snapshot.size >= pageSize;

  return { users, hasMore: _usersPageHasMore };
}

async function getAllUsersCached(forceRefresh = false, progressCallback = null) {
  const now = Date.now();
  if (!forceRefresh && allUsersCache && (now - usersCacheTimestamp) < USER_CACHE_DURATION_MS) {
    if (progressCallback) progressCallback(`Using cached data (${allUsersCache.length} users)`);
    return allUsersCache;
  }

  if (progressCallback) progressCallback("Connecting to database...");

  allUsersCache = [];
  resetUsersPagination();
  let batchNum = 0;

  while (_usersPageHasMore) {
    const page = await loadUsersPage();
    allUsersCache.push(...page.users);
    batchNum++;
    if (progressCallback) progressCallback(`Loaded ${allUsersCache.length} users (batch ${batchNum})...`);
    if (!page.hasMore) break;
  }

  usersCacheTimestamp = now;
  if (progressCallback) progressCallback(`Loaded ${allUsersCache.length} users`);
  return allUsersCache;
}

function invalidateUsersCache() {
  allUsersCache = null;
  usersCacheTimestamp = 0;
  resetUsersPagination();
}


// DOM Elements - Users
const tableBody = document.getElementById("user-data");
const loadMoreBtn = document.getElementById("load-more");
const searchBtn = document.getElementById("search-btn");
const prefixBtn = document.getElementById("prefix-btn");
const searchInput = document.getElementById("search-email");
const pasteEmailBtn = document.getElementById("paste-email-btn");
const applyFilterBtn = document.getElementById("apply-filter");
const clearFilterBtn = document.getElementById("clear-filter");
const filterFieldSel = document.getElementById("filter-field");
const filterValueSel = document.getElementById("filter-value");

// DOM Elements - Tickets
const ticketData = document.getElementById("ticket-data");
const ticketFilter = document.getElementById("ticket-filter");
const loadTicketsBtn = document.getElementById("load-tickets-btn");
const refreshTicketsBtn = document.getElementById("refresh-tickets-btn");
const ticketModal = document.getElementById("ticket-modal");
const ticketModalContent = document.getElementById("ticket-modal-content");
const closeModalBtn = document.getElementById("close-modal-btn");
const modalStatusSelect = document.getElementById("modal-status-select");
const updateStatusBtn = document.getElementById("update-status-btn");
const deleteTicketBtn = document.getElementById("delete-ticket-btn");
const replyTextarea = document.getElementById("reply-textarea");
const sendReplyBtn = document.getElementById("send-reply-btn");
const sendReplyCloseBtn = document.getElementById("send-reply-close-btn");
const repliesList = document.getElementById("replies-list");
const ticketCountBadge = document.getElementById("ticket-count");
const navTicketCount = document.getElementById("nav-ticket-count");
const adminReplyAttachment = document.getElementById("admin-reply-attachment");
const adminReplyFilePreview = document.getElementById("admin-reply-file-preview");
const adminReplyFileName = document.getElementById("admin-reply-file-name");
const adminReplyRemoveFile = document.getElementById("admin-reply-remove-file");

// DOM Elements - Reviews
const reviewData = document.getElementById("review-data");
const reviewFilter = document.getElementById("review-filter");
const loadReviewsBtn = document.getElementById("load-reviews-btn");
const refreshReviewsBtn = document.getElementById("refresh-reviews-btn");
const reviewModal = document.getElementById("review-modal");
const reviewModalContent = document.getElementById("review-modal-content");
const closeReviewModalBtn = document.getElementById("close-review-modal-btn");
const reviewStatusSelect = document.getElementById("review-status-select");
const approveReviewBtn = document.getElementById("approve-review-btn");
const saveReviewBtn = document.getElementById("save-review-btn");
const deleteReviewBtn = document.getElementById("delete-review-btn");
const editReviewMessage = document.getElementById("edit-review-message");
const reviewCountBadge = document.getElementById("review-count");
const navReviewCount = document.getElementById("nav-review-count");
const adminReplyMessage = document.getElementById("admin-reply-message");
const saveReplyBtn = document.getElementById("save-reply-btn");
const deleteReplyBtn = document.getElementById("delete-reply-btn");
const existingReplyContainer = document.getElementById("existing-reply-container");
const existingReplyText = document.getElementById("existing-reply-text");

// DOM Elements - Signals
const signalPendingCountBadge = document.getElementById("websignal-pending-count");
const navSignalCount = document.getElementById("nav-websignal-count");

// DOM Elements - Contacts
const contactData = document.getElementById("contact-data");
const contactSearch = document.getElementById("contact-search");
const loadContactsBtn = document.getElementById("load-contacts-btn");
const refreshContactsBtn = document.getElementById("refresh-contacts-btn");
const contactMobileCards = document.getElementById("contact-mobile-cards");

// DOM Elements - Navigation
const mobileToggle = document.getElementById("mobile-toggle");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const sidebarClose = document.getElementById("sidebar-close");

// State
let currentTicketId = null;
let ticketsCache = [];
let currentReviewId = null;
let reviewsCache = [];
let currentField = null;
let currentValue = null;
let lastDoc = null;
let isAdminAuthenticated = false;

// State for lazy loading
let ticketsLoaded = false;
let reviewsLoaded = false;
let contactsLoaded = false;
let contactsCache = [];
let adminReplySelectedFile = null;

// Toggle Spinner
let spinnerTimeout = null;
let spinnerDismissTimeout = null;
function toggleSpinner(show) {
  const s = document.getElementById("loading-spinner");
  if (!s) return;
  if (spinnerTimeout) { clearTimeout(spinnerTimeout); spinnerTimeout = null; }
  if (spinnerDismissTimeout) { clearTimeout(spinnerDismissTimeout); spinnerDismissTimeout = null; }
  const hint = s.querySelector('.spinner-dismiss-hint');
  s.classList.toggle('active', show);
  s.onclick = null;
  if (hint) hint.style.opacity = '0';
  if (show) {
    spinnerDismissTimeout = setTimeout(() => {
      if (hint) hint.style.opacity = '1';
      s.onclick = () => { s.classList.remove('active'); s.onclick = null; if (hint) hint.style.opacity = '0'; };
    }, 5000);
    spinnerTimeout = setTimeout(() => {
      s.classList.remove('active');
      s.onclick = null;
      if (hint) hint.style.opacity = '0';
      spinnerTimeout = null;
    }, 90000);
  }
}

// Show Access Denied
function showAccessDenied(message) {
  console.error("[Admin] Access denied:", message);
  const overlay = document.getElementById("access-denied-overlay");
  const messageEl = document.getElementById("access-denied-message");
  if (overlay) {
    overlay.classList.add("active");
    if (messageEl) messageEl.textContent = message;
  }
  document.body.style.overflow = "hidden";
}

// Mobile Menu
function openSidebar() {
  const sb = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  if (sb) sb.classList.add("open");
  if (overlay) overlay.classList.add("active");
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  const sb = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  if (sb) sb.classList.remove("open");
  if (overlay) overlay.classList.remove("active");
  document.body.style.overflow = '';
}

window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;

// Run immediately - module loads after DOM is already parsed
(function initMobileMenu() {
  const toggle = document.getElementById("mobile-toggle");
  const closeBtn = document.getElementById("sidebar-close");
  const overlay = document.getElementById("sidebar-overlay");
  
  if (toggle) {
    toggle.addEventListener("click", openSidebar);
  }
  if (closeBtn) {
    closeBtn.addEventListener("click", closeSidebar);
  }
  if (overlay) {
    overlay.addEventListener("click", closeSidebar);
  }
})();

// Paste from Clipboard
if (pasteEmailBtn) {
  pasteEmailBtn.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (searchInput) {
        searchInput.value = text.trim();
        searchInput.focus();
      }
    } catch (err) {
      console.error("[Admin] Clipboard paste error:", err);
      showToast("Unable to paste. Please allow clipboard access or paste manually (Ctrl+V).", "error");
    }
  });
}

// Section Navigation with lazy loading
window.showSection = function(section, element) {
  if (!isAdminAuthenticated) {
    console.warn("[Admin] Not authenticated, cannot show section");
    showToast("Please complete authentication first", "error");
    return;
  }
  
  document.querySelectorAll('[id^="section-"]').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  
  const targetSection = document.getElementById(`section-${section}`);
  if (targetSection) targetSection.style.display = 'block';
  
  if (element) element.classList.add('active');
  
  // Close sidebar on mobile after selecting
  if (window.innerWidth <= 1024) {
    closeSidebar();
  }
  
  // Update mobile header title
  const mobileHeaderTitle = document.getElementById('mobile-header-title');
  if (mobileHeaderTitle) {
    const titles = {
      'users': 'User Management',
      'tickets': 'Support Tickets',
      'reviews': 'Reviews',
      'contacts': 'User Contacts',
      'signals': 'Signals Management',
      'websignals': 'DigimunX Website Signals',
      'visitors': 'Visitor Analytics',
      'notifications': 'Push Notifications',
      'promocodes': 'Promo Codes',
      'auditlog': 'Audit Log',
      'cryptopayments': 'Crypto Payments'
    };
    mobileHeaderTitle.textContent = titles[section] || 'Admin Panel';
  }
  
  // Lazy load data only when section is opened
  if (section === 'tickets' && !ticketsLoaded) {
    loadTickets();
    ticketsLoaded = true;
  } else if (section === 'reviews' && !reviewsLoaded) {
    loadReviews();
    reviewsLoaded = true;
  } else if (section === 'contacts' && !contactsLoaded) {
    loadContacts();
    contactsLoaded = true;
  } else if (section === 'notifications') {
    loadNotificationStats();
    loadNotificationHistory();
  } else if (section === 'promocodes') {
    loadPromoCodes();
  } else if (section === 'auditlog' && !auditLogsLoaded) {
    loadAuditLogs();
  } else if (section === 'cryptopayments') {
    loadCryptoPayments();
  }
  
  closeSidebar();
};

// 2FA State
let pendingAdminUser = null;
let twoFAAttempts = 0;
const MAX_2FA_ATTEMPTS = 5;

// Show 2FA Overlay
function show2FAOverlay() {
  const overlay = document.getElementById("twofa-overlay");
  if (overlay) {
    overlay.classList.add("active");
    const input = document.getElementById("twofa-code");
    if (input) {
      input.value = "";
      input.focus();
    }
  }
  document.body.style.overflow = "hidden";
}

// Hide 2FA Overlay
function hide2FAOverlay() {
  const overlay = document.getElementById("twofa-overlay");
  if (overlay) overlay.classList.remove("active");
  document.body.style.overflow = "";
}

// Verify 2FA Code
async function verify2FACode() {
  const codeInput = document.getElementById("twofa-code");
  const errorEl = document.getElementById("twofa-error");
  const verifyBtn = document.getElementById("verify-2fa-btn");
  
  const code = codeInput?.value?.trim() || "";
  
  if (code.length !== 6 || !/^\d{6}$/.test(code)) {
    if (errorEl) {
      errorEl.textContent = "Please enter a valid 6-digit code";
      errorEl.style.display = "block";
    }
    return;
  }
  
  if (verifyBtn) {
    verifyBtn.disabled = true;
    verifyBtn.textContent = "Verifying...";
  }
  
  try {
    const trustCheckbox = document.getElementById('trust-device-checkbox');
    const trustDevice = trustCheckbox ? trustCheckbox.checked : false;
    const authHdrs = await getAuthHeaders();
    const response = await fetch("/.netlify/functions/verify-admin-2fa", {
      method: "POST",
      headers: authHdrs,
      body: JSON.stringify({ code, trustDevice })
    });
    
    if (response.status === 429) {
      hide2FAOverlay();
      showAccessDenied("Too many failed attempts. Please try again in 30 minutes.");
      return;
    }
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      
      const sessionToken = data.sessionToken || '';
      const expiry = data.expiresAt || (Date.now() + (3 * 60 * 60 * 1000));
      const isTrusted = data.trusted === true;
      const store = isTrusted ? localStorage : sessionStorage;
      store.setItem('admin2FAVerified', 'true');
      store.setItem('admin2FAExpiry', expiry.toString());
      store.setItem('admin2FAEmail', pendingAdminUser?.email || '');
      store.setItem('admin2FASessionToken', sessionToken);
      store.setItem('admin2FADevice', getDeviceFingerprint());
      if (isTrusted) store.setItem('admin2FATrusted', 'true');
      
      hide2FAOverlay();
      isAdminAuthenticated = true;
      twoFAAttempts = 0;
      applyRoleRestrictions();
      resetSessionTimeout();
      
      logAdminActionClient('admin_login', ADMIN_EMAIL, 'admin', { role: ADMIN_ROLE });
      
      try {
        await loadDashboardStats();
      } catch (err) {
        console.error("[Admin] Dashboard stats error:", err);
        showToast("Error loading dashboard stats", "error");
      }
    } else {
      twoFAAttempts++;
      if (twoFAAttempts >= MAX_2FA_ATTEMPTS) {
        hide2FAOverlay();
        showAccessDenied("Too many failed attempts. Please try again later.");
        return;
      }
      
      if (errorEl) {
        errorEl.textContent = `Invalid code. ${MAX_2FA_ATTEMPTS - twoFAAttempts} attempts remaining.`;
        errorEl.style.display = "block";
      }
      if (codeInput) {
        codeInput.value = "";
        codeInput.focus();
      }
    }
  } catch (err) {
    console.error("[Admin] 2FA verification error:", err);
    if (errorEl) {
      errorEl.textContent = "Verification failed. Please try again.";
      errorEl.style.display = "block";
    }
  } finally {
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.textContent = "Verify Code";
    }
  }
}

// Setup 2FA event listeners - run immediately since module loads after DOM is parsed
(function init2FAListeners() {
  const verifyBtn = document.getElementById("verify-2fa-btn");
  const codeInput = document.getElementById("twofa-code");
  
  if (verifyBtn) {
    verifyBtn.addEventListener("click", verify2FACode);
  }
  
  if (codeInput) {
    codeInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        verify2FACode();
      }
    });
    
    codeInput.addEventListener("input", () => {
      const errorEl = document.getElementById("twofa-error");
      if (errorEl) errorEl.style.display = "none";
    });
  }
})();

// Generate device fingerprint (browser + screen combo)
function getDeviceFingerprint() {
  const nav = navigator;
  const screen = window.screen;
  const fingerprint = [
    nav.userAgent,
    nav.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset()
  ].join('|');
  
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'df_' + Math.abs(hash).toString(36);
}

// Check if 2FA session is still valid (24 hours + same device)
function get2FAStore() {
  if (localStorage.getItem('admin2FATrusted') === 'true') return localStorage;
  return sessionStorage;
}

function isAdmin2FASessionValid(userEmail) {
  const store = get2FAStore();
  const verified = store.getItem('admin2FAVerified');
  const expiry = parseInt(store.getItem('admin2FAExpiry') || '0', 10);
  const savedEmail = store.getItem('admin2FAEmail') || '';
  const savedDevice = store.getItem('admin2FADevice') || '';
  const sessionToken = store.getItem('admin2FASessionToken') || '';
  const currentDevice = getDeviceFingerprint();
  
  if (verified === 'true' && 
      Date.now() < expiry && 
      savedEmail.toLowerCase() === userEmail.toLowerCase() &&
      savedDevice === currentDevice &&
      sessionToken) {
    return true;
  }
  
  clearAll2FASessions();
  return false;
}

function clearAll2FASessions() {
  const keys = ['admin2FAVerified','admin2FAExpiry','admin2FAEmail','admin2FADevice','admin2FASessionToken','admin2FATrusted'];
  keys.forEach(k => { sessionStorage.removeItem(k); localStorage.removeItem(k); });
}

// Auth Check
onAuthStateChanged(auth, async (user) => {
  
  if (!user) {
    showAccessDenied("Please log in first to access the admin panel.");
    return;
  }
  
  try {
    const token = await user.getIdToken();
    const adminCheckResp = await fetch('/.netlify/functions/check-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({})
    });
    const adminCheckData = await adminCheckResp.json();
    if (!adminCheckData.isAdmin) {
      showAccessDenied(`Access denied. Your account (${user.email}) is not authorized as an admin.`);
      return;
    }
    ADMIN_ROLE = adminCheckData.role || 'super-admin';
  } catch (e) {
    showAccessDenied("Could not verify admin access. Please try again.");
    return;
  }

  ADMIN_EMAIL = user.email;
  window._authUser = user;
  pendingAdminUser = user;
  
  if (isAdmin2FASessionValid(user.email)) {
    isAdminAuthenticated = true;
    applyRoleRestrictions();
    resetSessionTimeout();
    try {
      await loadDashboardStats();
    } catch (err) {
      console.error("[Admin] Dashboard stats error:", err);
    }
    return;
  }
  
  show2FAOverlay();
});

// Utility Functions
function cleanEmail(s) {
  if (!s) return "";
  return s.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "").trim().toLowerCase();
}

function statusBadge(val) {
  const safe = (val || "pending").toLowerCase();
  const klass = safe === "approved" ? "status-approved"
             : safe === "suspended" ? "status-suspended"
             : safe === "rejected" ? "status-rejected"
             : "status-pending";
  return `<span class="status-badge ${klass}">${safe}</span>`;
}

function formatDate(ts) {
  try {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return "—"; }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sanitizeTelegramUsername(username) {
  if (!username) return '';
  return username.replace(/[^A-Za-z0-9_]/g, '');
}

function getStars(rating) {
  const r = parseInt(rating) || 0;
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

function normalizeWhatsAppNumber(number) {
  if (!number) return '';
  let clean = number.replace(/[^0-9+]/g, '');
  if (clean.startsWith('+')) {
    clean = clean.substring(1);
  }
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }
  return clean;
}

function isValidWhatsAppNumber(number) {
  const clean = normalizeWhatsAppNumber(number);
  return clean.length >= 10 && clean.length <= 15 && /^[0-9]+$/.test(clean);
}

// ================== TOAST NOTIFICATIONS ==================

window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) {
    return;
  }
  
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
};

// ================== CONFIRMATION DIALOG ==================

function showConfirmDialog({ title, message, details, icon, confirmText, confirmClass }) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirm-dialog-overlay');
    const iconEl = document.getElementById('confirm-dialog-icon');
    const titleEl = document.getElementById('confirm-dialog-title');
    const messageEl = document.getElementById('confirm-dialog-message');
    const detailsEl = document.getElementById('confirm-dialog-details');
    const cancelBtn = document.getElementById('confirm-dialog-cancel');
    const confirmBtn = document.getElementById('confirm-dialog-confirm');

    if (!overlay) { resolve(window.confirm(message || title)); return; }

    if (iconEl) iconEl.textContent = icon || '⚠️';
    if (titleEl) titleEl.textContent = title || 'Confirm Action';
    if (messageEl) messageEl.textContent = message || 'Are you sure?';
    if (detailsEl) {
      if (details) {
        detailsEl.innerHTML = escapeHtml(details);
        detailsEl.style.display = 'block';
      } else {
        detailsEl.style.display = 'none';
      }
    }
    if (confirmBtn) {
      confirmBtn.textContent = confirmText || 'Confirm';
      confirmBtn.className = 'btn ' + (confirmClass || 'btn-danger');
    }

    overlay.classList.add('active');

    function cleanup() {
      overlay.classList.remove('active');
      cancelBtn.removeEventListener('click', onCancel);
      confirmBtn.removeEventListener('click', onConfirm);
      overlay.removeEventListener('click', onOverlayClick);
    }
    function onCancel() { cleanup(); resolve(false); }
    function onConfirm() { cleanup(); resolve(true); }
    function onOverlayClick(e) { if (e.target === overlay) { cleanup(); resolve(false); } }

    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);
    overlay.addEventListener('click', onOverlayClick);
  });
}

// ================== ROLE-BASED ACCESS ==================

function isSuperAdmin() {
  return ADMIN_ROLE === 'super-admin';
}

function requireSuperAdmin(actionName) {
  if (!isSuperAdmin()) {
    showToast(`${actionName || 'This action'} requires super-admin access`, 'error');
    return false;
  }
  return true;
}

function applyRoleRestrictions() {
  if (ADMIN_ROLE === 'moderator') {
    document.querySelectorAll('[data-require-super-admin]').forEach(el => {
      el.style.display = 'none';
    });
  } else {
    document.querySelectorAll('[data-require-super-admin]').forEach(el => {
      el.style.display = '';
    });
  }
  const roleBadgeEl = document.getElementById('admin-role-badge');
  if (roleBadgeEl) {
    roleBadgeEl.className = 'role-badge ' + ADMIN_ROLE;
    roleBadgeEl.textContent = ADMIN_ROLE === 'super-admin' ? 'Super Admin' : 'Moderator';
  }
}

// ================== SESSION TIMEOUT ==================

let sessionTimeoutTimer = null;
let sessionWarningTimer = null;
let sessionCountdownInterval = null;
let sessionLastActivity = Date.now();

function resetSessionTimeout() {
  sessionLastActivity = Date.now();
  const warningEl = document.getElementById('session-timeout-warning');
  if (warningEl) warningEl.style.display = 'none';
  if (sessionCountdownInterval) { clearInterval(sessionCountdownInterval); sessionCountdownInterval = null; }
  if (sessionTimeoutTimer) clearTimeout(sessionTimeoutTimer);
  if (sessionWarningTimer) clearTimeout(sessionWarningTimer);

  if (!isAdminAuthenticated) return;

  sessionWarningTimer = setTimeout(() => {
    showSessionWarning();
  }, SESSION_TIMEOUT_MS - SESSION_WARNING_MS);

  sessionTimeoutTimer = setTimeout(() => {
    sessionLogout();
  }, SESSION_TIMEOUT_MS);
}

function showSessionWarning() {
  const warningEl = document.getElementById('session-timeout-warning');
  const countdownEl = document.getElementById('session-timeout-countdown');
  if (!warningEl) return;

  warningEl.style.display = 'block';
  let remaining = Math.ceil(SESSION_WARNING_MS / 1000);

  if (sessionCountdownInterval) clearInterval(sessionCountdownInterval);
  sessionCountdownInterval = setInterval(() => {
    remaining--;
    if (countdownEl) countdownEl.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(sessionCountdownInterval);
      sessionCountdownInterval = null;
    }
  }, 1000);
}

function sessionLogout() {
  const warningEl = document.getElementById('session-timeout-warning');
  if (warningEl) warningEl.style.display = 'none';
  if (sessionCountdownInterval) { clearInterval(sessionCountdownInterval); sessionCountdownInterval = null; }

  clearAll2FASessions();
  isAdminAuthenticated = false;
  showToast('Session expired due to inactivity. Please re-authenticate.', 'warning');
  show2FAOverlay();
}

function initSessionTimeout() {
  const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
  let throttle = false;
  events.forEach(evt => {
    document.addEventListener(evt, () => {
      if (throttle) return;
      throttle = true;
      setTimeout(() => { throttle = false; }, 5000);
      if (isAdminAuthenticated) resetSessionTimeout();
    }, { passive: true });
  });

  const extendBtn = document.getElementById('session-timeout-extend');
  if (extendBtn) {
    extendBtn.addEventListener('click', () => {
      resetSessionTimeout();
      showToast('Session extended', 'success');
    });
  }
}

initSessionTimeout();

const roleObserver = new MutationObserver(() => {
  if (ADMIN_ROLE === 'moderator') {
    document.querySelectorAll('[data-require-super-admin]').forEach(el => {
      if (el.style.display !== 'none') el.style.display = 'none';
    });
  }
});
roleObserver.observe(document.body, { childList: true, subtree: true });

// ================== AUDIT LOGGING (CLIENT-SIDE) ==================

async function logAdminActionClient(action, target, targetType, details, before, after) {
  try {
    const hdrs = await getAuthHeaders();
    fetch('/.netlify/functions/admin-audit-log', {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({
        action: action,
        target: target || null,
        targetType: targetType || null,
        details: details || null,
        before: before || null,
        after: after || null
      })
    }).catch(err => console.error('[Admin] Audit log request failed:', err.message));
  } catch (err) {
    console.error('[Admin] Failed to write audit log:', err.message);
  }
}

// ================== AUDIT LOG VIEWER ==================

let auditLogsLoaded = false;

window.loadAuditLogs = async function() {
  if (!isAdminAuthenticated) {
    showToast('Not authenticated', 'error');
    return;
  }

  const filterEl = document.getElementById('audit-action-filter');
  const actionFilter = filterEl ? filterEl.value : 'all';
  const tbody = document.getElementById('audit-log-data');
  const mobileCards = document.getElementById('audit-log-mobile-cards');

  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="hint">Loading audit logs...</td></tr>';
  if (mobileCards) mobileCards.innerHTML = '';

  toggleSpinner(true);

  try {
    let q;
    if (actionFilter === 'all') {
      q = query(collection(db, 'adminLogs'), orderBy('timestamp', 'desc'), limit(100));
    } else {
      q = query(collection(db, 'adminLogs'), where('action', '==', actionFilter), orderBy('timestamp', 'desc'), limit(100));
    }

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="hint">No audit logs found.</td></tr>';
      if (mobileCards) mobileCards.innerHTML = '<div class="mobile-card"><div class="hint" style="text-align:center;">No audit logs found.</div></div>';
      showToast('No audit logs found', 'info');
      return;
    }

    if (tbody) tbody.innerHTML = '';
    let cardsHtml = '';

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const actionLabel = formatAuditAction(data.action);
      const actionBadgeClass = getAuditActionClass(data.action);
      const detailsStr = data.details ? JSON.stringify(data.details) : '';
      const shortDetails = detailsStr.length > 80 ? detailsStr.substring(0, 80) + '...' : detailsStr;

      if (tbody) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-size:12px; white-space:nowrap;">${formatDate(data.timestamp)}</td>
          <td style="font-size:12px;">${escapeHtml(data.adminEmail || '—')}</td>
          <td><span class="audit-action-badge ${actionBadgeClass}">${escapeHtml(actionLabel)}</span></td>
          <td style="font-size:12px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(data.target || '—')}</td>
          <td style="font-size:11px; color:var(--text-muted); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(detailsStr)}">${escapeHtml(shortDetails || '—')}</td>
        `;
        tbody.appendChild(tr);
      }

      cardsHtml += `
        <div class="mobile-card">
          <div class="mobile-card-header">
            <div>
              <div class="mobile-card-title">${escapeHtml(actionLabel)}</div>
              <div class="mobile-card-subtitle">${escapeHtml(data.adminEmail || '—')}</div>
            </div>
            <span class="audit-action-badge ${actionBadgeClass}">${escapeHtml(actionLabel)}</span>
          </div>
          <div class="mobile-card-body">
            <div class="mobile-card-row">
              <span class="mobile-card-label">Time</span>
              <span class="mobile-card-value">${formatDate(data.timestamp)}</span>
            </div>
            <div class="mobile-card-row">
              <span class="mobile-card-label">Target</span>
              <span class="mobile-card-value" style="word-break:break-all;">${escapeHtml(data.target || '—')}</span>
            </div>
          </div>
        </div>
      `;
    });

    if (mobileCards) mobileCards.innerHTML = cardsHtml;
    showToast(`Loaded ${snapshot.size} audit log entries`, 'success');
    auditLogsLoaded = true;

  } catch (err) {
    console.error('[Admin] Error loading audit logs:', err);
    const errorMsg = getDbErrorMessage(err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="hint" style="color:var(--danger);">${errorMsg}</td></tr>`;
    showToast(errorMsg, 'error');
  } finally {
    toggleSpinner(false);
  }
};

function formatAuditAction(action) {
  const labels = {
    'user_status_change': 'User Status Change',
    'user_field_change': 'User Field Change',
    'user_delete': 'User Deleted',
    'signal_edit': 'Signal Edited',
    'signal_delete': 'Signal Deleted',
    'batch_approve': 'Batch Approved',
    'ticket_delete': 'Ticket Deleted',
    'ticket_status_change': 'Ticket Status Change',
    'review_approve': 'Review Approved',
    'review_delete': 'Review Deleted',
    'review_edit': 'Review Edited',
    'review_reply_save': 'Review Reply Saved',
    'review_reply_delete': 'Review Reply Deleted',
    'promo_create': 'Promo Created',
    'promo_delete': 'Promo Deleted',
    'promo_toggle': 'Promo Toggled',
    'admin_login': 'Admin Login',
    'ticket_reply': 'Ticket Reply Sent',
    'user_create': 'User Created'
  };
  return labels[action] || action;
}

function getAuditActionClass(action) {
  if (action.includes('delete') || action.includes('ban') || action.includes('suspend')) return 'destructive';
  if (action.includes('approve') || action.includes('login')) return 'approve';
  if (action.includes('edit') || action.includes('change') || action.includes('toggle') || action.includes('reply')) return 'modify';
  return 'info';
}

// ================== DASHBOARD STATS ==================

async function loadPendingBatchCount() {
  try {
    const NF_BASE = '';
    const authHdrs = await getAuthHeaders();
    const resp = await fetch(NF_BASE + '/.netlify/functions/admin-batches', {
      method: 'POST',
      headers: authHdrs,
      body: JSON.stringify({ status: 'pending' })
    });
    const data = await resp.json();
    const count = data.batches ? data.batches.length : 0;
    
    if (navSignalCount) {
      if (count === 0) {
        navSignalCount.style.display = 'none';
      } else {
        navSignalCount.textContent = count.toString();
        navSignalCount.style.display = 'inline-block';
      }
    }
    
    if (signalPendingCountBadge) {
      if (count === 0) {
        signalPendingCountBadge.style.display = 'none';
      } else {
        signalPendingCountBadge.textContent = count.toString();
        signalPendingCountBadge.style.display = 'inline-block';
      }
    }
  } catch (err) {
    console.error("[Admin] Error loading pending batch count:", err);
  }
}

async function loadDashboardStats() {
  
  try {
    // Load open tickets count
    const ticketsQ = query(collection(db, "tickets"), where("status", "==", "open"));
    const ticketsSnap = await getDocs(ticketsQ);
    const openTicketsEl = document.getElementById('stat-open-tickets');
    if (openTicketsEl) openTicketsEl.textContent = ticketsSnap.size;
    
    // Load pending reviews count
    const reviewsQ = query(collection(db, "reviews"), where("status", "==", "pending"));
    const reviewsSnap = await getDocs(reviewsQ);
    const pendingReviewsEl = document.getElementById('stat-pending-reviews');
    if (pendingReviewsEl) pendingReviewsEl.textContent = reviewsSnap.size;
    
    // Load pending users count
    const pendingQ = query(collection(db, "users"), where("status", "==", "pending"), limit(100));
    const pendingSnap = await getDocs(pendingQ);
    const pendingUsersEl = document.getElementById('stat-pending-users');
    if (pendingUsersEl) pendingUsersEl.textContent = pendingSnap.size >= 100 ? '100+' : pendingSnap.size;
    
    // Set users count placeholder
    const usersEl = document.getElementById('stat-users');
    if (usersEl) usersEl.textContent = '--';
    
    // Load pending batch count
    await loadPendingBatchCount();
    
  } catch (err) {
    console.error("[Admin] Error loading dashboard stats:", err);
    showToast("Error loading dashboard stats: " + err.message, "error");
  }
}

window.refreshAllData = async function() {
  if (!isAdminAuthenticated) {
    showToast("Not authenticated", "error");
    return;
  }
  
  showToast('Refreshing...', 'info');
  toggleSpinner(true);
  ticketsLoaded = false;
  reviewsLoaded = false;
  contactsLoaded = false;
  
  try {
    await loadDashboardStats();
    showToast('Dashboard refreshed!', 'success');
  } catch (err) {
    console.error("[Admin] Refresh error:", err);
    showToast('Error refreshing: ' + err.message, 'error');
  } finally {
    toggleSpinner(false);
  }
};

window.filterPendingUsers = async function() {
  if (!isAdminAuthenticated) {
    showToast("Not authenticated", "error");
    return;
  }
  
  showSection('users', document.querySelector('[onclick*=users]'));
  
  if (filterFieldSel) filterFieldSel.value = 'status';
  if (filterValueSel) filterValueSel.value = 'pending';
  
  currentField = 'status';
  currentValue = 'pending';
  lastDoc = null;
  
  toggleSpinner(true);
  
  if (tableBody) tableBody.innerHTML = '<tr><td colspan="9" class="hint">Loading pending users...</td></tr>';
  
  const userMobileCardsEl = document.getElementById("user-mobile-cards");
  if (userMobileCardsEl) userMobileCardsEl.innerHTML = '<div class="mobile-card"><div class="hint" style="text-align:center;">Loading pending users...</div></div>';
  
  try {
    let pendingUsers = [];
    
    if (allUsersCache && allUsersCache.length > 0 && (Date.now() - usersCacheTimestamp) < USER_CACHE_DURATION_MS) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="9" class="hint">Filtering cached data...</td></tr>`;
      allUsersCache.forEach(user => {
        if (String(user.data.status || "").toLowerCase() === "pending") {
          pendingUsers.push({ id: user.id, data: user.data });
        }
      });
    } else {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="9" class="hint">Querying database for pending users...</td></tr>`;
      
      const usersCol = collection(db, "users");
      const valuesToTry = ["pending", "Pending"];
      const seenIds = new Set();
      
      for (const val of valuesToTry) {
        try {
          const q = query(usersCol, where("status", "==", val), limit(200));
          const fetchPromise = getDocs(q);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Query timed out")), 30000)
          );
          const qs = await Promise.race([fetchPromise, timeoutPromise]);
          qs.forEach(docSnap => {
            if (!seenIds.has(docSnap.id)) {
              seenIds.add(docSnap.id);
              pendingUsers.push({ id: docSnap.id, data: docSnap.data() });
            }
          });
        } catch (queryErr) {
          console.warn(`[Admin] Pending query for status=="${val}" failed:`, queryErr.message);
        }
      }
      
      if (pendingUsers.length === 0) {
        try {
          const allUsers = await getAllUsersCached(false, (msg) => {
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="9" class="hint">${msg} — Finding pending...</td></tr>`;
          });
          allUsers.forEach(user => {
            if (String(user.data.status || "").toLowerCase() === "pending") {
              pendingUsers.push({ id: user.id, data: user.data });
            }
          });
        } catch (cacheErr) {
          console.error("[Admin] Full scan failed:", cacheErr);
        }
      }
    }
    
    if (pendingUsers.length === 0) {
      if (tableBody) tableBody.innerHTML = '<tr><td colspan="9" class="hint">No pending users found.</td></tr>';
      if (userMobileCardsEl) userMobileCardsEl.innerHTML = '<div class="mobile-card"><div class="hint" style="text-align:center;">No pending users found.</div></div>';
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      showToast('No pending users found', 'info');
      return;
    }
    
    if (tableBody) tableBody.innerHTML = '';
    let mobileCardsHtml = '';
    pendingUsers.forEach(user => {
      if (tableBody) tableBody.appendChild(renderRow(user.id, user.data));
      mobileCardsHtml += renderUserMobileCard(user.id, user.data);
    });
    if (userMobileCardsEl) userMobileCardsEl.innerHTML = mobileCardsHtml;
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    
    showToast(`Found ${pendingUsers.length} pending users`, 'success');
  } catch (err) {
    console.error("[Admin] Error filtering pending users:", err);
    const errorMsg = getDbErrorMessage(err);
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="9" class="hint" style="color:var(--danger);">${errorMsg}</td></tr>`;
    if (userMobileCardsEl) userMobileCardsEl.innerHTML = `<div class="mobile-card"><div class="hint" style="text-align:center; color:var(--danger);">${errorMsg}</div></div>`;
    showToast(errorMsg, 'error');
  } finally {
    toggleSpinner(false);
  }
};

// ================== ERROR HANDLING ==================

function getDbErrorMessage(err) {
  console.error("[Admin] DB error details:", err.code, err.message);
  
  if (err.code === "failed-precondition" || err.message?.includes("index")) {
    return "Database index required. Please check the console for index creation link.";
  } else if (err.code === "permission-denied") {
    return "Permission denied. Check database security rules.";
  } else if (err.code === "unavailable") {
    return "Database unavailable. Please check your internet connection.";
  } else if (err.code === "not-found") {
    return "Data not found.";
  } else {
    return "Error: " + (err.message || "Unknown error occurred");
  }
}

// ================== USERS SECTION ==================

function renderUserContactInfo(telegram, whatsapp) {
  if (!telegram && !whatsapp) {
    return '<span style="color:var(--text-muted);">—</span>';
  }
  
  let html = '<div style="font-size:11px; line-height:1.4;">';
  if (telegram) {
    const username = sanitizeTelegramUsername(telegram.replace('@', '').trim());
    if (username) {
      html += `<a href="https://t.me/${username}" target="_blank" style="color:#0088cc; text-decoration:none;" title="Open Telegram">📱 @${escapeHtml(username)}</a><br>`;
    }
  }
  if (whatsapp) {
    const cleanNumber = normalizeWhatsAppNumber(whatsapp);
    if (isValidWhatsAppNumber(whatsapp)) {
      html += `<a href="https://wa.me/${cleanNumber}" target="_blank" style="color:#25d366; text-decoration:none;" title="Open WhatsApp">💬 ${escapeHtml(whatsapp)}</a>`;
    } else {
      html += `<span style="color:var(--text-muted);" title="Invalid format">⚠️ ${escapeHtml(whatsapp)}</span>`;
    }
  }
  html += '</div>';
  return html;
}

function getCountryFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '🌍';
  const code = countryCode.toUpperCase();
  return String.fromCodePoint(...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

function sanitizeCoord(val) {
  const n = Number(val);
  return (isFinite(n) && n >= -180 && n <= 180) ? n : null;
}

function renderUserIntelligencePanel(email, data) {
  const t = data.trackingMeta || {};
  const geo = t.lastGeo || t.signupGeo || {};
  const dev = t.deviceInfo || {};
  const ipHistory = (Array.isArray(t.ipHistory) ? t.ipHistory : []).filter(ip => typeof ip === 'string').slice(0, 10);
  const lastIP = (typeof t.lastIP === 'string') ? t.lastIP : '—';
  const fingerprint = (typeof t.deviceFingerprint === 'string' ? t.deviceFingerprint : '') || (typeof data.deviceFingerprint === 'string' ? data.deviceFingerprint : '') || '—';
  const flag = getCountryFlag(typeof geo.countryCode === 'string' ? geo.countryCode : '');
  const locationStr = [geo.city, geo.region, geo.country].filter(v => typeof v === 'string' && v).join(', ') || '—';
  const signupDate = data.signupDate ? formatDate(data.signupDate) : (data.approvedAt ? formatDate(data.approvedAt) : '—');
  const lastLogin = t.lastLoginAt ? formatDate(t.lastLoginAt) : '—';
  const safeLat = sanitizeCoord(geo.lat);
  const safeLng = sanitizeCoord(geo.lng);
  const mapLink = (safeLat !== null && safeLng !== null) ? `https://www.google.com/maps?q=${encodeURIComponent(safeLat + ',' + safeLng)}` : '';
  const osStr = (typeof dev.os === 'string' && dev.os) ? `${dev.os}${typeof dev.osVersion === 'string' && dev.osVersion ? ' ' + dev.osVersion : ''}` : '—';
  const browserStr = (typeof dev.browser === 'string' && dev.browser) ? `${dev.browser}${typeof dev.browserVersion === 'string' && dev.browserVersion ? ' ' + dev.browserVersion : ''}` : '—';
  const screenStr = (typeof dev.screen === 'string' && dev.screen) || (data.signupMeta && typeof data.signupMeta.screen === 'string' ? data.signupMeta.screen : '') || '—';
  const tzStr = (typeof dev.timezone === 'string' && dev.timezone) || (data.signupMeta && typeof data.signupMeta.tz === 'string' ? data.signupMeta.tz : '') || '—';
  const langStr = (typeof dev.language === 'string' && dev.language) || '—';
  const ispStr = (typeof geo.isp === 'string' && geo.isp) || '—';

  let ipHistoryHtml = '';
  if (ipHistory.length > 0) {
    ipHistoryHtml = ipHistory.map(ip => `<span style="display:inline-block;background:rgba(0,255,195,0.08);border:1px solid rgba(0,255,195,0.15);border-radius:4px;padding:2px 8px;font-family:monospace;font-size:11px;margin:2px;">${escapeHtml(String(ip))}</span>`).join('');
  }

  return `
    <div class="user-intel-panel" id="user-intel-panel">
      <div class="user-intel-header" onclick="this.parentElement.classList.toggle('collapsed')">
        <span>🔍 User Intelligence</span>
        <span class="user-intel-toggle">▼</span>
      </div>
      <div class="user-intel-body">
        <div class="user-intel-grid">
          <div class="user-intel-item">
            <div class="user-intel-label">📍 Location</div>
            <div class="user-intel-value">${flag} ${escapeHtml(locationStr)}</div>
          </div>
          <div class="user-intel-item">
            <div class="user-intel-label">🌐 Current IP</div>
            <div class="user-intel-value" style="font-family:monospace;">${escapeHtml(String(lastIP))}</div>
          </div>
          <div class="user-intel-item">
            <div class="user-intel-label">🏢 ISP</div>
            <div class="user-intel-value">${escapeHtml(String(ispStr))}</div>
          </div>
          <div class="user-intel-item">
            <div class="user-intel-label">💻 OS</div>
            <div class="user-intel-value">${escapeHtml(String(osStr))}</div>
          </div>
          <div class="user-intel-item">
            <div class="user-intel-label">🌏 Browser</div>
            <div class="user-intel-value">${escapeHtml(String(browserStr))}</div>
          </div>
          <div class="user-intel-item">
            <div class="user-intel-label">📐 Screen</div>
            <div class="user-intel-value">${escapeHtml(String(screenStr))}</div>
          </div>
          <div class="user-intel-item">
            <div class="user-intel-label">🕐 Timezone</div>
            <div class="user-intel-value">${escapeHtml(String(tzStr))}</div>
          </div>
          <div class="user-intel-item">
            <div class="user-intel-label">🗣️ Language</div>
            <div class="user-intel-value">${escapeHtml(String(langStr))}</div>
          </div>
          <div class="user-intel-item">
            <div class="user-intel-label">🔑 Fingerprint</div>
            <div class="user-intel-value" style="font-family:monospace;font-size:11px;">${escapeHtml(String(fingerprint))}</div>
          </div>
          <div class="user-intel-item">
            <div class="user-intel-label">📅 Signup Date</div>
            <div class="user-intel-value">${signupDate}</div>
          </div>
          <div class="user-intel-item">
            <div class="user-intel-label">🕑 Last Login</div>
            <div class="user-intel-value">${lastLogin}</div>
          </div>
          ${mapLink ? `<div class="user-intel-item">
            <div class="user-intel-label">🗺️ Map</div>
            <div class="user-intel-value"><a href="${escapeHtml(mapLink)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:underline;font-size:12px;">View on Google Maps ↗</a></div>
          </div>` : ''}
        </div>
        ${ipHistory.length > 0 ? `
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
          <div class="user-intel-label" style="margin-bottom:6px;">📋 IP History (last ${ipHistory.length})</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">${ipHistoryHtml}</div>
        </div>` : ''}
      </div>
    </div>
  `;
}

function renderRow(email, data) {
  const contactInfo = renderUserContactInfo(data.telegramUsername, data.whatsappNumber);
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${escapeHtml(email)}</td>
    <td>
      <label class="switch">
        <input type="checkbox" ${data.status === "approved" ? "checked" : ""}
               onchange="toggleSwitchStatus('${escapeHtml(email)}', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="margin-top:4px;">${statusBadge(data.status)}</div>
    </td>
    <td>
      <label class="switch">
        <input type="checkbox" ${data.paymentStatus === "approved" ? "checked" : ""}
               onchange="toggleSwitchField('${escapeHtml(email)}', 'paymentStatus', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="margin-top:4px;">${statusBadge(data.paymentStatus)}</div>
    </td>
    <td>
      <label class="switch">
        <input type="checkbox" ${data.quotexStatus === "approved" ? "checked" : ""}
               onchange="toggleSwitchField('${escapeHtml(email)}', 'quotexStatus', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="margin-top:4px;">${statusBadge(data.quotexStatus)}</div>
    </td>
    <td>
      <label class="switch">
        <input type="checkbox" ${data.recoveryRequest === "approved" ? "checked" : ""}
               onchange="toggleSwitchField('${escapeHtml(email)}', 'recoveryRequest', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="margin-top:4px;">${statusBadge(data.recoveryRequest)}</div>
    </td>
    <td>
      <label class="switch">
        <input type="checkbox" ${data.digimaxStatus === "approved" ? "checked" : ""}
               onchange="toggleSwitchField('${escapeHtml(email)}', 'digimaxStatus', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="margin-top:4px;">${statusBadge(data.digimaxStatus)}</div>
    </td>
    <td>${contactInfo}</td>
    <td style="font-size:12px;">${formatDate(data.approvedAt)}</td>
    <td><button class="btn btn-sm btn-danger" onclick="deleteUserAccount('${escapeHtml(email)}')" data-require-super-admin>🗑️ Delete</button></td>
  `;
  return tr;
}

function renderUserMobileCard(email, data) {
  const telegram = data.telegramUsername;
  const whatsapp = data.whatsappNumber;
  
  let contactHtml = '';
  if (telegram || whatsapp) {
    contactHtml = '<div class="mobile-card-contact">';
    if (telegram) {
      const username = sanitizeTelegramUsername(telegram.replace('@', '').trim());
      if (username) contactHtml += `<a href="https://t.me/${username}" target="_blank" class="contact-btn-mobile" title="Telegram">📱</a>`;
    }
    if (whatsapp) {
      const cleanNumber = normalizeWhatsAppNumber(whatsapp);
      if (isValidWhatsAppNumber(whatsapp)) {
        contactHtml += `<a href="https://wa.me/${cleanNumber}" target="_blank" class="contact-btn-mobile" title="WhatsApp">💬</a>`;
      }
    }
    contactHtml += '</div>';
  }
  
  return `
    <div class="mobile-card">
      <div class="mobile-card-header">
        <div>
          <div class="mobile-card-title" style="font-size:13px; word-break:break-all;">${escapeHtml(email)}</div>
          <div class="mobile-card-subtitle">Approved: ${formatDate(data.approvedAt)}</div>
        </div>
        ${statusBadge(data.status)}
      </div>
      <div class="user-status-grid">
        <div class="user-status-item">
          <span class="label">Status</span>
          <label class="switch" style="transform:scale(0.85);">
            <input type="checkbox" ${data.status === "approved" ? "checked" : ""} onchange="toggleSwitchStatus('${escapeHtml(email)}', this.checked)">
            <span class="slider"></span>
          </label>
        </div>
        <div class="user-status-item">
          <span class="label">Payment</span>
          <label class="switch" style="transform:scale(0.85);">
            <input type="checkbox" ${data.paymentStatus === "approved" ? "checked" : ""} onchange="toggleSwitchField('${escapeHtml(email)}', 'paymentStatus', this.checked)">
            <span class="slider"></span>
          </label>
        </div>
        <div class="user-status-item">
          <span class="label">Quotex</span>
          <label class="switch" style="transform:scale(0.85);">
            <input type="checkbox" ${data.quotexStatus === "approved" ? "checked" : ""} onchange="toggleSwitchField('${escapeHtml(email)}', 'quotexStatus', this.checked)">
            <span class="slider"></span>
          </label>
        </div>
        <div class="user-status-item">
          <span class="label">Recovery</span>
          <label class="switch" style="transform:scale(0.85);">
            <input type="checkbox" ${data.recoveryRequest === "approved" ? "checked" : ""} onchange="toggleSwitchField('${escapeHtml(email)}', 'recoveryRequest', this.checked)">
            <span class="slider"></span>
          </label>
        </div>
        <div class="user-status-item">
          <span class="label">Digimaxx</span>
          <label class="switch" style="transform:scale(0.85);">
            <input type="checkbox" ${data.digimaxStatus === "approved" ? "checked" : ""} onchange="toggleSwitchField('${escapeHtml(email)}', 'digimaxStatus', this.checked)">
            <span class="slider"></span>
          </label>
        </div>
      </div>
      ${contactHtml}
      <div class="mobile-card-actions">
        <button class="btn btn-sm btn-danger" onclick="deleteUserAccount('${escapeHtml(email)}')" data-require-super-admin>🗑️ Delete Account</button>
      </div>
    </div>
  `;
}

async function deleteUserAccount(email) {
  if (!requireSuperAdmin('User deletion')) return;

  const confirmed = await showConfirmDialog({
    title: 'Delete User Account',
    message: `Permanently delete the account for ${email}?`,
    details: 'This will:\n- Remove from authentication system\n- Delete user data from database\n- The user will see a deletion notice on login\n\nThis action CANNOT be undone.',
    icon: '🗑️',
    confirmText: 'Delete Permanently'
  });
  if (!confirmed) return;

  try {
    const authHdrs = await getAuthHeaders();
    const resp = await fetch('/.netlify/functions/delete-account', {
      method: 'POST',
      headers: authHdrs,
      body: JSON.stringify({ userEmail: email })
    });

    const data = await resp.json();

    if (resp.ok && data.success) {
      showToast(data.message || 'Account deleted successfully', 'success');
      logAdminActionClient('user_delete', email, 'user', { method: 'account_deletion' });
      invalidateUsersCache();

      const rows = document.querySelectorAll('#user-data tr');
      rows.forEach(row => {
        const firstTd = row.querySelector('td');
        if (firstTd && firstTd.textContent.trim().toLowerCase() === email.toLowerCase()) {
          row.remove();
        }
      });

      const cards = document.querySelectorAll('#user-mobile-cards .mobile-card');
      cards.forEach(card => {
        const title = card.querySelector('.mobile-card-title');
        if (title && title.textContent.trim().toLowerCase() === email.toLowerCase()) {
          card.remove();
        }
      });
    } else {
      showToast(data.message || 'Failed to delete account', 'error');
    }
  } catch (err) {
    console.error('[Admin] Delete account error:', err);
    showToast('Error deleting account: ' + err.message, 'error');
  }
}

window.deleteUserAccount = deleteUserAccount;

const userMobileCards = document.getElementById("user-mobile-cards");

function setTableMessage(msg, isError = false) {
  const style = isError ? 'color:var(--danger);' : '';
  if (tableBody) tableBody.innerHTML = `<tr><td colspan="9" class="hint" style="${style}">${msg}</td></tr>`;
  if (userMobileCards) userMobileCards.innerHTML = `<div class="mobile-card"><div class="hint" style="text-align:center;${style}">${msg}</div></div>`;
}

if (searchBtn) {
  searchBtn.addEventListener("click", async () => {
    const raw = searchInput?.value || "";
    const typedLower = cleanEmail(raw);
    if (!typedLower) {
      showToast("Please enter an email to search", "warning");
      return;
    }

    toggleSpinner(true);
    if (tableBody) tableBody.innerHTML = "";
    if (userMobileCards) userMobileCards.innerHTML = "";
    setTableMessage(`Searching for "${typedLower}"...`);

    try {
      let foundDoc = null;
      
      let snap = await getDoc(doc(db, "users", typedLower));
      if (snap.exists()) {
        foundDoc = { id: snap.id, data: snap.data() };
      }
      
      if (!foundDoc && raw.trim().toLowerCase() !== typedLower) {
        snap = await getDoc(doc(db, "users", raw.trim().toLowerCase()));
        if (snap.exists()) {
          foundDoc = { id: snap.id, data: snap.data() };
        }
      }
      
      if (!foundDoc) {
        const usersCol = collection(db, "users");
        let qs = await getDocs(query(usersCol, where("emailLower", "==", typedLower), limit(1)));
        if (!qs.empty) {
          const d = qs.docs[0];
          foundDoc = { id: d.id, data: d.data() };
        }
      }
      
      if (!foundDoc) {
        const usersCol = collection(db, "users");
        let qs = await getDocs(query(usersCol, where("email", "==", raw.trim()), limit(1)));
        if (qs.empty) {
          qs = await getDocs(query(usersCol, where("emailLower", "==", typedLower), limit(1)));
        }
        if (!qs.empty) {
          const d = qs.docs[0];
          foundDoc = { id: d.id, data: d.data() };
        }
      }
      
      if (!foundDoc && allUsersCache && allUsersCache.length > 0) {
        for (const u of allUsersCache) {
          if (u.id.toLowerCase() === typedLower || 
              String(u.data.email || "").toLowerCase() === typedLower ||
              String(u.data.emailLower || "") === typedLower) {
            foundDoc = { id: u.id, data: u.data };
            break;
          }
        }
      }
      
      if (foundDoc) {
        if (tableBody) tableBody.appendChild(renderRow(foundDoc.id, foundDoc.data));
        if (userMobileCards) userMobileCards.innerHTML = renderUserMobileCard(foundDoc.id, foundDoc.data);
        const intelContainer = document.getElementById('user-intel-container');
        if (intelContainer) {
          intelContainer.innerHTML = renderUserIntelligencePanel(foundDoc.id, foundDoc.data);
          intelContainer.style.display = 'block';
        }
        showToast("User found!", "success");
      } else {
        setTableMessage("User not found");
        showToast("User not found", "info");
        const intelContainer = document.getElementById('user-intel-container');
        if (intelContainer) { intelContainer.innerHTML = ''; intelContainer.style.display = 'none'; }
      }
    } catch (e) {
      console.error("[Admin] Search error:", e);
      setTableMessage("Error loading user: " + e.message, true);
      showToast("Error searching: " + e.message, "error");
      const intelContainer = document.getElementById('user-intel-container');
      if (intelContainer) { intelContainer.innerHTML = ''; intelContainer.style.display = 'none'; }
    } finally {
      toggleSpinner(false);
      currentField = null; currentValue = null; lastDoc = null;
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
    }
  });
}

if (searchInput) {
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchBtn?.click();
  });
}

if (prefixBtn) {
  prefixBtn.addEventListener("click", async () => {
    const raw = searchInput?.value || "";
    const p = cleanEmail(raw);
    if (!p) {
      showToast("Please enter a prefix to search", "warning");
      return;
    }

    toggleSpinner(true);
    if (tableBody) tableBody.innerHTML = "";
    if (userMobileCards) userMobileCards.innerHTML = "";
    
    try {
      const end = p.slice(0, -1) + String.fromCharCode(p.charCodeAt(p.length - 1) + 1);
      const usersCol = collection(db, "users");
      const qy = query(
        usersCol,
        orderBy("emailLower"),
        where("emailLower", ">=", p),
        where("emailLower", "<", end),
        limit(PAGE_SIZE)
      );
      const qs = await getDocs(qy);
      
      if (qs.empty) {
        setTableMessage("No matches found");
        showToast("No matches found", "info");
      } else {
        let mobileCardsHtml = '';
        qs.forEach(d => {
          if (tableBody) tableBody.appendChild(renderRow(d.id, d.data()));
          mobileCardsHtml += renderUserMobileCard(d.id, d.data());
        });
        if (userMobileCards) userMobileCards.innerHTML = mobileCardsHtml;
        showToast(`Found ${qs.size} users`, "success");
      }
      currentField = null; currentValue = null; lastDoc = null;
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
    } catch (e) {
      console.error("[Admin] Prefix search error:", e);
      setTableMessage("Error: " + e.message, true);
      showToast("Error: " + e.message, "error");
    } finally {
      toggleSpinner(false);
    }
  });
}

const createMissingBtn = document.getElementById("create-missing-btn");
if (createMissingBtn) {
  createMissingBtn.addEventListener("click", async () => {
    const raw = searchInput?.value || "";
    const emailLower = cleanEmail(raw);
    if (!emailLower) {
      showToast("Please enter an email first", "warning");
      return;
    }

    const existingSnap = await getDoc(doc(db, "users", emailLower));
    if (existingSnap.exists()) {
      showToast("User already exists in database!", "info");
      searchBtn?.click();
      return;
    }

    const createConfirmed = await showConfirmDialog({
      title: 'Create User Record',
      message: `Create database document for "${emailLower}"?`,
      details: 'This will create a new user record with pending status for all services.',
      icon: '➕',
      confirmText: 'Create User',
      confirmClass: 'btn-primary'
    });
    if (!createConfirmed) return;

    toggleSpinner(true);
    try {
      await setDoc(doc(db, "users", emailLower), {
        email: raw.trim(),
        emailLower: emailLower,
        status: "approved",
        paymentStatus: "pending",
        quotexStatus: "pending",
        digimaxStatus: "pending",
        recoveryRequest: "pending",
        DigimunXAdv: "pending",
        approvedAt: null,
        signupDate: serverTimestamp(),
        addedByAdmin: true
      });
      logAdminActionClient('user_create', emailLower, 'user', { addedByAdmin: true });
      showToast("User created successfully!", "success");
      searchBtn?.click();
    } catch (e) {
      console.error("[Admin] Create user error:", e);
      showToast("Error creating user: " + e.message, "error");
    } finally {
      toggleSpinner(false);
    }
  });
}

// ============ MIGRATION TOOL ============
let migrationPaused = false;
let migrationRunning = false;
let migrationQueue = [];
let migrationProcessed = 0;
let migrationTotal = 0;

const startMigrationBtn = document.getElementById("start-migration-btn");
const pauseMigrationBtn = document.getElementById("pause-migration-btn");
const resumeMigrationBtn = document.getElementById("resume-migration-btn");
const migrationProgress = document.getElementById("migration-progress");
const migrationStatus = document.getElementById("migration-status");
const migrationCount = document.getElementById("migration-count");
const migrationBar = document.getElementById("migration-bar");

function updateMigrationUI() {
  if (migrationCount) migrationCount.textContent = `${migrationProcessed}/${migrationTotal}`;
  if (migrationBar) migrationBar.style.width = migrationTotal > 0 ? `${(migrationProcessed / migrationTotal) * 100}%` : '0%';
}

async function processMigrationBatch() {
  const BATCH_SIZE = 50;
  
  while (migrationQueue.length > 0 && !migrationPaused) {
    const batch = migrationQueue.splice(0, BATCH_SIZE);
    
    for (const user of batch) {
      if (migrationPaused) {
        migrationQueue.unshift(...batch.slice(batch.indexOf(user)));
        return;
      }
      
      try {
        await updateDoc(doc(db, "users", user.id), { DigimunXAdv: "pending" });
        migrationProcessed++;
        updateMigrationUI();
      } catch (e) {
        console.error("[Migration] Error updating user:", user.id, e);
      }
    }
    
    if (migrationStatus) migrationStatus.textContent = `Processing... (${migrationProcessed}/${migrationTotal})`;
    await new Promise(r => setTimeout(r, 100));
  }
  
  if (migrationQueue.length === 0) {
    migrationRunning = false;
    if (migrationStatus) migrationStatus.textContent = `✅ Complete! Updated ${migrationProcessed} users.`;
    if (startMigrationBtn) startMigrationBtn.style.display = "inline-flex";
    if (pauseMigrationBtn) pauseMigrationBtn.style.display = "none";
    if (resumeMigrationBtn) resumeMigrationBtn.style.display = "none";
    invalidateUsersCache();
    showToast(`Migration complete! ${migrationProcessed} users updated.`, "success");
  }
}

if (startMigrationBtn) {
  startMigrationBtn.addEventListener("click", async () => {
    if (migrationRunning) return;
    
    const migConfirmed = await showConfirmDialog({
      title: 'Run Migration',
      message: "Add DigimunXAdv='pending' to all users missing this field?",
      details: 'This bulk operation will update all users who do not yet have the DigimunXAdv field.',
      icon: '🔄',
      confirmText: 'Start Migration',
      confirmClass: 'btn-warning'
    });
    if (!migConfirmed) return;
    
    toggleSpinner(true);
    try {
      const allUsers = await getAllUsersCached(true);
      migrationQueue = allUsers.filter(u => !u.data.DigimunXAdv || u.data.DigimunXAdv === 'undefined');
      migrationTotal = migrationQueue.length;
      migrationProcessed = 0;
      migrationPaused = false;
      
      if (migrationTotal === 0) {
        showToast("All users already have DigimunXAdv field!", "info");
        toggleSpinner(false);
        return;
      }
      
      migrationRunning = true;
      if (migrationProgress) migrationProgress.style.display = "block";
      if (startMigrationBtn) startMigrationBtn.style.display = "none";
      if (pauseMigrationBtn) pauseMigrationBtn.style.display = "inline-flex";
      if (migrationStatus) migrationStatus.textContent = `Starting migration of ${migrationTotal} users...`;
      updateMigrationUI();
      
      toggleSpinner(false);
      processMigrationBatch();
    } catch (e) {
      console.error("[Migration] Error:", e);
      showToast("Migration error: " + e.message, "error");
      toggleSpinner(false);
    }
  });
}

if (pauseMigrationBtn) {
  pauseMigrationBtn.addEventListener("click", () => {
    migrationPaused = true;
    if (pauseMigrationBtn) pauseMigrationBtn.style.display = "none";
    if (resumeMigrationBtn) resumeMigrationBtn.style.display = "inline-flex";
    if (migrationStatus) migrationStatus.textContent = `⏸️ Paused at ${migrationProcessed}/${migrationTotal}`;
    showToast("Migration paused", "info");
  });
}

if (resumeMigrationBtn) {
  resumeMigrationBtn.addEventListener("click", () => {
    migrationPaused = false;
    if (pauseMigrationBtn) pauseMigrationBtn.style.display = "inline-flex";
    if (resumeMigrationBtn) resumeMigrationBtn.style.display = "none";
    if (migrationStatus) migrationStatus.textContent = `Resuming...`;
    showToast("Migration resumed", "success");
    processMigrationBatch();
  });
}

async function runFilter(isNew = true) {
  if (!filterFieldSel || !filterValueSel) return;
  
  currentField = filterFieldSel.value;
  currentValue = filterValueSel.value;
  
  if (isNew) {
    lastDoc = null;
    if (tableBody) tableBody.innerHTML = "";
    if (userMobileCards) userMobileCards.innerHTML = "";
  }
  
  toggleSpinner(true);
  setTableMessage(`Querying ${currentField} = "${currentValue}"...`);
  
  try {
    let matchingDocs = [];
    
    if (allUsersCache && allUsersCache.length > 0 && (Date.now() - usersCacheTimestamp) < USER_CACHE_DURATION_MS) {
      setTableMessage(`Filtering cached data (${allUsersCache.length} users)...`);
      allUsersCache.forEach(user => {
        const fieldValue = String(user.data[currentField] || "").toLowerCase().trim();
        const searchValue = String(currentValue).toLowerCase().trim();
        if (fieldValue === searchValue) {
          matchingDocs.push({ id: user.id, data: user.data });
        }
      });
    } else {
      setTableMessage(`Querying database for ${currentField} = "${currentValue}"...`);
      
      const usersCol = collection(db, "users");
      const valuesToTry = [currentValue];
      const lowerVal = currentValue.toLowerCase();
      const capitalVal = currentValue.charAt(0).toUpperCase() + currentValue.slice(1).toLowerCase();
      if (lowerVal !== currentValue) valuesToTry.push(lowerVal);
      if (capitalVal !== currentValue && capitalVal !== lowerVal) valuesToTry.push(capitalVal);
      
      const seenIds = new Set();
      
      for (const val of valuesToTry) {
        try {
          const q = query(usersCol, where(currentField, "==", val), limit(200));
          const fetchPromise = getDocs(q);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Query timed out after 30 seconds")), 30000)
          );
          const qs = await Promise.race([fetchPromise, timeoutPromise]);
          qs.forEach(docSnap => {
            if (!seenIds.has(docSnap.id)) {
              seenIds.add(docSnap.id);
              matchingDocs.push({ id: docSnap.id, data: docSnap.data() });
            }
          });
        } catch (queryErr) {
          console.warn(`[Admin] Query for ${currentField}=="${val}" failed:`, queryErr.message);
        }
      }
      
      if (matchingDocs.length === 0) {
        setTableMessage(`Direct query returned 0 results. Trying full scan...`);
        try {
          const allUsers = await getAllUsersCached(false, (msg) => {
            setTableMessage(`${msg} — Filtering...`);
          });
          allUsers.forEach(user => {
            const fieldValue = String(user.data[currentField] || "").toLowerCase().trim();
            const searchValue = String(currentValue).toLowerCase().trim();
            if (fieldValue === searchValue) {
              matchingDocs.push({ id: user.id, data: user.data });
            }
          });
        } catch (cacheErr) {
          console.error("[Admin] Full scan also failed:", cacheErr);
        }
      }
    }
    
    if (isNew && tableBody) tableBody.innerHTML = "";
    if (isNew && userMobileCards) userMobileCards.innerHTML = "";
    
    if (matchingDocs.length === 0 && isNew) {
      setTableMessage(`No users found with ${currentField} = "${currentValue}"`);
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
      showToast("No users found", "info");
      return;
    }
    
    let mobileCardsHtml = '';
    matchingDocs.forEach(user => {
      if (tableBody) tableBody.appendChild(renderRow(user.id, user.data));
      mobileCardsHtml += renderUserMobileCard(user.id, user.data);
    });
    if (userMobileCards) userMobileCards.innerHTML = mobileCardsHtml;
    
    if (loadMoreBtn) loadMoreBtn.style.display = "none";
    
    if (isNew) showToast(`Found ${matchingDocs.length} users`, "success");
    
  } catch (e) {
    console.error("[Admin] Filter error:", e);
    const errorMsg = getDbErrorMessage(e);
    setTableMessage(errorMsg, true);
    showToast(errorMsg, "error");
  } finally {
    toggleSpinner(false);
  }
}

if (applyFilterBtn) {
  applyFilterBtn.addEventListener("click", async () => {
    await runFilter(true);
  });
}

if (loadMoreBtn) {
  loadMoreBtn.addEventListener("click", async () => {
    if (_usersPaginated && !currentField && !currentValue) {
      await loadUsersPageToUI(false);
    } else {
      await runFilter(false);
    }
  });
}

if (clearFilterBtn) {
  clearFilterBtn.addEventListener("click", () => {
    currentField = null; currentValue = null; lastDoc = null; _usersPaginated = false;
    if (loadMoreBtn) loadMoreBtn.style.display = "none";
    if (tableBody) tableBody.innerHTML = "";
    if (userMobileCards) userMobileCards.innerHTML = "";
    const intelContainer = document.getElementById('user-intel-container');
    if (intelContainer) { intelContainer.innerHTML = ''; intelContainer.style.display = 'none'; }
    setTableMessage("Filters cleared. Use search or apply a filter.");
    showToast("Filters cleared", "info");
  });
}

let _usersPaginated = false;
let _usersDisplayCount = 0;

async function loadUsersPageToUI(isFirst = false) {
  if (!isAdminAuthenticated) { showToast("Not authenticated", "error"); return; }
  toggleSpinner(true);
  if (isFirst) {
    resetUsersPagination();
    _usersDisplayCount = 0;
    if (tableBody) tableBody.innerHTML = "";
    if (userMobileCards) userMobileCards.innerHTML = "";
    setTableMessage("Loading users...");
  }

  try {
    const page = await loadUsersPage(USERS_PAGE_SIZE);

    if (page.users.length === 0 && isFirst) {
      setTableMessage("No users found.");
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      showToast("No users found", "info");
      return;
    }

    page.users.forEach(user => {
      if (tableBody) tableBody.appendChild(renderRow(user.id, user.data));
      if (userMobileCards) {
        userMobileCards.insertAdjacentHTML('beforeend', renderUserMobileCard(user.id, user.data));
      }
    });

    _usersDisplayCount += page.users.length;

    if (!allUsersCache) allUsersCache = [];
    allUsersCache.push(...page.users);
    usersCacheTimestamp = Date.now();

    if (loadMoreBtn) {
      loadMoreBtn.style.display = page.hasMore ? 'inline-flex' : 'none';
      loadMoreBtn.textContent = `Load More Users (${_usersDisplayCount} loaded)`;
    }

    _usersPaginated = true;
    showToast(`Loaded ${_usersDisplayCount} users${page.hasMore ? ' — click Load More for next page' : ' (all loaded)'}`, "success");
  } catch (e) {
    console.error("[Admin] Load users page error:", e);
    setTableMessage("Error: " + e.message, true);
    showToast("Error loading users: " + e.message, "error");
  } finally {
    toggleSpinner(false);
  }
}

const loadAllBtn = document.getElementById("load-all-btn");
if (loadAllBtn) {
  loadAllBtn.addEventListener("click", async () => {
    if (!isAdminAuthenticated) { showToast("Not authenticated", "error"); return; }

    if (currentField && currentValue) {
      await runFilter(true);
      return;
    }

    loadAllBtn.disabled = true;
    loadAllBtn.textContent = "Loading...";
    try {
      await loadUsersPageToUI(true);
    } finally {
      loadAllBtn.disabled = false;
      loadAllBtn.textContent = "Load Users";
    }
  });
}

window.toggleSwitchStatus = async function (email, isChecked) {
  if (!isAdminAuthenticated) {
    showToast("Not authenticated", "error");
    return;
  }
  
  try {
    toggleSpinner(true);
    const newStatus = isChecked ? "approved" : "pending";
    const updateObj = { status: newStatus };
    if (newStatus === "approved") updateObj.approvedAt = serverTimestamp();
    await updateDoc(doc(db, "users", email), updateObj);
    logAdminActionClient('user_status_change', email, 'user', null, { status: isChecked ? 'pending' : 'approved' }, { status: newStatus });
    invalidateUsersCache();
    await refreshRowOrView(email);
    showToast(`User ${newStatus}!`, "success");
  } catch (e) {
    console.error("[Admin] Toggle status error:", e);
    showToast("Error: " + e.message, "error");
  } finally { toggleSpinner(false); }
};

// Access Duration Modal State
let pendingAccessApproval = { email: null, field: null };

// Initialize Access Duration Modal
function initAccessDurationModal() {
  const modal = document.getElementById("access-duration-modal");
  const closeBtn = document.getElementById("close-access-duration-modal-btn");
  const cancelBtn = document.getElementById("access-cancel-btn");
  const btn24h = document.getElementById("access-24h-btn");
  const btn3day = document.getElementById("access-3day-btn");
  const btnPermanent = document.getElementById("access-permanent-btn");
  
  const hideModal = () => {
    if (modal) modal.classList.remove("active");
    pendingAccessApproval = { email: null, field: null };
  };
  
  if (closeBtn) closeBtn.addEventListener("click", hideModal);
  if (cancelBtn) cancelBtn.addEventListener("click", hideModal);
  if (modal) modal.addEventListener("click", (e) => {
    if (e.target === modal) hideModal();
  });
  
  if (btn24h) btn24h.addEventListener("click", () => processAccessApproval("24h"));
  if (btn3day) btn3day.addEventListener("click", () => processAccessApproval("3day"));
  if (btnPermanent) btnPermanent.addEventListener("click", () => processAccessApproval("permanent"));
}

function showAccessDurationModal(email, field) {
  const modal = document.getElementById("access-duration-modal");
  const title = document.getElementById("access-duration-modal-title");
  
  pendingAccessApproval = { email, field };
  
  const fieldName = field === "recoveryRequest" ? "DigimunX" : "DigiMaxx";
  if (title) title.textContent = `Select ${fieldName} Access Duration`;
  
  if (modal) modal.classList.add("active");
}

async function processAccessApproval(durationType) {
  const { email, field } = pendingAccessApproval;
  if (!email || !field) return;
  
  const modal = document.getElementById("access-duration-modal");
  if (modal) modal.classList.remove("active");
  
  try {
    toggleSpinner(true);
    
    const expiryField = field === "recoveryRequest" ? "recoveryRequestExpiry" : "digimaxStatusExpiry";
    let expiryValue = null;
    if (durationType === "24h") {
      expiryValue = new Date(Date.now() + 24 * 60 * 60 * 1000);
    } else if (durationType === "3day") {
      expiryValue = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    }
    
    const auditHeaders = await getAuthHeaders();
    const auditBody = {
      userEmail: email,
      field: field,
      value: "approved"
    };
    if (expiryValue) {
      auditBody.expiryData = { expiryField, expiryValue: expiryValue.toISOString() };
    }

    const auditResp = await fetch('/.netlify/functions/update-user-field', {
      method: 'POST',
      headers: auditHeaders,
      body: JSON.stringify(auditBody)
    });

    if (!auditResp.ok) {
      const errData = await auditResp.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to update field');
    }
    invalidateUsersCache();
    await refreshRowOrView(email);
    
    const accessLabel = durationType === "permanent" ? "permanent" : durationType === "3day" ? "3-day" : "24-hour";
    showToast(`${field} approved with ${accessLabel} access!`, "success");
    
    // Send automated emails
    try {
      const userDoc = await getDoc(doc(db, "users", email));
      const userData = userDoc.exists() ? userDoc.data() : {};
      const userName = userData.name || userData.displayName || "User";
      
      let emailEndpoint = null;
      let emailType = null;
      
      if (field === "recoveryRequest") {
        emailEndpoint = "/.netlify/functions/send-digimunx-access-email";
        emailType = "DigimunX";
      } else if (field === "digimaxStatus") {
        emailEndpoint = "/.netlify/functions/send-digimaxx-access-email";
        emailType = "DigiMaxx";
      }
      
      if (emailEndpoint) {
        const accessTypeValue = durationType === "permanent" ? "permanent" : durationType;
        const emailAuthHdrs = await getAuthHeaders();
        const response = await fetch(emailEndpoint, {
          method: "POST",
          headers: emailAuthHdrs,
          body: JSON.stringify({ to_email: email, to_name: userName, access_type: accessTypeValue })
        });
        
        if (response.ok) {
          showToast(`${emailType} access email sent!`, "success");
        } else {
          console.error(`[Admin] Failed to send ${emailType} email`);
        }
      }
    } catch (emailErr) {
      console.error("[Admin] Email error:", emailErr);
    }
  } catch (e) {
    console.error("[Admin] Approval error:", e);
    showToast("Error: " + e.message, "error");
  } finally {
    toggleSpinner(false);
    pendingAccessApproval = { email: null, field: null };
  }
}

// Initialize modal immediately - module loads after DOM is parsed
initAccessDurationModal();

window.toggleSwitchField = async function (email, field, isChecked) {
  if (!isAdminAuthenticated) {
    showToast("Not authenticated", "error");
    return;
  }
  
  // For recoveryRequest and digimaxStatus approvals, show the access duration modal
  if (isChecked && (field === "recoveryRequest" || field === "digimaxStatus")) {
    showAccessDurationModal(email, field);
    return;
  }
  
  try {
    toggleSpinner(true);
    const newValue = isChecked ? "approved" : "pending";
    
    const auditHeaders = await getAuthHeaders();
    const auditBody = {
      userEmail: email,
      field: field,
      value: newValue
    };

    if (!isChecked && (field === "recoveryRequest" || field === "digimaxStatus")) {
      const expiryField = field === "recoveryRequest" ? "recoveryRequestExpiry" : "digimaxStatusExpiry";
      auditBody.expiryData = null;
    }

    const auditResp = await fetch('/.netlify/functions/update-user-field', {
      method: 'POST',
      headers: auditHeaders,
      body: JSON.stringify(auditBody)
    });

    if (!auditResp.ok) {
      const errData = await auditResp.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to update field');
    }
    logAdminActionClient('user_field_change', email, 'user', { field }, { [field]: isChecked ? 'pending' : 'approved' }, { [field]: newValue });
    invalidateUsersCache();
    await refreshRowOrView(email);
    showToast(`${field} ${newValue}!`, "success");
    
    if (newValue === "approved") {
      try {
        const userDoc = await getDoc(doc(db, "users", email));
        const userData = userDoc.exists() ? userDoc.data() : {};
        const userName = userData.name || userData.displayName || "User";
        
        let emailEndpoint = null;
        let emailType = null;
        
        if (field === "quotexStatus") {
          emailEndpoint = "/.netlify/functions/send-probot-access-email";
          emailType = "Pro Bot";
        }
        
        if (emailEndpoint) {
          const emailAuthHdrs2 = await getAuthHeaders();
          const response = await fetch(emailEndpoint, {
            method: "POST",
            headers: emailAuthHdrs2,
            body: JSON.stringify({ to_email: email, to_name: userName })
          });
          
          if (response.ok) {
            showToast(`${emailType} access email sent!`, "success");
          } else {
            console.error(`[Admin] Failed to send ${emailType} email`);
          }
        }
      } catch (emailErr) {
        console.error("[Admin] Email error:", emailErr);
      }
    }
  } catch (e) {
    console.error("[Admin] Toggle field error:", e);
    showToast("Error: " + e.message, "error");
  } finally { toggleSpinner(false); }
};

async function refreshRowOrView(email) {
  if (currentField && currentValue) return runFilter(true);
  const typedLower = cleanEmail(searchInput?.value || "");
  if (typedLower) return searchBtn?.click();
  if (tableBody) tableBody.innerHTML = "";
  const snap = await getDoc(doc(db, "users", email));
  if (snap.exists() && tableBody) tableBody.appendChild(renderRow(email, snap.data()));
}

// ================== TICKETS SECTION ==================

function ticketStatusBadge(status) {
  const s = (status || "open").toLowerCase();
  const labels = { 'open': 'Open', 'replied': 'Replied', 'waiting-user': 'Waiting for User', 'waiting-support': 'Waiting for Support', 'closed': 'Closed' };
  return `<span class="ticket-status-pill s-${s}">${labels[s] || s}</span>`;
}

function renderContactIcons(telegram, whatsapp) {
  let icons = [];
  if (telegram) icons.push(`<span title="Telegram: ${escapeHtml(telegram)}" style="cursor:help;">📱</span>`);
  if (whatsapp) icons.push(`<span title="WhatsApp: ${escapeHtml(whatsapp)}" style="cursor:help;">💬</span>`);
  return icons.length > 0 ? icons.join(' ') : '<span style="color:var(--text-muted);">—</span>';
}

function renderTicketRow(ticketId, data) {
  const repliesCount = (data.replies && Array.isArray(data.replies)) ? data.replies.length : 0;
  const contactIcons = renderContactIcons(data.telegramUsername, data.whatsappNumber);
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td style="font-size:12px;">${formatDate(data.createdAt)}</td>
    <td>${escapeHtml(data.name) || "—"}</td>
    <td style="font-size:12px;">${escapeHtml(data.email) || "—"}</td>
    <td>${escapeHtml(data.subject) || "—"}</td>
    <td>${ticketStatusBadge(data.status)}</td>
    <td>${contactIcons}</td>
    <td><span style="background:var(--accent-glow);padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;">${repliesCount}</span></td>
    <td>
      <button class="btn btn-primary btn-sm" onclick="viewTicket('${ticketId}')">View</button>
    </td>
  `;
  return tr;
}

function renderTicketMobileCard(ticketId, data) {
  const repliesCount = (data.replies && Array.isArray(data.replies)) ? data.replies.length : 0;
  const telegram = data.telegramUsername;
  const whatsapp = data.whatsappNumber;
  
  let contactHtml = '';
  if (telegram || whatsapp) {
    contactHtml = '<div class="mobile-card-contact">';
    if (telegram) {
      const username = sanitizeTelegramUsername(telegram.replace('@', '').trim());
      if (username) contactHtml += `<a href="https://t.me/${username}" target="_blank" class="contact-btn-mobile" title="Telegram">📱</a>`;
    }
    if (whatsapp) {
      const cleanNumber = normalizeWhatsAppNumber(whatsapp);
      if (isValidWhatsAppNumber(whatsapp)) {
        contactHtml += `<a href="https://wa.me/${cleanNumber}" target="_blank" class="contact-btn-mobile" title="WhatsApp">💬</a>`;
      }
    }
    contactHtml += '</div>';
  }
  
  return `
    <div class="mobile-card">
      <div class="mobile-card-header">
        <div>
          <div class="mobile-card-title">${escapeHtml(data.subject) || "No Subject"}</div>
          <div class="mobile-card-subtitle">${escapeHtml(data.name)} - ${escapeHtml(data.email)}</div>
        </div>
        ${ticketStatusBadge(data.status)}
      </div>
      <div class="mobile-card-body">
        <div class="mobile-card-row">
          <span class="mobile-card-label">Date</span>
          <span class="mobile-card-value">${formatDate(data.createdAt)}</span>
        </div>
        <div class="mobile-card-row">
          <span class="mobile-card-label">Replies</span>
          <span class="mobile-card-value" style="background:var(--accent-glow);padding:2px 8px;border-radius:8px;">${repliesCount}</span>
        </div>
      </div>
      ${contactHtml}
      <div class="mobile-card-actions">
        <button class="btn btn-primary" onclick="viewTicket('${ticketId}')">View Ticket</button>
      </div>
    </div>
  `;
}

async function loadTickets() {
  if (!isAdminAuthenticated) {
    console.warn("[Admin] Not authenticated, cannot load tickets");
    showToast("Please complete authentication first", "error");
    return;
  }
  
  const statusFilter = ticketFilter?.value || "all";
  
  toggleSpinner(true);
  if (ticketData) ticketData.innerHTML = '<tr><td colspan="8" class="hint">Loading tickets...</td></tr>';
  
  const ticketMobileCards = document.getElementById("ticket-mobile-cards");
  if (ticketMobileCards) ticketMobileCards.innerHTML = '<div class="mobile-card"><div class="hint" style="text-align:center;">Loading tickets...</div></div>';

  try {
    const snapshot = await getDocs(collection(db, "tickets"));
    ticketsCache = [];

    if (snapshot.empty) {
      if (ticketData) ticketData.innerHTML = `<tr><td colspan="8" class="hint">No tickets found.</td></tr>`;
      if (ticketMobileCards) ticketMobileCards.innerHTML = '<div class="mobile-card"><div class="hint" style="text-align:center;">No tickets found.</div></div>';
      if (ticketCountBadge) ticketCountBadge.textContent = "0";
      if (navTicketCount) navTicketCount.textContent = "0";
      showToast("No tickets found", "info");
      return;
    }

    const allTickets = [];
    snapshot.forEach(docSnap => {
      allTickets.push({ id: docSnap.id, ...docSnap.data() });
    });

    let filtered = allTickets;
    if (statusFilter !== "all") {
      filtered = allTickets.filter(t => (t.status || "open").toLowerCase() === statusFilter);
    }

    filtered.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : Date.now());
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : Date.now());
      return aTime - bTime;
    });

    if (filtered.length > 100) filtered = filtered.slice(0, 100);

    ticketsCache = filtered;

    if (filtered.length === 0) {
      if (ticketData) ticketData.innerHTML = `<tr><td colspan="8" class="hint">No tickets found.</td></tr>`;
      if (ticketMobileCards) ticketMobileCards.innerHTML = '<div class="mobile-card"><div class="hint" style="text-align:center;">No tickets found.</div></div>';
      if (ticketCountBadge) ticketCountBadge.textContent = "0";
      if (navTicketCount) navTicketCount.textContent = "0";
      showToast("No tickets found", "info");
      return;
    }

    if (ticketData) ticketData.innerHTML = "";
    let mobileCardsHtml = '';
    filtered.forEach(ticket => {
      if (ticketData) ticketData.appendChild(renderTicketRow(ticket.id, ticket));
      mobileCardsHtml += renderTicketMobileCard(ticket.id, ticket);
    });

    if (ticketMobileCards) ticketMobileCards.innerHTML = mobileCardsHtml;
    if (ticketCountBadge) ticketCountBadge.textContent = ticketsCache.length.toString();
    if (navTicketCount) navTicketCount.textContent = ticketsCache.length.toString();
    
    showToast(`${ticketsCache.length} tickets loaded`, "success");

  } catch (err) {
    console.error("[Admin] Error loading tickets:", err);
    const errorMsg = getDbErrorMessage(err);
    if (ticketData) ticketData.innerHTML = `<tr><td colspan="8" class="hint" style="color:var(--danger);">${errorMsg}</td></tr>`;
    if (ticketMobileCards) ticketMobileCards.innerHTML = `<div class="mobile-card"><div class="hint" style="text-align:center; color:var(--danger);">${errorMsg}</div></div>`;
    showToast(errorMsg, 'error');
  } finally {
    toggleSpinner(false);
  }
}

function getStatusPill(status) {
  const s = (status || 'open').toLowerCase();
  const labels = { 'open': 'Open', 'replied': 'Replied', 'waiting-user': 'Waiting for User', 'waiting-support': 'Waiting for Support', 'closed': 'Closed' };
  return `<span class="ticket-status-pill s-${s}">${labels[s] || s}</span>`;
}

function renderChatThread(ticket) {
  const messages = [];
  
  messages.push({
    type: 'user',
    message: ticket.message,
    createdAt: ticket.createdAt,
    isOriginal: true,
    replyIndex: -1
  });
  
  if (ticket.replies && Array.isArray(ticket.replies)) {
    ticket.replies.forEach((reply, idx) => {
      const isAdmin = !!(reply.adminEmail || reply.isAdmin === true || reply.from === 'admin');
      messages.push({
        type: isAdmin ? 'admin' : 'user',
        message: reply.message,
        createdAt: reply.createdAt,
        attachment: reply.attachment,
        isAdmin: isAdmin,
        replyIndex: idx,
        edited: reply.edited || false,
        editedAt: reply.editedAt || null
      });
    });
  }
  
  if (messages.length === 1) {
    return `
      <div class="chat-bubble user-bubble">
        <div class="chat-bubble-header">
          <span class="chat-sender-badge customer">Customer</span>
          <span class="chat-time">${formatDate(ticket.createdAt)}</span>
        </div>
        <div class="chat-bubble-text">${escapeHtml(ticket.message)}</div>
      </div>
      <div class="no-replies">No replies yet. Write your first reply below.</div>
    `;
  }
  
  return messages.map(msg => {
    const bubbleClass = msg.type === 'admin' ? 'admin-bubble' : 'user-bubble';
    const badgeClass = msg.type === 'admin' ? 'admin' : 'customer';
    const label = msg.type === 'admin' ? 'Admin' : (msg.isOriginal ? 'Customer (Original)' : 'Customer');
    
    let attachmentHtml = '';
    if (msg.attachment) {
      const safeUrl = escapeHtml(msg.attachment);
      const isImage = msg.attachment.match(/\.(jpg|jpeg|png|gif|webp)$/i) || msg.attachment.includes('/image/');
      if (isImage) {
        attachmentHtml = `<div style="margin-top:8px;"><img src="${safeUrl}" alt="Attachment" style="max-width:200px; max-height:150px; border-radius:8px; border:1px solid var(--border); cursor:pointer;" onclick="openImageViewer(this.src)"></div>`;
      } else {
        attachmentHtml = `<div style="margin-top:8px;"><a href="${safeUrl}" target="_blank" rel="noopener" style="color:var(--accent); font-size:0.85rem;">📎 View Attachment</a></div>`;
      }
    }
    
    let actionsHtml = '';
    if (msg.type === 'admin' && msg.replyIndex >= 0) {
      actionsHtml = `
        <div class="chat-bubble-actions">
          <button class="chat-action-btn" onclick="editAdminReply(${msg.replyIndex})">✏️ Edit</button>
          <button class="chat-action-btn danger" onclick="deleteAdminReply(${msg.replyIndex})">🗑️ Delete</button>
        </div>
      `;
    }
    
    let editedHtml = '';
    if (msg.edited) {
      editedHtml = `<div class="chat-edited-tag">edited${msg.editedAt ? ' ' + formatDate(msg.editedAt) : ''}</div>`;
    }
    
    return `
      <div class="chat-bubble ${bubbleClass}">
        <div class="chat-bubble-header">
          <span class="chat-sender-badge ${badgeClass}">${label}</span>
          <span class="chat-time">${formatDate(msg.createdAt)}</span>
        </div>
        <div class="chat-bubble-text">${escapeHtml(msg.message)}</div>
        ${attachmentHtml}
        ${editedHtml}
        ${actionsHtml}
      </div>
    `;
  }).join('');
}

function renderAttachments(attachments) {
  if (!attachments || attachments.length === 0) {
    return '';
  }
  
  let html = `
    <div class="modal-field" style="background:rgba(0,212,170,0.05); border:1px solid var(--border-accent); border-radius:8px; padding:12px;">
      <label style="color:var(--accent); display:flex; align-items:center; gap:6px;">
        <span>📎</span> Attachments (${attachments.length})
      </label>
      <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:10px;">
  `;
  
  for (const file of attachments) {
    const isImage = file.type && file.type.startsWith('image/');
    const icon = isImage ? '🖼️' : '📄';
    const size = file.size ? (file.size / 1024).toFixed(1) + ' KB' : '';
    
    const safeFileUrl = escapeHtml(file.url);
    if (isImage) {
      html += `
        <div style="display:block; cursor:pointer;">
          <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:8px; text-align:center; transition:border-color 0.2s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            <img src="${safeFileUrl}" alt="${escapeHtml(file.name)}" style="max-width:120px; max-height:80px; border-radius:4px; display:block; margin-bottom:6px;" onclick="openImageViewer(this.src)">
            <span style="font-size:11px; color:var(--text-muted); display:block;">${escapeHtml(file.name.substring(0, 15))}${file.name.length > 15 ? '...' : ''}</span>
          </div>
        </div>
      `;
    } else {
      html += `
        <a href="${safeFileUrl}" target="_blank" rel="noopener" style="display:flex; align-items:center; gap:8px; background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:10px 14px; text-decoration:none; color:var(--text);">
          <span style="font-size:20px;">${icon}</span>
          <div>
            <div style="font-size:13px; font-weight:500;">${escapeHtml(file.name.substring(0, 20))}${file.name.length > 20 ? '...' : ''}</div>
            <div style="font-size:11px; color:var(--text-muted);">${size}</div>
          </div>
        </a>
      `;
    }
  }
  
  html += '</div></div>';
  return html;
}

function renderContactButtons(telegram, whatsapp) {
  if (!telegram && !whatsapp) {
    return '<p style="color:var(--text-muted); font-style:italic;">No contact info linked</p>';
  }
  
  let html = '<div style="display:flex; gap:8px; flex-wrap:wrap;">';
  
  if (telegram) {
    const username = sanitizeTelegramUsername(telegram.replace('@', '').trim());
    if (username) {
      html += `
        <a href="https://t.me/${username}" target="_blank" class="btn btn-sm" style="background:rgba(0,136,204,0.2); color:#0088cc; border:1px solid rgba(0,136,204,0.3); display:inline-flex; align-items:center; gap:6px;">
          <span style="font-size:14px;">📱</span> Open Telegram @${escapeHtml(username)}
        </a>
      `;
    }
  }
  
  if (whatsapp) {
    const cleanNumber = normalizeWhatsAppNumber(whatsapp);
    if (isValidWhatsAppNumber(whatsapp)) {
      html += `
        <a href="https://wa.me/${cleanNumber}" target="_blank" class="btn btn-sm" style="background:rgba(37,211,102,0.2); color:#25d366; border:1px solid rgba(37,211,102,0.3); display:inline-flex; align-items:center; gap:6px;">
          <span style="font-size:14px;">💬</span> Open WhatsApp ${escapeHtml(whatsapp)}
        </a>
      `;
    } else {
      html += `
        <span class="btn btn-sm" style="background:rgba(255,77,106,0.1); color:var(--text-muted); border:1px solid rgba(255,77,106,0.2); display:inline-flex; align-items:center; gap:6px; cursor:default;">
          <span style="font-size:14px;">⚠️</span> Invalid WhatsApp: ${escapeHtml(whatsapp)}
        </span>
      `;
    }
  }
  
  html += '</div>';
  return html;
}

window.viewTicket = function(ticketId) {
  const ticket = ticketsCache.find(t => t.id === ticketId);
  if (!ticket) {
    console.error("[Admin] Ticket not found in cache:", ticketId);
    showToast("Ticket not found. Please refresh the list.", "error");
    return;
  }

  currentTicketId = ticketId;
  if (modalStatusSelect) modalStatusSelect.value = ticket.status || "open";
  if (replyTextarea) replyTextarea.value = "";

  const chatSubject = document.getElementById('ticket-chat-subject');
  const chatCustomer = document.getElementById('ticket-chat-customer');
  const chatStatusBadge = document.getElementById('ticket-chat-status-badge');
  if (chatSubject) chatSubject.textContent = ticket.subject || 'No Subject';
  if (chatCustomer) chatCustomer.textContent = `${escapeHtml(ticket.name)} • ${escapeHtml(ticket.email)}`;
  if (chatStatusBadge) chatStatusBadge.innerHTML = getStatusPill(ticket.status);

  const hasTelegram = ticket.telegramUsername;
  const hasWhatsapp = ticket.whatsappNumber;

  if (ticketModalContent) {
    ticketModalContent.innerHTML = `
      <div id="ticket-user-intel-container"></div>
      <div class="modal-field">
        <label>Ticket ID</label>
        <p style="font-family:monospace; font-size:12px; color:var(--text-muted);">${ticketId}</p>
      </div>
      <div class="modal-field">
        <label>Submitted</label>
        <p>${formatDate(ticket.createdAt)}</p>
      </div>
      <div class="modal-field">
        <label>Subject / Reason</label>
        <p style="font-weight:600; color:var(--accent);">${escapeHtml(ticket.subject) || "—"}</p>
      </div>
      <div class="modal-field" style="background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2); border-radius:8px; padding:12px;">
        <label style="color:#60a5fa;">Original Message from Customer</label>
        <p style="white-space:pre-wrap; line-height:1.6; margin-top:6px;">${escapeHtml(ticket.message) || "—"}</p>
      </div>
      <div class="modal-field">
        <label>Customer Email</label>
        <p><a href="mailto:${escapeHtml(ticket.email)}" style="color:var(--accent);">${escapeHtml(ticket.email) || "—"}</a></p>
      </div>
      <div class="modal-field" style="background:rgba(0,255,195,0.05); border:1px solid var(--border-accent); border-radius:8px; padding:12px;">
        <label style="color:var(--accent);">Direct Contact</label>
        ${renderContactButtons(hasTelegram, hasWhatsapp)}
      </div>
      ${renderAttachments(ticket.attachments)}
    `;

    if (ticket.email) {
      const ticketUserEmail = ticket.email.trim().toLowerCase();
      getDoc(doc(db, "users", ticketUserEmail)).then(userSnap => {
        const ticketIntelContainer = document.getElementById('ticket-user-intel-container');
        if (userSnap.exists() && ticketIntelContainer) {
          ticketIntelContainer.innerHTML = renderUserIntelligencePanel(ticketUserEmail, userSnap.data());
        }
      }).catch(() => {});
    }
  }

  const infoPanel = document.getElementById('ticket-info-panel');
  if (infoPanel) infoPanel.style.display = 'block';

  if (repliesList) repliesList.innerHTML = renderChatThread(ticket);
  if (ticketModal) {
    ticketModal.classList.add('active');
    document.body.style.overflow = "hidden";
  }

  setTimeout(() => {
    const chatThread = document.getElementById('ticket-chat-thread');
    if (chatThread) chatThread.scrollTop = chatThread.scrollHeight;
  }, 100);
};

function closeTicketModal() {
  if (ticketModal) ticketModal.classList.remove('active');
  currentTicketId = null;
  document.body.style.overflow = "";
  adminReplySelectedFile = null;
  if (adminReplyFilePreview) adminReplyFilePreview.style.display = "none";
  if (adminReplyFileName) adminReplyFileName.textContent = "";
  if (adminReplyAttachment) adminReplyAttachment.value = "";
}

async function sendEmailNotification(ticket, replyMessage, ticketId) {
  try {
    const safeTicketId = ticketId || currentTicketId;
    if (!safeTicketId) {
      console.warn("[Admin] No ticket ID for email notification");
      return;
    }
    const supportAuthHdrs = await getAuthHeaders();
    const response = await fetch("/.netlify/functions/send-support-reply-email", {
      method: "POST",
      headers: supportAuthHdrs,
      body: JSON.stringify({
        to_email: ticket.email,
        to_name: ticket.name || "User",
        subject: `Reply to your ticket: ${ticket.subject}`,
        message: replyMessage,
        ticket_id: safeTicketId
      })
    });
    
    if (response.ok) {
      showToast("Email notification sent to user", "success");
    } else {
      const errorText = await response.text();
      console.warn("[Admin] Email send failed:", errorText);
      showToast("Reply saved, but email notification failed", "warning");
    }
  } catch (err) {
    console.warn("[Admin] Failed to send email notification:", err);
    showToast("Reply saved, but email notification failed", "warning");
  }
}

async function uploadAdminReplyAttachment(file, ticketId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('ticketId', ticketId);
  
  const uploadAuthHdrs = await getAuthHeadersOnly();
  const response = await fetch('/.netlify/functions/upload-ticket-attachment', {
    method: 'POST',
    headers: uploadAuthHdrs,
    body: formData
  });
  
  if (!response.ok) throw new Error('Upload failed');
  const result = await response.json();
  return result.url;
}

async function sendReply(closeAfter = false) {
  if (!currentTicketId) {
    showToast("No ticket selected", "error");
    return;
  }
  
  const replyMessage = replyTextarea?.value?.trim();
  if (!replyMessage && !adminReplySelectedFile) {
    showToast("Please write a reply message or attach a file", "warning");
    return;
  }

  toggleSpinner(true);

  try {
    let attachmentUrl = null;
    
    if (adminReplySelectedFile) {
      try {
        showToast("Uploading attachment...", "info");
        attachmentUrl = await uploadAdminReplyAttachment(adminReplySelectedFile, currentTicketId);
      } catch (uploadErr) {
        console.error("[Admin] Error uploading file:", uploadErr);
        showToast("Failed to upload file. Please try again.", "error");
        toggleSpinner(false);
        return;
      }
    }
    
    const newReply = {
      message: replyMessage || (attachmentUrl ? "Attachment added" : ""),
      createdAt: new Date(),
      adminEmail: ADMIN_EMAIL,
      isAdmin: true
    };
    
    if (attachmentUrl) {
      newReply.attachment = attachmentUrl;
    }

    const updateData = {
      replies: arrayUnion(newReply),
      status: closeAfter ? "closed" : "waiting-user",
      updatedAt: serverTimestamp()
    };

    await updateDoc(doc(db, "tickets", currentTicketId), updateData);
    logAdminActionClient('ticket_reply', currentTicketId, 'ticket', { closeAfter, hasAttachment: !!attachmentUrl });

    const idx = ticketsCache.findIndex(t => t.id === currentTicketId);
    if (idx !== -1) {
      if (!ticketsCache[idx].replies) ticketsCache[idx].replies = [];
      ticketsCache[idx].replies.push(newReply);
      ticketsCache[idx].status = closeAfter ? "closed" : "waiting-user";
      
      sendEmailNotification(ticketsCache[idx], replyMessage, currentTicketId);
    }

    if (replyTextarea) replyTextarea.value = "";
    adminReplySelectedFile = null;
    if (adminReplyFilePreview) adminReplyFilePreview.style.display = "none";
    if (adminReplyFileName) adminReplyFileName.textContent = "";
    if (adminReplyAttachment) adminReplyAttachment.value = "";
    
    if (repliesList && ticketsCache[idx]) repliesList.innerHTML = renderChatThread(ticketsCache[idx]);
    if (modalStatusSelect) modalStatusSelect.value = closeAfter ? "closed" : "waiting-user";
    const chatStatusBadge = document.getElementById('ticket-chat-status-badge');
    if (chatStatusBadge) chatStatusBadge.innerHTML = getStatusPill(closeAfter ? "closed" : "waiting-user");

    setTimeout(() => {
      const chatThread = document.getElementById('ticket-chat-thread');
      if (chatThread) chatThread.scrollTop = chatThread.scrollHeight;
    }, 100);

    showToast(closeAfter ? "Reply sent and ticket closed!" : "Reply sent successfully!", "success");
    
    if (closeAfter) {
      closeTicketModal();
    }
    
    await loadTickets();

  } catch (err) {
    console.error("[Admin] Error sending reply:", err);
    showToast("Failed to send reply: " + err.message, "error");
  } finally {
    toggleSpinner(false);
  }
}

async function updateTicketStatus() {
  if (!currentTicketId) {
    showToast("No ticket selected", "error");
    return;
  }

  const newStatus = modalStatusSelect?.value;
  toggleSpinner(true);

  try {
    const oldStatus = ticketsCache.find(t => t.id === currentTicketId)?.status;
    await updateDoc(doc(db, "tickets", currentTicketId), {
      status: newStatus,
      updatedAt: serverTimestamp()
    });
    logAdminActionClient('ticket_status_change', currentTicketId, 'ticket', null, { status: oldStatus }, { status: newStatus });

    const idx = ticketsCache.findIndex(t => t.id === currentTicketId);
    if (idx !== -1) {
      ticketsCache[idx].status = newStatus;
    }

    const chatStatusBadge = document.getElementById('ticket-chat-status-badge');
    if (chatStatusBadge) chatStatusBadge.innerHTML = getStatusPill(newStatus);
    showToast(`Ticket status updated to: ${newStatus}`, "success");
    closeTicketModal();
    await loadTickets();

  } catch (err) {
    console.error("[Admin] Error updating ticket:", err);
    showToast("Failed to update ticket status: " + err.message, "error");
  } finally {
    toggleSpinner(false);
  }
}

async function deleteTicket() {
  if (!currentTicketId) {
    showToast("No ticket selected", "error");
    return;
  }
  
  const confirmed = await showConfirmDialog({
    title: 'Delete Ticket',
    message: 'Are you sure you want to delete this ticket?',
    details: 'This action cannot be undone. All replies will also be deleted.',
    icon: '🗑️',
    confirmText: 'Delete Ticket'
  });
  if (!confirmed) return;

  toggleSpinner(true);

  try {
    const ticketForLog = ticketsCache.find(t => t.id === currentTicketId);
    await deleteDoc(doc(db, "tickets", currentTicketId));
    logAdminActionClient('ticket_delete', currentTicketId, 'ticket', { email: ticketForLog?.email, subject: ticketForLog?.subject });
    
    showToast("Ticket deleted successfully", "success");
    closeTicketModal();
    await loadTickets();

  } catch (err) {
    console.error("[Admin] Error deleting ticket:", err);
    showToast("Failed to delete ticket: " + err.message, "error");
  } finally {
    toggleSpinner(false);
  }
}

function serializeReply(reply) {
  const serialized = {};
  for (const key of Object.keys(reply)) {
    const val = reply[key];
    if (val && typeof val === 'object' && typeof val.toDate === 'function') {
      serialized[key] = val.toDate();
    } else {
      serialized[key] = val;
    }
  }
  return serialized;
}

window.editAdminReply = async function(replyIndex) {
  if (!currentTicketId) {
    showToast("No ticket selected", "error");
    return;
  }
  const ticket = ticketsCache.find(t => t.id === currentTicketId);
  if (!ticket || !ticket.replies || !ticket.replies[replyIndex]) {
    showToast("Reply not found", "error");
    return;
  }
  
  const reply = ticket.replies[replyIndex];
  const newMessage = prompt('Edit your reply:', reply.message);
  if (newMessage === null || newMessage.trim() === '' || newMessage.trim() === reply.message) return;
  
  toggleSpinner(true);
  try {
    const updatedReplies = ticket.replies.map((r, i) => {
      const s = serializeReply(r);
      if (i === replyIndex) {
        s.message = newMessage.trim();
        s.edited = true;
        s.editedAt = new Date();
      }
      return s;
    });
    
    await updateDoc(doc(db, "tickets", currentTicketId), {
      replies: updatedReplies,
      updatedAt: serverTimestamp()
    });
    
    ticket.replies = updatedReplies;
    if (repliesList) repliesList.innerHTML = renderChatThread(ticket);
    showToast("Reply updated successfully", "success");
  } catch (err) {
    console.error("[Admin] Error editing reply:", err);
    showToast("Failed to edit reply: " + err.message, "error");
  } finally {
    toggleSpinner(false);
  }
};

window.deleteAdminReply = async function(replyIndex) {
  if (!currentTicketId) {
    showToast("No ticket selected", "error");
    return;
  }
  const ticket = ticketsCache.find(t => t.id === currentTicketId);
  if (!ticket || !ticket.replies || !ticket.replies[replyIndex]) {
    showToast("Reply not found", "error");
    return;
  }
  
  const replyConfirmed = await showConfirmDialog({
    title: 'Delete Reply',
    message: 'Are you sure you want to delete this reply?',
    details: 'This action cannot be undone.',
    icon: '🗑️',
    confirmText: 'Delete Reply'
  });
  if (!replyConfirmed) return;
  
  toggleSpinner(true);
  try {
    const updatedReplies = ticket.replies
      .filter((_, i) => i !== replyIndex)
      .map(r => serializeReply(r));
    
    await updateDoc(doc(db, "tickets", currentTicketId), {
      replies: updatedReplies,
      updatedAt: serverTimestamp()
    });
    logAdminActionClient('review_reply_delete', currentTicketId, 'ticket', { replyIndex });
    
    ticket.replies = updatedReplies;
    if (repliesList) repliesList.innerHTML = renderChatThread(ticket);
    showToast("Reply deleted successfully", "success");
  } catch (err) {
    console.error("[Admin] Error deleting reply:", err);
    showToast("Failed to delete reply: " + err.message, "error");
  } finally {
    toggleSpinner(false);
  }
};

const ticketInfoToggle = document.getElementById('ticket-info-toggle');
if (ticketInfoToggle) {
  ticketInfoToggle.addEventListener('click', () => {
    const panel = document.getElementById('ticket-info-panel');
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
  });
}

if (loadTicketsBtn) loadTicketsBtn.addEventListener("click", loadTickets);
if (refreshTicketsBtn) refreshTicketsBtn.addEventListener("click", loadTickets);
if (closeModalBtn) closeModalBtn.addEventListener("click", closeTicketModal);
if (updateStatusBtn) updateStatusBtn.addEventListener("click", updateTicketStatus);
if (deleteTicketBtn) deleteTicketBtn.addEventListener("click", deleteTicket);
if (sendReplyBtn) sendReplyBtn.addEventListener("click", () => sendReply(false));
if (sendReplyCloseBtn) sendReplyCloseBtn.addEventListener("click", () => sendReply(true));

const autoManageBtn = document.getElementById('auto-manage-tickets-btn');
if (autoManageBtn) {
  autoManageBtn.addEventListener('click', async () => {
    const autoConfirmed = await showConfirmDialog({
      title: 'Auto-Manage Tickets',
      message: 'Run automatic ticket management?',
      details: 'This will:\n- Send reminder emails to users who haven\'t responded for 3 days\n- Auto-close tickets inactive for 4+ days',
      icon: '🤖',
      confirmText: 'Proceed',
      confirmClass: 'btn-warning'
    });
    if (!autoConfirmed) return;
    autoManageBtn.disabled = true;
    autoManageBtn.textContent = 'Processing...';
    try {
      const hdrs = await getAuthHeaders();
      const resp = await fetch('/.netlify/functions/ticket-auto-manage', { method: 'POST', headers: hdrs });
      const data = await resp.json();
      if (resp.ok) {
        showToast(`Done: ${data.reminders || 0} reminders sent, ${data.closed || 0} tickets closed`, 'success');
        await loadTickets();
      } else {
        showToast(data.error || 'Auto-manage failed', 'error');
      }
    } catch (err) {
      showToast('Auto-manage failed: ' + err.message, 'error');
    } finally {
      autoManageBtn.disabled = false;
      autoManageBtn.textContent = 'Auto-Manage';
    }
  });
}

const createTicketBtn = document.getElementById('create-ticket-btn');
const createTicketModal = document.getElementById('create-ticket-modal');
const closeCreateTicketBtn = document.getElementById('close-create-ticket-btn');
const submitCreateTicketBtn = document.getElementById('submit-create-ticket-btn');

if (createTicketBtn) {
  createTicketBtn.addEventListener('click', () => {
    if (createTicketModal) {
      createTicketModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  });
}

if (closeCreateTicketBtn) {
  closeCreateTicketBtn.addEventListener('click', () => {
    if (createTicketModal) {
      createTicketModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
}

if (createTicketModal) {
  createTicketModal.addEventListener('click', (e) => {
    if (e.target === createTicketModal) {
      createTicketModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
}

if (submitCreateTicketBtn) {
  submitCreateTicketBtn.addEventListener('click', async () => {
    const email = document.getElementById('create-ticket-email')?.value?.trim();
    const name = document.getElementById('create-ticket-name')?.value?.trim() || 'User';
    const subject = document.getElementById('create-ticket-subject')?.value?.trim();
    const message = document.getElementById('create-ticket-message')?.value?.trim();

    if (!email || !subject || !message) {
      showToast("Please fill in Email, Subject, and Message", "error");
      return;
    }

    submitCreateTicketBtn.disabled = true;
    submitCreateTicketBtn.textContent = 'Creating...';
    toggleSpinner(true);

    try {
      const ticketData = {
        name: name,
        email: email.toLowerCase().trim(),
        subject: subject,
        message: `[Ticket created by admin on behalf of user]`,
        status: "waiting-user",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        replies: [{
          message: message,
          createdAt: new Date(),
          adminEmail: ADMIN_EMAIL,
          isAdmin: true
        }],
        attachments: [],
        createdByAdmin: true
      };

      const docRef = await addDoc(collection(db, "tickets"), ticketData);

      try {
        const hdrs = await getAuthHeaders();
        await fetch("/.netlify/functions/send-support-reply-email", {
          method: "POST",
          headers: hdrs,
          body: JSON.stringify({
            to_email: email,
            to_name: name,
            subject: `New Support Ticket: ${subject}`,
            message: message,
            ticket_id: docRef.id
          })
        });
        showToast(`Ticket created and email sent to ${email}`, "success");
      } catch (emailErr) {
        console.warn("[Admin] Ticket created but email failed:", emailErr);
        showToast("Ticket created but email notification failed", "warning");
      }

      document.getElementById('create-ticket-email').value = '';
      document.getElementById('create-ticket-name').value = '';
      document.getElementById('create-ticket-subject').value = '';
      document.getElementById('create-ticket-message').value = '';

      createTicketModal.classList.remove('active');
      document.body.style.overflow = '';
      await loadTickets();

    } catch (err) {
      console.error("[Admin] Error creating ticket:", err);
      showToast("Failed to create ticket: " + err.message, "error");
    } finally {
      submitCreateTicketBtn.disabled = false;
      submitCreateTicketBtn.textContent = 'Create & Send Email';
      toggleSpinner(false);
    }
  });
}

if (adminReplyAttachment) {
  adminReplyAttachment.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast("File size must be less than 5MB", "warning");
        adminReplyAttachment.value = "";
        return;
      }
      adminReplySelectedFile = file;
      if (adminReplyFileName) adminReplyFileName.textContent = file.name;
      if (adminReplyFilePreview) adminReplyFilePreview.style.display = "block";
    }
  });
}

if (adminReplyRemoveFile) {
  adminReplyRemoveFile.addEventListener("click", () => {
    adminReplySelectedFile = null;
    if (adminReplyAttachment) adminReplyAttachment.value = "";
    if (adminReplyFileName) adminReplyFileName.textContent = "";
    if (adminReplyFilePreview) adminReplyFilePreview.style.display = "none";
  });
}

if (ticketModal) {
  ticketModal.addEventListener("click", (e) => {
    if (e.target === ticketModal) closeTicketModal();
  });
}

// ================== REVIEWS SECTION ==================

function renderReviewRow(reviewId, data) {
  const tr = document.createElement("tr");
  const messagePreview = (data.message || "").substring(0, 50) + ((data.message || "").length > 50 ? "..." : "");
  const hasReply = data.reply && data.reply.message;
  const replyBadge = hasReply ? '<span class="status-badge" style="background:rgba(0,255,195,0.15); color:var(--accent); font-size:10px; padding:2px 6px; margin-left:4px;">💬 Replied</span>' : '';
  const contactIcons = renderReviewContactIcons(data);
  
  tr.innerHTML = `
    <td style="font-size:12px;">${formatDate(data.createdAt)}</td>
    <td>${escapeHtml(data.name) || "—"}${contactIcons}</td>
    <td>${escapeHtml(data.country) || "—"}</td>
    <td><span class="stars">${getStars(data.rating)}</span></td>
    <td style="font-size:13px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(messagePreview)}</td>
    <td>${statusBadge(data.status)}${replyBadge}</td>
    <td>
      <button class="btn btn-primary btn-sm" onclick="viewReview('${reviewId}')">Manage</button>
    </td>
  `;
  return tr;
}

function renderReviewContactIcons(data) {
  let icons = [];
  if (data.email) icons.push(`<span title="Email: ${escapeHtml(data.email)}" style="cursor:help; font-size:11px;">✉️</span>`);
  if (data.telegramUsername) icons.push(`<span title="Telegram: ${escapeHtml(data.telegramUsername)}" style="cursor:help; font-size:11px;">📱</span>`);
  if (data.whatsappNumber) icons.push(`<span title="WhatsApp: ${escapeHtml(data.whatsappNumber)}" style="cursor:help; font-size:11px;">💬</span>`);
  return icons.length ? `<div style="display:flex; gap:4px; margin-top:2px;">${icons.join('')}</div>` : '';
}

function sanitizeWhatsAppNumber(val) {
  return (val || '').replace(/[^0-9]/g, '');
}

function renderReviewMobileCard(reviewId, data) {
  const messagePreview = (data.message || "").substring(0, 80) + ((data.message || "").length > 80 ? "..." : "");
  const hasReply = data.reply && data.reply.message;
  const replyBadge = hasReply ? '<span class="status-badge" style="background:rgba(0,255,195,0.15); color:var(--accent); font-size:10px; padding:2px 6px;">💬 Replied</span>' : '';
  const contactLine = renderReviewContactLine(data);
  
  return `
    <div class="mobile-card">
      <div class="mobile-card-header">
        <div>
          <div class="mobile-card-title">${escapeHtml(data.name) || "Anonymous"}</div>
          <div class="mobile-card-subtitle">${escapeHtml(data.country) || "Unknown"}</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
          ${statusBadge(data.status)}
          ${replyBadge}
        </div>
      </div>
      <div class="mobile-card-body">
        ${contactLine}
        <div class="mobile-card-row">
          <span class="mobile-card-label">Rating</span>
          <span class="mobile-card-value stars">${getStars(data.rating)}</span>
        </div>
        <div class="mobile-card-row">
          <span class="mobile-card-label">Date</span>
          <span class="mobile-card-value">${formatDate(data.createdAt)}</span>
        </div>
        <div style="margin-top:8px; font-size:13px; color:var(--text-secondary); line-height:1.5;">
          "${escapeHtml(messagePreview)}"
        </div>
      </div>
      <div class="mobile-card-actions">
        <button class="btn btn-primary" onclick="viewReview('${reviewId}')">Manage Review</button>
      </div>
    </div>
  `;
}

function renderReviewContactLine(data) {
  let parts = [];
  if (data.email) parts.push(`<a href="mailto:${encodeURIComponent(data.email)}" style="color:var(--accent); text-decoration:none; font-size:12px;">✉️ ${escapeHtml(data.email)}</a>`);
  if (data.telegramUsername) {
    const username = sanitizeTelegramUsername(data.telegramUsername);
    if (username) parts.push(`<a href="https://t.me/${username}" target="_blank" style="color:#0088cc; text-decoration:none; font-size:12px;">📱 @${escapeHtml(username)}</a>`);
  }
  if (data.whatsappNumber) {
    const waNum = sanitizeWhatsAppNumber(data.whatsappNumber);
    if (waNum) parts.push(`<a href="https://wa.me/${waNum}" target="_blank" style="color:#25d366; text-decoration:none; font-size:12px;">💬 ${escapeHtml(data.whatsappNumber)}</a>`);
  }
  if (!parts.length) return '';
  return `<div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px; padding:8px; background:rgba(0,0,0,0.2); border-radius:8px;">${parts.join('')}</div>`;
}

async function loadReviews() {
  if (!isAdminAuthenticated) {
    console.warn("[Admin] Not authenticated, cannot load reviews");
    showToast("Please complete authentication first", "error");
    return;
  }
  
  const statusFilter = reviewFilter?.value || "all";
  
  toggleSpinner(true);
  if (reviewData) reviewData.innerHTML = '<tr><td colspan="7" class="hint">Loading reviews...</td></tr>';
  
  const reviewMobileCards = document.getElementById("review-mobile-cards");
  if (reviewMobileCards) reviewMobileCards.innerHTML = '<div class="mobile-card"><div class="hint" style="text-align:center;">Loading reviews...</div></div>';

  try {
    let q;
    if (statusFilter === "all") {
      q = query(collection(db, "reviews"), orderBy("createdAt", "desc"), limit(25));
    } else {
      q = query(collection(db, "reviews"), where("status", "==", statusFilter), orderBy("createdAt", "desc"), limit(25));
    }

    const snapshot = await getDocs(q);
    reviewsCache = [];

    if (snapshot.empty) {
      if (reviewData) reviewData.innerHTML = `<tr><td colspan="7" class="hint">No reviews found.</td></tr>`;
      if (reviewMobileCards) reviewMobileCards.innerHTML = '<div class="mobile-card"><div class="hint" style="text-align:center;">No reviews found.</div></div>';
      if (reviewCountBadge) reviewCountBadge.textContent = "0";
      if (navReviewCount) navReviewCount.textContent = "0";
      showToast("No reviews found", "info");
      return;
    }

    if (reviewData) reviewData.innerHTML = "";
    let mobileCardsHtml = '';
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      reviewsCache.push({ id: docSnap.id, ...data });
      if (reviewData) reviewData.appendChild(renderReviewRow(docSnap.id, data));
      mobileCardsHtml += renderReviewMobileCard(docSnap.id, data);
    });

    if (reviewMobileCards) reviewMobileCards.innerHTML = mobileCardsHtml;
    if (reviewCountBadge) reviewCountBadge.textContent = reviewsCache.length.toString();
    if (navReviewCount) navReviewCount.textContent = reviewsCache.length.toString();
    
    showToast(`Loaded ${reviewsCache.length} reviews`, "success");

  } catch (err) {
    console.error("[Admin] Error loading reviews:", err);
    const errorMsg = getDbErrorMessage(err);
    if (reviewData) reviewData.innerHTML = `<tr><td colspan="7" class="hint" style="color:var(--danger);">${errorMsg}</td></tr>`;
    if (reviewMobileCards) reviewMobileCards.innerHTML = `<div class="mobile-card"><div class="hint" style="text-align:center; color:var(--danger);">${errorMsg}</div></div>`;
    showToast(errorMsg, 'error');
  } finally {
    toggleSpinner(false);
  }
}

window.viewReview = function(reviewId) {
  const review = reviewsCache.find(r => r.id === reviewId);
  if (!review) {
    console.error("[Admin] Review not found in cache:", reviewId);
    showToast("Review not found. Please refresh the list.", "error");
    return;
  }

  currentReviewId = reviewId;
  if (reviewStatusSelect) reviewStatusSelect.value = review.status || "pending";
  if (editReviewMessage) editReviewMessage.value = review.message || "";

  if (reviewModalContent) {
    let contactHtml = '';
    if (review.email || review.telegramUsername || review.whatsappNumber) {
      let contactParts = [];
      if (review.email) contactParts.push(`<a href="mailto:${encodeURIComponent(review.email)}" style="color:var(--accent); text-decoration:none;">✉️ ${escapeHtml(review.email)}</a>`);
      if (review.telegramUsername) {
        const tgUser = sanitizeTelegramUsername(review.telegramUsername);
        if (tgUser) contactParts.push(`<a href="https://t.me/${tgUser}" target="_blank" style="color:#0088cc; text-decoration:none;">📱 @${escapeHtml(tgUser)}</a>`);
      }
      if (review.whatsappNumber) {
        const waNum = sanitizeWhatsAppNumber(review.whatsappNumber);
        if (waNum) contactParts.push(`<a href="https://wa.me/${waNum}" target="_blank" style="color:#25d366; text-decoration:none;">💬 ${escapeHtml(review.whatsappNumber)}</a>`);
      }
      contactHtml = `
        <div class="modal-field">
          <label>Contact Details</label>
          <div style="display:flex; flex-wrap:wrap; gap:12px; padding:10px; background:rgba(0,212,170,0.05); border:1px solid rgba(0,212,170,0.15); border-radius:10px;">${contactParts.join('')}</div>
        </div>
      `;
    } else {
      contactHtml = `
        <div class="modal-field">
          <label>Contact Details</label>
          <p style="color:var(--text-muted); font-style:italic;">No contact info available</p>
        </div>
      `;
    }

    reviewModalContent.innerHTML = `
      <div class="modal-field">
        <label>Review ID</label>
        <p style="font-family:monospace; font-size:12px; color:var(--text-muted);">${reviewId}</p>
      </div>
      <div class="modal-field">
        <label>Submitted</label>
        <p>${formatDate(review.createdAt)}</p>
      </div>
      <div class="modal-field">
        <label>Reviewer Name</label>
        <p>${escapeHtml(review.name) || "—"}</p>
      </div>
      <div class="modal-field">
        <label>Country</label>
        <p>${escapeHtml(review.country) || "—"}</p>
      </div>
      ${contactHtml}
      <div class="modal-field">
        <label>Rating</label>
        <p><span class="stars" style="font-size:20px;">${getStars(review.rating)}</span> (${review.rating}/5)</p>
      </div>
      <div class="modal-field">
        <label>Current Status</label>
        <p>${statusBadge(review.status)}</p>
      </div>
    `;
  }

  if (adminReplyMessage) {
    adminReplyMessage.value = review.reply?.message || "";
  }
  
  if (existingReplyContainer && existingReplyText) {
    if (review.reply && review.reply.message) {
      existingReplyContainer.style.display = "block";
      existingReplyText.textContent = review.reply.message;
      if (deleteReplyBtn) deleteReplyBtn.style.display = "inline-flex";
    } else {
      existingReplyContainer.style.display = "none";
      existingReplyText.textContent = "";
      if (deleteReplyBtn) deleteReplyBtn.style.display = "none";
    }
  }

  if (reviewModal) {
    reviewModal.classList.add('active');
    document.body.style.overflow = "hidden";
  }
};

function closeReviewModal() {
  if (reviewModal) reviewModal.classList.remove('active');
  currentReviewId = null;
  document.body.style.overflow = "";
}

async function approveReview() {
  if (!currentReviewId) {
    showToast("No review selected", "error");
    return;
  }

  toggleSpinner(true);

  try {
    await updateDoc(doc(db, "reviews", currentReviewId), {
      status: "approved",
      updatedAt: serverTimestamp()
    });
    logAdminActionClient('review_approve', currentReviewId, 'review');

    const review = reviewsCache.find(r => r.id === currentReviewId);
    if (review && review.email) {
      try {
        const reviewApproveHdrs = await getAuthHeaders();
        await fetch('/.netlify/functions/send-review-approved-email', {
          method: 'POST',
          headers: reviewApproveHdrs,
          body: JSON.stringify({
            to_email: review.email,
            to_name: review.name || "User",
            review_message: review.message || ""
          })
        });
      } catch (emailErr) {
        console.error("[Admin] Error sending approval email:", emailErr);
      }
    }

    showToast("Review approved and now visible to the public!", "success");
    closeReviewModal();
    await loadReviews();

  } catch (err) {
    console.error("[Admin] Error approving review:", err);
    showToast("Failed to approve review: " + err.message, "error");
  } finally {
    toggleSpinner(false);
  }
}

async function saveReviewChanges() {
  if (!currentReviewId) {
    showToast("No review selected", "error");
    return;
  }

  const newStatus = reviewStatusSelect?.value;
  const newMessage = editReviewMessage?.value?.trim();

  if (!newMessage) {
    showToast("Review message cannot be empty", "warning");
    return;
  }

  toggleSpinner(true);

  try {
    await updateDoc(doc(db, "reviews", currentReviewId), {
      status: newStatus,
      message: newMessage,
      updatedAt: serverTimestamp()
    });

    const idx = reviewsCache.findIndex(r => r.id === currentReviewId);
    if (idx !== -1) {
      reviewsCache[idx].status = newStatus;
      reviewsCache[idx].message = newMessage;
    }

    showToast("Review updated successfully!", "success");
    closeReviewModal();
    await loadReviews();

  } catch (err) {
    console.error("[Admin] Error saving review:", err);
    showToast("Failed to save review: " + err.message, "error");
  } finally {
    toggleSpinner(false);
  }
}

async function deleteReview() {
  if (!currentReviewId) {
    showToast("No review selected", "error");
    return;
  }
  
  const delRevConfirmed = await showConfirmDialog({
    title: 'Delete Review',
    message: 'Are you sure you want to delete this review?',
    details: 'This action cannot be undone. The review will be permanently removed.',
    icon: '🗑️',
    confirmText: 'Delete Review'
  });
  if (!delRevConfirmed) return;

  toggleSpinner(true);

  try {
    const reviewForLog = reviewsCache.find(r => r.id === currentReviewId);
    await deleteDoc(doc(db, "reviews", currentReviewId));
    logAdminActionClient('review_delete', currentReviewId, 'review', { name: reviewForLog?.name, email: reviewForLog?.email });
    
    showToast("Review deleted successfully", "success");
    closeReviewModal();
    await loadReviews();

  } catch (err) {
    console.error("[Admin] Error deleting review:", err);
    showToast("Failed to delete review: " + err.message, "error");
  } finally {
    toggleSpinner(false);
  }
}

async function saveReviewReply() {
  if (!currentReviewId) {
    showToast("No review selected", "error");
    return;
  }

  const replyMessage = adminReplyMessage?.value?.trim();
  if (!replyMessage) {
    showToast("Please enter a reply message", "warning");
    return;
  }

  toggleSpinner(true);

  try {
    await updateDoc(doc(db, "reviews", currentReviewId), {
      reply: {
        message: replyMessage,
        updatedAt: serverTimestamp()
      },
      updatedAt: serverTimestamp()
    });
    logAdminActionClient('review_reply_save', currentReviewId, 'review', { replyLength: replyMessage.length });

    const idx = reviewsCache.findIndex(r => r.id === currentReviewId);
    if (idx !== -1) {
      reviewsCache[idx].reply = { message: replyMessage };
      
      const review = reviewsCache[idx];
      if (review.email) {
        try {
          const reviewReplyHdrs = await getAuthHeaders();
          await fetch('/.netlify/functions/send-review-reply-email', {
            method: 'POST',
            headers: reviewReplyHdrs,
            body: JSON.stringify({
              to_email: review.email,
              to_name: review.name || "User",
              reply_message: replyMessage,
              review_message: review.message || ""
            })
          });
        } catch (emailErr) {
          console.error("[Admin] Reply notification email failed:", emailErr);
        }
      }
    }

    if (existingReplyContainer) existingReplyContainer.style.display = "block";
    if (existingReplyText) existingReplyText.textContent = replyMessage;
    if (deleteReplyBtn) deleteReplyBtn.style.display = "inline-flex";

    showToast("Reply saved successfully! It will be visible on the public reviews page.", "success");

  } catch (err) {
    console.error("[Admin] Error saving reply:", err);
    showToast("Failed to save reply: " + err.message, "error");
  } finally {
    toggleSpinner(false);
  }
}

async function deleteReviewReply() {
  if (!currentReviewId) {
    showToast("No review selected", "error");
    return;
  }

  const delReplyConfirmed = await showConfirmDialog({
    title: 'Delete Review Reply',
    message: 'Delete this reply from the public reviews page?',
    details: 'The reply will be permanently removed and no longer visible to users.',
    icon: '🗑️',
    confirmText: 'Delete Reply'
  });
  if (!delReplyConfirmed) return;

  toggleSpinner(true);

  try {
    await updateDoc(doc(db, "reviews", currentReviewId), {
      reply: null,
      updatedAt: serverTimestamp()
    });
    logAdminActionClient('review_reply_delete', currentReviewId, 'review');

    const idx = reviewsCache.findIndex(r => r.id === currentReviewId);
    if (idx !== -1) {
      reviewsCache[idx].reply = null;
    }

    if (adminReplyMessage) adminReplyMessage.value = "";
    if (existingReplyContainer) existingReplyContainer.style.display = "none";
    if (existingReplyText) existingReplyText.textContent = "";
    if (deleteReplyBtn) deleteReplyBtn.style.display = "none";

    showToast("Reply deleted successfully", "success");

  } catch (err) {
    console.error("[Admin] Error deleting reply:", err);
    showToast("Failed to delete reply: " + err.message, "error");
  } finally {
    toggleSpinner(false);
  }
}

if (loadReviewsBtn) loadReviewsBtn.addEventListener("click", loadReviews);
if (refreshReviewsBtn) refreshReviewsBtn.addEventListener("click", loadReviews);
if (closeReviewModalBtn) closeReviewModalBtn.addEventListener("click", closeReviewModal);
if (approveReviewBtn) approveReviewBtn.addEventListener("click", approveReview);
if (saveReviewBtn) saveReviewBtn.addEventListener("click", saveReviewChanges);
if (deleteReviewBtn) deleteReviewBtn.addEventListener("click", deleteReview);
if (saveReplyBtn) saveReplyBtn.addEventListener("click", saveReviewReply);
if (deleteReplyBtn) deleteReplyBtn.addEventListener("click", deleteReviewReply);

if (reviewModal) {
  reviewModal.addEventListener("click", (e) => {
    if (e.target === reviewModal) closeReviewModal();
  });
}

// ================== CONTACTS SECTION ==================

function renderContactRow(email, data) {
  const tr = document.createElement("tr");
  const tgUsername = data.telegramUsername || data.telegram?.username || "—";
  const tgPhone = data.telegramPhone || data.telegramPhoneNumber || data.telegram?.phone || "—";
  const waNumber = data.whatsappNumber || data.whatsapp?.number || "—";
  
  tr.innerHTML = `
    <td style="font-size:12px; word-break:break-all;">${escapeHtml(email)}</td>
    <td>${escapeHtml(tgUsername)}</td>
    <td>${escapeHtml(tgPhone)}</td>
    <td>${escapeHtml(waNumber)}</td>
    <td style="font-size:12px;">${formatDate(data.updatedAt || data.createdAt)}</td>
  `;
  return tr;
}

function renderContactMobileCard(email, data) {
  const tgUsername = data.telegramUsername || data.telegram?.username;
  const tgPhone = data.telegramPhone || data.telegramPhoneNumber || data.telegram?.phone;
  const waNumber = data.whatsappNumber || data.whatsapp?.number;
  
  let contactButtons = '<div class="mobile-card-contact">';
  if (tgUsername) {
    const username = sanitizeTelegramUsername(tgUsername.replace('@', '').trim());
    if (username) contactButtons += `<a href="https://t.me/${username}" target="_blank" class="contact-btn-mobile" title="Telegram">📱</a>`;
  }
  if (waNumber && isValidWhatsAppNumber(waNumber)) {
    const cleanNumber = normalizeWhatsAppNumber(waNumber);
    contactButtons += `<a href="https://wa.me/${cleanNumber}" target="_blank" class="contact-btn-mobile" title="WhatsApp">💬</a>`;
  }
  contactButtons += '</div>';
  
  return `
    <div class="mobile-card">
      <div class="mobile-card-header">
        <div class="mobile-card-title" style="font-size:13px; word-break:break-all;">${escapeHtml(email)}</div>
      </div>
      <div class="mobile-card-body">
        <div class="mobile-card-row">
          <span class="mobile-card-label">Telegram</span>
          <span class="mobile-card-value">${escapeHtml(tgUsername || "—")}</span>
        </div>
        <div class="mobile-card-row">
          <span class="mobile-card-label">TG Phone</span>
          <span class="mobile-card-value">${escapeHtml(tgPhone || "—")}</span>
        </div>
        <div class="mobile-card-row">
          <span class="mobile-card-label">WhatsApp</span>
          <span class="mobile-card-value">${escapeHtml(waNumber || "—")}</span>
        </div>
        <div class="mobile-card-row">
          <span class="mobile-card-label">Updated</span>
          <span class="mobile-card-value">${formatDate(data.updatedAt || data.createdAt)}</span>
        </div>
      </div>
      ${contactButtons}
    </div>
  `;
}

async function loadContacts() {
  if (!isAdminAuthenticated) {
    console.warn("[Admin] Not authenticated, cannot load contacts");
    showToast("Please complete authentication first", "error");
    return;
  }
  
  toggleSpinner(true);
  
  if (contactData) contactData.innerHTML = '<tr><td colspan="5" class="hint">Loading contacts...</td></tr>';
  if (contactMobileCards) contactMobileCards.innerHTML = '<div class="mobile-card"><div class="hint" style="text-align:center;">Loading contacts...</div></div>';

  try {
    const allUsers = await getAllUsersCached();
    contactsCache = [];

    if (allUsers.length === 0) {
      if (contactData) contactData.innerHTML = `<tr><td colspan="5" class="hint">No contacts found.</td></tr>`;
      if (contactMobileCards) contactMobileCards.innerHTML = '<div class="mobile-card"><div class="hint" style="text-align:center;">No contacts found.</div></div>';
      showToast("No contacts found", "info");
      return;
    }

    if (contactData) contactData.innerHTML = "";
    let mobileCardsHtml = '';
    
    allUsers.forEach(user => {
      const data = user.data;
      
      const hasContact = data.telegramUsername || data.telegramPhone || data.whatsappNumber || 
                         data.telegram?.username || data.telegram?.phone || data.whatsapp?.number;
      
      if (hasContact) {
        contactsCache.push({ id: user.id, ...data });
        if (contactData) contactData.appendChild(renderContactRow(user.id, data));
        mobileCardsHtml += renderContactMobileCard(user.id, data);
      }
    });
    

    if (contactsCache.length === 0) {
      const msg = allUsers.length > 0 
        ? `Found ${allUsers.length} users but none have contact info saved yet.`
        : `No users found in database. Check database connection.`;
      if (contactData) contactData.innerHTML = `<tr><td colspan="5" class="hint">${msg}</td></tr>`;
      if (contactMobileCards) contactMobileCards.innerHTML = `<div class="mobile-card"><div class="hint" style="text-align:center;">${msg}</div></div>`;
      showToast(msg, "info");
      return;
    }

    if (contactMobileCards) contactMobileCards.innerHTML = mobileCardsHtml;
    showToast(`Loaded ${contactsCache.length} contacts`, "success");

  } catch (err) {
    console.error("[Admin] Error loading contacts:", err);
    const errorMsg = getDbErrorMessage(err);
    if (contactData) contactData.innerHTML = `<tr><td colspan="5" class="hint" style="color:var(--danger);">${errorMsg}</td></tr>`;
    if (contactMobileCards) contactMobileCards.innerHTML = `<div class="mobile-card"><div class="hint" style="text-align:center; color:var(--danger);">${errorMsg}</div></div>`;
    showToast(errorMsg, 'error');
  } finally {
    toggleSpinner(false);
  }
}

if (loadContactsBtn) loadContactsBtn.addEventListener("click", loadContacts);
if (refreshContactsBtn) refreshContactsBtn.addEventListener("click", loadContacts);

if (contactSearch) {
  contactSearch.addEventListener("input", () => {
    const searchTerm = contactSearch.value.toLowerCase().trim();
    if (!searchTerm) {
      if (contactData) {
        contactData.innerHTML = "";
        contactsCache.forEach(c => {
          contactData.appendChild(renderContactRow(c.id, c));
        });
      }
      return;
    }
    
    const filtered = contactsCache.filter(c => {
      const email = (c.id || "").toLowerCase();
      const tg = (c.telegramUsername || c.telegram?.username || "").toLowerCase();
      const wa = (c.whatsappNumber || c.whatsapp?.number || "").toLowerCase();
      return email.includes(searchTerm) || tg.includes(searchTerm) || wa.includes(searchTerm);
    });
    
    if (contactData) {
      contactData.innerHTML = "";
      if (filtered.length === 0) {
        contactData.innerHTML = `<tr><td colspan="5" class="hint">No matches found.</td></tr>`;
      } else {
        filtered.forEach(c => {
          contactData.appendChild(renderContactRow(c.id, c));
        });
      }
    }
  });
}

// ================== VISITOR ANALYTICS ==================

function setAnalyticsStatus(ok) {
  const el = document.getElementById('analytics-status');
  const banner = document.getElementById('analytics-error-banner');
  if (!el) return;
  if (ok) {
    el.textContent = 'Live';
    el.style.background = 'rgba(16,185,129,0.12)';
    el.style.color = '#10b981';
    el.style.border = '1px solid rgba(16,185,129,0.25)';
    if (banner) banner.style.display = 'none';
  } else {
    el.textContent = 'Offline';
    el.style.background = 'rgba(239,68,68,0.12)';
    el.style.color = '#ef4444';
    el.style.border = '1px solid rgba(239,68,68,0.25)';
    if (banner) banner.style.display = 'block';
  }
}

window.loadVisitorAnalytics = async function() {
  const now = new Date();
  const twoMinAgo = new Date(now.getTime() - 2 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twentyFourAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let hasError = false;

  try {
    const activeSnap = await getDocs(query(collection(db, 'activeVisitors'), where('lastSeen', '>', twoMinAgo)));
    let wsActive = 0, cpActive = 0;
    activeSnap.forEach(d => { const data = d.data(); if (data.page === 'connect') cpActive++; wsActive++; });
    document.getElementById('ws-active').textContent = wsActive;
    document.getElementById('cp-active').textContent = cpActive;
  } catch(e) {
    hasError = true;
    document.getElementById('ws-active').textContent = '—';
    document.getElementById('cp-active').textContent = '—';
  }

  try {
    const hr1Snap = await getDocs(query(collection(db, 'pageVisits'), where('timestamp', '>', oneHourAgo)));
    let ws1 = 0, cp1 = 0;
    hr1Snap.forEach(d => { const data = d.data(); if (data.page === 'connect') cp1++; ws1++; });
    document.getElementById('ws-1hr').textContent = ws1;
    document.getElementById('cp-1hr').textContent = cp1;
  } catch(e) {
    hasError = true;
    document.getElementById('ws-1hr').textContent = '—';
    document.getElementById('cp-1hr').textContent = '—';
  }

  try {
    const hr24Snap = await getDocs(query(collection(db, 'pageVisits'), where('timestamp', '>', twentyFourAgo)));
    let ws24 = 0, cp24 = 0;
    const pageCounts = {};
    hr24Snap.forEach(d => {
      const data = d.data();
      const pg = data.page || 'unknown';
      if (pg === 'connect') cp24++;
      ws24++;
      pageCounts[pg] = (pageCounts[pg] || 0) + 1;
    });
    document.getElementById('ws-24hr').textContent = ws24;
    document.getElementById('cp-24hr').textContent = cp24;

    const sorted = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const listEl = document.getElementById('top-pages-list');
    if (sorted.length === 0) {
      listEl.innerHTML = '<div style="color:var(--text-muted); font-size:13px;">No visitor data yet. Data will appear after visitors browse the site.</div>';
    } else {
      listEl.innerHTML = sorted.map((item, i) =>
        '<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:' + (i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent') + '; border-radius:8px; margin-bottom:2px;">' +
        '<span style="font-size:13px; color:var(--text-secondary);">/' + escapeHtml(item[0]) + '</span>' +
        '<span style="font-size:14px; font-weight:700; color:var(--accent); font-family:\'JetBrains Mono\',monospace;">' + escapeHtml(String(item[1])) + '</span>' +
        '</div>'
      ).join('');
    }
  } catch(e) {
    hasError = true;
    document.getElementById('ws-24hr').textContent = '—';
    document.getElementById('cp-24hr').textContent = '—';
  }

  setAnalyticsStatus(!hasError);
};

// ================== FILTER CHANGE LISTENERS ==================

if (ticketFilter) {
  ticketFilter.addEventListener("change", () => {
    if (ticketsLoaded) loadTickets();
  });
}

if (reviewFilter) {
  reviewFilter.addEventListener("change", () => {
    if (reviewsLoaded) loadReviews();
  });
}

let notifTargetMode = 'all';
let notifSegment = null;

window.setNotifTarget = function(mode) {
  notifTargetMode = mode;
  notifSegment = null;
  const allBtn = document.getElementById('notif-target-all');
  const singleBtn = document.getElementById('notif-target-single');
  const emailInput = document.getElementById('notif-email');

  singleBtn.textContent = 'Single User';
  if (mode === 'all') {
    allBtn.className = 'btn btn-primary';
    allBtn.style.cssText = 'flex:1; font-size:12px; padding:8px 12px;';
    singleBtn.className = 'btn';
    singleBtn.style.cssText = 'flex:1; font-size:12px; padding:8px 12px; background:rgba(255,255,255,0.05); border:1px solid var(--border); color:var(--text-secondary);';
    emailInput.style.display = 'none';
  } else {
    singleBtn.className = 'btn btn-primary';
    singleBtn.style.cssText = 'flex:1; font-size:12px; padding:8px 12px;';
    allBtn.className = 'btn';
    allBtn.style.cssText = 'flex:1; font-size:12px; padding:8px 12px; background:rgba(255,255,255,0.05); border:1px solid var(--border); color:var(--text-secondary);';
    emailInput.style.display = 'block';
    emailInput.focus();
  }
};

window.applyNotifTemplate = function(type) {
  const titleEl = document.getElementById('notif-title');
  const bodyEl = document.getElementById('notif-body');
  const urlEl = document.getElementById('notif-url');

  const templates = {
    signal: {
      title: 'New Signal Alert!',
      body: 'A new trading signal is available. Open Digimun Pro to check it now!',
      url: '/digimunx-telegram'
    },
    update: {
      title: 'Platform Update',
      body: "We've added new features to Digimun Pro. Check out what's new!",
      url: '/dashboard'
    },
    promo: {
      title: 'Special Offer!',
      body: "Limited time offer! Get VIP access at a special discount. Don't miss out!",
      url: '/access-options'
    },
    result: {
      title: 'Signal Result Update',
      body: 'Your recent signal result is in! Check your trading performance now.',
      url: '/digimunx-telegram'
    },
    no_bots: {
      title: 'Start Your Trading Journey!',
      body: "You haven't activated any trading bot yet! Start with Pro Bot and get AI-powered signals to grow your account.",
      url: '/access-options',
      segment: 'no_bots'
    },
    has_pro_only: {
      title: 'Upgrade Your Setup!',
      body: "You're using Pro Bot - great choice! Add DigiMaxx for premium OTC signals and maximize your profits.",
      url: '/access-options',
      segment: 'has_pro_only'
    },
    has_digimax_only: {
      title: 'Complete Your Arsenal!',
      body: "You have DigiMaxx! Add Pro Bot for live market signals and double your trading opportunities.",
      url: '/access-options',
      segment: 'has_digimax_only'
    },
    has_digimunx_only: {
      title: 'Supercharge Your Analysis!',
      body: "DigimunX AI is powerful! Add Pro Bot and DigiMaxx for automated signals alongside your chart analysis.",
      url: '/access-options',
      segment: 'has_digimunx_only'
    },
    missing_digimunx: {
      title: 'Unlock AI Chart Analysis!',
      body: "You have trading bots but no AI analyzer! Add DigimunX for AI-powered chart analysis and smarter entries.",
      url: '/access-options',
      segment: 'missing_digimunx'
    },
    vip_retention: {
      title: 'VIP Exclusive Update!',
      body: "As a VIP member, you have early access to our latest features! Check what's new on your dashboard.",
      url: '/dashboard',
      segment: 'vip'
    },
    eid_mubarak: {
      title: 'Eid Mubarak from Digimun Pro!',
      body: "Wishing you a blessed Eid! Celebrate with our special Eid offer - get exclusive discounts on all trading bots. Limited time only!",
      url: '/access-options'
    },
    eid_discount: {
      title: 'Eid Special - 50% OFF All Bots!',
      body: "This Eid, supercharge your trading! Get 50% off on Pro Bot, DigiMaxx & DigimunX AI. Use code: EID2026. Offer ends soon!",
      url: '/access-options'
    },
    eid_free_trial: {
      title: 'Eid Gift - Free 3-Day VIP Access!',
      body: "Eid Mubarak! As our gift, enjoy FREE 3-day VIP access to all trading bots. No payment needed. Activate now!",
      url: '/access-options'
    }
  };

  const t = templates[type];
  if (t) {
    titleEl.value = t.title;
    bodyEl.value = t.body;
    urlEl.value = t.url;
    if (t.segment) {
      notifSegment = t.segment;
      notifTargetMode = 'segment';
      const allBtn = document.getElementById('notif-target-all');
      const singleBtn = document.getElementById('notif-target-single');
      const emailInput = document.getElementById('notif-email');
      allBtn.className = 'btn';
      allBtn.style.cssText = 'flex:1; font-size:12px; padding:8px 12px; background:rgba(255,255,255,0.05); border:1px solid var(--border); color:var(--text-secondary);';
      singleBtn.className = 'btn';
      singleBtn.style.cssText = 'flex:1; font-size:12px; padding:8px 12px; background:rgba(255,171,0,0.1); border:1px solid rgba(255,171,0,0.3); color:#ffab00;';
      singleBtn.textContent = 'Segment: ' + t.segment.replace(/_/g, ' ');
      emailInput.style.display = 'none';
    } else {
      notifSegment = null;
    }
  }
};

window.loadNotificationStats = async function() {
  try {
    const db = window._db;
    if (!db) return;
    const { collection, getDocs } = await import('./platform.js');
    const usersSnap = await getDocs(collection(db, 'users'));
    let subscribers = 0;
    let totalTokens = 0;
    let noBots = 0;
    let oneBot = 0;
    let vipMulti = 0;

    usersSnap.forEach(doc => {
      const d = doc.data();
      if (d.fcmTokens && Array.isArray(d.fcmTokens) && d.fcmTokens.length > 0) {
        subscribers++;
        totalTokens += d.fcmTokens.length;
      }
      const hasPro = (d.quotexStatus || '').toLowerCase() === 'approved';
      const hasDigimax = (d.digimaxStatus || '').toLowerCase() === 'approved' || (d.digimaxStatus || '').toLowerCase() === 'active';
      const hasDigimunx = (d.recoveryRequest || '').toLowerCase() === 'approved' || (d.recoveryRequest || '').toLowerCase() === 'active';
      const botCount = (hasPro ? 1 : 0) + (hasDigimax ? 1 : 0) + (hasDigimunx ? 1 : 0);
      if (botCount === 0) noBots++;
      else if (botCount === 1) oneBot++;
      else vipMulti++;
    });

    document.getElementById('notif-subscriber-count').textContent = subscribers;
    document.getElementById('notif-token-count').textContent = totalTokens;
    document.getElementById('notif-no-bots-count').textContent = noBots;
    document.getElementById('notif-one-bot-count').textContent = oneBot;
    document.getElementById('notif-vip-count').textContent = vipMulti;
  } catch (e) {
    console.error('Failed to load notification stats:', e);
  }
};

window.loadPromoCodes = async function() {
  const listEl = document.getElementById('promo-codes-list');
  if (!listEl) return;

  listEl.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:12px;">Loading...</div>';

  try {
    const authHdrs = await getAuthHeaders();
    const res = await fetch('/.netlify/functions/promo-codes?action=list', { headers: authHdrs });
    if (!res.ok) throw new Error('Server error');
    const data = await res.json();
    const codes = data.codes || [];

    if (codes.length === 0) {
      listEl.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:12px;">No promo codes created yet</div>';
      return;
    }

    const escH = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };

    let html = '';
    codes.forEach(c => {
      const statusColor = c.active ? '#00d4aa' : '#ef4444';
      const statusText = c.active ? 'Active' : 'Inactive';
      const expiryText = c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never';
      const usageText = c.maxUses ? (c.usedCount + '/' + c.maxUses) : (c.usedCount + ' uses');

      html += '<div style="padding:14px 16px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">';
      html += '<div style="flex:1; min-width:150px;">';
      html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">';
      html += '<span style="font-size:16px; font-weight:800; color:var(--text-primary); font-family:\'JetBrains Mono\',monospace; letter-spacing:1px;">' + escH(c.code) + '</span>';
      html += '<span style="font-size:10px; font-weight:700; background:rgba(' + (c.active ? '0,212,170' : '239,68,68') + ',0.15); color:' + statusColor + '; padding:2px 8px; border-radius:4px;">' + statusText + '</span>';
      html += '</div>';
      html += '<div style="font-size:11px; color:var(--text-muted);">' + escH(c.label || '') + '</div>';
      html += '</div>';
      html += '<div style="display:flex; align-items:center; gap:16px; flex-shrink:0;">';
      html += '<div style="text-align:center;"><div style="font-size:18px; font-weight:800; color:#00d4aa;">' + c.discount + '%</div><div style="font-size:9px; color:var(--text-muted);">OFF</div></div>';
      html += '<div style="text-align:center;"><div style="font-size:13px; font-weight:600; color:var(--text-secondary);">' + escH(usageText) + '</div><div style="font-size:9px; color:var(--text-muted);">Usage</div></div>';
      html += '<div style="text-align:center;"><div style="font-size:11px; color:var(--text-secondary);">' + escH(expiryText) + '</div><div style="font-size:9px; color:var(--text-muted);">Expires</div></div>';
      html += '<div style="display:flex; gap:6px;">';
      html += '<button data-promo-toggle="' + escH(c.code) + '" style="padding:6px 10px; background:rgba(255,171,0,0.1); border:1px solid rgba(255,171,0,0.3); color:#ffab00; border-radius:6px; font-size:10px; font-weight:600; cursor:pointer;">' + (c.active ? 'Disable' : 'Enable') + '</button>';
      html += '<button data-promo-delete="' + escH(c.code) + '" style="padding:6px 10px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#ef4444; border-radius:6px; font-size:10px; font-weight:600; cursor:pointer;">Delete</button>';
      html += '</div>';
      html += '</div>';
      html += '</div>';
    });

    listEl.innerHTML = html;

    listEl.querySelectorAll('[data-promo-toggle]').forEach(btn => {
      btn.addEventListener('click', () => togglePromoCode(btn.getAttribute('data-promo-toggle')));
    });
    listEl.querySelectorAll('[data-promo-delete]').forEach(btn => {
      btn.addEventListener('click', () => deletePromoCode(btn.getAttribute('data-promo-delete')));
    });
  } catch (e) {
    listEl.innerHTML = '<div style="text-align:center; padding:30px; color:#ef4444; font-size:12px;">Failed to load: ' + e.message + '</div>';
  }
};

window.createPromoCode = async function() {
  const code = document.getElementById('promo-code-input').value.trim();
  const discount = document.getElementById('promo-discount-input').value;
  const maxUses = document.getElementById('promo-maxuses-input').value;
  const expiresInDays = document.getElementById('promo-expires-input').value;
  const label = document.getElementById('promo-label-input').value.trim();
  const statusEl = document.getElementById('promo-create-status');

  if (!code) { statusEl.textContent = 'Enter a code'; statusEl.style.color = '#ef4444'; return; }
  if (!discount || discount < 1 || discount > 100) { statusEl.textContent = 'Enter discount 1-100%'; statusEl.style.color = '#ef4444'; return; }

  statusEl.textContent = 'Creating...';
  statusEl.style.color = '#00d4aa';

  try {
    const authHdrs = await getAuthHeaders();
    const res = await fetch('/.netlify/functions/promo-codes', {
      method: 'POST',
      headers: authHdrs,
      body: JSON.stringify({ action: 'create', code, discount, label, maxUses, expiresInDays })
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Server error ' + res.status); }
    const data = await res.json();
    if (data.success) {
      statusEl.textContent = 'Created: ' + data.code;
      statusEl.style.color = '#00d4aa';
      document.getElementById('promo-code-input').value = '';
      document.getElementById('promo-discount-input').value = '';
      document.getElementById('promo-maxuses-input').value = '';
      document.getElementById('promo-expires-input').value = '';
      document.getElementById('promo-label-input').value = '';
      loadPromoCodes();
    } else {
      statusEl.textContent = 'Error: ' + (data.error || 'Unknown');
      statusEl.style.color = '#ef4444';
    }
  } catch (e) {
    statusEl.textContent = 'Network error: ' + e.message;
    statusEl.style.color = '#ef4444';
  }
};

window.togglePromoCode = async function(code) {
  try {
    const authHdrs = await getAuthHeaders();
    const res = await fetch('/.netlify/functions/promo-codes', {
      method: 'POST',
      headers: authHdrs,
      body: JSON.stringify({ action: 'toggle', code })
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Server error'); }
    const data = await res.json();
    if (data.success) {
      logAdminActionClient('promo_toggle', code, 'promo', { active: data.active });
      showToast('Promo code ' + (data.active ? 'enabled' : 'disabled'), 'success');
      loadPromoCodes();
    } else {
      showToast('Error: ' + (data.error || 'Unknown'), 'error');
    }
  } catch (e) {
    showToast('Network error', 'error');
  }
};

window.deletePromoCode = async function(code) {
  const promoDelConfirmed = await showConfirmDialog({
    title: 'Delete Promo Code',
    message: 'Delete promo code "' + code + '"?',
    details: 'This cannot be undone. Users will no longer be able to use this code.',
    icon: '🗑️',
    confirmText: 'Delete Code'
  });
  if (!promoDelConfirmed) return;

  try {
    const authHdrs = await getAuthHeaders();
    const res = await fetch('/.netlify/functions/promo-codes', {
      method: 'POST',
      headers: authHdrs,
      body: JSON.stringify({ action: 'delete', code })
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Server error'); }
    const data = await res.json();
    if (data.success) {
      logAdminActionClient('promo_delete', code, 'promo');
      showToast('Promo code deleted', 'success');
      loadPromoCodes();
    } else {
      showToast('Error: ' + (data.error || 'Unknown'), 'error');
    }
  } catch (e) {
    showToast('Network error', 'error');
  }
};

window.loadNotificationHistory = async function() {
  const listEl = document.getElementById('notif-history-list');
  if (!listEl) return;
  
  listEl.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:12px;">Loading...</div>';
  
  try {
    const authHdrs = await getAuthHeaders();
    const res = await fetch('/.netlify/functions/get-notifications', { headers: authHdrs });
    if (!res.ok) throw new Error('Server error');
    const data = await res.json();
    const notifications = data.notifications || [];
    
    if (notifications.length === 0) {
      listEl.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:12px;">No notifications sent yet</div>';
      return;
    }
    
    const escHtml = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
    
    let html = '';
    notifications.forEach(n => {
      let timeStr = 'Unknown';
      if (n.timestamp) {
        const ts = typeof n.timestamp === 'number' ? n.timestamp : (n.timestamp._seconds ? n.timestamp._seconds * 1000 : Date.parse(n.timestamp));
        const date = new Date(ts);
        if (!isNaN(date.getTime())) {
          timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
      }
      const targetLabel = n.target === 'all' ? 'All Users' : n.target?.startsWith('segment:') ? n.target.replace('segment:', '').replace(/_/g, ' ').toUpperCase() : (n.target || 'All');
      
      html += '<div style="padding:12px 14px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">';
      html += '<div style="flex:1; min-width:0;">';
      html += '<div style="font-size:13px; font-weight:600; color:var(--text-primary); margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + escHtml(n.title || 'Notification') + '</div>';
      html += '<div style="font-size:11px; color:var(--text-muted); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">' + escHtml(n.body || '') + '</div>';
      html += '</div>';
      html += '<div style="text-align:right; flex-shrink:0;">';
      html += '<div style="font-size:10px; color:var(--text-muted);">' + escHtml(timeStr) + '</div>';
      html += '<div style="font-size:9px; color:#00d4aa; margin-top:2px;">' + escHtml(targetLabel) + '</div>';
      html += '</div>';
      html += '</div>';
    });
    
    listEl.innerHTML = html;
  } catch (e) {
    listEl.innerHTML = '<div style="text-align:center; padding:30px; color:#ef4444; font-size:12px;">Failed to load history: ' + e.message + '</div>';
  }
};

window.sendPushNotification = async function() {
  const title = document.getElementById('notif-title').value.trim();
  const body = document.getElementById('notif-body').value.trim();
  const url = document.getElementById('notif-url').value;
  const statusEl = document.getElementById('notif-send-status');
  const resultEl = document.getElementById('notif-result');
  const resultDetails = document.getElementById('notif-result-details');
  const sendBtn = document.getElementById('notif-send-btn');

  if (!title) { statusEl.textContent = 'Please enter a title'; statusEl.style.color = '#ef4444'; return; }
  if (!body) { statusEl.textContent = 'Please enter a message body'; statusEl.style.color = '#ef4444'; return; }

  let target = 'all';
  let segmentVal = null;
  if (notifTargetMode === 'segment' && notifSegment) {
    segmentVal = notifSegment;
    target = 'all';
  } else if (notifTargetMode === 'single') {
    const email = document.getElementById('notif-email').value.trim();
    if (!email) { statusEl.textContent = 'Please enter user email'; statusEl.style.color = '#ef4444'; return; }
    target = email;
  }

  const confirmMsg = segmentVal
    ? 'Send this notification to the "' + segmentVal.replace(/_/g, ' ') + '" user segment?'
    : notifTargetMode === 'all'
    ? 'Send this notification to ALL subscribed users?'
    : 'Send this notification to ' + target + '?';
  const notifConfirmed = await showConfirmDialog({
    title: 'Send Notification',
    message: confirmMsg,
    icon: '📢',
    confirmText: 'Send',
    confirmClass: 'btn-primary'
  });
  if (!notifConfirmed) return;

  sendBtn.disabled = true;
  sendBtn.style.opacity = '0.5';
  statusEl.textContent = 'Sending...';
  statusEl.style.color = '#00d4aa';
  resultEl.style.display = 'none';

  try {
    const notifAuthHdrs = await getAuthHeaders();
    const res = await fetch('/.netlify/functions/send-push-notification', {
      method: 'POST',
      headers: notifAuthHdrs,
      body: JSON.stringify({ title, body, url, target, segment: segmentVal })
    });

    const data = await res.json();

    if (data.success) {
      statusEl.textContent = '';
      resultEl.style.display = 'block';
      resultEl.style.background = 'rgba(0,212,170,0.06)';
      resultEl.style.borderColor = 'rgba(0,212,170,0.2)';
      resultEl.querySelector('div').style.color = '#00d4aa';
      resultEl.querySelector('div').textContent = 'Notification Sent Successfully';
      resultDetails.innerHTML =
        'Delivered: <strong>' + data.sent + '</strong> | ' +
        'Failed: <strong>' + data.failed + '</strong> | ' +
        'Total Tokens: <strong>' + data.totalTokens + '</strong>' +
        (data.staleCleaned > 0 ? ' | Stale Cleaned: <strong>' + data.staleCleaned + '</strong>' : '');
    } else {
      statusEl.textContent = 'Error: ' + (data.error || 'Unknown error');
      statusEl.style.color = '#ef4444';
    }
  } catch (e) {
    statusEl.textContent = 'Network error: ' + e.message;
    statusEl.style.color = '#ef4444';
  }

  sendBtn.disabled = false;
  sendBtn.style.opacity = '1';
};

window.sendTestNotification = async function() {
  const statusEl = document.getElementById('notif-send-status');
  statusEl.textContent = 'Sending test to yourself...';
  statusEl.style.color = '#ffab00';

  try {
    const testNotifHdrs = await getAuthHeaders();
    const res = await fetch('/.netlify/functions/send-push-notification', {
      method: 'POST',
      headers: testNotifHdrs,
      body: JSON.stringify({
        title: 'Test Notification',
        body: 'This is a test push notification from Digimun Pro admin panel.',
        url: '/dashboard',
        target: ADMIN_EMAIL
      })
    });
    const data = await res.json();
    if (data.success) {
      statusEl.textContent = 'Test sent! Delivered: ' + data.sent + ', Failed: ' + data.failed;
      statusEl.style.color = '#00d4aa';
    } else {
      statusEl.textContent = 'Test failed: ' + (data.error || 'Unknown');
      statusEl.style.color = '#ef4444';
    }
  } catch (e) {
    statusEl.textContent = 'Test error: ' + e.message;
    statusEl.style.color = '#ef4444';
  }
  setTimeout(() => { statusEl.textContent = ''; }, 5000);
};

let cryptoPaymentsCache = [];

window.loadCryptoPayments = async function() {
  const tbody = document.getElementById('crypto-payments-tbody');
  const mobileCards = document.getElementById('crypto-payments-mobile-cards');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">Loading...</td></tr>';
  mobileCards.innerHTML = '';

  try {
    const hdrs = await getAuthHeaders();
    const [paymentsRes, revenueRes] = await Promise.all([
      fetch('/.netlify/functions/crypto-admin?action=list', { headers: hdrs }),
      fetch('/.netlify/functions/crypto-admin?action=revenue', { headers: hdrs })
    ]);

    const paymentsData = await paymentsRes.json();
    const revenueData = await revenueRes.json();

    if (paymentsData.payments) {
      cryptoPaymentsCache = paymentsData.payments;
      renderCryptoPayments(cryptoPaymentsCache);
    }

    if (revenueData) {
      document.getElementById('crypto-rev-today').textContent = '$' + (revenueData.today || 0).toFixed(2);
      document.getElementById('crypto-rev-week').textContent = '$' + (revenueData.week || 0).toFixed(2);
      document.getElementById('crypto-rev-month').textContent = '$' + (revenueData.month || 0).toFixed(2);
      document.getElementById('crypto-rev-total').textContent = '$' + (revenueData.total || 0).toFixed(2);
    }
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#ef4444; padding:30px;">Error: ' + e.message + '</td></tr>';
  }
};

function renderCryptoPayments(payments) {
  const tbody = document.getElementById('crypto-payments-tbody');
  const mobileCards = document.getElementById('crypto-payments-mobile-cards');

  if (!payments.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:30px;">No crypto payments found</td></tr>';
    mobileCards.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px;">No crypto payments found</div>';
    return;
  }

  const statusColors = {
    waiting: '#f59e0b',
    confirming: '#3b82f6',
    confirmed: '#10b981',
    finished: '#10b981',
    failed: '#ef4444',
    expired: '#6b7a94',
    refunded: '#9333ea',
    partially_paid: '#f97316'
  };

  tbody.innerHTML = payments.map(p => {
    const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '-';
    const statusColor = statusColors[p.status] || '#6b7a94';
    const crypto = p.cryptoCurrency ? `${p.cryptoAmount || ''} ${p.cryptoCurrency}` : '-';
    const safeInvoice = (p.invoiceId || '').replace(/'/g, "\\'");
    const refundBtn = (!p.accessGranted && p.status !== 'refunded') ?
      `<button onclick="toggleCryptoRefund('${safeInvoice}')" style="font-size:11px; padding:4px 8px; background:rgba(147,51,234,0.2); color:#9333ea; border:1px solid #9333ea; border-radius:6px; cursor:pointer;">Refund</button>` : '';
    const viewBtn = `<button onclick="showCryptoDetail('${safeInvoice}')" style="font-size:11px; padding:4px 8px; background:rgba(59,130,246,0.2); color:#3b82f6; border:1px solid #3b82f6; border-radius:6px; cursor:pointer; margin-right:4px;">View</button>`;
    return `<tr>
      <td>${date}</td>
      <td style="font-size:12px;">${p.userEmail || '-'}</td>
      <td>${p.productName || '-'}</td>
      <td>$${(p.amountUSD || 0).toFixed(2)}</td>
      <td style="font-size:12px;">${crypto}</td>
      <td><span style="color:${statusColor}; font-weight:600; font-size:12px;">${(p.status || '').toUpperCase()}</span></td>
      <td style="font-size:11px; max-width:80px; overflow:hidden; text-overflow:ellipsis;">${p.invoiceId || '-'}</td>
      <td>${viewBtn}${refundBtn}</td>
    </tr>`;
  }).join('');

  mobileCards.innerHTML = payments.map(p => {
    const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '-';
    const statusColor = statusColors[p.status] || '#6b7a94';
    const crypto = p.cryptoCurrency ? `${p.cryptoAmount || ''} ${p.cryptoCurrency}` : '-';
    return `<div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:12px; padding:14px; margin-bottom:8px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <strong style="font-size:13px;">${p.userEmail || '-'}</strong>
        <span style="color:${statusColor}; font-weight:600; font-size:12px;">${(p.status || '').toUpperCase()}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted);">
        <span>${p.productName || '-'}</span>
        <span>$${(p.amountUSD || 0).toFixed(2)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:4px;">
        <span>${date}</span>
        <span>${crypto}</span>
      </div>
    </div>`;
  }).join('');
}

window.filterCryptoPayments = function() {
  const search = (document.getElementById('crypto-search')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('crypto-status-filter')?.value || 'all';
  const productFilter = document.getElementById('crypto-product-filter')?.value || 'all';
  const dateFrom = document.getElementById('crypto-date-from')?.value || '';
  const dateTo = document.getElementById('crypto-date-to')?.value || '';

  const filtered = cryptoPaymentsCache.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (productFilter !== 'all' && p.productId !== productFilter) return false;
    if (search && !(p.userEmail || '').toLowerCase().includes(search) && !(p.invoiceId || '').toLowerCase().includes(search)) return false;
    if (dateFrom && p.createdAt) {
      const created = new Date(p.createdAt).toISOString().split('T')[0];
      if (created < dateFrom) return false;
    }
    if (dateTo && p.createdAt) {
      const created = new Date(p.createdAt).toISOString().split('T')[0];
      if (created > dateTo) return false;
    }
    return true;
  });

  renderCryptoPayments(filtered);
};

window.showCryptoDetail = function(invoiceId) {
  const p = cryptoPaymentsCache.find(x => x.invoiceId === invoiceId);
  if (!p) return;
  const esc = (s) => { const d = document.createElement('div'); d.textContent = s || '-'; return d.innerHTML; };
  const statusColors = { waiting: '#f59e0b', confirming: '#3b82f6', confirmed: '#10b981', finished: '#10b981', failed: '#ef4444', expired: '#6b7a94', refunded: '#9333ea', partially_paid: '#f97316', amount_mismatch: '#ef4444' };
  const color = statusColors[p.status] || '#6b7a94';
  const row = (label, val) => `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border);"><span style="color:var(--text-muted);">${label}</span><span style="font-weight:600; max-width:60%; text-align:right; word-break:break-all;">${val}</span></div>`;
  const content = [
    row('Invoice ID', esc(p.invoiceId)),
    row('Email', esc(p.userEmail)),
    row('Product', esc(p.productName)),
    row('Product Tier', esc(p.productTier)),
    row('Amount (USD)', '$' + (p.amountUSD || 0).toFixed(2)),
    row('Crypto Amount', p.cryptoAmount ? esc(p.cryptoAmount + ' ' + p.cryptoCurrency) : '-'),
    row('Status', `<span style="color:${color}; font-weight:700;">${esc((p.status || '').toUpperCase())}</span>`),
    row('Access Granted', p.accessGranted ? '<span style="color:#10b981;">Yes</span>' : '<span style="color:#ef4444;">No</span>'),
    row('Refund Eligible', p.refundEligible ? 'Yes' : 'No'),
    row('Promo Code', esc(p.promoCode)),
    row('Transaction Hash', esc(p.transactionHash)),
    row('Sender Wallet', esc(p.senderWallet)),
    row('NP Payment ID', esc(p.nowpaymentsPaymentId)),
    row('Last IPN Status', esc(p.lastIpnStatus)),
    p.amountMismatch ? row('Expected USD', '$' + (p.expectedUSD || 0).toFixed(2)) : '',
    p.amountMismatch ? row('Paid USD', '$' + (p.paidUSD || 0).toFixed(2)) : '',
    row('Created', p.createdAt ? new Date(p.createdAt).toLocaleString() : '-'),
    row('Confirmed', p.confirmedAt ? new Date(p.confirmedAt).toLocaleString() : '-'),
    row('Access Granted At', p.accessGrantedAt ? new Date(p.accessGrantedAt).toLocaleString() : '-'),
    row('Refunded At', p.refundedAt ? new Date(p.refundedAt).toLocaleString() : '-')
  ].filter(Boolean).join('');
  document.getElementById('crypto-detail-content').innerHTML = content;
  document.getElementById('crypto-detail-modal').style.display = 'flex';
};

window.toggleCryptoRefund = async function(invoiceId) {
  if (!confirm('Mark this payment as refunded?')) return;
  try {
    const hdrs = await getAuthHeaders();
    const res = await fetch('/.netlify/functions/crypto-admin?action=toggle-refund', {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({ invoiceId })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Refund status updated', 'success');
      loadCryptoPayments();
    } else {
      showToast(data.error || 'Failed to update', 'error');
    }
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
};

window.exportCryptoCSV = function() {
  if (!cryptoPaymentsCache.length) {
    showToast('No payments to export', 'error');
    return;
  }

  const csvHeaders = ['Date', 'Email', 'Product', 'Tier', 'Amount USD', 'Crypto Amount', 'Crypto Currency', 'Status', 'Invoice ID', 'Transaction Hash', 'Promo Code', 'Access Granted'];
  const rows = cryptoPaymentsCache.map(p => [
    p.createdAt ? new Date(p.createdAt).toISOString() : '',
    p.userEmail || '',
    p.productName || '',
    p.productTier || '',
    p.amountUSD || 0,
    p.cryptoAmount || '',
    p.cryptoCurrency || '',
    p.status || '',
    p.invoiceId || '',
    p.transactionHash || '',
    p.promoCode || '',
    p.accessGranted ? 'Yes' : 'No'
  ]);

  const csvContent = [csvHeaders, ...rows].map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'crypto-payments-' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported successfully', 'success');
};

