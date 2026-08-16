(() => {
  "use strict";

  const gate = document.querySelector("#simulationGate");
  const site = document.querySelector("#siteContent");
  const accept = document.querySelector("#acceptSimulation");
  const showNotice = document.querySelector("#showSimulationNotice");
  const toast = document.querySelector("#toast");

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function showGate() {
    gate.hidden = false;
    site.hidden = true;
    document.body.classList.add("simulation-locked");
  }

  function enterSimulation() {
    gate.hidden = true;
    site.hidden = false;
    document.body.classList.remove("simulation-locked");
    sessionStorage.setItem("raiz_viva_simulation_ack", "1");
    window.scrollTo({ top: 0, behavior: "instant" });
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
          title: "Instituto Raiz Viva — Simulação Acadêmica",
          text: "Simulação acadêmica de mídia própria para uma atividade universitária.",
          url
        });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    await copyLink();
  }

  accept?.addEventListener("click", enterSimulation);
  showNotice?.addEventListener("click", showGate);

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-copy]")) {
      copyLink();
      return;
    }

    if (event.target.closest("[data-share]")) {
      share();
      return;
    }

    if (event.target.closest("[data-demo-donation]")) {
      showToast("Simulação acadêmica: nenhuma cobrança é realizada.");
    }
  });

  // A cada nova sessão/aba, o aviso volta a aparecer.
  if (sessionStorage.getItem("raiz_viva_simulation_ack") === "1") {
    enterSimulation();
  } else {
    showGate();
  }
})();