/**
 * Registro de PWA y botón de instalación en pantalla de inicio
 * Hecho por xzerox99
 */

(function () {
  // Registrar Service Worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch((err) => {
        // En file:// los navegadores no permiten registrar service workers, solo en http/https
        console.debug("Service Worker no registrado (normal en file://):", err);
      });
    });
  }

  // Capturar evento de instalación de PWA en móviles
  let deferredPrompt;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Si existe botón de instalación en la UI, mostrarlo
    const installBtn = document.getElementById("pwaInstallBtn");
    if (installBtn) {
      installBtn.classList.remove("d-none");
      installBtn.addEventListener("click", async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          installBtn.classList.add("d-none");
        }
        deferredPrompt = null;
      });
    }
  });
})();

