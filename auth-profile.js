import { auth, db, onAuthStateChanged, signOut, doc, getDoc, onSnapshot } from "./platform.js";

const CACHE_DURATION_MS = 3 * 60 * 1000;

const _state = {
  user: null,
  userData: null,
  email: null,
  status: null,
  isSuspended: false,
  isLoggedIn: false,
  isPremium: false,
  authResolved: false,
  lastFetched: 0,
  _listeners: [],
  _userDocUnsubscribe: null
};

function _notifyListeners() {
  const snapshot = getProfileSnapshot();
  _state._listeners.forEach(fn => {
    try { fn(snapshot); } catch (e) { console.error('[AuthProfile] Listener error:', e); }
  });
}

function _checkPremiumStatus(userData) {
  if (!userData) return false;
  const paymentStatus = String(userData.paymentStatus || '').toLowerCase();
  const quotexStatus = String(userData.quotexStatus || '').toLowerCase();
  const recoveryRequest = String(userData.recoveryRequest || '').toLowerCase();
  const digimaxStatus = String(userData.digimaxStatus || '').toLowerCase();
  const hasPaymentApproved = paymentStatus === 'approved';
  const hasQuotexApproved = quotexStatus === 'approved';
  const hasRecoveryApproved = recoveryRequest === 'approved' || recoveryRequest === 'active';
  const hasDigimaxApproved = digimaxStatus === 'approved' || digimaxStatus === 'active';
  return hasPaymentApproved || hasQuotexApproved || hasRecoveryApproved || hasDigimaxApproved;
}

function _isSuspendedStatus(status) {
  return ['pending', 'suspended', 'banned'].includes(status);
}

function _updateState(user, userData) {
  _state.user = user;
  if (user) {
    _state.email = (user.email || '').toLowerCase().trim();
    _state.isLoggedIn = true;
    _state.userData = userData || null;
    if (userData) {
      _state.status = String(userData.status || '').toLowerCase().trim();
      _state.isSuspended = _isSuspendedStatus(_state.status);
      _state.isPremium = _checkPremiumStatus(userData);
      _state.lastFetched = Date.now();
    } else {
      _state.status = null;
      _state.isSuspended = false;
      _state.isPremium = false;
      _state.lastFetched = 0;
    }
  } else {
    _state.email = null;
    _state.userData = null;
    _state.status = null;
    _state.isSuspended = false;
    _state.isLoggedIn = false;
    _state.isPremium = false;
    _state.lastFetched = 0;
  }
  _state.authResolved = true;
  _notifyListeners();
}

function _cleanupDocListener() {
  if (_state._userDocUnsubscribe) {
    _state._userDocUnsubscribe();
    _state._userDocUnsubscribe = null;
  }
}

function _startDocListener(email) {
  _cleanupDocListener();
  const userRef = doc(db, "users", email);
  _state._userDocUnsubscribe = onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
      _updateState(_state.user, snap.data());
    } else {
      _updateState(_state.user, null);
    }
  }, (error) => {
    console.error('[AuthProfile] Doc listener error:', error);
  });
}

function getProfileSnapshot() {
  return {
    user: _state.user,
    userData: _state.userData,
    email: _state.email,
    status: _state.status,
    isSuspended: _state.isSuspended,
    isLoggedIn: _state.isLoggedIn,
    isPremium: _state.isPremium,
    authResolved: _state.authResolved
  };
}

function onProfileChange(callback) {
  _state._listeners.push(callback);
  if (_state.authResolved) {
    try { callback(getProfileSnapshot()); } catch (e) {}
  }
  return () => {
    _state._listeners = _state._listeners.filter(fn => fn !== callback);
  };
}

async function fetchUserData(email) {
  const userRef = doc(db, "users", email);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data() : null;
}

function isCacheFresh() {
  return _state.lastFetched > 0 && (Date.now() - _state.lastFetched) < CACHE_DURATION_MS;
}

async function doSignOut() {
  try {
    _cleanupDocListener();
    localStorage.removeItem('userEmail');
    localStorage.removeItem('digimunCurrentUserEmail');
    await signOut(auth);
  } catch (e) {
    console.error('[AuthProfile] Sign out error:', e);
  }
}

let _initialized = false;

function initAuthProfile() {
  if (_initialized) return;
  _initialized = true;

  onAuthStateChanged(auth, async (user) => {
    _cleanupDocListener();

    if (!user) {
      _updateState(null, null);
      return;
    }

    const email = (user.email || '').toLowerCase().trim();
    if (!email) {
      _updateState(user, null);
      return;
    }

    try {
      const userData = await fetchUserData(email);
      _updateState(user, userData);
      _startDocListener(email);
    } catch (e) {
      console.error('[AuthProfile] Initial fetch error:', e);
      _updateState(user, null);
    }
  });
}

initAuthProfile();

export {
  auth,
  db,
  getProfileSnapshot,
  onProfileChange,
  fetchUserData,
  isCacheFresh,
  doSignOut,
  initAuthProfile
};
