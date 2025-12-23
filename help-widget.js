(function() {
  const WHATSAPP_LINK = 'https://wa.me/923004671280?text=Hi%2C%20I%20need%20help%20with%20Digimun';
  const TELEGRAM_LINK = 'https://t.me/digimun49?text=Hi%2C%20I%20need%20help%20with%20Digimun';

  const styles = `
    .help-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
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
      position: fixed;
      bottom: 90px;
      right: 24px;
      background: linear-gradient(180deg, #1a2332 0%, #0d1117 100%);
      border: 1px solid rgba(0, 212, 170, 0.3);
      border-radius: 16px;
      padding: 20px;
      width: 280px;
      max-width: calc(100vw - 48px);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
      opacity: 0;
      visibility: hidden;
      transform: translateY(10px) scale(0.95);
      transition: all 0.3s ease;
      box-sizing: border-box;
    }
    .help-popup.active {
      opacity: 1;
      visibility: visible;
      transform: translateY(0) scale(1);
    }
    .help-popup-title {
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 16px 0;
      padding: 0;
      text-align: center;
      line-height: 1.4;
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
      padding: 14px 16px;
      border-radius: 12px;
      text-decoration: none;
      transition: all 0.2s ease;
      color: #fff;
      font-size: 14px;
      font-weight: 500;
      box-sizing: border-box;
    }
    .help-link-whatsapp {
      background: linear-gradient(135deg, rgba(37, 211, 102, 0.2) 0%, rgba(18, 140, 126, 0.15) 100%);
      border: 1px solid rgba(37, 211, 102, 0.4);
    }
    .help-link-whatsapp:hover {
      background: linear-gradient(135deg, rgba(37, 211, 102, 0.35) 0%, rgba(18, 140, 126, 0.25) 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3);
    }
    .help-link-telegram {
      background: linear-gradient(135deg, rgba(0, 136, 204, 0.2) 0%, rgba(0, 100, 180, 0.15) 100%);
      border: 1px solid rgba(0, 136, 204, 0.4);
    }
    .help-link-telegram:hover {
      background: linear-gradient(135deg, rgba(0, 136, 204, 0.35) 0%, rgba(0, 100, 180, 0.25) 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 136, 204, 0.3);
    }
    .help-link-icon {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      flex-shrink: 0;
    }
    .help-link-text {
      flex: 1;
      white-space: nowrap;
    }
    @media (max-width: 480px) {
      .help-fab {
        bottom: 16px;
        right: 16px;
      }
      .help-fab-btn {
        width: 52px;
        height: 52px;
      }
      .help-fab-btn svg {
        width: 26px;
        height: 26px;
      }
      .help-popup {
        bottom: 80px;
        right: 16px;
        width: 260px;
        padding: 16px;
      }
      .help-popup-title {
        font-size: 15px;
        margin-bottom: 14px;
      }
      .help-link {
        padding: 12px 14px;
        font-size: 13px;
      }
      .help-link-icon {
        width: 24px;
        height: 24px;
        font-size: 20px;
      }
    }
    @media (max-width: 360px) {
      .help-popup {
        width: calc(100vw - 32px);
        right: 16px;
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
        <a href="${TELEGRAM_LINK}" target="_blank" rel="noopener" class="help-link help-link-telegram">
          <span class="help-link-icon">📨</span>
          <span class="help-link-text">Chat on Telegram</span>
        </a>
        <a href="${WHATSAPP_LINK}" target="_blank" rel="noopener" class="help-link help-link-whatsapp">
          <span class="help-link-icon">💬</span>
          <span class="help-link-text">Chat on WhatsApp</span>
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
