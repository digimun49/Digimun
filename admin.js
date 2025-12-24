// admin.js — Digimun Admin Panel (Users, Tickets, Reviews Management)
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, updateDoc, serverTimestamp, deleteDoc,
  collection, query, where, orderBy, limit, startAfter, getDocs, documentId, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const ADMIN_EMAIL = "muneebg249@gmail.com";
const PAGE_SIZE = 50;

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

// Toggle Spinner
function toggleSpinner(show) {
  const s = document.getElementById("loading-spinner");
  if (s) s.classList.toggle('active', show);
}

// Mobile Menu
function openSidebar() {
  if (sidebar) sidebar.classList.add("open");
  if (sidebarOverlay) sidebarOverlay.classList.add("active");
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  if (sidebar) sidebar.classList.remove("open");
  if (sidebarOverlay) sidebarOverlay.classList.remove("active");
  document.body.style.overflow = '';
}

if (mobileToggle) {
  mobileToggle.addEventListener("click", openSidebar);
}

if (sidebarClose) {
  sidebarClose.addEventListener("click", closeSidebar);
}

if (sidebarOverlay) {
  sidebarOverlay.addEventListener("click", closeSidebar);
}

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
      alert("Unable to paste. Please allow clipboard access or paste manually (Ctrl+V).");
    }
  });
}

// Section Navigation with lazy loading
window.showSection = function(section, element) {
  document.querySelectorAll('[id^="section-"]').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  
  const targetSection = document.getElementById(`section-${section}`);
  if (targetSection) targetSection.style.display = 'block';
  
  if (element) element.classList.add('active');
  
  // Lazy load data only when section is opened
  if (section === 'tickets' && !ticketsLoaded) {
    loadTickets();
    ticketsLoaded = true;
  } else if (section === 'reviews' && !reviewsLoaded) {
    loadReviews();
    reviewsLoaded = true;
  }
  
  closeSidebar();
};

// State for lazy loading
let ticketsLoaded = false;
let reviewsLoaded = false;

// Auth Check
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Access Denied. Please log in first.");
    window.location.href = "login.html";
    return;
  }
  
  if (user.email !== ADMIN_EMAIL) {
    alert("Access Denied. You are not an admin.");
    window.location.href = "login.html";
    return;
  }
  
  // Only load dashboard stats on login (fast)
  try {
    await loadDashboardStats();
  } catch (err) {
    console.error("Dashboard stats error:", err);
  }
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

// ================== TOAST NOTIFICATIONS ==================

window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-message">${message}</span>
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
  try {
    const ticketsQ = query(collection(db, "tickets"), where("status", "==", "open"));
    const ticketsSnap = await getDocs(ticketsQ);
    document.getElementById('stat-open-tickets').textContent = ticketsSnap.size;
    
    const reviewsQ = query(collection(db, "reviews"), where("status", "==", "pending"));
    const reviewsSnap = await getDocs(reviewsQ);
    document.getElementById('stat-pending-reviews').textContent = reviewsSnap.size;
    
    const pendingQ = query(collection(db, "users"), where("status", "==", "pending"), limit(100));
    const pendingSnap = await getDocs(pendingQ);
    document.getElementById('stat-pending-users').textContent = pendingSnap.size >= 100 ? '100+' : pendingSnap.size;
    
    const usersQ = query(collection(db, "users"), limit(1));
    document.getElementById('stat-users').textContent = '--';
    
  } catch (err) {
    console.error("Error loading dashboard stats:", err);
  }
}

window.refreshAllData = async function() {
  showToast('Refreshing...', 'info');
  toggleSpinner(true);
  ticketsLoaded = false;
  reviewsLoaded = false;
  
  try {
    await loadDashboardStats();
    showToast('Dashboard refreshed!', 'success');
  } catch (err) {
    showToast('Error refreshing', 'error');
  } finally {
    toggleSpinner(false);
  }
};

window.filterPendingUsers = async function() {
  showSection('users', document.querySelector('[onclick*=users]'));
  
  if (filterFieldSel) filterFieldSel.value = 'status';
  if (filterValueSel) filterValueSel.value = 'pending';
  
  currentField = 'status';
  currentValue = 'pending';
  lastDoc = null;
  
  toggleSpinner(true);
  tableBody.innerHTML = '<tr><td colspan="7" class="hint">Loading pending users...</td></tr>';
  
  try {
    const q = query(
      collection(db, "users"),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    );
    
    const snap = await getDocs(q);
    
    if (snap.empty) {
      tableBody.innerHTML = '<tr><td colspan="7" class="hint">No pending users found.</td></tr>';
      loadMoreBtn.style.display = 'none';
      showToast('No pending users found', 'info');
      return;
    }
    
    tableBody.innerHTML = '';
    snap.forEach(docSnap => renderRow(docSnap.id, docSnap.data()));
    lastDoc = snap.docs[snap.docs.length - 1];
    loadMoreBtn.style.display = snap.size < PAGE_SIZE ? 'none' : 'inline-block';
    
    showToast(`Found ${snap.size} pending users`, 'success');
  } catch (err) {
    console.error("Error filtering pending users:", err);
    tableBody.innerHTML = '<tr><td colspan="7" class="hint">Error loading users.</td></tr>';
    showToast('Error loading users', 'error');
  } finally {
    toggleSpinner(false);
  }
};

// ================== USERS SECTION ==================

function renderRow(email, data) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${email}</td>
    <td>
      <label class="switch">
        <input type="checkbox" ${data.status === "approved" ? "checked" : ""}
               onchange="toggleSwitchStatus('${email}', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="margin-top:4px;">${statusBadge(data.status)}</div>
    </td>
    <td>
      <label class="switch">
        <input type="checkbox" ${data.paymentStatus === "approved" ? "checked" : ""}
               onchange="toggleSwitchField('${email}', 'paymentStatus', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="margin-top:4px;">${statusBadge(data.paymentStatus)}</div>
    </td>
    <td>
      <label class="switch">
        <input type="checkbox" ${data.quotexStatus === "approved" ? "checked" : ""}
               onchange="toggleSwitchField('${email}', 'quotexStatus', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="margin-top:4px;">${statusBadge(data.quotexStatus)}</div>
    </td>
    <td>
      <label class="switch">
        <input type="checkbox" ${data.recoveryRequest === "approved" ? "checked" : ""}
               onchange="toggleSwitchField('${email}', 'recoveryRequest', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="margin-top:4px;">${statusBadge(data.recoveryRequest)}</div>
    </td>
    <td>
      <label class="switch">
        <input type="checkbox" ${data.digimaxStatus === "approved" ? "checked" : ""}
               onchange="toggleSwitchField('${email}', 'digimaxStatus', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="margin-top:4px;">${statusBadge(data.digimaxStatus)}</div>
    </td>
    <td style="font-size:12px;">${formatDate(data.approvedAt)}</td>
  `;
  return tr;
}

function setTableMessage(msg) {
  tableBody.innerHTML = `<tr><td colspan="7" class="hint">${msg}</td></tr>`;
}

if (searchBtn) {
  searchBtn.addEventListener("click", async () => {
    const raw = searchInput?.value || "";
    const typedLower = cleanEmail(raw);
    if (!typedLower) return;

    toggleSpinner(true);
    tableBody.innerHTML = "";

    try {
      let snap = await getDoc(doc(db, "users", typedLower));
      if (!snap.exists() && raw.trim() !== typedLower) {
        snap = await getDoc(doc(db, "users", raw.trim()));
      }
      if (snap.exists()) {
        tableBody.appendChild(renderRow(snap.id, snap.data()));
      } else {
        const usersCol = collection(db, "users");
        let qs = await getDocs(query(usersCol, where("emailLower", "==", typedLower), limit(1)));
        if (qs.empty) {
          qs = await getDocs(query(usersCol, where("email", "==", raw.trim()), limit(1)));
        }
        if (!qs.empty) {
          const d = qs.docs[0];
          tableBody.appendChild(renderRow(d.id, d.data()));
        } else {
          setTableMessage("User not found");
        }
      }
    } catch (e) {
      console.error(e);
      setTableMessage("Error loading user");
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
    if (!p) return;

    toggleSpinner(true);
    tableBody.innerHTML = "";
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
        setTableMessage("No matches");
      } else {
        qs.forEach(d => tableBody.appendChild(renderRow(d.id, d.data())));
      }
      currentField = null; currentValue = null; lastDoc = null;
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
    } catch (e) {
      console.error(e);
      setTableMessage("Error loading list");
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
    } finally {
      toggleSpinner(false);
    }
  });
}

async function runFilter(firstPage = true) {
  if (!currentField || !currentValue) return;
  if (firstPage) { tableBody.innerHTML = ""; lastDoc = null; }

  toggleSpinner(true);
  try {
    let base = query(
      collection(db, "users"),
      where(currentField, "==", currentValue),
      orderBy(documentId()),
      limit(PAGE_SIZE)
    );
    if (lastDoc) {
      base = query(
        collection(db, "users"),
        where(currentField, "==", currentValue),
        orderBy(documentId()),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
    }
    const qs = await getDocs(base);
    if (qs.empty && firstPage) {
      setTableMessage(`No users found for <b>${currentField}</b> = <b>${currentValue}</b>`);
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
      return;
    }
    qs.forEach(d => tableBody.appendChild(renderRow(d.id, d.data())));
    lastDoc = qs.docs[qs.docs.length - 1] || null;
    if (loadMoreBtn) loadMoreBtn.style.display = qs.size === PAGE_SIZE ? "inline-block" : "none";
  } catch (e) {
    console.error(e);
    if (firstPage) setTableMessage("Error loading list");
    if (loadMoreBtn) loadMoreBtn.style.display = "none";
  } finally {
    toggleSpinner(false);
  }
}

if (applyFilterBtn) {
  applyFilterBtn.addEventListener("click", async () => {
    currentField = filterFieldSel?.value || null;
    currentValue = filterValueSel?.value || null;
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
  });
}

window.toggleSwitchStatus = async function (email, isChecked) {
  try {
    toggleSpinner(true);
    const newStatus = isChecked ? "approved" : "pending";
    const updateObj = { status: newStatus };
    if (newStatus === "approved") updateObj.approvedAt = serverTimestamp();
    await updateDoc(doc(db, "users", email), updateObj);
    await refreshRowOrView(email);
  } catch (e) {
    alert(e.message);
  } finally { toggleSpinner(false); }
};

window.toggleSwitchField = async function (email, field, isChecked) {
  try {
    toggleSpinner(true);
    const newValue = isChecked ? "approved" : "pending";
    await updateDoc(doc(db, "users", email), { [field]: newValue });
    await refreshRowOrView(email);
  } catch (e) {
    alert(e.message);
  } finally { toggleSpinner(false); }
};

async function refreshRowOrView(email) {
  if (currentField && currentValue) return runFilter(true);
  const typedLower = cleanEmail(searchInput?.value || "");
  if (typedLower) return searchBtn?.click();
  tableBody.innerHTML = "";
  const snap = await getDoc(doc(db, "users", email));
  if (snap.exists()) tableBody.appendChild(renderRow(email, snap.data()));
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
  if (telegram) icons.push(`<span title="Telegram: ${telegram}" style="cursor:help;">📱</span>`);
  if (whatsapp) icons.push(`<span title="WhatsApp: ${whatsapp}" style="cursor:help;">💬</span>`);
  return icons.length > 0 ? icons.join(' ') : '<span style="color:var(--text-muted);">—</span>';
}

function renderTicketRow(ticketId, data) {
  const repliesCount = (data.replies && Array.isArray(data.replies)) ? data.replies.length : 0;
  const contactIcons = renderContactIcons(data.telegramUsername, data.whatsappNumber);
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td style="font-size:12px;">${formatDate(data.createdAt)}</td>
    <td>${data.name || "—"}</td>
    <td style="font-size:12px;">${data.email || "—"}</td>
    <td>${data.subject || "—"}</td>
    <td>${ticketStatusBadge(data.status)}</td>
    <td>${contactIcons}</td>
    <td><span style="background:var(--accent-glow);padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;">${repliesCount}</span></td>
    <td>
      <button class="btn btn-primary btn-sm" onclick="viewTicket('${ticketId}')">View</button>
    </td>
  `;
  return tr;
}

async function loadTickets() {
  const statusFilter = ticketFilter?.value || "all";
  toggleSpinner(true);
  ticketData.innerHTML = "";

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
      ticketData.innerHTML = `<tr><td colspan="8" class="hint">No tickets found.</td></tr>`;
      if (ticketCountBadge) ticketCountBadge.textContent = "0";
      if (navTicketCount) navTicketCount.textContent = "0";
      return;
    }

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      ticketsCache.push({ id: docSnap.id, ...data });
      ticketData.appendChild(renderTicketRow(docSnap.id, data));
    });

    if (ticketCountBadge) ticketCountBadge.textContent = ticketsCache.length.toString();
    if (navTicketCount) navTicketCount.textContent = ticketsCache.length.toString();

  } catch (err) {
    console.error("Error loading tickets:", err);
    let errorMsg = "Error loading tickets";
    if (err.code === "failed-precondition" || err.message?.includes("index")) {
      errorMsg = "Firestore index required. Please check Firebase Console for index creation link.";
      console.error("INDEX REQUIRED: Create composite index for 'tickets' collection with fields: status (Ascending), createdAt (Descending)");
    } else if (err.code === "permission-denied") {
      errorMsg = "Permission denied. Check Firestore security rules.";
    }
    ticketData.innerHTML = `<tr><td colspan="8" class="hint" style="color:var(--danger);">${errorMsg}</td></tr>`;
    showToast?.(errorMsg, 'error');
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
    const username = telegram.replace('@', '');
    html += `
      <a href="https://t.me/${username}" target="_blank" class="btn btn-sm" style="background:rgba(0,136,204,0.2); color:#0088cc; border:1px solid rgba(0,136,204,0.3); display:inline-flex; align-items:center; gap:6px;">
        <span style="font-size:14px;">📱</span> Open Telegram @${username}
      </a>
    `;
  }
  
  if (whatsapp) {
    const cleanNumber = whatsapp.replace(/[^0-9]/g, '');
    html += `
      <a href="https://wa.me/${cleanNumber}" target="_blank" class="btn btn-sm" style="background:rgba(37,211,102,0.2); color:#25d366; border:1px solid rgba(37,211,102,0.3); display:inline-flex; align-items:center; gap:6px;">
        <span style="font-size:14px;">💬</span> Open WhatsApp ${whatsapp}
      </a>
    `;
  }
  
  html += '</div>';
  return html;
}

window.viewTicket = function(ticketId) {
  const ticket = ticketsCache.find(t => t.id === ticketId);
  if (!ticket) {
    alert("Ticket not found in cache");
    return;
  }

  currentTicketId = ticketId;
  modalStatusSelect.value = ticket.status || "open";
  replyTextarea.value = "";

  const hasTelegram = ticket.telegramUsername;
  const hasWhatsapp = ticket.whatsappNumber;

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
      <p>${ticket.name || "—"}</p>
    </div>
    <div class="modal-field">
      <label>Customer Email</label>
      <p><a href="mailto:${ticket.email}" style="color:var(--accent);">${ticket.email || "—"}</a></p>
    </div>
    <div class="modal-field" style="background:rgba(0,255,195,0.05); border:1px solid var(--border-accent); border-radius:8px; padding:12px;">
      <label style="color:var(--accent);">Direct Contact</label>
      ${renderContactButtons(hasTelegram, hasWhatsapp)}
    </div>
    <div class="modal-field">
      <label>Subject</label>
      <p style="color:var(--accent); font-weight:600;">${ticket.subject || "—"}</p>
    </div>
    <div class="modal-field">
      <label>Message</label>
      <div class="message-box">${escapeHtml(ticket.message) || "—"}</div>
    </div>
  `;

  repliesList.innerHTML = renderReplies(ticket.replies);
  ticketModal.classList.add('active');
  document.body.style.overflow = "hidden";
};

function closeTicketModal() {
  ticketModal.classList.remove('active');
  currentTicketId = null;
  document.body.style.overflow = "";
}

async function sendEmailNotification(ticket, replyMessage) {
  if (typeof emailjs === "undefined") {
    console.log("EmailJS not loaded - skipping email notification");
    return;
  }

  try {
    await emailjs.send("service_digimun", "template_ticket_reply", {
      to_email: ticket.email,
      to_name: ticket.name,
      ticket_subject: ticket.subject,
      admin_reply: replyMessage,
      ticket_id: currentTicketId
    });
    console.log("Email notification sent to:", ticket.email);
  } catch (err) {
    console.warn("Email notification failed (non-critical):", err);
  }
}

async function sendReply(closeAfter = false) {
  if (!currentTicketId) return;
  
  const replyMessage = replyTextarea.value.trim();
  if (!replyMessage) {
    alert("Please write a reply message");
    return;
  }

  toggleSpinner(true);

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

    const idx = ticketsCache.findIndex(t => t.id === currentTicketId);
    if (idx !== -1) {
      if (!ticketsCache[idx].replies) ticketsCache[idx].replies = [];
      ticketsCache[idx].replies.push(newReply);
      ticketsCache[idx].status = closeAfter ? "closed" : "replied";
      
      sendEmailNotification(ticketsCache[idx], replyMessage);
    }

    replyTextarea.value = "";
    repliesList.innerHTML = renderReplies(ticketsCache[idx]?.replies || []);
    modalStatusSelect.value = closeAfter ? "closed" : "replied";

    alert(closeAfter ? "Reply sent and ticket closed!" : "Reply sent successfully!");
    
    if (closeAfter) {
      closeTicketModal();
    }
    
    await loadTickets();

  } catch (err) {
    console.error("Error sending reply:", err);
    alert("Failed to send reply: " + err.message);
  } finally {
    toggleSpinner(false);
  }
}

async function updateTicketStatus() {
  if (!currentTicketId) return;

  const newStatus = modalStatusSelect.value;
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

    alert(`Ticket status updated to: ${newStatus}`);
    closeTicketModal();
    await loadTickets();

  } catch (err) {
    console.error("Error updating ticket:", err);
    alert("Failed to update ticket status");
  } finally {
    toggleSpinner(false);
  }
}

async function deleteTicket() {
  if (!currentTicketId) return;
  
  if (!confirm("Are you sure you want to delete this ticket? This action cannot be undone.")) {
    return;
  }

  toggleSpinner(true);

  try {
    await deleteDoc(doc(db, "tickets", currentTicketId));
    
    alert("Ticket deleted successfully");
    closeTicketModal();
    await loadTickets();

  } catch (err) {
    console.error("Error deleting ticket:", err);
    alert("Failed to delete ticket: " + err.message);
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
  
  tr.innerHTML = `
    <td style="font-size:12px;">${formatDate(data.createdAt)}</td>
    <td>${escapeHtml(data.name) || "—"}</td>
    <td>${escapeHtml(data.country) || "—"}</td>
    <td><span class="stars">${getStars(data.rating)}</span></td>
    <td style="font-size:13px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(messagePreview)}</td>
    <td>${statusBadge(data.status)}</td>
    <td>
      <button class="btn btn-primary btn-sm" onclick="viewReview('${reviewId}')">Manage</button>
    </td>
  `;
  return tr;
}

async function loadReviews() {
  const statusFilter = reviewFilter?.value || "all";
  toggleSpinner(true);
  reviewData.innerHTML = "";

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
      reviewData.innerHTML = `<tr><td colspan="7" class="hint">No reviews found.</td></tr>`;
      if (reviewCountBadge) reviewCountBadge.textContent = "0";
      if (navReviewCount) navReviewCount.textContent = "0";
      return;
    }

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      reviewsCache.push({ id: docSnap.id, ...data });
      reviewData.appendChild(renderReviewRow(docSnap.id, data));
    });

    if (reviewCountBadge) reviewCountBadge.textContent = reviewsCache.length.toString();
    if (navReviewCount) navReviewCount.textContent = reviewsCache.length.toString();

  } catch (err) {
    console.error("Error loading reviews:", err);
    let errorMsg = "Error loading reviews";
    if (err.code === "failed-precondition" || err.message?.includes("index")) {
      errorMsg = "Firestore index required. Please check Firebase Console for index creation link.";
      console.error("INDEX REQUIRED: Create composite index for 'reviews' collection with fields: status (Ascending), createdAt (Descending)");
    } else if (err.code === "permission-denied") {
      errorMsg = "Permission denied. Check Firestore security rules.";
    }
    reviewData.innerHTML = `<tr><td colspan="7" class="hint" style="color:var(--danger);">${errorMsg}</td></tr>`;
    showToast?.(errorMsg, 'error');
  } finally {
    toggleSpinner(false);
  }
}

window.viewReview = function(reviewId) {
  const review = reviewsCache.find(r => r.id === reviewId);
  if (!review) {
    alert("Review not found in cache");
    return;
  }

  currentReviewId = reviewId;
  reviewStatusSelect.value = review.status || "pending";
  editReviewMessage.value = review.message || "";

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

  reviewModal.classList.add('active');
  document.body.style.overflow = "hidden";
};

function closeReviewModal() {
  reviewModal.classList.remove('active');
  currentReviewId = null;
  document.body.style.overflow = "";
}

async function approveReview() {
  if (!currentReviewId) return;

  toggleSpinner(true);

  try {
    await updateDoc(doc(db, "reviews", currentReviewId), {
      status: "approved",
      updatedAt: serverTimestamp()
    });

    alert("Review approved and now visible to the public!");
    closeReviewModal();
    await loadReviews();

  } catch (err) {
    console.error("Error approving review:", err);
    alert("Failed to approve review: " + err.message);
  } finally {
    toggleSpinner(false);
  }
}

async function saveReviewChanges() {
  if (!currentReviewId) return;

  const newStatus = reviewStatusSelect.value;
  const newMessage = editReviewMessage.value.trim();

  if (!newMessage) {
    alert("Review message cannot be empty");
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

    alert("Review updated successfully!");
    closeReviewModal();
    await loadReviews();

  } catch (err) {
    console.error("Error updating review:", err);
    alert("Failed to update review: " + err.message);
  } finally {
    toggleSpinner(false);
  }
}

async function deleteReview() {
  if (!currentReviewId) return;
  
  if (!confirm("Are you sure you want to delete this review permanently? This action cannot be undone.")) {
    return;
  }

  toggleSpinner(true);

  try {
    await deleteDoc(doc(db, "reviews", currentReviewId));
    
    alert("Review deleted successfully");
    closeReviewModal();
    await loadReviews();

  } catch (err) {
    console.error("Error deleting review:", err);
    alert("Failed to delete review: " + err.message);
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

if (reviewModal) {
  reviewModal.addEventListener("click", (e) => {
    if (e.target === reviewModal) closeReviewModal();
  });
}

// Escape key handler for modals
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (ticketModal.classList.contains('active')) closeTicketModal();
    if (reviewModal.classList.contains('active')) closeReviewModal();
  }
});

// Data loading is now handled in onAuthStateChanged callback above
console.log("Admin.js: Script loaded. Waiting for authentication...");
