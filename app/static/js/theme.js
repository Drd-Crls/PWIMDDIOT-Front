// theme.js
// Alterna claro/escuro. O tema inicial NAO e decidido aqui: o atributo
// data-theme no <html> ja vem do servidor ("dark", o padrao) e o script inline
// do base.html corrige para o valor salvo antes do primeiro paint. Este arquivo
// so cuida do clique e de manter o rotulo do botao coerente.
//
// Script classico (nao e ES module) de proposito: roda em toda pagina, inclusive
// no login, sem depender do grafo de modulos do painel.

(function () {
  const STORAGE_KEY = "theme";
  const root = document.documentElement;

  const current = () => (root.getAttribute("data-theme") === "light" ? "light" : "dark");

  // O botao anuncia o destino, nao o estado atual.
  function syncButtons(theme) {
    const label = theme === "light" ? "Mudar para tema escuro" : "Mudar para tema claro";
    document.querySelectorAll(".theme-toggle").forEach((btn) => {
      btn.setAttribute("aria-label", label);
      btn.setAttribute("title", label);
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    });
  }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      // Sem persistencia (modo privado): a troca vale so para esta pagina.
    }
    syncButtons(theme);
  }

  document.querySelectorAll(".theme-toggle").forEach((btn) => {
    btn.addEventListener("click", () => apply(current() === "light" ? "dark" : "light"));
  });

  // Se o script inline aplicou um tema salvo diferente do padrao do markup, os
  // rotulos ainda estao no estado errado.
  syncButtons(current());

  // Duas abas abertas: refletir a troca feita na outra.
  window.addEventListener("storage", (ev) => {
    if (ev.key !== STORAGE_KEY) return;
    if (ev.newValue !== "light" && ev.newValue !== "dark") return;
    root.setAttribute("data-theme", ev.newValue);
    syncButtons(ev.newValue);
  });
})();
