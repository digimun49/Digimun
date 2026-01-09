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

/* ---------------- LOGIN SECTION ---------------- */
document.getElementById('login-btn')?.addEventListener('click', () => {
  const email = document.getElementById('email').value.trim();
  const pass = document.getElementById('password').value;
  const loading = document.getElementById('auth-status');
  const spinner = document.getElementById('loading-spinner-overlay');

  spinner.style.display = "flex";
  loading.textContent = "";

  signInWithEmailAndPassword(auth, email, pass)
    .then(async (userCredential) => {
      const user = userCredential.user;

      if (user.email === "muneebg249@gmail.com") {
        spinner.style.display = "none";
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
          spinner.style.display = "none";
          return;
        }

        localStorage.setItem("digimunCurrentUserEmail", user.email);
        spinner.style.display = "none";
        window.location.href = '/chooseAccountType';
      } else {
        loading.textContent = "No user data found.";
        loading.style.color = "red";
        spinner.style.display = "none";
      }
    })
    .catch(error => {
      console.log("❗ Error Code:", error.code);
      let message;

      switch (error.code) {
        case "auth/user-not-found":
          message = "Email not found. Please sign up first.";
          break;
        case "auth/wrong-password":
          message = "Incorrect password. Please try again.";
          break;
        case "auth/invalid-email":
          message = "Invalid email address format.";
          break;
        default:
          message = "Login failed. Please try again.";
      }

      loading.textContent = message;
      loading.style.color = "red";
      spinner.style.display = "none";
    });
});

/* ---------------- SIGNUP SECTION ---------------- */
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

      statusBox.textContent = "Account created. Redirecting to access options...";
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

/* ---------------- FORGOT PASSWORD — SEND RESET LINK ---------------- */
document.getElementById('reset-btn')?.addEventListener('click', () => {
  const email = document.getElementById('reset-email').value.trim();
  const status = document.getElementById('reset-status');

  if (!email) {
    status.textContent = "Please enter your email.";
    status.style.color = "red";
    return;
  }

  sendPasswordResetEmail(auth, email)
    .then(() => {
      status.textContent = "Password reset link sent to your email. Must Check Your Spam Folder!!!";
      status.style.color = "#00ff88";
    })
    .catch((error) => {
      status.textContent = "Error: " + error.message;
      status.style.color = "red";
    });
});
