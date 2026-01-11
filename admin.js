// admin.js — Digimun Admin Panel (Users, Tickets, Reviews Management)
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, updateDoc, serverTimestamp, deleteDoc, addDoc,
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
    console.log("[Admin] Using cached users data:", allUsersCache.length, "users");
    return allUsersCache;
  }
  
  console.log("[Admin] Fetching fresh users data from Firestore...");
  const snapshot = await getDocs(collection(db, "users"));
  allUsersCache = [];
  snapshot.forEach(docSnap => {
    allUsersCache.push({ id: docSnap.id, data: docSnap.data() });
  });
  usersCacheTimestamp = now;
  console.log("[Admin] Users cache refreshed:", allUsersCache.length, "users");
  return allUsersCache;
}

function invalidateUsersCache() {
  allUsersCache = null;
  usersCacheTimestamp = 0;
  console.log("[Admin] Users cache invalidated");
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
  console.log("[Admin] DOM loaded, setting up event listeners...");
  
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
      'contacts': 'User Contacts'
    };
    mobileHeaderTitle.textContent = titles[section] || 'Admin Panel';
  }
  
  // Lazy load data only when section is opened
  if (section === 'tickets' && !ticketsLoaded) {
    console.log("[Admin] Loading tickets section for first time...");
    loadTickets();
    ticketsLoaded = true;
  } else if (section === 'reviews' && !reviewsLoaded) {
    console.log("[Admin] Loading reviews section for first time...");
    loadReviews();
    reviewsLoaded = true;
  } else if (section === 'contacts' && !contactsLoaded) {
    console.log("[Admin] Loading contacts section for first time...");
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
      console.log("[Admin] 2FA verified successfully!");
      
      if (data.sessionToken) {
        sessionStorage.setItem('admin2FAToken', data.sessionToken);
        sessionStorage.setItem('admin2FAExpiry', data.expiresAt);
      }
      
      hide2FAOverlay();
      isAdminAuthenticated = true;
      twoFAAttempts = 0;
      
      try {
        await loadDashboardStats();
        console.log("[Admin] Dashboard stats loaded successfully");
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
    console.log(`[Toast] ${type}: ${message}`);
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

async function loadDashboardStats() {
  console.log("[Admin] Loading dashboard stats...");
  
  try {
    // Load open tickets count
    console.log("[Admin] Fetching open tickets count...");
    const ticketsQ = query(collection(db, "tickets"), where("status", "==", "open"));
    const ticketsSnap = await getDocs(ticketsQ);
    console.log("[Admin] Open tickets found:", ticketsSnap.size);
    const openTicketsEl = document.getElementById('stat-open-tickets');
    if (openTicketsEl) openTicketsEl.textContent = ticketsSnap.size;
    
    // Load pending reviews count
    console.log("[Admin] Fetching pending reviews count...");
    const reviewsQ = query(collection(db, "reviews"), where("status", "==", "pending"));
    const reviewsSnap = await getDocs(reviewsQ);
    console.log("[Admin] Pending reviews found:", reviewsSnap.size);
    const pendingReviewsEl = document.getElementById('stat-pending-reviews');
    if (pendingReviewsEl) pendingReviewsEl.textContent = reviewsSnap.size;
    
    // Load pending users count
    console.log("[Admin] Fetching pending users count...");
    const pendingQ = query(collection(db, "users"), where("status", "==", "pending"), limit(100));
    const pendingSnap = await getDocs(pendingQ);
    console.log("[Admin] Pending users found:", pendingSnap.size);
    const pendingUsersEl = document.getElementById('stat-pending-users');
    if (pendingUsersEl) pendingUsersEl.textContent = pendingSnap.size >= 100 ? '100+' : pendingSnap.size;
    
    // Set users count placeholder
    const usersEl = document.getElementById('stat-users');
    if (usersEl) usersEl.textContent = '--';
    
    console.log("[Admin] Dashboard stats loaded successfully");
    
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
  
  if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" class="hint">Loading pending users...</td></tr>';
  
  const userMobileCardsEl = document.getElementById("user-mobile-cards");
  if (userMobileCardsEl) userMobileCardsEl.innerHTML = '<div class="mobile-card"><div class="hint" style="text-align:center;">Loading pending users...</div></div>';
  
  try {
    console.log("[Admin] Filtering pending users (using cache)...");
    
    const allUsers = await getAllUsersCached();
    console.log("[Admin] Total users:", allUsers.length);
    
    const pendingUsers = [];
    allUsers.forEach(user => {
      if (String(user.data.status || "").toLowerCase() === "pending") {
        pendingUsers.push({ id: user.id, data: user.data });
      }
    });
    
    console.log("[Admin] Pending users result:", pendingUsers.length, "documents");
    
    if (pendingUsers.length === 0) {
      if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" class="hint">No pending users found.</td></tr>';
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
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="8" class="hint" style="color:var(--danger);">${errorMsg}</td></tr>`;
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
    </div>
  `;
}

const userMobileCards = document.getElementById("user-mobile-cards");

function setTableMessage(msg, isError = false) {
  const style = isError ? 'color:var(--danger);' : '';
  if (tableBody) tableBody.innerHTML = `<tr><td colspan="8" class="hint" style="${style}">${msg}</td></tr>`;
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
      console.log("[Admin] Searching for user:", typedLower);
      let snap = await getDoc(doc(db, "users", typedLower));
      if (!snap.exists() && raw.trim() !== typedLower) {
        snap = await getDoc(doc(db, "users", raw.trim()));
      }
      if (snap.exists()) {
        console.log("[Admin] User found by ID:", snap.id);
        if (tableBody) tableBody.appendChild(renderRow(snap.id, snap.data()));
        if (userMobileCards) userMobileCards.innerHTML = renderUserMobileCard(snap.id, snap.data());
        showToast("User found!", "success");
      } else {
        const usersCol = collection(db, "users");
        let qs = await getDocs(query(usersCol, where("emailLower", "==", typedLower), limit(1)));
        if (qs.empty) {
          qs = await getDocs(query(usersCol, where("email", "==", raw.trim()), limit(1)));
        }
        if (!qs.empty) {
          const d = qs.docs[0];
          console.log("[Admin] User found by query:", d.id);
          if (tableBody) tableBody.appendChild(renderRow(d.id, d.data()));
          if (userMobileCards) userMobileCards.innerHTML = renderUserMobileCard(d.id, d.data());
          showToast("User found!", "success");
        } else {
          console.log("[Admin] User not found:", typedLower);
          setTableMessage("User not found");
          showToast("User not found", "info");
        }
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
      console.log("[Admin] Prefix search:", p);
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
      console.log("[Admin] Prefix search results:", qs.size);
      
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
    console.log("[Admin] Running filter:", currentField, "=", currentValue);
    
    const allUsers = await getAllUsersCached();
    console.log("[Admin] Total users:", allUsers.length);
    
    const fieldValues = {};
    allUsers.forEach(u => {
      const val = u.data[currentField];
      fieldValues[String(val)] = (fieldValues[String(val)] || 0) + 1;
    });
    console.log("[Admin] All values for", currentField + ":", JSON.stringify(fieldValues));
    
    const matchingDocs = [];
    allUsers.forEach(user => {
      const fieldValue = String(user.data[currentField] || "").toLowerCase().trim();
      const searchValue = String(currentValue).toLowerCase().trim();
      if (fieldValue === searchValue) {
        matchingDocs.push({ id: user.id, data: user.data });
        console.log("[Admin] Match found:", user.id, "->", user.data[currentField]);
      }
    });
    
    console.log("[Admin] Client-side filter matched:", matchingDocs.length, "users");
    
    // Create a mock snap object for compatibility
    const snap = {
      empty: matchingDocs.length === 0,
      size: matchingDocs.length,
      docs: matchingDocs,
      forEach: (callback) => matchingDocs.forEach(doc => callback({ id: doc.id, data: () => doc.data }))
    };
    
    console.log("[Admin] Filter results:", snap.size);
    
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
    console.log("[Admin] Updating user status:", email, isChecked ? "approved" : "pending");
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

window.toggleSwitchField = async function (email, field, isChecked) {
  if (!isAdminAuthenticated) {
    showToast("Not authenticated", "error");
    return;
  }
  
  try {
    toggleSpinner(true);
    console.log("[Admin] Updating user field:", email, field, isChecked ? "approved" : "pending");
    const newValue = isChecked ? "approved" : "pending";
    await updateDoc(doc(db, "users", email), { [field]: newValue });
    invalidateUsersCache();
    await refreshRowOrView(email);
    showToast(`${field} ${newValue}!`, "success");
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
  console.log("[Admin] Loading tickets with filter:", statusFilter);
  
  toggleSpinner(true);
  if (ticketData) ticketData.innerHTML = '<tr><td colspan="8" class="hint">Loading tickets...</td></tr>';
  
  const ticketMobileCards = document.getElementById("ticket-mobile-cards");
  if (ticketMobileCards) ticketMobileCards.innerHTML = '<div class="mobile-card"><div class="hint" style="text-align:center;">Loading tickets...</div></div>';

  try {
    let q;
    if (statusFilter === "all") {
      console.log("[Admin] Fetching all tickets...");
      q = query(collection(db, "tickets"), orderBy("createdAt", "desc"), limit(25));
    } else {
      console.log("[Admin] Fetching tickets with status:", statusFilter);
      q = query(collection(db, "tickets"), where("status", "==", statusFilter), orderBy("createdAt", "desc"), limit(25));
    }

    const snapshot = await getDocs(q);
    console.log("[Admin] Tickets snapshot:", snapshot.size, "documents");
    ticketsCache = [];

    if (snapshot.empty) {
      console.log("[Admin] No tickets found");
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
    
    console.log("[Admin] Tickets loaded successfully:", ticketsCache.length);
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
    return `
      <div class="reply-item ${isAdmin ? '' : 'user-reply'}">
        <div class="reply-meta">
          <span class="${isAdmin ? 'admin-badge' : 'user-badge'}">${isAdmin ? 'Admin' : 'Customer'}</span>
          <span class="reply-date">${formatDate(reply.createdAt)}</span>
        </div>
        <div class="reply-text">${escapeHtml(reply.message)}</div>
      </div>
    `;
  }).join('');
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
  console.log("[Admin] Viewing ticket:", ticketId);
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
      console.log("[Admin] Email sent successfully to:", ticket.email);
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

async function sendReply(closeAfter = false) {
  if (!currentTicketId) {
    showToast("No ticket selected", "error");
    return;
  }
  
  const replyMessage = replyTextarea?.value?.trim();
  if (!replyMessage) {
    showToast("Please write a reply message", "warning");
    return;
  }

  toggleSpinner(true);
  console.log("[Admin] Sending reply to ticket:", currentTicketId, "closeAfter:", closeAfter);

  try {
    const newReply = {
      message: replyMessage,
      createdAt: new Date(),
      adminEmail: ADMIN_EMAIL,
      isAdmin: true
    };

    const updateData = {
      replies: arrayUnion(newReply),
      status: closeAfter ? "closed" : "replied",
      updatedAt: serverTimestamp()
    };

    await updateDoc(doc(db, "tickets", currentTicketId), updateData);
    console.log("[Admin] Reply saved successfully");

    const idx = ticketsCache.findIndex(t => t.id === currentTicketId);
    if (idx !== -1) {
      if (!ticketsCache[idx].replies) ticketsCache[idx].replies = [];
      ticketsCache[idx].replies.push(newReply);
      ticketsCache[idx].status = closeAfter ? "closed" : "replied";
      
      sendEmailNotification(ticketsCache[idx], replyMessage);
    }

    if (replyTextarea) replyTextarea.value = "";
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
  console.log("[Admin] Updating ticket status:", currentTicketId, "to", newStatus);
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

  console.log("[Admin] Deleting ticket:", currentTicketId);
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
  
  tr.innerHTML = `
    <td style="font-size:12px;">${formatDate(data.createdAt)}</td>
    <td>${escapeHtml(data.name) || "—"}</td>
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

function renderReviewMobileCard(reviewId, data) {
  const messagePreview = (data.message || "").substring(0, 80) + ((data.message || "").length > 80 ? "..." : "");
  const hasReply = data.reply && data.reply.message;
  const replyBadge = hasReply ? '<span class="status-badge" style="background:rgba(0,255,195,0.15); color:var(--accent); font-size:10px; padding:2px 6px;">💬 Replied</span>' : '';
  
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

async function loadReviews() {
  if (!isAdminAuthenticated) {
    console.warn("[Admin] Not authenticated, cannot load reviews");
    return;
  }
  
  const statusFilter = reviewFilter?.value || "all";
  console.log("[Admin] Loading reviews with filter:", statusFilter);
  
  toggleSpinner(true);
  if (reviewData) reviewData.innerHTML = '<tr><td colspan="7" class="hint">Loading reviews...</td></tr>';
  
  const reviewMobileCards = document.getElementById("review-mobile-cards");
  if (reviewMobileCards) reviewMobileCards.innerHTML = '<div class="mobile-card"><div class="hint" style="text-align:center;">Loading reviews...</div></div>';

  try {
    let q;
    if (statusFilter === "all") {
      console.log("[Admin] Fetching all reviews...");
      q = query(collection(db, "reviews"), orderBy("createdAt", "desc"), limit(25));
    } else {
      console.log("[Admin] Fetching reviews with status:", statusFilter);
      q = query(collection(db, "reviews"), where("status", "==", statusFilter), orderBy("createdAt", "desc"), limit(25));
    }

    const snapshot = await getDocs(q);
    console.log("[Admin] Reviews snapshot:", snapshot.size, "documents");
    reviewsCache = [];

    if (snapshot.empty) {
      console.log("[Admin] No reviews found");
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
    
    console.log("[Admin] Reviews loaded successfully:", reviewsCache.length);
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
  console.log("[Admin] Viewing review:", reviewId);
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

  console.log("[Admin] Approving review:", currentReviewId);
  toggleSpinner(true);

  try {
    await updateDoc(doc(db, "reviews", currentReviewId), {
      status: "approved",
      updatedAt: serverTimestamp()
    });

    const review = reviewsCache.find(r => r.id === currentReviewId);
    if (review && review.email) {
      await addDoc(collection(db, "emailNotifications"), {
        type: "review_approved",
        to_email: review.email,
        to_name: review.name || "User",
        subject: "Your review has been approved!",
        message: "Congratulations! Your review has been approved and is now visible on our website. Thank you for sharing your feedback with the Digimun community.",
        review_id: currentReviewId,
        link: "/reviews",
        status: "pending",
        createdAt: serverTimestamp()
      });
      console.log("[Admin] Review approval notification queued for:", review.email);
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

  console.log("[Admin] Saving review changes:", currentReviewId);
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

  console.log("[Admin] Deleting review:", currentReviewId);
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

  console.log("[Admin] Saving reply for review:", currentReviewId);
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
        await addDoc(collection(db, "emailNotifications"), {
          type: "review_reply",
          to_email: review.email,
          to_name: review.name || "User",
          subject: "Digimun Team replied to your review",
          message: replyMessage,
          review_id: currentReviewId,
          link: "/reviews",
          status: "pending",
          createdAt: serverTimestamp()
        });
        console.log("[Admin] Review reply notification queued for:", review.email);
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

  console.log("[Admin] Deleting reply for review:", currentReviewId);
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
  
  console.log("[Admin] Loading contacts...");
  toggleSpinner(true);
  
  if (contactData) contactData.innerHTML = '<tr><td colspan="5" class="hint">Loading contacts...</td></tr>';
  if (contactMobileCards) contactMobileCards.innerHTML = '<div class="mobile-card"><div class="hint" style="text-align:center;">Loading contacts...</div></div>';

  try {
    console.log("[Admin] Loading contacts (using cache)...");
    const allUsers = await getAllUsersCached();
    console.log("[Admin] Total users:", allUsers.length);
    contactsCache = [];

    if (allUsers.length === 0) {
      console.log("[Admin] No contacts found");
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
    
    console.log("[Admin] Total users:", allUsers.length, "| Users with contacts:", contactsCache.length);

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
    console.log("[Admin] Contacts loaded successfully:", contactsCache.length);
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

