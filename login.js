import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ---------------- FIELD VALIDATION HELPERS ---------------- */
function showFieldError(inputEl, message) {
  if (!inputEl) return;
  
  inputEl.classList.add('has-error');
  inputEl.classList.remove('is-valid');
  
  if (inputEl.closest('.password-wrapper')) {
    inputEl.closest('.password-wrapper').classList.add('has-error');
  }
  
  const formField = inputEl.closest('.form-field');
  const errorEl = formField?.querySelector('.field-error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add('visible');
  }
}

function clearFieldError(inputEl) {
  if (!inputEl) return;
  
  inputEl.classList.remove('has-error');
  
  if (inputEl.closest('.password-wrapper')) {
    inputEl.closest('.password-wrapper').classList.remove('has-error');
  }
  
  const formField = inputEl.closest('.form-field');
  const errorEl = formField?.querySelector('.field-error');
  if (errorEl) {
    errorEl.classList.remove('visible');
  }
}

function clearAllErrors() {
  document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
  document.querySelectorAll('.field-error.visible').forEach(el => el.classList.remove('visible'));
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ---------------- AUTO-CLEAR ERRORS ON INPUT ---------------- */
document.getElementById('email')?.addEventListener('input', function() {
  clearFieldError(this);
  document.getElementById('auth-status').textContent = '';
});

document.getElementById('password')?.addEventListener('input', function() {
  clearFieldError(this);
  document.getElementById('auth-status').textContent = '';
});

/* ---------------- LOGIN SECTION ---------------- */
document.getElementById('login-btn')?.addEventListener('click', () => {
  const emailInput = document.getElementById('email');
  const passInput = document.getElementById('password');
  const email = emailInput?.value.trim() || '';
  const pass = passInput?.value || '';
  const statusEl = document.getElementById('auth-status');

  clearAllErrors();
  if (statusEl) statusEl.textContent = '';

  let hasError = false;

  if (!email) {
    showFieldError(emailInput, 'Please enter your email address');
    hasError = true;
  } else if (!isValidEmail(email)) {
    showFieldError(emailInput, 'Please enter a valid email address');
    hasError = true;
  }

  if (!pass) {
    showFieldError(passInput, 'Please enter your password');
    hasError = true;
  }

  if (hasError) return;

  if (typeof showLoader === 'function') showLoader();

  signInWithEmailAndPassword(auth, email, pass)
    .then(async (userCredential) => {
      const user = userCredential.user;

      const ADMIN_EMAIL = "muneebg249@gmail.com";
      if ((user.email || '').toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()) {
        if (typeof hideLoader === 'function') hideLoader();
        window.location.href = '/admin';
        return;
      }

      localStorage.setItem("userEmail", user.email);

      const userDocRef = doc(db, "users", user.email);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const data = userDocSnap.data();

        if (data.status !== "approved") {
          const suspensionBanner = document.getElementById('suspension-banner');
          if (suspensionBanner) {
            suspensionBanner.classList.add('show');
          }
          if (typeof hideLoader === 'function') hideLoader();
          return;
        }

        localStorage.setItem("digimunCurrentUserEmail", user.email);
        if (typeof hideLoader === 'function') hideLoader();
        window.location.href = '/chooseAccountType';
      } else {
        try {
          await setDoc(userDocRef, {
            status: "approved",
            paymentStatus: "pending",
            quotexStatus: "pending",
            digimaxStatus: "pending",
            recoveryRequest: "pending",
            approvedAt: null,
            createdAt: new Date().toISOString(),
            autoCreated: true
          });
          
          localStorage.setItem("digimunCurrentUserEmail", user.email);
          if (typeof hideLoader === 'function') hideLoader();
          window.location.href = '/chooseAccountType';
        } catch (docError) {
          console.error("Failed to create user document:", docError);
          localStorage.setItem("digimunCurrentUserEmail", user.email);
          if (typeof hideLoader === 'function') hideLoader();
          window.location.href = '/chooseAccountType';
        }
      }
    })
    .catch(error => {
      if (typeof hideLoader === 'function') hideLoader();

      switch (error.code) {
        case "auth/user-not-found":
          showFieldError(emailInput, 'No account found with this email');
          break;
        case "auth/wrong-password":
        case "auth/invalid-credential":
          showFieldError(passInput, 'Invalid email or password');
          break;
        case "auth/invalid-email":
          showFieldError(emailInput, 'Please enter a valid email address');
          break;
        case "auth/too-many-requests":
          if (statusEl) {
            statusEl.textContent = "Too many attempts. Please try again later.";
          }
          break;
        default:
          if (statusEl) {
            statusEl.textContent = "Login failed. Please check your credentials.";
          }
      }
    });
});

/* ---------------- SIGNUP SECTION (legacy fallback) ---------------- */
document.getElementById('signup-btn')?.addEventListener('click', () => {
  const email = document.getElementById('email').value.trim();
  const pass = document.getElementById('password').value;
  const statusBox = document.getElementById('auth-status');

  createUserWithEmailAndPassword(auth, email, pass)
    .then(async () => {
      await setDoc(doc(db, "users", email), {
        status: "approved",
        paymentStatus: "pending",
        quotexStatus: "pending",
        approvedAt: null
      });

      statusBox.textContent = "Account created. Redirecting...";
      statusBox.style.color = "#00ff88";
      setTimeout(() => window.location.href = '/access-options', 1000);
    })
    .catch(error => {
      statusBox.textContent = "Signup failed: " + error.message;
      statusBox.style.color = "red";
    });
});

/* ---------------- FORGOT PASSWORD — SHOW RESET SECTION ---------------- */
document.getElementById('forgot-password')?.addEventListener('click', () => {
  document.getElementById('auth-form').style.display = 'none';
  document.getElementById('forgot-section').style.display = 'block';
});

/* ---------------- FORGOT PASSWORD — SEND RESET LINK (RATE LIMITED) ---------------- */
let resetCooldownActive = false;
let resetCooldownTimer = null;

document.getElementById('reset-btn')?.addEventListener('click', () => {
  const resetBtn = document.getElementById('reset-btn');
  const emailInput = document.getElementById('reset-email');
  const email = emailInput?.value.trim() || '';
  const status = document.getElementById('reset-status');

  if (resetCooldownActive) {
    return;
  }

  if (!email) {
    showFieldError(emailInput, 'Please enter your email address');
    return;
  }

  if (!isValidEmail(email)) {
    showFieldError(emailInput, 'Please enter a valid email address');
    return;
  }

  resetBtn.disabled = true;
  resetBtn.textContent = 'Sending...';

  sendPasswordResetEmail(auth, email)
    .then(() => {
      status.textContent = "Password reset link sent! Check your inbox and spam folder.";
      status.style.color = "#00ff88";
      status.classList.add('form-success-message');
      startResetCooldown(resetBtn, 30);
    })
    .catch((error) => {
      resetBtn.disabled = false;
      resetBtn.textContent = 'Send Reset Link';
      if (error.code === 'auth/user-not-found') {
        showFieldError(emailInput, 'No account found with this email');
      } else {
        status.textContent = "Failed to send reset link. Please try again.";
        status.style.color = "#ff6b6b";
      }
    });
});

function startResetCooldown(btn, seconds) {
  resetCooldownActive = true;
  let remaining = seconds;
  
  btn.disabled = true;
  btn.textContent = `Wait ${remaining}s`;
  btn.style.opacity = '0.6';
  
  resetCooldownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(resetCooldownTimer);
      resetCooldownActive = false;
      btn.disabled = false;
      btn.textContent = 'Send Reset Link';
      btn.style.opacity = '1';
    } else {
      btn.textContent = `Wait ${remaining}s`;
    }
  }, 1000);
}

document.getElementById('reset-email')?.addEventListener('input', function() {
  clearFieldError(this);
  document.getElementById('reset-status').textContent = '';
});
