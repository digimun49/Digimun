/* Digimun Help Widget (Telegram-first, WhatsApp retired) */

/* ===== Config ===== */
const TELEGRAM_HANDLE = "digimun49"; // t.me/<handle>
const TUTORIAL_URL = "https://youtu.be/mROinTjkVGY?si=NoYDHPomDYN-5Q3r";
const WHATSAPP_CHANNEL_URL = ""; // WhatsApp removed

document.addEventListener("DOMContentLoaded", () => {
  /* ===== UI: container + popover + modal ===== */
  const helpContainer = document.createElement("div");
  helpContainer.id = "help-container";
  helpContainer.innerHTML = `
    <button id="help-button" aria-expanded="false" aria-controls="help-options">💬 Need Help?</button>

    <div id="help-options" class="hidden" role="menu" aria-label="Help options">
      <a id="telegram-link" role="menuitem" target="_blank">📨 Contact on Telegram</a>
      <button id="whatsapp-retired" role="menuitem" class="linkish danger">⚠️ WhatsApp (retired)</button>
    </div>

    <div id="help-modal" class="modal hidden" aria-hidden="true" aria-modal="true" role="dialog">
      <div class="modal-card" role="document">
        <button class="modal-close" aria-label="Close">×</button>
        <h3 class="modal-title">We’ve moved support to Telegram.</h3>
        <p class="muted">WhatsApp support is discontinued. Please contact us on Telegram for faster responses.</p>

        <div class="modal-actions">
          <a id="tg-open-app" class="btn primary" target="_blank" rel="noopener">Open Telegram App</a>
          <a id="tg-open-web" class="btn" target="_blank" rel="noopener">Open in Browser</a>
          <a id="watch-tutorial" class="btn" target="_blank" rel="noopener">How to use Telegram (Video)</a>
          <a id="wa-channel" class="btn ghost" target="_blank" rel="noopener" style="display:none">Follow WhatsApp Channel</a>
        </div>

        <p class="tiny">Tip: If you don’t have Telegram installed, choose “Open in Browser”.</p>
      </div>
    </div>
  `;
  document.body.appendChild(helpContainer);

  /* ===== CSS ===== */
  const style = document.createElement("style");
  style.textContent = `
    :root { --accent:#00ffc3; --ink:#eaf4ff; --muted:#9bb0cc; --danger:#ff6b6b; --surface:#0b1324; --stroke:#16304e; }
    #help-container{position:fixed;bottom:20px;right:20px;text-align:right;z-index:9999;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial}

    /* Help button */
    #help-button{
      background:var(--accent);color:#000;border:none;padding:9px 12px;font-weight:700;
      font-size:12px;border-radius:10px;cursor:pointer;box-shadow:0 0 12px var(--accent);
      transition:transform .15s ease, box-shadow .2s ease;
    }
    #help-button:hover{box-shadow:0 0 18px var(--accent)}
    #help-button:active{transform:scale(.98)}

    /* Popover */
    #help-options{display:none;margin-top:8px}
    #help-options a, #help-options button.linkish{
      display:block;margin-top:6px;padding:9px 14px;background:#101827;color:var(--accent);
      border-radius:20px;text-decoration:none;font-size:12px;border:none;cursor:pointer;text-align:right;
      outline:none;
    }
    #help-options a:hover, #help-options button.linkish:hover{background:var(--accent);color:#000}
    #help-options button.linkish.danger{color:var(--danger)}
    #help-options button.linkish.danger:hover{background:var(--danger);color:#000}
    .hidden{display:none}
    .visible{display:block !important}

    /* Modal */
    .modal{position:fixed;inset:0;background:rgba(2,6,23,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
           display:flex;align-items:center;justify-content:center;padding:16px}
    .modal.hidden{display:none !important;}

    .modal-card{
      position:relative;width:min(460px,92vw);background:var(--surface);color:var(--ink);
      border:1px solid var(--stroke); border-radius:18px; padding:22px 22px 18px 22px;
      box-shadow:0 24px 60px rgba(0,0,0,.45);
    }

    .modal-close{
      position:absolute;top:10px;right:10px;background:#0f172a;border:1px solid #223a63;
      border-radius:999px;color:var(--muted);width:28px;height:28px;cursor:pointer;line-height:26px;text-align:center;
    }

    .modal-title{
      margin:0 0 8px; font-size:20px; font-weight:800; letter-spacing:.2px; line-height:1.3;
      padding-right:34px; /* prevents overlap with close button */
      word-break:normal; overflow-wrap:anywhere;
    }

    .muted{color:var(--muted);margin:0 0 14px;font-size:13px;line-height:1.5}

    .modal-actions{display:grid;gap:10px;margin-top:6px}
    .btn{display:block;text-align:center;padding:12px 14px;border-radius:14px;text-decoration:none;border:1px solid #2a3f5e}
    .btn.primary{background:var(--accent);color:#000;border-color:transparent;font-weight:800}
    .btn.ghost{background:#0e1a33;color:var(--ink)}
    .btn:hover{transform:translateY(-1px)}
    .tiny{color:var(--muted);font-size:11px;margin-top:10px}
  `;
  document.head.appendChild(style);

  /* ===== Helpers ===== */
  const qs = (s) => document.querySelector(s);
  const buildTelegramLinks = () => {
    const web = `https://t.me/${TELEGRAM_HANDLE}`;
    const app = `tg://resolve?domain=${encodeURIComponent(TELEGRAM_HANDLE)}`;
    return { web, app };
  };

  /* ===== Popover toggle ===== */
  qs("#help-button").addEventListener("click", () => {
    const opts = qs("#help-options");
    const expanded = opts.classList.toggle("visible");
    opts.classList.toggle("hidden", !expanded);
    qs("#help-button").setAttribute("aria-expanded", expanded ? "true" : "false");
    qs("#telegram-link").href = buildTelegramLinks().web;
  });

  /* ===== Open modal ONLY via WhatsApp (retired) ===== */
  qs("#whatsapp-retired").addEventListener("click", openModal);

  function openModal() {
    const modal = qs("#help-modal");
    const { app, web } = buildTelegramLinks();
    qs("#tg-open-app").href = app;
    qs("#tg-open-web").href = web;
    qs("#watch-tutorial").href = TUTORIAL_URL;

    const waBtn = qs("#wa-channel");
    if (WHATSAPP_CHANNEL_URL && WHATSAPP_CHANNEL_URL.trim() !== "") {
      waBtn.href = WHATSAPP_CHANNEL_URL;
      waBtn.style.display = "block";
    } else {
      waBtn.style.display = "none";
    }

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    const modal = qs("#help-modal");
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  qs(".modal-close").addEventListener("click", closeModal);
  qs("#help-modal").addEventListener("click", (e) => { if (e.target.id === "help-modal") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  /* Collapse popover on outside click */
  document.addEventListener("click", (e) => {
    const c = qs("#help-container"), opts = qs("#help-options");
    if (!c.contains(e.target) && opts.classList.contains("visible")) {
      opts.classList.remove("visible");
      opts.classList.add("hidden");
      qs("#help-button").setAttribute("aria-expanded","false");
    }
  });
});
