import {
  auth, db,
  createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup,
  doc, getDoc, setDoc, serverTimestamp
} from "./platform.js";

function collectTrackingDataSignup() {
  try {
    const ua = navigator.userAgent || '';
    let browser = 'Unknown', browserVersion = '', os = 'Unknown', osVersion = '';

    if (/Edg\/(\d+[\d.]*)/i.test(ua)) { browser = 'Edge'; browserVersion = RegExp.$1; }
    else if (/OPR\/(\d+[\d.]*)/i.test(ua)) { browser = 'Opera'; browserVersion = RegExp.$1; }
    else if (/Chrome\/(\d+[\d.]*)/i.test(ua)) { browser = 'Chrome'; browserVersion = RegExp.$1; }
    else if (/Firefox\/(\d+[\d.]*)/i.test(ua)) { browser = 'Firefox'; browserVersion = RegExp.$1; }
    else if (/Safari\/(\d+[\d.]*)/i.test(ua) && /Version\/(\d+[\d.]*)/i.test(ua)) { browser = 'Safari'; browserVersion = RegExp.$1; }

    if (/Windows NT (\d+[\d.]*)/i.test(ua)) { os = 'Windows'; osVersion = RegExp.$1; }
    else if (/Mac OS X (\d+[_.\d]*)/i.test(ua)) { os = 'macOS'; osVersion = RegExp.$1.replace(/_/g, '.'); }
    else if (/Android (\d+[\d.]*)/i.test(ua)) { os = 'Android'; osVersion = RegExp.$1; }
    else if (/iPhone OS (\d+[_\d]*)/i.test(ua)) { os = 'iOS'; osVersion = RegExp.$1.replace(/_/g, '.'); }
    else if (/Linux/i.test(ua)) { os = 'Linux'; }

    return {
      browser, browserVersion, os, osVersion,
      screen: screen.width + 'x' + screen.height,
      language: navigator.language || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      platform: navigator.platform || '',
      userAgent: ua.substring(0, 200)
    };
  } catch (e) {
    return {};
  }
}

function sendSignupTracking(email) {
  try {
    const deviceInfo = collectTrackingDataSignup();
    const fingerprint = generateFingerprint();
    const user = auth.currentUser;
    if (!user) return;
    user.getIdToken().then(token => {
      fetch('/.netlify/functions/user-geo-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          fingerprint: fingerprint.hash || 'fp_unknown',
          deviceInfo: deviceInfo,
          isSignup: true
        }),
        keepalive: true
      }).catch(() => {});
    }).catch(() => {});
  } catch (e) {}
}

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

/* ---------------- Device Fingerprint Generation ---------------- */
function generateFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
    const canvasHash = canvas.toDataURL().slice(-50);

    const components = [
      navigator.userAgent || '',
      navigator.language || '',
      screen.width + 'x' + screen.height,
      screen.colorDepth || '',
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || '',
      navigator.platform || '',
      canvasHash
    ];

    const raw = components.join('|');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const chr = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return {
      hash: 'fp_' + Math.abs(hash).toString(36),
      ua: navigator.userAgent?.substring(0, 100) || '',
      screen: screen.width + 'x' + screen.height,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    };
  } catch (e) {
    return { hash: 'fp_unknown', ua: '', screen: '', tz: '' };
  }
}

async function validateSignupServer(email, fingerprint) {
  try {
    const resp = await fetch('/.netlify/functions/validate-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fingerprint })
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { allowed: false, error: data.error || 'Validation failed', isDeleted: data.isDeleted || false };
    }
    return { allowed: true };
  } catch (e) {
    console.warn('Server validation unavailable:', e.message);
    return { allowed: false, error: 'Unable to verify signup. Please try again.' };
  }
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

  const fingerprint = generateFingerprint();
  const serverCheck = await validateSignupServer(email, fingerprint);
  if (!serverCheck.allowed) {
    lockUI(false);
    if (serverCheck.isDeleted) {
      const deletedBanner = document.getElementById('deleted-banner');
      if (deletedBanner) deletedBanner.classList.add('show');
    } else if (statusEl) {
      statusEl.textContent = serverCheck.error || 'Signup not allowed. Please try again later.';
    }
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;

    try {
      await fetch('/.netlify/functions/send-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
    } catch (verifyErr) {
      console.warn('Verification email failed:', verifyErr.message);
    }

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
        deviceFingerprint: fingerprint.hash || null,
        signupMeta: {
          ua: fingerprint.ua || '',
          screen: fingerprint.screen || '',
          tz: fingerprint.tz || ''
        }
      }, { merge: true });
    } catch (dbErr) {
      console.error("DB write failed:", dbErr);
    }

    sendSignupTracking(emailLower);
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
    const fingerprint = generateFingerprint();

    const serverCheck = await validateSignupServer(emailLower, fingerprint);
    if (!serverCheck.allowed) {
      if (serverCheck.isDeleted) {
        try { await auth.signOut(); } catch(so) {}
        try { await user.delete(); } catch(du) {}
        lockUI(false);
        const deletedBanner = document.getElementById('deleted-banner');
        if (deletedBanner) deletedBanner.classList.add('show');
        return;
      }
      lockUI(false);
      if (statusEl) statusEl.textContent = serverCheck.error || 'Signup not allowed.';
      return;
    }

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
        deviceFingerprint: fingerprint.hash || null,
        signupMeta: {
          ua: fingerprint.ua || '',
          screen: fingerprint.screen || '',
          tz: fingerprint.tz || ''
        }
      }, { merge: true });
    } catch (dbErr) {
      console.error("DB write failed:", dbErr);
    }

    sendSignupTracking(emailLower);
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
