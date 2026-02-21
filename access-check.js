import { auth, db } from "./firebase.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

async function checkIsAdmin(email) {
  try {
    const resp = await fetch('/.netlify/functions/check-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await resp.json();
    return data.isAdmin === true;
  } catch (e) {
    return false;
  }
}

function isAccessExpired(expiryValue) {
  if (!expiryValue) return false;
  
  let expiryDate;
  if (expiryValue.toDate) {
    expiryDate = expiryValue.toDate();
  } else if (expiryValue.seconds) {
    expiryDate = new Date(expiryValue.seconds * 1000);
  } else {
    expiryDate = new Date(expiryValue);
  }
  
  return expiryDate <= new Date();
}

async function checkAndExpireAccess(userEmail, data) {
  const updates = {};
  let needsUpdate = false;
  
  if (data.recoveryRequest === 'approved' && data.recoveryRequestExpiry) {
    if (isAccessExpired(data.recoveryRequestExpiry)) {
      updates.recoveryRequest = 'pending';
      updates.recoveryRequestExpiry = null;
      needsUpdate = true;
    }
  }
  
  if (data.digimaxStatus === 'approved' && data.digimaxStatusExpiry) {
    if (isAccessExpired(data.digimaxStatusExpiry)) {
      updates.digimaxStatus = 'pending';
      updates.digimaxStatusExpiry = null;
      needsUpdate = true;
    }
  }
  
  if (needsUpdate) {
    try {
      await updateDoc(doc(db, "users", userEmail), updates);
      return updates;
    } catch (e) {
      console.error('Error expiring access:', e);
    }
  }
  
  return null;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/login';
    return;
  }

  const userEmail = (user.email || '').toLowerCase().trim();

  const isAdmin = await checkIsAdmin(userEmail);
  if (isAdmin) {
    window.location.href = '/admincontroldp49';
    return;
  }

  try {
    const docRef = doc(db, "users", user.email);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return;
    }

    let data = snap.data();
    
    const expiredUpdates = await checkAndExpireAccess(user.email, data);
    if (expiredUpdates) {
      data = { ...data, ...expiredUpdates };
    }
    
    const paymentStatus = String(data.paymentStatus || '').toLowerCase();
    const quotexStatus = String(data.quotexStatus || '').toLowerCase();

    if (paymentStatus === 'approved' && quotexStatus === 'approved') {
      window.location.href = '/signal';
    }
  } catch (e) {
    console.error('Access check error:', e);
  }
});