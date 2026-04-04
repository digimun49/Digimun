let _msgMod = {};
let _pMod = {};
try {
  _msgMod = await import("./platform-messaging.js");
  _pMod = await import("./platform.js");
} catch(e) {
  console.warn('Push notifications: modules failed to load', e);
}
const { getMessaging, getToken, onMessage } = _msgMod;
const { doc, setDoc, arrayUnion, arrayRemove, collection, getDocs, query, orderBy, limit } = _pMod;

const VAPID_KEY = 'BIzAoMv4C1utAo-K-Ra6UaIOAZKl3mwNPMtJHEkA70xL_Ar3gLUHh41H3udYLgS3vzauNtyhQd-iYxKot5Q_V2g';
const TOKEN_KEY = 'digimun_fcm_token';
const PERM_KEY = 'digimun_notif_enabled';
const HISTORY_KEY = 'digimun_notif_last_seen';
const PROMPT_DISMISS_KEY_PREFIX = 'digimun_notif_prompt_dismissed';
const TOKEN_REFRESH_INTERVAL = 60 * 60 * 1000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY = 2000;
const PENDING_OPS_KEY = 'digimun_pending_token_ops';

let messaging = null;
let _swRegistration = null;
let _tokenRefreshTimer = null;

function isPushSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

function getPromptDismissKey() {
  const email = getUserEmailKey();
  return email ? PROMPT_DISMISS_KEY_PREFIX + ':' + email : PROMPT_DISMISS_KEY_PREFIX;
}

function getUserEmailKey() {
  const auth = window._auth;
  if (auth?.currentUser?.email) return auth.currentUser.email.toLowerCase();
  return null;
}

function getNotifStatus() {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission === 'granted' && localStorage.getItem(PERM_KEY) === 'true') {
    if (!localStorage.getItem(TOKEN_KEY)) return 'broken';
    return 'enabled';
  }
  return 'default';
}

function waitForPlatform(timeoutMs = 10000) {
  return new Promise((resolve) => {
    if (window._ready && window._app) {
      resolve(window._app);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if (window._ready && window._app) {
        clearInterval(interval);
        resolve(window._app);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        clearInterval(interval);
        resolve(null);
      }
    }, 100);
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff(fn, description, maxAttempts = MAX_RETRY_ATTEMPTS) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt === maxAttempts) {
        console.warn(`${description} failed after ${maxAttempts} attempts:`, e.message);
        throw e;
      }
      const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
      console.warn(`${description} attempt ${attempt} failed, retrying in ${delay}ms:`, e.message);
      await sleep(delay);
    }
  }
}

async function registerServiceWorker() {
  if (_swRegistration) return _swRegistration;
  if (!('serviceWorker' in navigator)) return null;

  try {
    _swRegistration = await retryWithBackoff(
      () => navigator.serviceWorker.register('/messaging-sw.js?v=2', { scope: '/' }),
      'Service worker registration'
    );
    return _swRegistration;
  } catch (e) {
    console.warn('Service worker registration failed permanently:', e.message);
    return null;
  }
}

async function initMessaging() {
  if (messaging) return messaging;

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const app = await waitForPlatform();
      if (!app) {
        if (attempt < MAX_RETRY_ATTEMPTS) {
          const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
          console.warn(`FCM init: platform not ready, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRY_ATTEMPTS})`);
          await sleep(delay);
          continue;
        }
        console.warn('FCM init: platform not ready after all retries');
        return null;
      }

      const swReg = await registerServiceWorker();
      if (!swReg) {
        console.warn('FCM init: Service worker not available');
        return null;
      }

      messaging = getMessaging(app);
      onMessage(messaging, (payload) => {
        const data = payload.notification || payload.data || {};
        showInAppNotification(data.title || 'Digimun Pro', data.body || '');
        updateBellBadge();
      });
      return messaging;
    } catch (e) {
      if (attempt < MAX_RETRY_ATTEMPTS) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
        console.warn(`FCM init attempt ${attempt} failed, retrying in ${delay}ms:`, e.message);
        await sleep(delay);
      } else {
        console.warn('FCM init failed after all retries:', e.message);
        return null;
      }
    }
  }
  return null;
}

function showInAppNotification(title, body) {
  const existing = document.querySelector('.digimun-in-app-notif');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = 'digimun-in-app-notif';

  const iconDiv = document.createElement('div');
  iconDiv.className = 'notif-icon';
  iconDiv.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="#00D4AA"><path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'notif-content';
  const titleEl = document.createElement('div');
  titleEl.className = 'notif-title';
  titleEl.textContent = title;
  const bodyEl = document.createElement('div');
  bodyEl.className = 'notif-body';
  bodyEl.textContent = body;
  contentDiv.appendChild(titleEl);
  contentDiv.appendChild(bodyEl);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'notif-close';
  closeBtn.textContent = '\u00D7';
  closeBtn.onclick = () => el.remove();

  el.appendChild(iconDiv);
  el.appendChild(contentDiv);
  el.appendChild(closeBtn);
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    if (el.parentElement) {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }
  }, 6000);
}

function queuePendingOp(op) {
  try {
    let pending = JSON.parse(localStorage.getItem(PENDING_OPS_KEY) || '[]');
    const cancelIdx = pending.findIndex(
      p => p.token === op.token &&
      (p.email || '') === (op.email || '') &&
      ((p.action === 'add' && op.action === 'remove') || (p.action === 'remove' && op.action === 'add'))
    );
    if (cancelIdx !== -1) {
      pending.splice(cancelIdx, 1);
    } else {
      pending.push(op);
    }
    if (pending.length > 0) {
      localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(pending));
    } else {
      localStorage.removeItem(PENDING_OPS_KEY);
    }
  } catch (e) {
    console.warn('Failed to queue pending op:', e.message);
  }
}

async function drainPendingOps() {
  let pending;
  try {
    pending = JSON.parse(localStorage.getItem(PENDING_OPS_KEY) || '[]');
  } catch (e) {
    localStorage.removeItem(PENDING_OPS_KEY);
    return;
  }
  if (pending.length === 0) return;

  const currentEmail = getUserEmailKey();
  const db = window._db;
  if (!currentEmail || !db) return;

  const remaining = [];
  for (const op of pending) {
    const opEmail = op.email || currentEmail;
    if (opEmail !== currentEmail) {
      remaining.push(op);
      continue;
    }
    try {
      const userRef = doc(db, 'users', opEmail);
      if (op.action === 'add') {
        await setDoc(userRef, { fcmTokens: arrayUnion(op.token) }, { merge: true });
      } else if (op.action === 'remove') {
        await setDoc(userRef, { fcmTokens: arrayRemove(op.token) }, { merge: true });
      }
    } catch (e) {
      remaining.push(op);
    }
  }

  if (remaining.length > 0) {
    localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(remaining));
  } else {
    localStorage.removeItem(PENDING_OPS_KEY);
  }
}

async function saveTokenToDb(token) {
  const emailKey = getUserEmailKey();
  const db = window._db;
  if (!emailKey || !db) {
    queuePendingOp({ action: 'add', token, email: emailKey, ts: Date.now() });
    return;
  }

  try {
    await retryWithBackoff(async () => {
      const userRef = doc(db, 'users', emailKey);
      await setDoc(userRef, { fcmTokens: arrayUnion(token) }, { merge: true });
    }, 'DB token save');
  } catch (e) {
    queuePendingOp({ action: 'add', token, email: emailKey, ts: Date.now() });
  }
}

async function removeTokenFromDb(token) {
  const emailKey = getUserEmailKey();
  const db = window._db;
  if (!emailKey || !db) {
    queuePendingOp({ action: 'remove', token, email: emailKey, ts: Date.now() });
    return;
  }

  try {
    await retryWithBackoff(async () => {
      const userRef = doc(db, 'users', emailKey);
      await setDoc(userRef, { fcmTokens: arrayRemove(token) }, { merge: true });
    }, 'DB token remove');
  } catch (e) {
    queuePendingOp({ action: 'remove', token, email: emailKey, ts: Date.now() });
  }
}

async function requestFCMToken() {
  const msg = await initMessaging();
  if (!msg) return null;

  const swReg = _swRegistration || await navigator.serviceWorker.getRegistration('/');
  if (!swReg) return null;

  const token = await retryWithBackoff(
    () => getToken(msg, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg }),
    'FCM getToken'
  );
  return token || null;
}

async function enableNotifications() {
  if (!isPushSupported()) return { success: false, reason: 'unsupported' };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { success: false, reason: 'denied' };

    const token = await requestFCMToken();
    if (!token) return { success: false, reason: 'no_token' };

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(PERM_KEY, 'true');

    await saveTokenToDb(token);

    dismissPermissionPrompt();
    startTokenRefresh();
    updateNotifButton();
    return { success: true, token };
  } catch (e) {
    console.warn('Enable notifications error:', e.message);
    return { success: false, reason: e.message };
  }
}

async function disableNotifications() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      await removeTokenFromDb(token);
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.setItem(PERM_KEY, 'false');
    stopTokenRefresh();
    return { success: true };
  } catch (e) {
    return { success: false, reason: e.message };
  }
}

async function refreshToken() {
  if (getNotifStatus() !== 'enabled' && getNotifStatus() !== 'broken') return;

  try {
    const oldToken = localStorage.getItem(TOKEN_KEY);
    const newToken = await requestFCMToken();

    if (!newToken) {
      console.warn('Token refresh: failed to get new token');
      if (oldToken) {
        await removeTokenFromDb(oldToken);
      }
      localStorage.removeItem(TOKEN_KEY);
      updateNotifButton();
      updatePanelToggle();
      return;
    }

    if (newToken !== oldToken) {
      if (oldToken) {
        await removeTokenFromDb(oldToken);
      }
      localStorage.setItem(TOKEN_KEY, newToken);
      await saveTokenToDb(newToken);
    }

    updateNotifButton();
    updatePanelToggle();
  } catch (e) {
    console.warn('Token refresh error:', e.message);
  }
}

function startTokenRefresh() {
  stopTokenRefresh();
  _tokenRefreshTimer = setInterval(refreshToken, TOKEN_REFRESH_INTERVAL);
}

function stopTokenRefresh() {
  if (_tokenRefreshTimer) {
    clearInterval(_tokenRefreshTimer);
    _tokenRefreshTimer = null;
  }
}

function waitForAuth(timeoutMs = 30000) {
  return new Promise((resolve) => {
    if (getUserEmailKey() && window._db) {
      resolve(true);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if (getUserEmailKey() && window._db) {
        clearInterval(interval);
        resolve(true);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, 500);
  });
}

async function validateTokenOnLoad() {
  const permEnabled = localStorage.getItem(PERM_KEY) === 'true';
  if (!permEnabled) return;

  if (Notification.permission !== 'granted') {
    const oldToken = localStorage.getItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.setItem(PERM_KEY, 'false');
    updateNotifButton();
    updatePanelToggle();
    if (oldToken) {
      const authReady = await waitForAuth();
      if (authReady) {
        await removeTokenFromDb(oldToken);
      }
    }
    return;
  }

  try {
    const oldToken = localStorage.getItem(TOKEN_KEY);
    const newToken = await requestFCMToken();

    await waitForAuth();

    if (!newToken) {
      if (oldToken) {
        await removeTokenFromDb(oldToken);
      }
      localStorage.removeItem(TOKEN_KEY);
      updateNotifButton();
      updatePanelToggle();
      return;
    }

    if (newToken !== oldToken) {
      if (oldToken) {
        await removeTokenFromDb(oldToken);
      }
      localStorage.setItem(TOKEN_KEY, newToken);
    }

    await saveTokenToDb(newToken);
    await drainPendingOps();
    startTokenRefresh();
    updateNotifButton();
    updatePanelToggle();
  } catch (e) {
    console.warn('Token validation on load failed:', e.message);
    const oldToken = localStorage.getItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    updateNotifButton();
    updatePanelToggle();
    if (oldToken) {
      const authReady = await waitForAuth();
      if (authReady) {
        await removeTokenFromDb(oldToken);
      }
    }
  }
}

function injectNotifStyles() {
  if (document.getElementById('digimun-notif-styles')) return;
  const style = document.createElement('style');
  style.id = 'digimun-notif-styles';
  style.textContent = `
    .digimun-in-app-notif {
      position: fixed;
      top: 16px;
      right: 16px;
      left: 16px;
      max-width: 420px;
      margin: 0 auto;
      background: linear-gradient(135deg, rgba(14,14,20,0.98) 0%, rgba(10,10,15,0.98) 100%);
      border: 1px solid rgba(0,212,170,0.25);
      border-radius: 14px;
      padding: 14px 16px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      z-index: 99999;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,212,170,0.1);
      transform: translateY(-100%);
      opacity: 0;
      transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .digimun-in-app-notif.show {
      transform: translateY(0);
      opacity: 1;
    }
    .digimun-in-app-notif .notif-icon {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: rgba(0,212,170,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .digimun-in-app-notif .notif-content { flex: 1; min-width: 0; }
    .digimun-in-app-notif .notif-title {
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 2px;
    }
    .digimun-in-app-notif .notif-body {
      font-size: 12px;
      color: rgba(255,255,255,0.6);
      line-height: 1.4;
    }
    .digimun-in-app-notif .notif-close {
      flex-shrink: 0;
      background: none;
      border: none;
      color: rgba(255,255,255,0.4);
      font-size: 18px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    }

    .sidebar-notif-toggle {
      display: flex;
      align-items: center;
      gap: 10px;
      width: calc(100% - 32px);
      margin: 6px 16px;
      padding: 10px 14px;
      border: 1px solid rgba(0,212,170,0.15);
      border-radius: 10px;
      background: rgba(0,212,170,0.05);
      color: rgba(255,255,255,0.7);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .sidebar-notif-toggle:hover {
      background: rgba(0,212,170,0.1);
      border-color: rgba(0,212,170,0.25);
      color: #00D4AA;
    }
    .sidebar-notif-toggle .notif-bell-icon { font-size: 14px; opacity: 0.8; }
    .sidebar-notif-toggle .notif-status {
      margin-left: auto;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .sidebar-notif-toggle .notif-status.on {
      background: rgba(0,212,170,0.15);
      color: #00D4AA;
    }
    .sidebar-notif-toggle .notif-status.off {
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.4);
    }
    .sidebar-notif-toggle .notif-status.blocked {
      background: rgba(255,71,87,0.12);
      color: rgba(255,71,87,0.7);
    }
    .sidebar-notif-toggle .notif-status.broken {
      background: rgba(255,171,0,0.12);
      color: rgba(255,171,0,0.8);
    }

    .digimun-bell-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .digimun-bell-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: background 0.2s;
      position: relative;
    }
    .digimun-bell-btn:hover {
      background: rgba(255,255,255,0.06);
    }
    .digimun-bell-btn svg {
      width: 20px;
      height: 20px;
      fill: rgba(255,255,255,0.6);
      transition: fill 0.2s;
    }
    .digimun-bell-btn:hover svg {
      fill: #00D4AA;
    }
    .digimun-bell-badge {
      position: absolute;
      top: 3px;
      right: 3px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #00D4AA;
      border: 2px solid #0a0a0f;
      display: none;
    }
    .digimun-bell-badge.has-new {
      display: block;
      animation: bellPulse 2s ease-in-out infinite;
    }
    @keyframes bellPulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.3); opacity: 0.7; }
    }

    .digimun-notif-panel {
      position: fixed;
      top: 0;
      right: -380px;
      width: 360px;
      max-width: 100vw;
      height: 100vh;
      background: linear-gradient(180deg, #0c0c14 0%, #080810 100%);
      border-left: 1px solid rgba(0,212,170,0.12);
      z-index: 100000;
      transition: right 0.3s cubic-bezier(0.4,0,0.2,1);
      display: flex;
      flex-direction: column;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .digimun-notif-panel.open {
      right: 0;
    }
    .digimun-notif-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .digimun-notif-panel-header h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .digimun-notif-panel-close {
      background: none;
      border: none;
      color: rgba(255,255,255,0.4);
      font-size: 22px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      transition: all 0.2s;
    }
    .digimun-notif-panel-close:hover {
      background: rgba(255,255,255,0.06);
      color: #fff;
    }
    .digimun-notif-panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;
    }
    .digimun-notif-panel-body::-webkit-scrollbar { width: 4px; }
    .digimun-notif-panel-body::-webkit-scrollbar-track { background: transparent; }
    .digimun-notif-panel-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
    .digimun-notif-item {
      padding: 14px 16px;
      border-radius: 12px;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.04);
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .digimun-notif-item:hover {
      background: rgba(0,212,170,0.04);
      border-color: rgba(0,212,170,0.12);
    }
    .digimun-notif-item-title {
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 4px;
    }
    .digimun-notif-item-body {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      line-height: 1.4;
      margin-bottom: 6px;
    }
    .digimun-notif-item-time {
      font-size: 10px;
      color: rgba(255,255,255,0.25);
      font-family: 'JetBrains Mono', monospace;
    }
    .digimun-notif-item.unread {
      border-left: 3px solid #00D4AA;
      background: rgba(0,212,170,0.03);
    }
    .digimun-notif-empty {
      text-align: center;
      padding: 60px 20px;
      color: rgba(255,255,255,0.3);
    }
    .digimun-notif-empty svg {
      opacity: 0.2;
      margin-bottom: 12px;
    }
    .digimun-notif-empty p {
      font-size: 13px;
      margin: 0;
    }
    .digimun-notif-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 99999;
      opacity: 0;
      transition: opacity 0.3s;
      display: none;
    }
    .digimun-notif-overlay.show {
      display: block;
      opacity: 1;
    }

    .digimun-notif-prompt {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 99998;
      transform: translateY(100%);
      transition: transform 0.4s cubic-bezier(0.4,0,0.2,1);
    }
    .digimun-notif-prompt.show {
      transform: translateY(0);
    }
    .digimun-notif-prompt-inner {
      max-width: 480px;
      margin: 0 auto;
      background: linear-gradient(135deg, rgba(14,14,22,0.98) 0%, rgba(8,8,16,0.98) 100%);
      border: 1px solid rgba(0,212,170,0.2);
      border-bottom: none;
      border-radius: 20px 20px 0 0;
      padding: 24px 24px 20px;
      backdrop-filter: blur(20px);
      box-shadow: 0 -8px 40px rgba(0,0,0,0.6);
    }
    .digimun-notif-prompt-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .digimun-notif-prompt-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(0,212,170,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .digimun-notif-prompt h4 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: #fff;
    }
    .digimun-notif-prompt p {
      margin: 0 0 16px;
      font-size: 13px;
      color: rgba(255,255,255,0.5);
      line-height: 1.5;
    }
    .digimun-notif-prompt-actions {
      display: flex;
      gap: 10px;
    }
    .digimun-notif-prompt-btn {
      flex: 1;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      font-family: 'Inter', system-ui, sans-serif;
      transition: all 0.2s;
    }
    .digimun-notif-prompt-btn.primary {
      background: linear-gradient(135deg, #00D4AA, #00b894);
      color: #050508;
    }
    .digimun-notif-prompt-btn.primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 16px rgba(0,212,170,0.3);
    }
    .digimun-notif-prompt-btn.secondary {
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.5);
      border: 1px solid rgba(255,255,255,0.08);
    }
    .digimun-notif-prompt-btn.secondary:hover {
      background: rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.7);
    }
    .digimun-notif-panel-toggle {
      background: none;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: pointer;
      transition: all 0.2s;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .digimun-notif-panel-toggle.on {
      color: #00D4AA;
      border-color: rgba(0,212,170,0.3);
      background: rgba(0,212,170,0.08);
    }
    .digimun-notif-panel-toggle.off {
      color: #ffab00;
      border-color: rgba(255,171,0,0.3);
      background: rgba(255,171,0,0.08);
    }
    .digimun-notif-panel-toggle.blocked {
      color: rgba(255,71,87,0.7);
      border-color: rgba(255,71,87,0.2);
      background: rgba(255,71,87,0.06);
    }
    .digimun-notif-panel-toggle.broken {
      color: #ffab00;
      border-color: rgba(255,171,0,0.3);
      background: rgba(255,171,0,0.08);
    }
    .digimun-notif-panel-toggle:hover {
      opacity: 0.8;
    }
    @media (max-width: 480px) {
      .digimun-notif-panel {
        width: 100vw;
        right: -100vw;
      }
      .digimun-notif-panel.open {
        right: 0;
      }
      .digimun-notif-prompt-inner {
        margin: 0 8px;
        border-radius: 16px 16px 0 0;
        padding: 20px 18px 16px;
      }
    }
  `;
  document.head.appendChild(style);
}

function createNotifButton() {

  const contactBtn = document.getElementById('sidebarContactBtn');
  if (!contactBtn) return;

  const btn = document.createElement('button');
  btn.className = 'sidebar-notif-toggle sidebar-user-item';
  btn.id = 'sidebarNotifBtn';
  btn.onclick = handleNotifToggle;
  const isLoggedIn = contactBtn.style.display !== 'none';
  if (!isLoggedIn) btn.style.display = 'none';
  contactBtn.parentNode.insertBefore(btn, contactBtn.nextSibling);
  updateNotifButton();
}

function updateNotifButton() {
  const btn = document.getElementById('sidebarNotifBtn');
  if (!btn) return;

  const status = getNotifStatus();
  let label = 'Notifications';
  let statusHtml = '';

  if (status === 'enabled') {
    statusHtml = '<span class="notif-status on">ON</span>';
  } else if (status === 'broken') {
    statusHtml = '<span class="notif-status broken">Fix</span>';
  } else if (status === 'blocked') {
    statusHtml = '<span class="notif-status blocked">Blocked</span>';
  } else if (status === 'unsupported') {
    statusHtml = '<span class="notif-status off">N/A</span>';
  } else {
    statusHtml = '<span class="notif-status off">OFF</span>';
  }

  btn.innerHTML = `
    <span class="notif-bell-icon">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
    </span>
    <span>${label}</span>
    ${statusHtml}
  `;
}

async function handleNotifToggle() {
  const status = getNotifStatus();
  const btn = document.getElementById('sidebarNotifBtn');

  if (status === 'unsupported') {
    alert('Push notifications are not supported on this browser. On iPhone, add this site to your Home Screen first, then enable notifications.');
    return;
  }

  if (status === 'blocked') {
    alert('Notifications are blocked. To fix this:\n\n1. Tap the lock/tune icon in the address bar\n2. Tap "Permissions" or "Site settings"\n3. Find "Notifications" and change to "Allow"\n4. Reload the page\n\nOr go to Chrome Settings > Site Settings > Notifications > find digimun.pro and Allow');
    return;
  }

  if (status === 'enabled') {
    if (btn) btn.style.opacity = '0.5';
    await disableNotifications();
    if (btn) btn.style.opacity = '1';
    updateNotifButton();
    return;
  }

  if (btn) {
    btn.style.opacity = '0.5';
    btn.style.pointerEvents = 'none';
  }
  const result = await enableNotifications();
  if (btn) {
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
  }

  if (result.success) {
    updateNotifButton();
    showInAppNotification('Notifications Enabled', 'You will now receive trading signal alerts.');
  } else if (result.reason === 'denied') {
    updateNotifButton();
    alert('Permission denied. On Android, if you see "can\'t ask for permission", close any screen overlay apps (chat bubbles, screen recorders) and try again.');
  } else {
    alert('Could not enable notifications. Please try again.');
  }
}

function injectBellIcon() {
  const dashHeader = document.querySelector('.page-header');

  if (!document.getElementById('navBellWrap')) {
    const sidebarBtn = document.querySelector('.sidebar-toggle-btn');
    const navCta = document.querySelector('.nav-cta');
    const target = sidebarBtn ? sidebarBtn.parentNode : navCta;
    if (target) {
      const wrap = document.createElement('div');
      wrap.className = 'digimun-bell-wrap';
      wrap.id = 'navBellWrap';
      wrap.innerHTML = `
        <button class="digimun-bell-btn" id="navBellBtn" aria-label="Notifications">
          <svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
          <span class="digimun-bell-badge" id="navBellBadge"></span>
        </button>
      `;
      if (sidebarBtn) {
        sidebarBtn.parentNode.insertBefore(wrap, sidebarBtn);
      } else {
        target.appendChild(wrap);
      }
      wrap.querySelector('#navBellBtn').onclick = toggleNotifPanel;
    }
  }

  if (dashHeader && !document.getElementById('dashBellWrap')) {
    const badge = dashHeader.querySelector('.page-badge');
    if (badge) {
      const wrap = document.createElement('div');
      wrap.className = 'digimun-bell-wrap';
      wrap.id = 'dashBellWrap';
      wrap.style.cssText = 'position:absolute; top:20px; right:20px;';
      wrap.innerHTML = `
        <button class="digimun-bell-btn" id="dashBellBtn" aria-label="Notifications">
          <svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
          <span class="digimun-bell-badge" id="dashBellBadge"></span>
        </button>
      `;
      dashHeader.style.position = 'relative';
      dashHeader.appendChild(wrap);
      wrap.querySelector('#dashBellBtn').onclick = toggleNotifPanel;
    }
  }
}

function createNotifPanel() {
  if (document.getElementById('digimunNotifPanel')) return;

  const overlay = document.createElement('div');
  overlay.className = 'digimun-notif-overlay';
  overlay.id = 'digimunNotifOverlay';
  overlay.onclick = closeNotifPanel;

  const panel = document.createElement('div');
  panel.className = 'digimun-notif-panel';
  panel.id = 'digimunNotifPanel';
  panel.innerHTML = `
    <div class="digimun-notif-panel-header">
      <h3>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#00D4AA"><path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
        Notifications
      </h3>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="digimun-notif-panel-toggle" id="notifPanelToggle"></button>
        <button class="digimun-notif-panel-close" onclick="document.getElementById('digimunNotifPanel').classList.remove('open'); document.getElementById('digimunNotifOverlay').classList.remove('show');">&times;</button>
      </div>
    </div>
    <div class="digimun-notif-panel-body" id="digimunNotifPanelBody">
      <div class="digimun-notif-empty">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
        <p>No notifications yet</p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(panel);
  updatePanelToggle();
}

function updatePanelToggle() {
  const btn = document.getElementById('notifPanelToggle');
  if (!btn) return;

  const status = getNotifStatus();

  if (status === 'enabled') {
    btn.className = 'digimun-notif-panel-toggle on';
    btn.textContent = 'Enabled';
    btn.onclick = async () => {
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
      await disableNotifications();
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
      updatePanelToggle();
      updateNotifButton();
    };
  } else if (status === 'broken') {
    btn.className = 'digimun-notif-panel-toggle broken';
    btn.textContent = 'Re-enable';
    btn.onclick = async () => {
      btn.textContent = '...';
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
      const result = await enableNotifications();
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
      if (result.success) {
        showInAppNotification('Notifications Fixed', 'Notifications are working again.');
        updateNotifButton();
      }
      updatePanelToggle();
    };
  } else if (status === 'blocked') {
    btn.className = 'digimun-notif-panel-toggle blocked';
    btn.textContent = 'Blocked';
    btn.onclick = () => {
      alert('Notifications are blocked. To fix this:\n\n1. Tap the lock/tune icon in the address bar\n2. Tap "Permissions" or "Site settings"\n3. Find "Notifications" and change to "Allow"\n4. Reload the page');
    };
  } else if (status === 'unsupported') {
    btn.className = 'digimun-notif-panel-toggle blocked';
    btn.textContent = 'Not Supported';
    btn.onclick = () => {
      alert('Push notifications are not supported on this browser. On iPhone, add this site to your Home Screen first.');
    };
  } else {
    btn.className = 'digimun-notif-panel-toggle off';
    btn.textContent = 'Enable';
    btn.onclick = async () => {
      btn.textContent = '...';
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
      const result = await enableNotifications();
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
      if (result.success) {
        showInAppNotification('Notifications Enabled', 'You will now receive trading signal alerts.');
        updateNotifButton();
      } else if (result.reason === 'denied') {
        alert('Permission denied. On Android, if you see "can\'t ask for permission", close any screen overlay apps (chat bubbles, screen recorders) and try again.');
      }
      updatePanelToggle();
    };
  }
}

async function loadNotifHistory() {
  const db = window._db;
  if (!db) return;

  const body = document.getElementById('digimunNotifPanelBody');
  if (!body) return;

  body.innerHTML = '<div style="text-align:center; padding:40px; color:rgba(255,255,255,0.3); font-size:12px;">Loading...</div>';

  try {
    const res = await fetch('/.netlify/functions/get-notifications');
    if (!res.ok) throw new Error('Server error');
    const data = await res.json();
    const notifications = data.notifications || [];

    if (notifications.length === 0) {
      body.innerHTML = `
        <div class="digimun-notif-empty">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
          <p>No notifications yet</p>
        </div>
      `;
      return;
    }

    const lastSeen = parseInt(localStorage.getItem(HISTORY_KEY) || '0');
    let html = '';

    notifications.forEach(d => {
      const isUnread = d.timestamp > lastSeen;
      const ts = d.timestamp ? timeAgo(d.timestamp) : '';
      const url = d.url || '/dashboard';
      html += `
        <div class="digimun-notif-item${isUnread ? ' unread' : ''}" onclick="window.location.href='${url}'">
          <div class="digimun-notif-item-title">${escapeHtml(d.title || 'Notification')}</div>
          <div class="digimun-notif-item-body">${escapeHtml(d.body || '')}</div>
          <div class="digimun-notif-item-time">${ts}</div>
        </div>
      `;
    });

    body.innerHTML = html;

    if (notifications[0]?.timestamp) {
      localStorage.setItem(HISTORY_KEY, String(notifications[0].timestamp));
    }
    updateBellBadge();
  } catch (e) {
    console.warn('Load notification history error:', e.message);
    body.innerHTML = '<div style="text-align:center; padding:40px; color:rgba(255,255,255,0.3); font-size:12px;">No notifications yet</div>';
  }
}

function toggleNotifPanel() {
  const panel = document.getElementById('digimunNotifPanel');
  const overlay = document.getElementById('digimunNotifOverlay');
  if (!panel || !overlay) {
    createNotifPanel();
  }
  const p = document.getElementById('digimunNotifPanel');
  const o = document.getElementById('digimunNotifOverlay');
  if (p.classList.contains('open')) {
    closeNotifPanel();
  } else {
    p.classList.add('open');
    o.classList.add('show');
    updatePanelToggle();
    loadNotifHistory();
  }
}

function closeNotifPanel() {
  const panel = document.getElementById('digimunNotifPanel');
  const overlay = document.getElementById('digimunNotifOverlay');
  if (panel) panel.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
}

async function updateBellBadge() {
  const badges = document.querySelectorAll('.digimun-bell-badge');
  if (badges.length === 0) return;

  try {
    const lastSeen = parseInt(localStorage.getItem(HISTORY_KEY) || '0');
    const res = await fetch('/.netlify/functions/get-notifications');
    if (!res.ok) return;
    const data = await res.json();
    const notifications = data.notifications || [];

    let hasNew = false;
    if (notifications.length > 0 && notifications[0].timestamp > lastSeen) {
      hasNew = true;
    }

    badges.forEach(b => {
      if (hasNew) b.classList.add('has-new');
      else b.classList.remove('has-new');
    });
  } catch (e) {
    console.warn('Badge check error:', e.message);
  }
}

function showPermissionPrompt() {
  const status = getNotifStatus();
  if (status === 'enabled') return;

  const dismissKey = getPromptDismissKey();
  const dismissedAt = localStorage.getItem(dismissKey);
  if (dismissedAt) {
    const elapsed = Date.now() - parseInt(dismissedAt);
    if (elapsed < 30 * 60 * 1000) return;
    localStorage.removeItem(dismissKey);
  }

  if (!getUserEmailKey()) return;
  if (document.getElementById('digimunNotifPrompt')) return;

  const isBlocked = status === 'blocked';
  const isUnsupported = status === 'unsupported';
  const isBroken = status === 'broken';

  const prompt = document.createElement('div');
  prompt.className = 'digimun-notif-prompt';
  prompt.id = 'digimunNotifPrompt';

  let primaryBtnText = 'Enable Notifications';
  if (isBlocked) primaryBtnText = 'Show Me How';
  else if (isUnsupported) primaryBtnText = 'Not Available';
  else if (isBroken) primaryBtnText = 'Fix Notifications';

  prompt.innerHTML = `
    <div class="digimun-notif-prompt-inner">
      <div class="digimun-notif-prompt-header">
        <div class="digimun-notif-prompt-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="#00D4AA"><path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
        </div>
        <h4>${isBroken ? 'Notifications Need Attention' : 'Stay Updated with Trading Signals'}</h4>
      </div>
      <p>${isBroken ? 'Your notification token expired. Tap below to fix it and keep receiving alerts.' : 'Enable notifications to receive real-time trading signal alerts and never miss a profitable opportunity.'}</p>
      <div id="notifPromptMessage" style="display:none; font-size:12px; color:#ffab00; margin-bottom:12px; line-height:1.5;"></div>
      <div class="digimun-notif-prompt-actions">
        <button class="digimun-notif-prompt-btn primary" id="notifPromptEnable">${primaryBtnText}</button>
        <button class="digimun-notif-prompt-btn secondary" id="notifPromptDismiss">Don't Show Again</button>
      </div>
    </div>
  `;

  document.body.appendChild(prompt);
  setTimeout(() => prompt.classList.add('show'), 500);

  const msgEl = prompt.querySelector('#notifPromptMessage');

  if (isBlocked) {
    showManualSteps(msgEl);
  }

  prompt.querySelector('#notifPromptEnable').onclick = async () => {
    const btn = prompt.querySelector('#notifPromptEnable');

    if (isUnsupported) {
      msgEl.style.display = 'block';
      msgEl.innerHTML = '<strong>Not supported on this browser.</strong><br>On iPhone, add this website to your Home Screen first:<br>1. Tap the <strong>Share</strong> button (box with arrow)<br>2. Tap <strong>"Add to Home Screen"</strong><br>3. Open from Home Screen and enable notifications';
      return;
    }

    if (isBlocked) {
      showManualSteps(msgEl);
      return;
    }

    btn.textContent = isBroken ? 'Fixing...' : 'Enabling...';
    btn.style.opacity = '0.6';
    btn.style.pointerEvents = 'none';

    const result = await enableNotifications();

    if (result.success) {
      showInAppNotification(isBroken ? 'Notifications Fixed' : 'Notifications Enabled', 'You will now receive trading signal alerts.');
      updateNotifButton();
      dismissPermissionPrompt(false);
      return;
    }

    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';

    if (result.reason === 'denied') {
      btn.textContent = 'Retry';
      msgEl.style.display = 'block';
      msgEl.innerHTML = '<strong>Permission was denied.</strong> Let\'s try again. If a system popup appears, tap <strong>"Allow"</strong>.<br><br>On Android: Close any screen overlay apps (chat bubbles, brightness filters) and tap Retry.';

      btn.onclick = async () => {
        btn.textContent = 'Retrying...';
        btn.style.opacity = '0.6';
        btn.style.pointerEvents = 'none';
        const retry = await enableNotifications();
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
        if (retry.success) {
          showInAppNotification('Notifications Enabled', 'You will now receive trading signal alerts.');
          updateNotifButton();
          dismissPermissionPrompt(false);
        } else {
          btn.textContent = 'Show Manual Steps';
          msgEl.innerHTML = '<strong>Still blocked.</strong> Your browser has saved the "Block" decision. You need to manually allow notifications:';
          btn.onclick = () => { showManualSteps(msgEl); };
        }
      };
    } else {
      btn.textContent = 'Retry';
      msgEl.style.display = 'block';
      msgEl.textContent = 'Something went wrong. Tap Retry to try again.';
    }
  };

  prompt.querySelector('#notifPromptDismiss').onclick = () => {
    dismissPermissionPrompt(true);
  };
}

function showManualSteps(msgEl) {
  if (!msgEl) return;
  msgEl.style.display = 'block';
  const isChrome = /Chrome/i.test(navigator.userAgent) && !/Edge/i.test(navigator.userAgent);
  const isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  if (isSafari) {
    msgEl.innerHTML = '<strong>To enable on Safari:</strong><br>1. Tap the <strong>Share</strong> button<br>2. Tap <strong>"Add to Home Screen"</strong><br>3. Open from Home Screen<br>4. Then enable notifications';
  } else if (isChrome && isAndroid) {
    msgEl.innerHTML = '<strong>To enable on Chrome Android:</strong><br>1. Tap the <strong>lock/tune icon</strong> in the address bar<br>2. Tap <strong>"Permissions"</strong> or <strong>"Site settings"</strong><br>3. Set <strong>Notifications → Allow</strong><br>4. <strong>Reload</strong> the page<br><br>Or: Chrome menu ⋮ → Settings → Site Settings → Notifications → find digimun.pro → Allow';
  } else if (isChrome) {
    msgEl.innerHTML = '<strong>To enable on Chrome:</strong><br>1. Click the <strong>lock icon</strong> in the address bar<br>2. Click <strong>"Site settings"</strong><br>3. Set <strong>Notifications → Allow</strong><br>4. <strong>Reload</strong> the page';
  } else {
    msgEl.innerHTML = '<strong>To enable notifications:</strong><br>1. Open your browser settings<br>2. Find <strong>Site Settings → Notifications</strong><br>3. Allow notifications for <strong>digimun.pro</strong><br>4. <strong>Reload</strong> the page';
  }
}

function dismissPermissionPrompt(saveDismiss) {
  const prompt = document.getElementById('digimunNotifPrompt');
  if (prompt) {
    prompt.classList.remove('show');
    setTimeout(() => prompt.remove(), 400);
  }
  if (saveDismiss) {
    localStorage.setItem(getPromptDismissKey(), String(Date.now()));
  }
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + 'd ago';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function init() {
  injectNotifStyles();

  registerServiceWorker();

  const tryCreate = () => {
    if (document.getElementById('sidebarNotifBtn')) return;
    if (document.querySelector('.sidebar-nav')) {
      createNotifButton();
    }
  };

  if (document.querySelector('.sidebar-nav')) {
    tryCreate();
  }
  window.addEventListener('sidebarLoaded', () => {
    tryCreate();
    injectBellIcon();
  });

  const status = getNotifStatus();
  if (status === 'enabled' || status === 'broken') {
    validateTokenOnLoad();
  }

  createNotifPanel();
  injectBellIcon();
  setTimeout(() => { injectBellIcon(); updateBellBadge(); }, 2000);

  setTimeout(() => {
    showPermissionPrompt();
  }, 4000);

  setTimeout(() => {
    if (!document.getElementById('digimunNotifPrompt')) showPermissionPrompt();
  }, 12000);

  const authPoller = setInterval(() => {
    if (getUserEmailKey()) {
      clearInterval(authPoller);
      drainPendingOps();
      if (!document.getElementById('digimunNotifPrompt') && getNotifStatus() !== 'enabled') {
        showPermissionPrompt();
      }
    }
  }, 3000);
  setTimeout(() => clearInterval(authPoller), 60000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { enableNotifications, disableNotifications, getNotifStatus, showInAppNotification };
