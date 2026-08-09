// ui/rangeFilter.js
// Card de intervalo: dois <input type="date">, presets e teto de 1 semana.

import { esc } from "../lib/dom.js";
import { PRESETS, diffDaysYmd } from "../state.js";

export function renderRangeFilter(root, state, { onSetRange, onPreset }) {
  const { from, to } = state.range;
  const span = from && to ? diffDaysYmd(from, to) : null;

  const presetsHtml = PRESETS.map((p) => {
    const active = span === p.days - 1;
    return `<button type="button" class="iot-preset${active ? " is-active" : ""}"
              data-days="${p.days}">${esc(p.label)}</button>`;
  }).join("");

  root.innerHTML = `
    <div class="iot-card iot-range-card">
      <span class="iot-control-label">RANGE</span>
      <div class="iot-range-inputs">
        <input type="date" class="iot-date" data-which="from" value="${esc(from || "")}">
        <span class="iot-arrow">→</span>
        <input type="date" class="iot-date" data-which="to" value="${esc(to || "")}">
      </div>
      <div class="iot-presets">${presetsHtml}</div>
      <span class="iot-range-hint">Max 1 semana</span>
    </div>
  `;

  root.querySelectorAll(".iot-date").forEach((input) => {
    input.addEventListener("change", () => {
      const which = input.dataset.which;
      const value = input.value;
      if (!value) return;
      const next =
        which === "from"
          ? { from: value, to: state.range.to }
          : { from: state.range.from, to: value };
      onSetRange(next.from, next.to, which);
    });
  });

  root.querySelectorAll(".iot-preset").forEach((btn) => {
    btn.addEventListener("click", () => onPreset(Number(btn.dataset.days)));
  });
}
