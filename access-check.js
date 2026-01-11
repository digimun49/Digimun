import { auth, db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const ADMIN_EMAIL = "muneebg249@gmail.com";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/login';
    return;
  }

  const userEmail = (user.email || '').toLowerCase().trim();
  const adminEmail = ADMIN_EMAIL.toLowerCase().trim();

  if (userEmail === adminEmail) {
    window.location.href = '/admincontroldp49';
    return;
  }

  try {
    const docRef = doc(db, "users", user.email);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return;
    }

    const data = snap.data();
    const paymentStatus = String(data.paymentStatus || '').toLowerCase();
    const quotexStatus = String(data.quotexStatus || '').toLowerCase();

    if (paymentStatus === 'approved' && quotexStatus === 'approved') {
      window.location.href = '/signal';
    }
  } catch (e) {
    console.error('Access check error:', e);
  }
});