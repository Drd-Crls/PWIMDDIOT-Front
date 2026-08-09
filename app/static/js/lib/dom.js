// lib/dom.js — utilitarios minimos de DOM/escape.

/** Escapa texto para interpolacao segura em innerHTML. */
export function esc(v) {
  if (v == null) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escapa para uso dentro de atributos SVG/HTML (mesma base). */
export const escAttr = esc;
