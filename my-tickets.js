import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, query, where, orderBy, getDocs, doc, updateDoc, arrayUnion, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const notLoggedIn = document.getElementById("not-logged-in");
const loggedInInfo = document.getElementById("logged-in-info");
const userEmailDisplay = document.getElementById("user-email-display");
const filterTabs = document.getElementById("filter-tabs");
const ticketsContainer = document.getElementById("tickets-container");
const ticketModal = document.getElementById("ticket-modal");
const closeModalBtn = document.getElementById("close-modal");
const modalTicketContent = document.getElementById("modal-ticket-content");
const repliesList = document.getElementById("replies-list");
const replyForm = document.getElementById("reply-form");
const ticketClosedMsg = document.getElementById("ticket-closed-msg");
const userReplyTextarea = document.getElementById("user-reply");
const sendReplyBtn = document.getElementById("send-reply-btn");
const closeTicketBtn = document.getElementById("close-ticket-btn");
const replyAttachment = document.getElementById("reply-attachment");
const replyFilePreview = document.getElementById("reply-file-preview");
const replyFileName = document.getElementById("reply-file-name");
const replyRemoveFile = document.getElementById("reply-remove-file");

let ticketsCache = [];
let replySelectedFile = null;
let filteredTickets = [];
let currentTicketId = null;
let currentUserEmail = "";
let currentFilter = "all";

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(ts) {
  try {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return "—"; }
}

function statusBadge(status) {
  const s = (status || "open").toLowerCase();
  const classMap = {
    open: "status-open",
    replied: "status-replied",
    closed: "status-closed"
  };
  return `<span class="status-badge ${classMap[s] || 'status-open'}">${s}</span>`;
}

function renderTicketCard(ticket) {
  const repliesCount = (ticket.replies && Array.isArray(ticket.replies)) ? ticket.replies.length : 0;
  const hasUpdate = ticket.updatedAt && ticket.createdAt && 
    (ticket.updatedAt?.toMillis?.() || ticket.updatedAt) !== (ticket.createdAt?.toMillis?.() || ticket.createdAt);
  
  return `
    <div class="card ticket-card" data-ticket-id="${ticket.id}">
      <div class="ticket-header">
        <span class="ticket-subject">${escapeHtml(ticket.subject)}</span>
        <div style="display:flex; gap:8px; align-items:center;">
          ${repliesCount > 0 ? `<span class="reply-count">${repliesCount} ${repliesCount === 1 ? 'reply' : 'replies'}</span>` : ''}
          ${statusBadge(ticket.status)}
        </div>
      </div>
      <div class="ticket-meta">
        <span>Submitted: ${formatDate(ticket.createdAt)}</span>
        ${hasUpdate ? `<span>Updated: ${formatDate(ticket.updatedAt)}</span>` : ''}
      </div>
      <div class="ticket-message">${escapeHtml(ticket.message)}</div>
    </div>
  `;
}

function renderConversation(ticket) {
  const messages = [];
  
  messages.push({
    type: 'user',
    message: ticket.message,
    createdAt: ticket.createdAt,
    isOriginal: true
  });
  
  if (ticket.replies && Array.isArray(ticket.replies)) {
    ticket.replies.forEach(reply => {
      messages.push({
        type: reply.adminEmail || reply.isAdmin ? 'support' : 'user',
        message: reply.message,
        createdAt: reply.createdAt,
        attachment: reply.attachment
      });
    });
  }
  
  if (messages.length === 1) {
    return `
      <div class="original-message">
        <div class="label">Your Message</div>
        <div style="color:var(--text); line-height:1.6; white-space:pre-wrap;">${escapeHtml(ticket.message)}</div>
      </div>
      <div class="no-replies">No replies yet. Our support team will respond soon!</div>
    `;
  }
  
  let html = '<div class="conversation-thread">';
  
  messages.forEach((msg, idx) => {
    const bubbleClass = msg.type === 'support' ? 'support' : 'user';
    const label = msg.type === 'support' ? 'Support Team' : (msg.isOriginal ? 'You (Original Message)' : 'You');
    
    let attachmentHtml = '';
    if (msg.attachment) {
      const isImage = msg.attachment.match(/\.(jpg|jpeg|png|gif|webp)$/i) || msg.attachment.includes('/image/');
      if (isImage) {
        attachmentHtml = `<div style="margin-top:8px;"><a href="${msg.attachment}" target="_blank"><img src="${msg.attachment}" alt="Attachment" style="max-width:200px; max-height:150px; border-radius:8px; border:1px solid var(--border);"></a></div>`;
      } else {
        attachmentHtml = `<div style="margin-top:8px;"><a href="${msg.attachment}" target="_blank" style="color:var(--accent); font-size:0.85rem;">📎 View Attachment</a></div>`;
      }
    }
    
    html += `
      <div class="message-bubble ${bubbleClass}">
        <div class="bubble-header">
          <span>${label}</span>
          <span>${formatDate(msg.createdAt)}</span>
        </div>
        <div class="bubble-text">${escapeHtml(msg.message)}</div>
        ${attachmentHtml}
      </div>
    `;
  });
  
  html += '</div>';
  return html;
}

function renderReplies(replies) {
  if (!replies || !Array.isArray(replies) || replies.length === 0) {
    return '<div class="no-replies">No replies yet. We\'ll respond soon!</div>';
  }
  
  return replies.map(reply => {
    const isAdmin = reply.adminEmail || reply.isAdmin;
    return `
      <div class="reply-item ${isAdmin ? '' : 'user-reply'}">
        <div class="reply-meta">
          <span class="sender-badge ${isAdmin ? 'admin-badge' : 'user-badge'}">${isAdmin ? 'Support' : 'You'}</span>
          <span class="reply-date">${formatDate(reply.createdAt)}</span>
        </div>
        <div class="reply-text">${escapeHtml(reply.message)}</div>
      </div>
    `;
  }).join('');
}

function hasNewAdminReply(ticket) {
  if (!ticket.replies || !Array.isArray(ticket.replies) || ticket.replies.length === 0) return false;
  const lastReply = ticket.replies[ticket.replies.length - 1];
  return lastReply.adminEmail || lastReply.isAdmin;
}

function applyFilter() {
  if (currentFilter === "all") {
    filteredTickets = [...ticketsCache];
  } else {
    filteredTickets = ticketsCache.filter(t => (t.status || "open").toLowerCase() === currentFilter);
  }
  renderTicketsList();
}

function renderTicketsList() {
  if (filteredTickets.length === 0) {
    const filterText = currentFilter === "all" ? "" : ` with status "${currentFilter}"`;
    ticketsContainer.innerHTML = `
      <div class="empty-state">
        <h3>No tickets found${filterText}</h3>
        <p>${currentFilter === "all" ? "You haven't submitted any tickets yet." : "Try selecting a different filter."}</p>
        <a href="help" class="btn" style="margin-top:16px;">Submit New Ticket</a>
      </div>
    `;
    return;
  }
  
  ticketsContainer.innerHTML = filteredTickets.map(renderTicketCard).join('');
  
  document.querySelectorAll('.ticket-card').forEach(card => {
    card.addEventListener('click', () => {
      const ticketId = card.dataset.ticketId;
      openTicketModal(ticketId);
    });
  });
}

async function loadTickets(email) {
  ticketsContainer.innerHTML = '<div class="loading">Loading your tickets...</div>';
  
  try {
    const q = query(
      collection(db, "tickets"),
      where("email", "==", email.toLowerCase().trim()),
      orderBy("createdAt", "desc")
    );
    
    const snapshot = await getDocs(q);
    ticketsCache = [];
    
    if (snapshot.empty) {
      if (filterTabs) filterTabs.style.display = "none";
      ticketsContainer.innerHTML = `
        <div class="empty-state">
          <h3>No tickets found</h3>
          <p>No support tickets found for this email address.</p>
          <a href="help" class="btn" style="margin-top:16px;">Submit New Ticket</a>
        </div>
      `;
      return;
    }
    
    snapshot.forEach(docSnap => {
      ticketsCache.push({ id: docSnap.id, ...docSnap.data() });
    });
    
    if (filterTabs) filterTabs.style.display = "flex";
    currentFilter = "all";
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.filter-tab[data-filter="all"]')?.classList.add('active');
    
    applyFilter();
    
  } catch (err) {
    console.error("Error loading tickets:", err);
    if (filterTabs) filterTabs.style.display = "none";
    ticketsContainer.innerHTML = `
      <div class="empty-state">
        <h3>Error loading tickets</h3>
        <p>Please check your email and try again. If the problem persists, contact us on Telegram.</p>
      </div>
    `;
  }
}

function openTicketModal(ticketId) {
  const ticket = ticketsCache.find(t => t.id === ticketId);
  if (!ticket) return;
  
  currentTicketId = ticketId;
  
  const replies = ticket.replies || [];
  const adminReplies = replies.filter(r => r.from === 'admin');
  if (adminReplies.length > 0) {
    const lastAdminReply = adminReplies[adminReplies.length - 1];
    const replyTime = lastAdminReply.createdAt?.toMillis?.() || lastAdminReply.createdAt || Date.now();
    const seenReplies = JSON.parse(localStorage.getItem('digimun_seen_replies') || '{}');
    seenReplies[ticketId] = replyTime;
    localStorage.setItem('digimun_seen_replies', JSON.stringify(seenReplies));
  }
  
  const repliesCount = (ticket.replies && Array.isArray(ticket.replies)) ? ticket.replies.length : 0;
  const hasAdminReply = hasNewAdminReply(ticket);
  
  modalTicketContent.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <div>
        <h3 style="color:var(--accent); font-size:1.1rem; margin-bottom:4px;">${escapeHtml(ticket.subject)}</h3>
        <p style="font-size:0.8rem; color:var(--muted);">Ticket #${ticketId.substring(0, 8)}...</p>
      </div>
      ${statusBadge(ticket.status)}
    </div>
    <div class="ticket-stats">
      <div class="ticket-stat">
        <span>Submitted:</span>
        <span>${formatDate(ticket.createdAt)}</span>
      </div>
      <div class="ticket-stat">
        <span>Messages:</span>
        <span>${repliesCount + 1}</span>
      </div>
      ${hasAdminReply && ticket.status !== 'closed' ? '<span class="new-reply-indicator">NEW REPLY</span>' : ''}
    </div>
  `;
  
  repliesList.innerHTML = renderConversation(ticket);
  
  const isClosed = ticket.status === "closed";
  replyForm.style.display = isClosed ? "none" : "block";
  ticketClosedMsg.style.display = isClosed ? "block" : "none";
  userReplyTextarea.value = "";
  
  ticketModal.classList.add('active');
  document.body.style.overflow = "hidden";
}

function closeModal() {
  ticketModal.classList.remove('active');
  currentTicketId = null;
  document.body.style.overflow = "";
}

async function uploadReplyAttachment(file, ticketId) {
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

async function sendUserReply() {
  if (!currentTicketId || !currentUserEmail) return;
  
  const message = userReplyTextarea.value.trim();
  if (!message && !replySelectedFile) {
    alert("Please enter a reply message or attach a file");
    return;
  }
  
  sendReplyBtn.disabled = true;
  sendReplyBtn.textContent = replySelectedFile ? "Uploading..." : "Sending...";
  
  try {
    let attachmentUrl = null;
    
    if (replySelectedFile) {
      try {
        attachmentUrl = await uploadReplyAttachment(replySelectedFile, currentTicketId);
      } catch (uploadErr) {
        console.error("Error uploading file:", uploadErr);
        alert("Failed to upload file. Please try again.");
        sendReplyBtn.disabled = false;
        sendReplyBtn.textContent = "Send Reply";
        return;
      }
    }
    
    sendReplyBtn.textContent = "Sending...";
    
    const newReply = {
      message: message || (attachmentUrl ? "Attachment added" : ""),
      createdAt: new Date(),
      userEmail: currentUserEmail,
      isAdmin: false
    };
    
    if (attachmentUrl) {
      newReply.attachment = attachmentUrl;
    }
    
    await updateDoc(doc(db, "tickets", currentTicketId), {
      replies: arrayUnion(newReply),
      status: "open",
      updatedAt: serverTimestamp()
    });
    
    const idx = ticketsCache.findIndex(t => t.id === currentTicketId);
    if (idx !== -1) {
      if (!ticketsCache[idx].replies) ticketsCache[idx].replies = [];
      ticketsCache[idx].replies.push(newReply);
      ticketsCache[idx].status = "open";
    }
    
    userReplyTextarea.value = "";
    replySelectedFile = null;
    if (replyFilePreview) replyFilePreview.style.display = "none";
    if (replyFileName) replyFileName.textContent = "";
    
    const updatedTicket = ticketsCache[idx];
    if (updatedTicket) {
      repliesList.innerHTML = renderConversation(updatedTicket);
      applyFilter();
    }
    
    alert("Reply sent successfully!");
    
  } catch (err) {
    console.error("Error sending reply:", err);
    alert("Failed to send reply. Please try again or contact support on Telegram.");
  } finally {
    sendReplyBtn.disabled = false;
    sendReplyBtn.textContent = "Send Reply";
  }
}

async function closeTicket() {
  if (!currentTicketId) return;
  
  if (!confirm("Are you sure you want to close this ticket? You won't be able to add more replies.")) {
    return;
  }
  
  closeTicketBtn.disabled = true;
  closeTicketBtn.textContent = "Closing...";
  
  try {
    await updateDoc(doc(db, "tickets", currentTicketId), {
      status: "closed",
      updatedAt: serverTimestamp()
    });
    
    const idx = ticketsCache.findIndex(t => t.id === currentTicketId);
    if (idx !== -1) {
      ticketsCache[idx].status = "closed";
    }
    
    replyForm.style.display = "none";
    ticketClosedMsg.style.display = "block";
    
    applyFilter();
    
    alert("Ticket closed successfully!");
    
  } catch (err) {
    console.error("Error closing ticket:", err);
    alert("Failed to close ticket. Please try again.");
  } finally {
    closeTicketBtn.disabled = false;
    closeTicketBtn.textContent = "Close Ticket";
  }
}

closeModalBtn.addEventListener("click", closeModal);
ticketModal.addEventListener("click", (e) => {
  if (e.target === ticketModal) closeModal();
});

if (replyAttachment) {
  replyAttachment.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File size must be less than 5MB");
        replyAttachment.value = "";
        return;
      }
      replySelectedFile = file;
      if (replyFileName) replyFileName.textContent = file.name;
      if (replyFilePreview) replyFilePreview.style.display = "block";
    }
  });
}

if (replyRemoveFile) {
  replyRemoveFile.addEventListener("click", () => {
    replySelectedFile = null;
    if (replyAttachment) replyAttachment.value = "";
    if (replyFileName) replyFileName.textContent = "";
    if (replyFilePreview) replyFilePreview.style.display = "none";
  });
}

sendReplyBtn.addEventListener("click", sendUserReply);
closeTicketBtn.addEventListener("click", closeTicket);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && ticketModal.classList.contains('active')) {
    closeModal();
  }
});

document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    applyFilter();
  });
});

onAuthStateChanged(auth, (user) => {
  if (user && user.email) {
    if (notLoggedIn) notLoggedIn.style.display = "none";
    if (userEmailDisplay) userEmailDisplay.textContent = user.email;
    if (loggedInInfo) loggedInInfo.style.display = "block";
    
    currentUserEmail = user.email.toLowerCase();
    loadTickets(currentUserEmail);
  } else {
    if (notLoggedIn) notLoggedIn.style.display = "block";
    if (loggedInInfo) loggedInInfo.style.display = "none";
    if (filterTabs) filterTabs.style.display = "none";
    ticketsContainer.innerHTML = `
      <div class="empty-state">
        <h3>Please log in</h3>
        <p>You need to be logged in to view your support tickets.</p>
      </div>
    `;
  }
});
