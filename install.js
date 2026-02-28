let deferredPrompt;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;

  const installBtn = document.getElementById("install-btn");
  if (installBtn) installBtn.style.display = "block";

  installBtn.addEventListener("click", async () => {
    installBtn.disabled = true;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
    } else {
    }

    deferredPrompt = null;
  });
});