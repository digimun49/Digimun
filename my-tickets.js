import { db } from "./firebase.js";
import {
  collection, query, where, orderBy, getDocs, doc, updateDoc, arrayUnion, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const lookupEmail = document.getElementById("lookup-email");
const lookupBtn = document.getElementById("lookup-btn");
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

let ticketsCache = [];
let currentTicketId = null;
let currentUserEmail = "";

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
      </div>
      <div class="ticket-message">${escapeHtml(ticket.message)}</div>
    </div>
  `;
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
      ticketsContainer.innerHTML = `
        <div class="empty-state">
          <h3>No tickets found</h3>
          <p>No support tickets found for this email address.</p>
          <a href="help.html" class="btn" style="margin-top:16px;">Submit New Ticket</a>
        </div>
      `;
      return;
    }
    
    snapshot.forEach(docSnap => {
      ticketsCache.push({ id: docSnap.id, ...docSnap.data() });
    });
    
    ticketsContainer.innerHTML = ticketsCache.map(renderTicketCard).join('');
    
    document.querySelectorAll('.ticket-card').forEach(card => {
      card.addEventListener('click', () => {
        const ticketId = card.dataset.ticketId;
        openTicketModal(ticketId);
      });
    });
    
  } catch (err) {
    console.error("Error loading tickets:", err);
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
  
  modalTicketContent.innerHTML = `
    <div class="modal-field">
      <label>Ticket ID</label>
      <p style="font-family:monospace; font-size:12px; color:var(--muted);">${ticketId}</p>
    </div>
    <div class="modal-field">
      <label>Submitted</label>
      <p>${formatDate(ticket.createdAt)}</p>
    </div>
    <div class="modal-field">
      <label>Subject</label>
      <p style="color:var(--accent); font-weight:600;">${escapeHtml(ticket.subject)}</p>
    </div>
    <div class="modal-field">
      <label>Your Message</label>
      <div class="message-box">${escapeHtml(ticket.message)}</div>
    </div>
  `;
  
  repliesList.innerHTML = renderReplies(ticket.replies);
  
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

async function sendUserReply() {
  if (!currentTicketId || !currentUserEmail) return;
  
  const message = userReplyTextarea.value.trim();
  if (!message) {
    alert("Please enter a reply message");
    return;
  }
  
  sendReplyBtn.disabled = true;
  sendReplyBtn.textContent = "Sending...";
  
  try {
    const newReply = {
      message: message,
      createdAt: new Date(),
      userEmail: currentUserEmail,
      isAdmin: false
    };
    
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
    repliesList.innerHTML = renderReplies(ticketsCache[idx]?.replies || []);
    
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
    
    ticketsContainer.innerHTML = ticketsCache.map(renderTicketCard).join('');
    document.querySelectorAll('.ticket-card').forEach(card => {
      card.addEventListener('click', () => openTicketModal(card.dataset.ticketId));
    });
    
    alert("Ticket closed successfully!");
    
  } catch (err) {
    console.error("Error closing ticket:", err);
    alert("Failed to close ticket. Please try again.");
  } finally {
    closeTicketBtn.disabled = false;
    closeTicketBtn.textContent = "Close Ticket";
  }
}

lookupBtn.addEventListener("click", () => {
  const email = lookupEmail.value.trim();
  if (!email) {
    alert("Please enter your email address");
    return;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert("Please enter a valid email address");
    return;
  }
  
  currentUserEmail = email.toLowerCase();
  loadTickets(currentUserEmail);
});

lookupEmail.addEventListener("keydown", (e) => {
  if (e.key === "Enter") lookupBtn.click();
});

closeModalBtn.addEventListener("click", closeModal);
ticketModal.addEventListener("click", (e) => {
  if (e.target === ticketModal) closeModal();
});

sendReplyBtn.addEventListener("click", sendUserReply);
closeTicketBtn.addEventListener("click", closeTicket);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && ticketModal.classList.contains('active')) {
    closeModal();
  }
});
