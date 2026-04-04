import { auth, db, doc, getDoc, updateDoc, onAuthStateChanged } from "./platform.js";

async function checkIsAdmin(email) {
  try {
    const user = auth.currentUser;
    if (!user) return false;
    const token = await user.getIdToken();
    const resp = await fetch('/.netlify/functions/check-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ email })
    });
    const data = await resp.json();
    if (data.isAdmin === true && data.r) {
      return data.r;
    }
    return false;
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
  
  const expiryChecks = [
    { field: 'recoveryRequest', expiryField: 'recoveryRequestExpiry' },
    { field: 'digimaxStatus', expiryField: 'digimaxStatusExpiry' },
    { field: 'paymentStatus', expiryField: 'paymentStatusExpiry' },
    { field: 'quotexStatus', expiryField: 'quotexStatusExpiry' }
  ];
  
  for (const { field, expiryField } of expiryChecks) {
    if (data[field] === 'approved' && data[expiryField]) {
      if (isAccessExpired(data[expiryField])) {
        updates[field] = 'pending';
        updates[expiryField] = null;
        needsUpdate = true;
      }
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

  const adminRedirect = await checkIsAdmin(userEmail);
  if (adminRedirect) {
    window.location.href = adminRedirect;
    return;
  }

  try {
    const docRef = doc(db, "users", (user.email || '').toLowerCase().trim());
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return;
    }

    let data = snap.data();
    
    const expiredUpdates = await checkAndExpireAccess(userEmail, data);
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