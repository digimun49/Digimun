import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp,
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

/* ---------------- Helpers: Spinner & Button Lock ---------------- */
function lockUI(lock = true) {
  const signBtn = document.getElementById("signup-btn");
  const googleBtn = document.getElementById("google-signup");

  if (lock) {
    if (typeof showLoader === 'function') showLoader();
  } else {
    if (typeof hideLoader === 'function') hideLoader();
  }
  
  [signBtn, googleBtn].forEach((btn) => {
    if (!btn) return;
    btn.disabled = lock;
    btn.style.opacity = lock ? "0.6" : "";
    btn.style.pointerEvents = lock ? "none" : "";
  });
}

/* ---------------- AUTO-CLEAR ERRORS ON INPUT ---------------- */
document.getElementById('signup-email')?.addEventListener('input', function() {
  clearFieldError(this);
  const statusEl = document.getElementById('signup-status');
  if (statusEl) statusEl.textContent = '';
});

document.getElementById('signup-password')?.addEventListener('input', function() {
  clearFieldError(this);
  const statusEl = document.getElementById('signup-status');
  if (statusEl) statusEl.textContent = '';
});

/* ---------------- Email/Password Signup ---------------- */
const formEl = document.getElementById("signup-form");
formEl?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const emailInput = document.getElementById("signup-email");
  const passInput = document.getElementById("signup-password");
  const email = emailInput?.value.trim() || '';
  const pass = passInput?.value || '';
  const statusEl = document.getElementById("signup-status");

  clearAllErrors();
  if (statusEl) statusEl.textContent = "";

  let hasError = false;

  if (!email) {
    showFieldError(emailInput, 'Please enter your email address');
    hasError = true;
  } else if (!isValidEmail(email)) {
    showFieldError(emailInput, 'Please enter a valid email address');
    hasError = true;
  }

  if (!pass) {
    showFieldError(passInput, 'Please create a password');
    hasError = true;
  } else if (pass.length < 6) {
    showFieldError(passInput, 'Password must be at least 6 characters');
    hasError = true;
  } else if (pass.length < 8) {
    showFieldError(passInput, 'We recommend at least 8 characters for security');
    hasError = true;
  }

  if (hasError) return;

  lockUI(true);

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;

    await sendEmailVerification(user);

    const emailLower = email.toLowerCase().trim();
    try {
      await setDoc(doc(db, "users", emailLower), {
        email: email.trim(),
        emailLower: emailLower,
        status: "approved",
        paymentStatus: "pending",
        quotexStatus: "pending",
        digimaxStatus: "pending",
        recoveryRequest: "pending",
        DigimunXAdv: "pending",
        approvedAt: null,
        signupDate: serverTimestamp(),
      }, { merge: true });
    } catch (dbErr) {
      console.error("Firestore write failed:", dbErr);
    }

    localStorage.setItem("digimunCurrentUserEmail", emailLower);
    localStorage.setItem("userEmail", email);
    sessionStorage.setItem("digimunJustRegistered", "true");

    window.location.href = '/dashboard';
  } catch (err) {
    const code = err?.code || "";
    
    switch (code) {
      case "auth/email-already-in-use":
        showFieldError(emailInput, 'This email is already registered');
        if (statusEl) {
          statusEl.innerHTML = 'Already have an account? <a href="/login" style="color:#00D4AA;text-decoration:underline;">Log in here</a>';
        }
        break;
      case "auth/weak-password":
        showFieldError(passInput, 'Password is too weak. Use letters, numbers & symbols');
        break;
      case "auth/invalid-email":
        showFieldError(emailInput, 'Please enter a valid email address');
        break;
      default:
        if (statusEl) {
          statusEl.textContent = "Something went wrong. Please try again.";
        }
    }
  } finally {
    lockUI(false);
  }
});

/* ---------------- Google Signup ---------------- */
const provider = new GoogleAuthProvider();

document.getElementById("google-signup")?.addEventListener("click", async () => {
  const statusEl = document.getElementById("signup-status");
  if (statusEl) statusEl.textContent = "";
  clearAllErrors();
  lockUI(true);

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const emailLower = user.email.toLowerCase().trim();
    try {
      await setDoc(doc(db, "users", emailLower), {
        email: user.email.trim(),
        emailLower: emailLower,
        status: "approved",
        paymentStatus: "pending",
        quotexStatus: "pending",
        digimaxStatus: "pending",
        recoveryRequest: "pending",
        DigimunXAdv: "pending",
        approvedAt: null,
        signupDate: serverTimestamp(),
      }, { merge: true });
    } catch (dbErr) {
      console.error("Firestore write failed:", dbErr);
    }

    localStorage.setItem("digimunCurrentUserEmail", emailLower);
    localStorage.setItem("userEmail", user.email);
    sessionStorage.setItem("digimunJustRegistered", "true");

    window.location.href = '/dashboard';
  } catch (error) {
    if (statusEl) {
      if (error.code === 'auth/popup-closed-by-user') {
        statusEl.textContent = "";
      } else {
        statusEl.textContent = "Google sign-in failed. Please try again.";
      }
    }
  } finally {
    lockUI(false);
  }
});
