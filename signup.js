// signup.js (type="module")

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
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;

    await sendEmailVerification(user);

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
    sessionStorage.setItem("digimunJustRegistered", "true");

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
    sessionStorage.setItem("digimunJustRegistered", "true");

    window.location.href = "chooseAccountType.html";
  } catch (error) {
    console.error("Google Signup Error:", error);
    if (statusEl) statusEl.textContent = "❌ Google signup failed. Please try again.";
  } finally {
    lockUI(false);
  }
});
