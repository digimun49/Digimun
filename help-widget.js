(function() {
  const WHATSAPP_LINK = 'https://wa.me/447846665413';
  const TELEGRAM_LINK = 'https://t.me/digimun49';

  const styles = `
    .help-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .help-fab-btn {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #00ffc3 0%, #00c99a 100%);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0, 255, 195, 0.4);
      transition: all 0.3s ease;
    }
    .help-fab-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 28px rgba(0, 255, 195, 0.5);
    }
    .help-fab-btn svg {
      width: 28px;
      height: 28px;
      fill: #001a14;
    }
    .help-fab-btn.active {
      background: #ff4d6a;
    }
    .help-fab-btn.active svg {
      fill: #fff;
    }
    .help-popup {
      position: absolute;
      bottom: 70px;
      right: 0;
      background: linear-gradient(180deg, #141c2b 0%, #0a0e17 100%);
      border: 1px solid rgba(0, 255, 195, 0.3);
      border-radius: 16px;
      padding: 20px;
      min-width: 240px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
      opacity: 0;
      visibility: hidden;
      transform: translateY(10px);
      transition: all 0.3s ease;
    }
    .help-popup.active {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
    .help-popup-title {
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      text-align: center;
    }
    .help-popup-links {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .help-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 12px;
      text-decoration: none;
      transition: all 0.2s ease;
      color: #fff;
      font-size: 14px;
      font-weight: 500;
    }
    .help-link-whatsapp {
      background: rgba(37, 211, 102, 0.15);
      border: 1px solid rgba(37, 211, 102, 0.3);
    }
    .help-link-whatsapp:hover {
      background: rgba(37, 211, 102, 0.25);
      transform: translateX(4px);
    }
    .help-link-telegram {
      background: rgba(0, 136, 204, 0.15);
      border: 1px solid rgba(0, 136, 204, 0.3);
    }
    .help-link-telegram:hover {
      background: rgba(0, 136, 204, 0.25);
      transform: translateX(4px);
    }
    .help-link img {
      width: 24px;
      height: 24px;
      object-fit: contain;
    }
    @media (max-width: 480px) {
      .help-fab {
        bottom: 16px;
        right: 16px;
      }
      .help-fab-btn {
        width: 50px;
        height: 50px;
      }
      .help-popup {
        right: -8px;
        min-width: 220px;
      }
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  const widget = document.createElement('div');
  widget.className = 'help-fab';
  widget.innerHTML = `
    <div class="help-popup" id="help-popup">
      <div class="help-popup-title">Need Help?</div>
      <div class="help-popup-links">
        <a href="${WHATSAPP_LINK}" target="_blank" class="help-link help-link-whatsapp">
          <img src="assets/whatsapp.png" alt="WhatsApp" onerror="this.outerHTML='<span style=\\'font-size:24px\\'>💬</span>'">
          <span>Chat on WhatsApp</span>
        </a>
        <a href="${TELEGRAM_LINK}" target="_blank" class="help-link help-link-telegram">
          <img src="assets/telegram.png" alt="Telegram" onerror="this.outerHTML='<span style=\\'font-size:24px\\'>✈️</span>'">
          <span>Message on Telegram</span>
        </a>
      </div>
    </div>
    <button class="help-fab-btn" id="help-fab-btn" aria-label="Need help?">
      <svg viewBox="0 0 24 24" id="help-icon-question">
        <path d="M11.95 18q.525 0 .888-.363t.362-.887q0-.525-.362-.888t-.888-.362q-.525 0-.887.363t-.363.887q0 .525.363.888t.887.362Zm-.9-3.85h1.85q0-.825.188-1.3t1.062-1.3q.65-.65 1.025-1.238t.375-1.412q0-1.4-1.025-2.15T12 6q-1.425 0-2.313.75T8.55 8.55l1.65.65q.125-.45.563-.975T12 7.7q.675 0 1.038.338t.362.862q0 .5-.3.938t-.75.812q-1.1.975-1.35 1.475t-.25 1.025ZM12 22q-2.075 0-3.9-.787t-3.175-2.138q-1.35-1.35-2.137-3.175T2 12q0-2.075.788-3.9t2.137-3.175q1.35-1.35 3.175-2.137T12 2q2.075 0 3.9.788t3.175 2.137q1.35 1.35 2.138 3.175T22 12q0 2.075-.788 3.9t-2.137 3.175q-1.35 1.35-3.175 2.138T12 22Z"/>
      </svg>
      <svg viewBox="0 0 24 24" id="help-icon-close" style="display:none;">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>
  `;
  document.body.appendChild(widget);

  const fabBtn = document.getElementById('help-fab-btn');
  const popup = document.getElementById('help-popup');
  const iconQuestion = document.getElementById('help-icon-question');
  const iconClose = document.getElementById('help-icon-close');
  let isOpen = false;

  fabBtn.addEventListener('click', () => {
    isOpen = !isOpen;
    popup.classList.toggle('active', isOpen);
    fabBtn.classList.toggle('active', isOpen);
    iconQuestion.style.display = isOpen ? 'none' : 'block';
    iconClose.style.display = isOpen ? 'block' : 'none';
  });

  document.addEventListener('click', (e) => {
    if (!widget.contains(e.target) && isOpen) {
      isOpen = false;
      popup.classList.remove('active');
      fabBtn.classList.remove('active');
      iconQuestion.style.display = 'block';
      iconClose.style.display = 'none';
    }
  });
})();
