// admin.js — Digimun Admin Panel (Users, Tickets, Reviews Management)
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp, deleteDoc, addDoc,
  collection, query, where, orderBy, limit, startAfter, getDocs, documentId, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const ADMIN_EMAIL = "muneebg249@gmail.com";
const PAGE_SIZE = 50;
const USER_CACHE_DURATION_MS = 5 * 60 * 1000;

let allUsersCache = null;
let usersCacheTimestamp = 0;

async function getAllUsersCached(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && allUsersCache && (now - usersCacheTimestamp) < USER_CACHE_DURATION_MS) {
    return allUsersCache;
  }
  
  const snapshot = await getDocs(collection(db, "users"));
  allUsersCache = [];
  snapshot.forEach(docSnap => {
    allUsersCache.push({ id: docSnap.id, data: docSnap.data() });
  });
  usersCacheTimestamp = now;
  return allUsersCache;
}

function invalidateUsersCache() {
  allUsersCache = null;
  usersCacheTimestamp = 0;
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
function toggleSpinner(show) {
  const s = document.getElementById("loading-spinner");
  if (s) s.classList.toggle('active', show);
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

document.addEventListener("DOMContentLoaded", () => {
  
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
});

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
      'visitors': 'Visitor Analytics'
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
    const response = await fetch("/.netlify/functions/verify-admin-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, email: pendingAdminUser?.email })
    });
    
    if (response.status === 429) {
      hide2FAOverlay();
      showAccessDenied("Too many failed attempts. Please try again in 30 minutes.");
      return;
    }
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      
      const expiry = Date.now() + (3 * 24 * 60 * 60 * 1000);
      localStorage.setItem('admin2FAVerified', 'true');
      localStorage.setItem('admin2FAExpiry', expiry.toString());
      localStorage.setItem('admin2FAEmail', pendingAdminUser?.email || '');
      localStorage.setItem('admin2FADevice', getDeviceFingerprint());
      
      hide2FAOverlay();
      isAdminAuthenticated = true;
      twoFAAttempts = 0;
      
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

// Setup 2FA event listeners
document.addEventListener("DOMContentLoaded", () => {
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
});

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
function isAdmin2FASessionValid(userEmail) {
  const verified = localStorage.getItem('admin2FAVerified');
  const expiry = parseInt(localStorage.getItem('admin2FAExpiry') || '0', 10);
  const savedEmail = localStorage.getItem('admin2FAEmail') || '';
  const savedDevice = localStorage.getItem('admin2FADevice') || '';
  const currentDevice = getDeviceFingerprint();
  
  if (verified === 'true' && 
      Date.now() < expiry && 
      savedEmail.toLowerCase() === userEmail.toLowerCase() &&
      savedDevice === currentDevice) {
    return true;
  }
  
  if (savedDevice !== currentDevice) {
  }
  
  localStorage.removeItem('admin2FAVerified');
  localStorage.removeItem('admin2FAExpiry');
  localStorage.removeItem('admin2FAEmail');
  localStorage.removeItem('admin2FADevice');
  return false;
}

// Auth Check
onAuthStateChanged(auth, async (user) => {
  
  if (!user) {
    showAccessDenied("Please log in first to access the admin panel.");
    return;
  }
  
  if ((user.email || '').toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
    showAccessDenied(`Access denied. Your account (${user.email}) is not authorized as an admin.`);
    return;
  }
  
  pendingAdminUser = user;
  
  if (isAdmin2FASessionValid(user.email)) {
    isAdminAuthenticated = true;
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

// ================== DASHBOARD STATS ==================

async function loadPendingBatchCount() {
  try {
    const NF_BASE = 'https://88eddaf8-4cba-4584-9921-d8c580294502-00-3ohoi515cpvkj.sisko.replit.dev';
    const resp = await fetch(NF_BASE + '/.netlify/functions/admin-batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminEmail: 'digimun249@gmail.com', status: 'pending' })
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
    
    const allUsers = await getAllUsersCached();
    
    const pendingUsers = [];
    allUsers.forEach(user => {
      if (String(user.data.status || "").toLowerCase() === "pending") {
        pendingUsers.push({ id: user.id, data: user.data });
      }
    });
    
    
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
    const errorMsg = getFirestoreErrorMessage(err);
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="9" class="hint" style="color:var(--danger);">${errorMsg}</td></tr>`;
    if (userMobileCardsEl) userMobileCardsEl.innerHTML = `<div class="mobile-card"><div class="hint" style="text-align:center; color:var(--danger);">${errorMsg}</div></div>`;
    showToast(errorMsg, 'error');
  } finally {
    toggleSpinner(false);
  }
};

// ================== ERROR HANDLING ==================

function getFirestoreErrorMessage(err) {
  console.error("[Admin] Firestore error details:", err.code, err.message);
  
  if (err.code === "failed-precondition" || err.message?.includes("index")) {
    return "Database index required. Please check Firebase Console for index creation link.";
  } else if (err.code === "permission-denied") {
    return "Permission denied. Check Firestore security rules.";
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
    const username = telegram.replace('@', '').trim();
    if (username) {
      html += `<a href="https://t.me/${username}" target="_blank" style="color:#0088cc; text-decoration:none;" title="Open Telegram">📱 @${username}</a><br>`;
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
    <td><button class="btn btn-sm btn-danger" onclick="deleteUserAccount('${escapeHtml(email)}')">🗑️ Delete</button></td>
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
      const username = telegram.replace('@', '').trim();
      contactHtml += `<a href="https://t.me/${username}" target="_blank" class="contact-btn-mobile" title="Telegram">📱</a>`;
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
        <button class="btn btn-sm btn-danger" onclick="deleteUserAccount('${escapeHtml(email)}')">🗑️ Delete Account</button>
      </div>
    </div>
  `;
}

async function deleteUserAccount(email) {
  if (!confirm(`Are you sure you want to permanently delete the account for ${email}? This will:\n\n• Remove from Firebase Authentication\n• Delete user data from Firestore\n• The user will see a deletion notice on login\n\nThis action CANNOT be undone.`)) {
    return;
  }

  const confirmation = prompt(`Type DELETE to confirm permanent deletion of ${email}`);
  if (confirmation !== 'DELETE') {
    showToast('Deletion cancelled - confirmation text did not match', 'info');
    return;
  }

  try {
    const API_BASE = 'https://88eddaf8-4cba-4584-9921-d8c580294502-00-3ohoi515cpvkj.sisko.replit.dev';
    const resp = await fetch(API_BASE + '/api/admin/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminEmail: 'digimun249@gmail.com', userEmail: email })
    });

    const data = await resp.json();

    if (resp.ok && data.success) {
      showToast(data.message || 'Account deleted successfully', 'success');
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

    try {
      let foundDoc = null;
      
      let snap = await getDoc(doc(db, "users", typedLower));
      if (snap.exists()) {
        foundDoc = { id: snap.id, data: snap.data() };
      }
      
      if (!foundDoc && raw.trim() !== typedLower) {
        snap = await getDoc(doc(db, "users", raw.trim()));
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
      
      if (!foundDoc) {
        const usersCol = collection(db, "users");
        const allDocs = await getDocs(query(usersCol, limit(500)));
        for (const d of allDocs.docs) {
          if (d.id.toLowerCase() === typedLower) {
            foundDoc = { id: d.id, data: d.data() };
            break;
          }
        }
      }
      
      if (foundDoc) {
        if (tableBody) tableBody.appendChild(renderRow(foundDoc.id, foundDoc.data));
        if (userMobileCards) userMobileCards.innerHTML = renderUserMobileCard(foundDoc.id, foundDoc.data);
        showToast("User found!", "success");
      } else {
        setTableMessage("User not found");
        showToast("User not found", "info");
      }
    } catch (e) {
      console.error("[Admin] Search error:", e);
      setTableMessage("Error loading user: " + e.message, true);
      showToast("Error searching: " + e.message, "error");
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

    if (!confirm(`Create Firestore document for "${emailLower}"?\n\nThis will create a new user record with pending status for all services.`)) {
      return;
    }

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
    
    if (!confirm("This will add DigimunXAdv='pending' to all users who don't have this field.\n\nProceed?")) {
      return;
    }
    
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
  
  try {
    
    const allUsers = await getAllUsersCached();
    
    const fieldValues = {};
    allUsers.forEach(u => {
      const val = u.data[currentField];
      fieldValues[String(val)] = (fieldValues[String(val)] || 0) + 1;
    });
    
    const matchingDocs = [];
    allUsers.forEach(user => {
      const fieldValue = String(user.data[currentField] || "").toLowerCase().trim();
      const searchValue = String(currentValue).toLowerCase().trim();
      if (fieldValue === searchValue) {
        matchingDocs.push({ id: user.id, data: user.data });
      }
    });
    
    
    // Create a mock snap object for compatibility
    const snap = {
      empty: matchingDocs.length === 0,
      size: matchingDocs.length,
      docs: matchingDocs,
      forEach: (callback) => matchingDocs.forEach(doc => callback({ id: doc.id, data: () => doc.data }))
    };
    
    
    if (snap.empty && isNew) {
      setTableMessage("No users found with this filter");
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
      showToast("No users found", "info");
      return;
    }
    
    let mobileCardsHtml = userMobileCards?.innerHTML || '';
    snap.forEach(docSnap => {
      if (tableBody) tableBody.appendChild(renderRow(docSnap.id, docSnap.data()));
      mobileCardsHtml += renderUserMobileCard(docSnap.id, docSnap.data());
    });
    if (userMobileCards) userMobileCards.innerHTML = mobileCardsHtml;
    
    lastDoc = snap.docs[snap.docs.length - 1];
    if (loadMoreBtn) loadMoreBtn.style.display = snap.size < PAGE_SIZE ? "none" : "inline-block";
    
    if (isNew) showToast(`Found ${snap.size} users`, "success");
    
  } catch (e) {
    console.error("[Admin] Filter error:", e);
    const errorMsg = getFirestoreErrorMessage(e);
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
  loadMoreBtn.addEventListener("click", async () => { await runFilter(false); });
}

if (clearFilterBtn) {
  clearFilterBtn.addEventListener("click", () => {
    currentField = null; currentValue = null; lastDoc = null;
    if (loadMoreBtn) loadMoreBtn.style.display = "none";
    setTableMessage("Filters cleared. Use search or apply a filter.");
    showToast("Filters cleared", "info");
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
  
  if (btn24h) btn24h.addEventListener("click", () => processAccessApproval(false));
  if (btnPermanent) btnPermanent.addEventListener("click", () => processAccessApproval(true));
}

function showAccessDurationModal(email, field) {
  const modal = document.getElementById("access-duration-modal");
  const title = document.getElementById("access-duration-modal-title");
  
  pendingAccessApproval = { email, field };
  
  const fieldName = field === "recoveryRequest" ? "DigimunX" : "DigiMaxx";
  if (title) title.textContent = `Select ${fieldName} Access Duration`;
  
  if (modal) modal.classList.add("active");
}

async function processAccessApproval(isPermanent) {
  const { email, field } = pendingAccessApproval;
  if (!email || !field) return;
  
  const modal = document.getElementById("access-duration-modal");
  if (modal) modal.classList.remove("active");
  
  try {
    toggleSpinner(true);
    
    const expiryField = field === "recoveryRequest" ? "recoveryRequestExpiry" : "digimaxStatusExpiry";
    const expiryValue = isPermanent ? null : new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const updateData = { 
      [field]: "approved",
      [expiryField]: expiryValue
    };
    
    await updateDoc(doc(db, "users", email), updateData);
    invalidateUsersCache();
    await refreshRowOrView(email);
    
    const accessType = isPermanent ? "permanent" : "24-hour";
    showToast(`${field} approved with ${accessType} access!`, "success");
    
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
        const accessTypeValue = isPermanent ? "permanent" : "24h";
        const response = await fetch(emailEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

// Initialize modal when DOM is ready
document.addEventListener("DOMContentLoaded", initAccessDurationModal);

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
    
    const updateData = { [field]: newValue };
    
    // Clear expiry when setting to pending
    if (!isChecked && (field === "recoveryRequest" || field === "digimaxStatus")) {
      const expiryField = field === "recoveryRequest" ? "recoveryRequestExpiry" : "digimaxStatusExpiry";
      updateData[expiryField] = null;
    }
    
    await updateDoc(doc(db, "users", email), updateData);
    invalidateUsersCache();
    await refreshRowOrView(email);
    showToast(`${field} ${newValue}!`, "success");
    
    // Send automated emails when specific fields are approved
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
          const response = await fetch(emailEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
  const classMap = {
    open: "status-open",
    replied: "status-replied",
    closed: "status-closed"
  };
  return `<span class="status-badge ${classMap[s] || 'status-open'}">${s}</span>`;
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
      const username = telegram.replace('@', '').trim();
      contactHtml += `<a href="https://t.me/${username}" target="_blank" class="contact-btn-mobile" title="Telegram">📱</a>`;
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
    return;
  }
  
  const statusFilter = ticketFilter?.value || "all";
  
  toggleSpinner(true);
  if (ticketData) ticketData.innerHTML = '<tr><td colspan="8" class="hint">Loading tickets...</td></tr>';
  
  const ticketMobileCards = document.getElementById("ticket-mobile-cards");
  if (ticketMobileCards) ticketMobileCards.innerHTML = '<div class="mobile-card"><div class="hint" style="text-align:center;">Loading tickets...</div></div>';

  try {
    let q;
    if (statusFilter === "all") {
      q = query(collection(db, "tickets"), orderBy("createdAt", "desc"), limit(25));
    } else {
      q = query(collection(db, "tickets"), where("status", "==", statusFilter), orderBy("createdAt", "desc"), limit(25));
    }

    const snapshot = await getDocs(q);
    ticketsCache = [];

    if (snapshot.empty) {
      if (ticketData) ticketData.innerHTML = `<tr><td colspan="8" class="hint">No tickets found.</td></tr>`;
      if (ticketMobileCards) ticketMobileCards.innerHTML = '<div class="mobile-card"><div class="hint" style="text-align:center;">No tickets found.</div></div>';
      if (ticketCountBadge) ticketCountBadge.textContent = "0";
      if (navTicketCount) navTicketCount.textContent = "0";
      showToast("No tickets found", "info");
      return;
    }

    if (ticketData) ticketData.innerHTML = "";
    let mobileCardsHtml = '';
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      ticketsCache.push({ id: docSnap.id, ...data });
      if (ticketData) ticketData.appendChild(renderTicketRow(docSnap.id, data));
      mobileCardsHtml += renderTicketMobileCard(docSnap.id, data);
    });

    if (ticketMobileCards) ticketMobileCards.innerHTML = mobileCardsHtml;
    if (ticketCountBadge) ticketCountBadge.textContent = ticketsCache.length.toString();
    if (navTicketCount) navTicketCount.textContent = ticketsCache.length.toString();
    
    showToast(`Loaded ${ticketsCache.length} tickets`, "success");

  } catch (err) {
    console.error("[Admin] Error loading tickets:", err);
    const errorMsg = getFirestoreErrorMessage(err);
    if (ticketData) ticketData.innerHTML = `<tr><td colspan="8" class="hint" style="color:var(--danger);">${errorMsg}</td></tr>`;
    if (ticketMobileCards) ticketMobileCards.innerHTML = `<div class="mobile-card"><div class="hint" style="text-align:center; color:var(--danger);">${errorMsg}</div></div>`;
    showToast(errorMsg, 'error');
  } finally {
    toggleSpinner(false);
  }
}

function renderReplies(replies) {
  if (!replies || !Array.isArray(replies) || replies.length === 0) {
    return '<div class="no-replies">No replies yet. Write your first reply above.</div>';
  }
  
  return replies.map(reply => {
    const isAdmin = reply.adminEmail || reply.isAdmin !== false;
    let attachmentHtml = '';
    if (reply.attachment) {
      const isImage = reply.attachment.match(/\.(jpg|jpeg|png|gif|webp)$/i) || reply.attachment.includes('/image/');
      if (isImage) {
        attachmentHtml = `<div style="margin-top:8px;"><img src="${reply.attachment}" alt="Attachment" style="max-width:200px; max-height:150px; border-radius:8px; border:1px solid var(--border); cursor:pointer;" onclick="openImageViewer('${reply.attachment}')"></div>`;
      } else {
        attachmentHtml = `<div style="margin-top:8px;"><a href="${reply.attachment}" target="_blank" style="color:var(--accent); font-size:0.85rem;">📎 View Attachment</a></div>`;
      }
    }
    return `
      <div class="reply-item ${isAdmin ? '' : 'user-reply'}">
        <div class="reply-meta">
          <span class="${isAdmin ? 'admin-badge' : 'user-badge'}">${isAdmin ? 'Admin' : 'Customer'}</span>
          <span class="reply-date">${formatDate(reply.createdAt)}</span>
        </div>
        <div class="reply-text">${escapeHtml(reply.message)}</div>
        ${attachmentHtml}
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
    
    if (isImage) {
      html += `
        <div onclick="openImageViewer('${file.url}')" style="display:block; cursor:pointer;">
          <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:8px; text-align:center; transition:border-color 0.2s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            <img src="${file.url}" alt="${escapeHtml(file.name)}" style="max-width:120px; max-height:80px; border-radius:4px; display:block; margin-bottom:6px;">
            <span style="font-size:11px; color:var(--text-muted); display:block;">${escapeHtml(file.name.substring(0, 15))}${file.name.length > 15 ? '...' : ''}</span>
          </div>
        </div>
      `;
    } else {
      html += `
        <a href="${file.url}" target="_blank" style="display:flex; align-items:center; gap:8px; background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:10px 14px; text-decoration:none; color:var(--text);">
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
    const username = telegram.replace('@', '').trim();
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

  const hasTelegram = ticket.telegramUsername;
  const hasWhatsapp = ticket.whatsappNumber;

  if (ticketModalContent) {
    ticketModalContent.innerHTML = `
      <div class="modal-field">
        <label>Ticket ID</label>
        <p style="font-family:monospace; font-size:12px; color:var(--text-muted);">${ticketId}</p>
      </div>
      <div class="modal-field">
        <label>Submitted</label>
        <p>${formatDate(ticket.createdAt)}</p>
      </div>
      <div class="modal-field">
        <label>Customer Name</label>
        <p>${escapeHtml(ticket.name) || "—"}</p>
      </div>
      <div class="modal-field">
        <label>Customer Email</label>
        <p><a href="mailto:${escapeHtml(ticket.email)}" style="color:var(--accent);">${escapeHtml(ticket.email) || "—"}</a></p>
      </div>
      <div class="modal-field" style="background:rgba(0,255,195,0.05); border:1px solid var(--border-accent); border-radius:8px; padding:12px;">
        <label style="color:var(--accent);">Direct Contact</label>
        ${renderContactButtons(hasTelegram, hasWhatsapp)}
      </div>
      <div class="modal-field">
        <label>Subject</label>
        <p style="color:var(--accent); font-weight:600;">${escapeHtml(ticket.subject) || "—"}</p>
      </div>
      <div class="modal-field">
        <label>Message</label>
        <div class="message-box">${escapeHtml(ticket.message) || "—"}</div>
      </div>
      ${renderAttachments(ticket.attachments)}
    `;
  }

  if (repliesList) repliesList.innerHTML = renderReplies(ticket.replies);
  if (ticketModal) {
    ticketModal.classList.add('active');
    document.body.style.overflow = "hidden";
  }
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

async function sendEmailNotification(ticket, replyMessage) {
  try {
    const response = await fetch("/.netlify/functions/send-support-reply-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to_email: ticket.email,
        to_name: ticket.name || "User",
        subject: `Reply to your ticket: ${ticket.subject}`,
        message: replyMessage,
        ticket_id: currentTicketId
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
  
  const response = await fetch('/.netlify/functions/upload-ticket-attachment', {
    method: 'POST',
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
      status: closeAfter ? "closed" : "replied",
      updatedAt: serverTimestamp()
    };

    await updateDoc(doc(db, "tickets", currentTicketId), updateData);

    const idx = ticketsCache.findIndex(t => t.id === currentTicketId);
    if (idx !== -1) {
      if (!ticketsCache[idx].replies) ticketsCache[idx].replies = [];
      ticketsCache[idx].replies.push(newReply);
      ticketsCache[idx].status = closeAfter ? "closed" : "replied";
      
      sendEmailNotification(ticketsCache[idx], replyMessage);
    }

    if (replyTextarea) replyTextarea.value = "";
    adminReplySelectedFile = null;
    if (adminReplyFilePreview) adminReplyFilePreview.style.display = "none";
    if (adminReplyFileName) adminReplyFileName.textContent = "";
    if (adminReplyAttachment) adminReplyAttachment.value = "";
    
    if (repliesList) repliesList.innerHTML = renderReplies(ticketsCache[idx]?.replies || []);
    if (modalStatusSelect) modalStatusSelect.value = closeAfter ? "closed" : "replied";

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
    await updateDoc(doc(db, "tickets", currentTicketId), {
      status: newStatus,
      updatedAt: serverTimestamp()
    });

    const idx = ticketsCache.findIndex(t => t.id === currentTicketId);
    if (idx !== -1) {
      ticketsCache[idx].status = newStatus;
    }

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
  
  if (!confirm("Are you sure you want to delete this ticket? This action cannot be undone.")) {
    return;
  }

  toggleSpinner(true);

  try {
    await deleteDoc(doc(db, "tickets", currentTicketId));
    
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

if (loadTicketsBtn) loadTicketsBtn.addEventListener("click", loadTickets);
if (refreshTicketsBtn) refreshTicketsBtn.addEventListener("click", loadTickets);
if (closeModalBtn) closeModalBtn.addEventListener("click", closeTicketModal);
if (updateStatusBtn) updateStatusBtn.addEventListener("click", updateTicketStatus);
if (deleteTicketBtn) deleteTicketBtn.addEventListener("click", deleteTicket);
if (sendReplyBtn) sendReplyBtn.addEventListener("click", () => sendReply(false));
if (sendReplyCloseBtn) sendReplyCloseBtn.addEventListener("click", () => sendReply(true));

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

function sanitizeTelegramUsername(val) {
  return (val || '').replace('@', '').replace(/[^a-zA-Z0-9_]/g, '').trim();
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
    const errorMsg = getFirestoreErrorMessage(err);
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

    const review = reviewsCache.find(r => r.id === currentReviewId);
    if (review && review.email) {
      try {
        await fetch('/.netlify/functions/send-review-approved-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
  
  if (!confirm("Are you sure you want to delete this review? This action cannot be undone.")) {
    return;
  }

  toggleSpinner(true);

  try {
    await deleteDoc(doc(db, "reviews", currentReviewId));
    
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

    const idx = reviewsCache.findIndex(r => r.id === currentReviewId);
    if (idx !== -1) {
      reviewsCache[idx].reply = { message: replyMessage };
      
      const review = reviewsCache[idx];
      if (review.email) {
        try {
          await fetch('/.netlify/functions/send-review-reply-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

  if (!confirm("Are you sure you want to delete this reply? It will be removed from the public reviews page.")) {
    return;
  }

  toggleSpinner(true);

  try {
    await updateDoc(doc(db, "reviews", currentReviewId), {
      reply: null,
      updatedAt: serverTimestamp()
    });

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
    const username = tgUsername.replace('@', '').trim();
    contactButtons += `<a href="https://t.me/${username}" target="_blank" class="contact-btn-mobile" title="Telegram">📱</a>`;
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
        : `No users found in database. Check Firebase connection.`;
      if (contactData) contactData.innerHTML = `<tr><td colspan="5" class="hint">${msg}</td></tr>`;
      if (contactMobileCards) contactMobileCards.innerHTML = `<div class="mobile-card"><div class="hint" style="text-align:center;">${msg}</div></div>`;
      showToast(msg, "info");
      return;
    }

    if (contactMobileCards) contactMobileCards.innerHTML = mobileCardsHtml;
    showToast(`Loaded ${contactsCache.length} contacts`, "success");

  } catch (err) {
    console.error("[Admin] Error loading contacts:", err);
    const errorMsg = getFirestoreErrorMessage(err);
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
        '<span style="font-size:13px; color:var(--text-secondary);">/' + item[0] + '</span>' +
        '<span style="font-size:14px; font-weight:700; color:var(--accent); font-family:\'JetBrains Mono\',monospace;">' + item[1] + '</span>' +
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

