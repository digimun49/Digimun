import { auth, db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ✅ Set admin email
const ADMIN_EMAIL = "muneebg249@gmail.com";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.log("Not logged in, redirecting to login...");
    window.location.href = '/login';
    return;
  }

  const userEmail = user.email.toLowerCase();
  const adminEmail = ADMIN_EMAIL.toLowerCase();
  console.log("Logged in email:", userEmail);
  console.log("Admin email:", adminEmail);

  if (userEmail === adminEmail) {
    console.log("✅ Admin match confirmed, redirecting to admin panel...");
    window.location.href = '/admin';
    return;
  }

  console.log("Normal user, checking Firestore data...");

  const docRef = doc(db, "users", user.email);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    console.log("❌ Firestore entry not found");
    return;
  }

  const data = snap.data();
  const { paymentStatus, quotexStatus } = data;

  if (paymentStatus === "approved" && quotexStatus === "approved") {
    console.log("✅ User approved, redirecting to signal");
    window.location.href = '/signal';
  } else {
    console.log("❌ User not approved");
  }
});