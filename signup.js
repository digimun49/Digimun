// signup.js (type="module")

import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ---------------- UI Boot ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  setupPasswordUI(); // adds eye toggle + strength bar
});

/* ---------------- Password UI (stable height, eye, strength) ---------------- */
function setupPasswordUI() {
  const pwd = document.getElementById("signup-password");
  if (!pwd || pwd.dataset.enhanced === "1") return;

  // mark once to avoid double wrapping
  pwd.dataset.enhanced = "1";

  // lock height/box
  Object.assign(pwd.style, {
    height: "44px",
    lineHeight: "44px",
    boxSizing: "border-box",
  });

  // wrapper
  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    position: "relative",
    width: "100%",
    display: "flex",
    alignItems: "center",
  });
  pwd.parentNode.insertBefore(wrap, pwd);
  wrap.appendChild(pwd);

  // padding for eye
  Object.assign(pwd.style, {
    paddingRight: "46px",
    flex: "1",
  });

  // eye button
  const eye = document.createElement("button");
  eye.type = "button";
  eye.setAttribute("aria-label", "Show or hide password");
  eye.textContent = "👁";
  Object.assign(eye.style, {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    lineHeight: "1",
    width: "28px",   // fixed box to avoid layout jump
    height: "28px",  // "
    fontSize: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#bbb",
  });

  // keep input focused when clicking
  eye.addEventListener("mousedown", (e) => e.preventDefault());

  eye.addEventListener("click", () => {
    const show = pwd.type === "password";
    pwd.type = show ? "text" : "password";
    eye.textContent = "👁"; // keep same-size icon
  });
  wrap.appendChild(eye);

  // strength bar AFTER wrapper
  const bar = document.createElement("div");
  Object.assign(bar.style, {
    height: "4px",
    background: "#ccc",
    borderRadius: "999px",
    marginTop: "6px",
    transition: "background .2s",
  });
  wrap.parentNode.insertBefore(bar, wrap.nextSibling);

  pwd.addEventListener("input", () => {
    const v = pwd.value;
    let score = 0;
    if (v.length >= 8) score++;
    if (/[A-Z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    const colors = ["#ccc", "#ff4d4d", "#ffa500", "#9acd32", "#00cc66"];
    bar.style.background = colors[score];
  });
}

/* ---------------- Helpers: Spinner & Button Lock ---------------- */
function lockUI(lock = true) {
  const spinner = document.getElementById("loading-spinner");
  const signBtn = document.getElementById("signup-btn");
  const googleBtn = document.getElementById("google-signup");

  if (spinner) spinner.style.display = lock ? "flex" : "none";
  [signBtn, googleBtn].forEach((btn) => {
    if (!btn) return;
    btn.disabled = lock;
    btn.style.opacity = lock ? "0.6" : "";
    btn.style.pointerEvents = lock ? "none" : "";
  });
}

/* ---------------- Email/Password Signup (no checkbox required) ---------------- */
const formEl = document.getElementById("signup-form");
formEl?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("signup-email")?.value.trim();
  const pass = document.getElementById("signup-password")?.value;
  const statusEl = document.getElementById("signup-status");

  if (statusEl) statusEl.textContent = "";
  lockUI(true);

  try {
    await createUserWithEmailAndPassword(auth, email, pass);

    await setDoc(doc(db, "users", email), {
      status: "approved",
      paymentStatus: "pending",
      quotexStatus: "pending",
      digimaxStatus: "pending",
      recoveryRequest: "pending",
      approvedAt: null,
      signupDate: serverTimestamp(),
    });

    localStorage.setItem("digimunCurrentUserEmail", email);
    localStorage.setItem("userEmail", email);

    window.location.href = "chooseAccountType.html";
  } catch (err) {
    const code = err?.code || "";
    if (statusEl) {
      if (code === "auth/email-already-in-use") {
        statusEl.textContent = "This email is already registered. Please log in instead.";
      } else if (code === "auth/weak-password") {
        statusEl.textContent = "Password is too weak. Try at least 8 chars with A–Z, 0–9 & a symbol.";
      } else if (code === "auth/invalid-email") {
        statusEl.textContent = "Invalid email address.";
      } else {
        statusEl.textContent = "Signup failed: " + (err?.message || "Unknown error");
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
  lockUI(true);

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    await setDoc(doc(db, "users", user.email), {
      status: "approved",
      paymentStatus: "pending",
      quotexStatus: "pending",
      digimaxStatus: "pending",
      recoveryRequest: "pending",
      approvedAt: null,
      signupDate: serverTimestamp(),
    });

    localStorage.setItem("digimunCurrentUserEmail", user.email);
    localStorage.setItem("userEmail", user.email);

    window.location.href = "chooseAccountType.html";
  } catch (error) {
    console.error("Google Signup Error:", error);
    if (statusEl) statusEl.textContent = "❌ Google signup failed. Please try again.";
  } finally {
    lockUI(false);
  }
});
