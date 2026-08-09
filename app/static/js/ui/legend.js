// ui/legend.js
// Linha de legenda abaixo do grafico: swatch + nome da chave + ultimo valor.

import { esc } from "../lib/dom.js";
import { metricColor } from "../lib/colors.js";
import { metricValue, formatValue } from "../lib/metrics.js";

// Ultimo valor numerico (mais recente) de uma metrica nos ingests filtrados.
function latestValue(state, key) {
  let bestT = -Infinity;
  let bestV = null;
  for (const ing of state.ingests) {
    const v = metricValue(ing, key);
    if (v == null) continue;
    const t = Date.parse(ing.created_at);
    if (t > bestT) {
      bestT = t;
      bestV = v;
    }
  }
  return bestV;
}

export function renderLegend(root, state) {
  if (!state.selectedMetrics.length) {
    root.innerHTML = "";
    return;
  }
  const items = state.selectedMetrics
    .map((key) => {
      const color = metricColor(key, state.detectedMetrics);
      const val = formatValue(latestValue(state, key));
      return `
        <div class="iot-legend-item">
          <span class="iot-legend-swatch" style="background:${color}"></span>
          <span class="iot-legend-key">${esc(key)}</span>
          <span class="iot-legend-val">${esc(val)}</span>
        </div>`;
    })
    .join("");
  root.innerHTML = `<div class="iot-legend">${items}</div>`;
}
