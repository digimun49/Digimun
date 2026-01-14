import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const form = document.getElementById("ticket-form");
const submitBtn = document.getElementById("submit-btn");
const successMsg = document.getElementById("success-msg");
const errorMsg = document.getElementById("error-msg");
const emailInput = document.getElementById("email");
const fileInput = document.getElementById("attachments");
const dropZone = document.getElementById("file-drop-zone");
const filePreview = document.getElementById("file-preview");
const uploadProgress = document.getElementById("upload-progress");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 3;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

let selectedFiles = [];

onAuthStateChanged(auth, (user) => {
  if (user && user.email && emailInput) {
    emailInput.value = user.email;
  }
});

function validateFile(file) {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `${file.name} is too large (max 5MB)` };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: `${file.name} has an unsupported format` };
  }
  return { valid: true };
}

function renderFilePreview() {
  filePreview.innerHTML = '';
  selectedFiles.forEach((file, index) => {
    const item = document.createElement('div');
    item.style.cssText = 'display: flex; align-items: center; gap: 8px; background: rgba(0,212,170,0.1); padding: 8px 12px; border-radius: 8px; font-size: 0.85rem;';
    
    const icon = file.type.startsWith('image/') ? '🖼️' : '📄';
    const name = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
    const size = (file.size / 1024).toFixed(1) + ' KB';
    
    item.innerHTML = `
      <span>${icon}</span>
      <span style="color: var(--text);">${name}</span>
      <span style="color: var(--muted); font-size: 0.75rem;">(${size})</span>
      <button type="button" data-index="${index}" style="background: none; border: none; color: #ff4d4d; cursor: pointer; padding: 0 4px; font-size: 1rem;">×</button>
    `;
    filePreview.appendChild(item);
  });
  
  filePreview.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.index);
      selectedFiles.splice(idx, 1);
      renderFilePreview();
    });
  });
}

function handleFiles(files) {
  const newFiles = Array.from(files);
  
  for (const file of newFiles) {
    if (selectedFiles.length >= MAX_FILES) {
      showError(`Maximum ${MAX_FILES} files allowed`);
      break;
    }
    
    const validation = validateFile(file);
    if (!validation.valid) {
      showError(validation.error);
      continue;
    }
    
    const alreadyAdded = selectedFiles.some(f => f.name === file.name && f.size === file.size);
    if (!alreadyAdded) {
      selectedFiles.push(file);
    }
  }
  
  renderFilePreview();
}

if (dropZone && fileInput) {
  dropZone.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = '';
  });
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--accent)';
    dropZone.style.background = 'rgba(0,212,170,0.08)';
  });
  
  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.background = 'rgba(0,212,170,0.02)';
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.background = 'rgba(0,212,170,0.02)';
    handleFiles(e.dataTransfer.files);
  });
}

async function uploadFiles(ticketId) {
  if (selectedFiles.length === 0) return { success: true, attachments: [] };
  
  uploadProgress.style.display = 'block';
  const uploadedUrls = [];
  let hasError = false;
  
  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i];
    progressText.textContent = `Uploading ${i + 1}/${selectedFiles.length}: ${file.name}`;
    progressBar.style.width = ((i / selectedFiles.length) * 100) + '%';
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('ticketId', ticketId);
      
      const response = await fetch('/.netlify/functions/upload-ticket-attachment', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const result = await response.json();
      
      if (result.ok) {
        uploadedUrls.push({
          name: result.name,
          url: result.url,
          type: result.type,
          size: result.size
        });
      } else {
        throw new Error(result.error || 'Upload failed');
      }
      
      progressBar.style.width = (((i + 1) / selectedFiles.length) * 100) + '%';
    } catch (error) {
      console.error('Upload error:', error);
      hasError = true;
      progressText.textContent = `Failed to upload: ${file.name}`;
    }
  }
  
  uploadProgress.style.display = 'none';
  progressBar.style.width = '0%';
  return { success: !hasError || uploadedUrls.length > 0, attachments: uploadedUrls, hadErrors: hasError };
}


function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = "block";
  setTimeout(() => { errorMsg.style.display = "none"; }, 5000);
}

function hideForm() {
  form.style.display = "none";
  successMsg.style.display = "block";
}


function cleanTelegramUsername(input) {
  if (!input) return '';
  let cleaned = input.trim();
  cleaned = cleaned.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '');
  if (!cleaned.startsWith('@') && cleaned.length > 0) {
    cleaned = '@' + cleaned;
  }
  return cleaned;
}

function cleanWhatsAppNumber(input) {
  if (!input) return '';
  let cleaned = input.trim();
  cleaned = cleaned.replace(/[^0-9+]/g, '');
  if (cleaned && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

async function sendTicketAutoReply(email, name) {
  try {
    await fetch("/.netlify/functions/send-ticket-autoreply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to_email: email,
        to_name: name
      })
    });
    console.log("Auto-reply email sent");
  } catch (err) {
    console.warn("Auto-reply email failed (non-critical):", err);
  }
}

async function updateUserContactInfo(email, telegram, whatsapp) {
  if (!telegram && !whatsapp) return;
  
  try {
    const userRef = doc(db, "users", email);
    const userSnap = await getDoc(userRef);
    
    const contactUpdate = {};
    if (telegram) contactUpdate.telegramUsername = telegram;
    if (whatsapp) contactUpdate.whatsappNumber = whatsapp;
    contactUpdate.contactLinkedAt = serverTimestamp();
    
    if (userSnap.exists()) {
      await updateDoc(userRef, contactUpdate);
    } else {
      await setDoc(userRef, {
        email: email,
        ...contactUpdate,
        createdAt: serverTimestamp()
      }, { merge: true });
    }
    console.log("User contact info updated");
  } catch (err) {
    console.warn("Could not update user contact info (non-critical):", err);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const subject = document.getElementById("subject").value;
  const message = document.getElementById("message").value.trim();
  
  const telegramRaw = document.getElementById("telegram")?.value || '';
  const whatsappRaw = document.getElementById("whatsapp")?.value || '';
  const telegram = cleanTelegramUsername(telegramRaw);
  const whatsapp = cleanWhatsAppNumber(whatsappRaw);

  if (!name || !email || !subject || !message) {
    showError("Please fill in all fields.");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showError("Please enter a valid email address.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  try {
    const ticketData = {
      name,
      email,
      subject,
      message,
      status: "open",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      replies: [],
      attachments: []
    };
    
    if (telegram) ticketData.telegramUsername = telegram;
    if (whatsapp) ticketData.whatsappNumber = whatsapp;

    const docRef = await addDoc(collection(db, "tickets"), ticketData);

    if (selectedFiles.length > 0) {
      submitBtn.textContent = "Uploading files...";
      const uploadResult = await uploadFiles(docRef.id);
      
      if (uploadResult.attachments.length > 0) {
        await updateDoc(docRef, { attachments: uploadResult.attachments });
        ticketData.attachments = uploadResult.attachments;
      }
      
      if (uploadResult.hadErrors && uploadResult.attachments.length < selectedFiles.length) {
        showError(`Some files failed to upload (${uploadResult.attachments.length}/${selectedFiles.length} succeeded). Your ticket was still submitted.`);
      }
    }

    ticketData.ticketId = docRef.id;
    
    updateUserContactInfo(email, telegram, whatsapp);

    sendTicketAutoReply(email, name);

    selectedFiles = [];
    hideForm();

  } catch (err) {
    console.error("Error submitting ticket:", err);
    showError("Failed to submit ticket. Please try again or contact us on Telegram.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Ticket";
  }
});
