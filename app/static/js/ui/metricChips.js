// ui/metricChips.js
// Card de metricas: chip "All", um chip por chave numerica detectada e o toggle
// "Normalize". As cores dos chips vem da ordem de deteccao (metricColor).

import { esc } from "../lib/dom.js";
import { metricColor } from "../lib/colors.js";

export function renderMetricChips(root, state, { onToggleMetric, onToggleAll, onToggleNormalize }) {
  const detected = state.detectedMetrics;
  const selected = new Set(state.selectedMetrics);
  const allActive = detected.length > 0 && selected.size === detected.length;

  const chipsHtml = detected
    .map((key) => {
      const active = selected.has(key);
      const color = metricColor(key, detected);
      const style = active ? `background:${color};border-color:${color};color:#fff;` : "";
      const dotStyle = active ? "background:#fff;" : `background:${color};`;
      return `<button type="button" class="iot-chip${active ? " is-active" : ""}"
                data-metric="${esc(key)}" style="${style}">
                <span class="iot-chip-dot" style="${dotStyle}"></span>${esc(key)}
              </button>`;
    })
    .join("");

  const normalizeTitle = state.selectedMetrics.length < 2
    ? "Mais util com 2+ metricas"
    : "Reescala cada serie para 0-100%";

  root.innerHTML = `
    <div class="iot-card iot-metrics-card">
      <span class="iot-control-label">METRICS</span>
      <button type="button" class="iot-chip iot-chip-all${allActive ? " is-active" : ""}"
              data-all="1">All</button>
      <div class="iot-chip-list">${chipsHtml || '<span class="iot-muted">Nenhuma metrica numerica</span>'}</div>
      <button type="button" class="iot-normalize${state.normalize ? " is-active" : ""}"
              data-normalize="1" title="${esc(normalizeTitle)}">
        <span class="iot-switch"><span class="iot-switch-knob"></span></span>
        Normalize
      </button>
    </div>
  `;

  root.querySelectorAll(".iot-chip[data-metric]").forEach((btn) => {
    btn.addEventListener("click", () => onToggleMetric(btn.dataset.metric));
  });
  const allBtn = root.querySelector("[data-all]");
  if (allBtn) allBtn.addEventListener("click", () => onToggleAll());
  const normBtn = root.querySelector("[data-normalize]");
  if (normBtn) normBtn.addEventListener("click", () => onToggleNormalize());
}
