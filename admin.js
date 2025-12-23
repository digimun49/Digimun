// admin.js — Digimun Admin (robust email search + prefix search + filters + pagination + ticket replies)
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, updateDoc, serverTimestamp, deleteDoc,
  collection, query, where, orderBy, limit, startAfter, getDocs, documentId, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const ADMIN_EMAIL = "muneebg249@gmail.com";
const PAGE_SIZE = 50;

const sidebarToggle = document.getElementById("sidebar-toggle");
const tableBody     = document.getElementById("user-data");
const loadMoreBtn   = document.getElementById("load-more");
const searchBtn     = document.getElementById("search-btn");
const prefixBtn     = document.getElementById("prefix-btn");
const searchInput   = document.getElementById("search-email");

const applyFilterBtn = document.getElementById("apply-filter");
const clearFilterBtn = document.getElementById("clear-filter");
const filterFieldSel = document.getElementById("filter-field");
const filterValueSel = document.getElementById("filter-value");

function toggleSpinner(show) {
  const s = document.getElementById("loading-spinner");
  if (s) s.style.display = show ? "block" : "none";
}
if (sidebarToggle) {
  sidebarToggle.addEventListener("click", () => {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    sidebar.style.width = sidebar.style.width === "250px" ? "0" : "250px";
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user || user.email !== ADMIN_EMAIL) {
    alert("Access Denied. You are not an admin.");
    window.location.href = "login.html";
  }
});

function cleanEmail(s) {
  if (!s) return "";
  return s.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "").trim().toLowerCase();
}
function statusBadge(val) {
  const safe = (val || "pending").toLowerCase();
  const klass = safe === "approved" ? "status-approved"
             : safe === "suspended" ? "status-suspended"
             : "status-pending";
  return `<span class="status-badge ${klass}">${safe}</span>`;
}
function formatApprovedAt(ts) {
  try {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d)) return "—";
    return d.toLocaleString();
  } catch { return "—"; }
}
function renderRow(email, data) {
  const approvedDate = formatApprovedAt(data.approvedAt);
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${email}</td>
    <td>
      <label class="switch">
        <input type="checkbox" ${data.status === "approved" ? "checked" : ""}
               aria-label="Toggle main status for ${email}"
               onchange="toggleSwitchStatus('${email}', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="font-size:12px;margin-top:4px;">${statusBadge(data.status)}</div>
    </td>
    <td>
      <label class="switch">
        <input type="checkbox" ${data.paymentStatus === "approved" ? "checked" : ""}
               aria-label="Toggle payment status for ${email}"
               onchange="toggleSwitchField('${email}', 'paymentStatus', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="font-size:12px;margin-top:4px;">${statusBadge(data.paymentStatus)}</div>
    </td>
    <td>
      <label class="switch">
        <input type="checkbox" ${data.quotexStatus === "approved" ? "checked" : ""}
               aria-label="Toggle quotex status for ${email}"
               onchange="toggleSwitchField('${email}', 'quotexStatus', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="font-size:12px;margin-top:4px;">${statusBadge(data.quotexStatus)}</div>
    </td>
    <td>
      <label class="switch">
        <input type="checkbox" ${data.recoveryRequest === "approved" ? "checked" : ""}
               aria-label="Toggle recovery status for ${email}"
               onchange="toggleSwitchField('${email}', 'recoveryRequest', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="font-size:12px;margin-top:4px;">${statusBadge(data.recoveryRequest)}</div>
    </td>
    <td>
      <label class="switch">
        <input type="checkbox" ${data.digimaxStatus === "approved" ? "checked" : ""}
               aria-label="Toggle digimax status for ${email}"
               onchange="toggleSwitchField('${email}', 'digimaxStatus', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="font-size:12px;margin-top:4px;">${statusBadge(data.digimaxStatus)}</div>
    </td>
    <td>${approvedDate}</td>
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

let currentField = null;
let currentValue = null;
let lastDoc = null;

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

let currentTicketId = null;
let ticketsCache = [];

function ticketStatusBadge(status) {
  const s = (status || "open").toLowerCase();
  const classMap = {
    open: "status-open",
    replied: "status-replied",
    closed: "status-closed"
  };
  return `<span class="status-badge ${classMap[s] || 'status-open'}">${s}</span>`;
}

function formatTicketDate(ts) {
  try {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return "—"; }
}

function renderTicketRow(ticketId, data) {
  const repliesCount = (data.replies && Array.isArray(data.replies)) ? data.replies.length : 0;
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td style="font-size:12px;">${formatTicketDate(data.createdAt)}</td>
    <td>${data.name || "—"}</td>
    <td style="font-size:12px;">${data.email || "—"}</td>
    <td>${data.subject || "—"}</td>
    <td>${ticketStatusBadge(data.status)}</td>
    <td><span style="background:rgba(0,255,195,0.15);padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;">${repliesCount}</span></td>
    <td>
      <button class="btn" style="padding:6px 14px; font-size:12px;" onclick="viewTicket('${ticketId}')">View & Reply</button>
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
      q = query(collection(db, "tickets"), orderBy("createdAt", "desc"), limit(100));
    } else {
      q = query(collection(db, "tickets"), where("status", "==", statusFilter), orderBy("createdAt", "desc"), limit(100));
    }

    const snapshot = await getDocs(q);
    ticketsCache = [];

    if (snapshot.empty) {
      ticketData.innerHTML = `<tr><td colspan="7" class="hint">No tickets found.</td></tr>`;
      ticketCountBadge.textContent = "0";
      return;
    }

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      ticketsCache.push({ id: docSnap.id, ...data });
      ticketData.appendChild(renderTicketRow(docSnap.id, data));
    });

    ticketCountBadge.textContent = ticketsCache.length.toString();

  } catch (err) {
    console.error("Error loading tickets:", err);
    ticketData.innerHTML = `<tr><td colspan="7" class="hint" style="color:#ff4d4d;">Error loading tickets</td></tr>`;
  } finally {
    toggleSpinner(false);
  }
}

function renderReplies(replies) {
  if (!replies || !Array.isArray(replies) || replies.length === 0) {
    return '<div class="no-replies">No replies yet. Write your first reply above.</div>';
  }
  
  return replies.map(reply => `
    <div class="reply-item">
      <div class="reply-meta">
        <span class="admin-badge">Admin</span>
        <span class="reply-date">${formatTicketDate(reply.createdAt)}</span>
      </div>
      <div class="reply-text">${escapeHtml(reply.message)}</div>
    </div>
  `).join('');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

  ticketModalContent.innerHTML = `
    <div class="modal-field">
      <label>Ticket ID</label>
      <p style="font-family:monospace; font-size:12px; color:var(--muted);">${ticketId}</p>
    </div>
    <div class="modal-field">
      <label>Submitted</label>
      <p>${formatTicketDate(ticket.createdAt)}</p>
    </div>
    <div class="modal-field">
      <label>Customer Name</label>
      <p>${ticket.name || "—"}</p>
    </div>
    <div class="modal-field">
      <label>Customer Email</label>
      <p><a href="mailto:${ticket.email}">${ticket.email || "—"}</a></p>
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
  ticketModal.style.display = "block";
  document.body.style.overflow = "hidden";
};

function closeModal() {
  ticketModal.style.display = "none";
  currentTicketId = null;
  document.body.style.overflow = "";
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
      adminEmail: ADMIN_EMAIL
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
    }

    replyTextarea.value = "";
    repliesList.innerHTML = renderReplies(ticketsCache[idx]?.replies || []);
    modalStatusSelect.value = closeAfter ? "closed" : "replied";

    alert(closeAfter ? "Reply sent and ticket closed!" : "Reply sent successfully!");
    
    if (closeAfter) {
      closeModal();
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
    closeModal();
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
    closeModal();
    await loadTickets();

  } catch (err) {
    console.error("Error deleting ticket:", err);
    alert("Failed to delete ticket: " + err.message);
  } finally {
    toggleSpinner(false);
  }
}

if (loadTicketsBtn) {
  loadTicketsBtn.addEventListener("click", loadTickets);
}
if (refreshTicketsBtn) {
  refreshTicketsBtn.addEventListener("click", loadTickets);
}
if (closeModalBtn) {
  closeModalBtn.addEventListener("click", closeModal);
}
if (updateStatusBtn) {
  updateStatusBtn.addEventListener("click", updateTicketStatus);
}
if (deleteTicketBtn) {
  deleteTicketBtn.addEventListener("click", deleteTicket);
}
if (sendReplyBtn) {
  sendReplyBtn.addEventListener("click", () => sendReply(false));
}
if (sendReplyCloseBtn) {
  sendReplyCloseBtn.addEventListener("click", () => sendReply(true));
}
if (ticketModal) {
  ticketModal.addEventListener("click", (e) => {
    if (e.target === ticketModal) closeModal();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && ticketModal.style.display === "block") {
    closeModal();
  }
});

loadTickets();
