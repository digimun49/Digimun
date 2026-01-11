(function() {
  const TELEGRAM_LINK = 'https://t.me/digimun49';
  const TELEGRAM_TUTORIAL_VIDEO = 'https://youtu.be/mROinTjkVGY';

  const styles = `
    .digimun-help-widget {
      position: fixed !important;
      bottom: 24px !important;
      right: 24px !important;
      z-index: 99999 !important;
      font-family: 'Inter', 'Segoe UI', -apple-system, sans-serif !important;
    }
    .digimun-help-widget * {
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .digimun-help-btn {
      width: 56px !important;
      height: 56px !important;
      border-radius: 50% !important;
      background: linear-gradient(135deg, #00ffc3 0%, #00c99a 100%) !important;
      border: none !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      box-shadow: 0 4px 20px rgba(0, 255, 195, 0.4) !important;
      transition: all 0.3s ease !important;
      position: relative !important;
    }
    .digimun-help-btn:hover {
      transform: scale(1.1) !important;
    }
    .digimun-help-btn svg {
      width: 28px !important;
      height: 28px !important;
      fill: #001a14 !important;
    }
    .digimun-help-btn.open {
      background: #ff4d6a !important;
    }
    .digimun-help-btn.open svg {
      fill: #fff !important;
    }
    .digimun-notif-badge {
      position: absolute !important;
      top: -2px !important;
      right: -2px !important;
      min-width: 18px !important;
      height: 18px !important;
      background: #ef4444 !important;
      border-radius: 9px !important;
      font-size: 10px !important;
      font-weight: 700 !important;
      color: #fff !important;
      display: none !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 0 5px !important;
      box-shadow: 0 2px 6px rgba(239, 68, 68, 0.5) !important;
      animation: digimun-badge-pulse 2s infinite !important;
    }
    .digimun-notif-badge.show {
      display: flex !important;
    }
    @keyframes digimun-badge-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    .digimun-help-link.my-tickets {
      background: rgba(100, 116, 139, 0.15) !important;
      border: 1px solid rgba(100, 116, 139, 0.3) !important;
      padding: 8px 12px !important;
      font-size: 12px !important;
      margin-top: 4px !important;
    }
    .digimun-help-link.my-tickets:hover {
      background: rgba(100, 116, 139, 0.25) !important;
    }
    .digimun-help-link.my-tickets .icon {
      font-size: 14px !important;
    }
    .digimun-help-link.my-tickets .unread-count {
      background: #ef4444 !important;
      color: #fff !important;
      font-size: 9px !important;
      font-weight: 700 !important;
      padding: 2px 5px !important;
      border-radius: 8px !important;
      margin-left: auto !important;
    }
    .digimun-help-link.whatsapp {
      background: rgba(37, 211, 102, 0.2) !important;
      border: 1px solid rgba(37, 211, 102, 0.5) !important;
    }
    .digimun-help-link.whatsapp:hover {
      background: rgba(37, 211, 102, 0.35) !important;
    }
    .digimun-help-popup {
      position: absolute !important;
      bottom: 70px !important;
      right: 0 !important;
      width: 280px !important;
      background: linear-gradient(180deg, #1a2332 0%, #0d1117 100%) !important;
      border: 1px solid rgba(0, 212, 170, 0.4) !important;
      border-radius: 16px !important;
      padding: 16px !important;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6) !important;
      opacity: 0 !important;
      visibility: hidden !important;
      transform: translateY(10px) !important;
      transition: all 0.25s ease !important;
    }
    .digimun-help-popup.show {
      opacity: 1 !important;
      visibility: visible !important;
      transform: translateY(0) !important;
    }
    .digimun-help-title {
      color: #fff !important;
      font-size: 15px !important;
      font-weight: 600 !important;
      text-align: center !important;
      margin-bottom: 12px !important;
      display: block !important;
    }
    .digimun-help-links {
      display: flex !important;
      flex-direction: column !important;
      gap: 10px !important;
    }
    .digimun-help-link {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      gap: 10px !important;
      padding: 12px 14px !important;
      border-radius: 10px !important;
      text-decoration: none !important;
      color: #fff !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      transition: all 0.2s ease !important;
    }
    .digimun-help-link.telegram {
      background: rgba(0, 136, 204, 0.2) !important;
      border: 1px solid rgba(0, 136, 204, 0.5) !important;
    }
    .digimun-help-link.telegram:hover {
      background: rgba(0, 136, 204, 0.35) !important;
    }
    .digimun-help-link.ticket {
      background: rgba(168, 85, 247, 0.2) !important;
      border: 1px solid rgba(168, 85, 247, 0.5) !important;
    }
    .digimun-help-link.ticket:hover {
      background: rgba(168, 85, 247, 0.35) !important;
    }
    .digimun-help-link.tutorial {
      background: rgba(255, 193, 7, 0.15) !important;
      border: 1px solid rgba(255, 193, 7, 0.4) !important;
      font-size: 12px !important;
      padding: 10px 12px !important;
    }
    .digimun-help-link.tutorial:hover {
      background: rgba(255, 193, 7, 0.25) !important;
    }
    .digimun-help-link.whatsapp-disabled {
      background: rgba(100, 100, 100, 0.15) !important;
      border: 1px solid rgba(100, 100, 100, 0.3) !important;
      cursor: not-allowed !important;
      opacity: 0.6 !important;
      pointer-events: none !important;
    }
    .digimun-help-link .icon {
      font-size: 20px !important;
      line-height: 1 !important;
      flex-shrink: 0 !important;
    }
    .digimun-help-link .text {
      flex: 1 !important;
      white-space: nowrap !important;
      line-height: 1.2 !important;
    }
    .digimun-help-divider {
      border: none !important;
      border-top: 1px solid rgba(255,255,255,0.1) !important;
      margin: 12px 0 !important;
    }
    .digimun-help-notice {
      font-size: 11px !important;
      color: #f59e0b !important;
      text-align: center !important;
      padding: 8px !important;
      background: rgba(245, 158, 11, 0.1) !important;
      border-radius: 8px !important;
      line-height: 1.4 !important;
    }
    @media (max-width: 480px) {
      .digimun-help-widget {
        bottom: 16px !important;
        right: 16px !important;
      }
      .digimun-help-btn {
        width: 50px !important;
        height: 50px !important;
      }
      .digimun-help-btn svg {
        width: 24px !important;
        height: 24px !important;
      }
      .digimun-help-popup {
        bottom: 62px !important;
        width: 260px !important;
        padding: 14px !important;
      }
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  const widget = document.createElement('div');
  widget.className = 'digimun-help-widget';
  widget.innerHTML = `
    <div class="digimun-help-popup" id="digimun-popup">
      <span class="digimun-help-title">Need Help?</span>
      <div class="digimun-help-links">
        <a href="${TELEGRAM_LINK}" target="_blank" rel="noopener" class="digimun-help-link telegram">
          <span class="icon">📨</span>
          <span class="text">Chat on Telegram</span>
        </a>
        <a href="https://wa.me/447846665413?text=Hi, I need help regarding Digimun." target="_blank" rel="noopener" class="digimun-help-link whatsapp">
          <span class="icon">💬</span>
          <span class="text">Chat on WhatsApp</span>
        </a>
        <a href="/help" class="digimun-help-link ticket">
          <span class="icon">🎫</span>
          <span class="text">Create Support Ticket</span>
        </a>
        <a href="/my-tickets" class="digimun-help-link my-tickets" id="digimun-my-tickets" style="display:none;">
          <span class="icon">📋</span>
          <span class="text">My Tickets</span>
          <span class="unread-count" id="digimun-unread-count" style="display:none;">0</span>
        </a>
      </div>
    </div>
    <button class="digimun-help-btn" id="digimun-btn" aria-label="Need help?">
      <span class="digimun-notif-badge" id="digimun-badge">0</span>
      <svg viewBox="0 0 24 24" id="digimun-icon-q">
        <path d="M11.95 18q.525 0 .888-.363t.362-.887q0-.525-.362-.888t-.888-.362q-.525 0-.887.363t-.363.887q0 .525.363.888t.887.362Zm-.9-3.85h1.85q0-.825.188-1.3t1.062-1.3q.65-.65 1.025-1.238t.375-1.412q0-1.4-1.025-2.15T12 6q-1.425 0-2.313.75T8.55 8.55l1.65.65q.125-.45.563-.975T12 7.7q.675 0 1.038.338t.362.862q0 .5-.3.938t-.75.812q-1.1.975-1.35 1.475t-.25 1.025ZM12 22q-2.075 0-3.9-.787t-3.175-2.138q-1.35-1.35-2.137-3.175T2 12q0-2.075.788-3.9t2.137-3.175q1.35-1.35 3.175-2.137T12 2q2.075 0 3.9.788t3.175 2.137q1.35 1.35 2.138 3.175T22 12q0 2.075-.788 3.9t-2.137 3.175q-1.35 1.35-3.175 2.138T12 22Z"/>
      </svg>
      <svg viewBox="0 0 24 24" id="digimun-icon-x" style="display:none;">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>
  `;
  document.body.appendChild(widget);

  const btn = document.getElementById('digimun-btn');
  const popup = document.getElementById('digimun-popup');
  const iconQ = document.getElementById('digimun-icon-q');
  const iconX = document.getElementById('digimun-icon-x');
  let open = false;

  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    open = !open;
    popup.classList.toggle('show', open);
    btn.classList.toggle('open', open);
    iconQ.style.display = open ? 'none' : 'block';
    iconX.style.display = open ? 'block' : 'none';
  });

  document.addEventListener('click', function(e) {
    if (open && !widget.contains(e.target)) {
      open = false;
      popup.classList.remove('show');
      btn.classList.remove('open');
      iconQ.style.display = 'block';
      iconX.style.display = 'none';
    }
  });

  const badge = document.getElementById('digimun-badge');
  const myTicketsLink = document.getElementById('digimun-my-tickets');
  const unreadCountSpan = document.getElementById('digimun-unread-count');

  async function checkUnreadReplies() {
    try {
      const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
      const { getFirestore, collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

      const firebaseConfig = {
        apiKey: "AIzaSyACACrfmp0EpnsuVClv57VmDz5uMQ39qdM",
        authDomain: "digimun-49.firebaseapp.com",
        projectId: "digimun-49",
        storageBucket: "digimun-49.firebasestorage.app",
        messagingSenderId: "624588089371",
        appId: "1:624588089371:web:3d932c99fef512213c70be"
      };

      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      const auth = getAuth(app);
      const db = getFirestore(app);

      onAuthStateChanged(auth, async (user) => {
        if (user) {
          myTicketsLink.style.display = 'flex';
          
          try {
            const ticketsRef = collection(db, 'tickets');
            const q = query(ticketsRef, where('email', '==', user.email));
            const snapshot = await getDocs(q);
            
            let unreadCount = 0;
            const seenReplies = JSON.parse(localStorage.getItem('digimun_seen_replies') || '{}');
            
            snapshot.forEach(doc => {
              const data = doc.data();
              const replies = data.replies || [];
              const adminReplies = replies.filter(r => r.from === 'admin');
              
              if (adminReplies.length > 0) {
                const lastAdminReply = adminReplies[adminReplies.length - 1];
                const lastSeenTime = seenReplies[doc.id] || 0;
                const replyTime = lastAdminReply.createdAt?.toMillis?.() || lastAdminReply.createdAt || 0;
                
                if (replyTime > lastSeenTime) {
                  unreadCount++;
                }
              }
            });
            
            if (unreadCount > 0) {
              badge.textContent = unreadCount;
              badge.classList.add('show');
              unreadCountSpan.textContent = unreadCount;
              unreadCountSpan.style.display = 'inline';
            } else {
              badge.classList.remove('show');
              unreadCountSpan.style.display = 'none';
            }
          } catch (err) {
            console.log('Could not check unread replies:', err);
          }
        } else {
          myTicketsLink.style.display = 'none';
          badge.classList.remove('show');
        }
      });
    } catch (err) {
      console.log('Firebase not available for help widget');
    }
  }

  checkUnreadReplies();
})();
