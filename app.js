(() => {
  "use strict";

  const toast = document.querySelector("#toast");

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  async function copyLink() {
    const url = location.href.split("#")[0];
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copiado.");
    } catch {
      window.prompt("Copie o link:", url);
    }
  }

  async function share() {
    const url = location.href.split("#")[0];

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Instituto Raiz Viva",
          text: "Conheça esta simulação de mídia própria para uma campanha ambiental.",
          url
        });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    await copyLink();
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-copy]")) {
      copyLink();
      return;
    }

    if (event.target.closest("[data-share]")) {
      share();
      return;
    }

    const donation = event.target.closest("[data-demo-donation]");
    if (donation) {
      showToast("Demonstração acadêmica: nenhuma cobrança é realizada.");
    }
  });
})();