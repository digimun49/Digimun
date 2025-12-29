import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const SUSPENDED_STATUSES = ['pending', 'suspended', 'banned'];

const SUSPENSION_OVERLAY_STYLES = `
<style id="suspension-overlay-styles">
.suspension-overlay {
  position: fixed;
  inset: 0;
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, rgba(5,8,16,0.98) 0%, rgba(15,10,10,0.99) 100%);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 20px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

.suspension-card {
  width: min(500px, 94vw);
  background: linear-gradient(180deg, rgba(30,15,15,0.95) 0%, rgba(20,10,10,0.98) 100%);
  border: 2px solid rgba(239,68,68,0.4);
  border-radius: 24px;
  padding: clamp(28px, 6vw, 44px);
  text-align: center;
  box-shadow: 0 40px 80px rgba(0,0,0,0.6), 0 0 80px rgba(239,68,68,0.15);
  position: relative;
  overflow: hidden;
}

.suspension-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #ef4444, #dc2626, #ef4444);
}

.suspension-icon {
  font-size: 72px;
  margin-bottom: 20px;
  display: block;
  filter: drop-shadow(0 0 30px rgba(239,68,68,0.5));
  animation: pulse-icon 2s ease-in-out infinite;
}

@keyframes pulse-icon {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.suspension-title {
  font-size: clamp(24px, 5vw, 32px);
  font-weight: 800;
  color: #ef4444;
  margin: 0 0 16px;
  letter-spacing: -0.5px;
  text-shadow: 0 0 20px rgba(239,68,68,0.3);
}

.suspension-subtitle {
  font-size: clamp(14px, 3vw, 16px);
  color: #fca5a5;
  margin: 0 0 24px;
  line-height: 1.7;
}

.suspension-email {
  display: inline-block;
  font-size: 13px;
  color: #94a3b8;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.2);
  padding: 10px 20px;
  border-radius: 999px;
  margin-bottom: 24px;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.suspension-warning {
  display: flex;
  gap: 14px;
  background: linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(185,28,28,0.1) 100%);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 14px;
  padding: 18px;
  margin: 20px 0;
  text-align: left;
}

.suspension-warning-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.suspension-warning-content strong {
  display: block;
  color: #fca5a5;
  font-size: 14px;
  margin-bottom: 6px;
}

.suspension-warning-content p {
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
}

.suspension-scam-alert {
  background: rgba(251,191,36,0.1);
  border: 1px solid rgba(251,191,36,0.3);
  border-radius: 10px;
  padding: 12px 16px;
  margin: 16px 0;
  font-size: 12px;
  color: #fbbf24;
  text-align: center;
}

.suspension-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
}

.suspension-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 24px;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  text-decoration: none;
  transition: all 0.3s ease;
  font-family: inherit;
}

.suspension-btn.telegram {
  background: linear-gradient(135deg, #0088cc, #00a2e8);
  color: #fff;
  box-shadow: 0 8px 24px rgba(0,136,204,0.25);
}

.suspension-btn.telegram:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(0,136,204,0.35);
}

.suspension-btn.logout {
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  color: #ef4444;
}

.suspension-btn.logout:hover {
  background: rgba(239,68,68,0.2);
}

.suspension-footer {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(239,68,68,0.1);
  font-size: 11px;
  color: #64748b;
}

.suspension-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.suspension-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: #22d3ee;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 480px) {
  .suspension-card { padding: 24px 20px; }
  .suspension-icon { font-size: 56px; }
  .suspension-btn { padding: 14px 20px; font-size: 14px; }
}
</style>
`;

function injectStyles() {
  if (!document.getElementById('suspension-overlay-styles')) {
    document.head.insertAdjacentHTML('beforeend', SUSPENSION_OVERLAY_STYLES);
  }
}

function showSuspensionScreen(email) {
  injectStyles();
  
  document.body.style.overflow = 'hidden';
  
  const overlay = document.createElement('div');
  overlay.id = 'suspension-overlay';
  overlay.className = 'suspension-overlay';
  
  const encodedMessage = encodeURIComponent(
    `Salam Digimun Team, mera account suspend ho gaya hai. Kripya madad karein. Meri email: ${email}`
  );
  const telegramLink = `https://t.me/digimun49?text=${encodedMessage}`;
  
  overlay.innerHTML = `
    <div class="suspension-card">
      <span class="suspension-icon">🚫</span>
      <h2 class="suspension-title">Account Suspended</h2>
      <p class="suspension-subtitle">
        Aapka account temporarily suspend kar diya gaya hai. 
        Aap is email se kisi bhi bot ya feature ko access nahi kar saktay.
      </p>
      <div class="suspension-email">${email}</div>
      
      <div class="suspension-warning">
        <div class="suspension-warning-icon">⚠️</div>
        <div class="suspension-warning-content">
          <strong>Kya karein?</strong>
          <p>Agar aapko lagta hai ke yeh galti se hua hai, toh hamari support team se contact karein. Hum aapki madad ke liye yahan hain.</p>
        </div>
      </div>
      
      <div class="suspension-scam-alert">
        ⚠️ SCAMMERS SE BACHEIN - Sirf @digimun49 official Telegram hai!
      </div>
      
      <div class="suspension-actions">
        <a href="${telegramLink}" target="_blank" rel="noopener" class="suspension-btn telegram">
          📱 Telegram pe Contact Karein
        </a>
        <button id="suspension-logout-btn" class="suspension-btn logout">
          🚪 Logout Karein
        </button>
      </div>
      
      <div class="suspension-footer">
        Reference: ${email} | Support ke liye apni email zaroor mention karein
      </div>
    </div>
  `;
  
  document.body.insertBefore(overlay, document.body.firstChild);
  
  document.getElementById('suspension-logout-btn').addEventListener('click', async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('userEmail');
      localStorage.removeItem('digimunCurrentUserEmail');
      window.location.href = 'login.html';
    } catch (e) {
      console.error('Logout error:', e);
      window.location.href = 'login.html';
    }
  });
}

async function forceLogoutSuspendedUser(user) {
  try {
    await signOut(auth);
    localStorage.removeItem('userEmail');
    localStorage.removeItem('digimunCurrentUserEmail');
  } catch (e) {
    console.error('Force logout error:', e);
  }
  showSuspensionScreen(user.email);
}

export function initSuspensionCheck() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      return;
    }
    
    try {
      const userDocRef = doc(db, "users", user.email);
      const userSnap = await getDoc(userDocRef);
      
      if (!userSnap.exists()) {
        return;
      }
      
      const userData = userSnap.data();
      const status = String(userData.status || '').toLowerCase().trim();
      
      if (SUSPENDED_STATUSES.includes(status)) {
        console.log('SUSPENSION CHECK: Account is suspended, forcing logout');
        await forceLogoutSuspendedUser(user);
      }
    } catch (error) {
      console.error('Suspension check error:', error);
    }
  });
}

initSuspensionCheck();
