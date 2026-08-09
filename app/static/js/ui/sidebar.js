// ui/sidebar.js
// Linhas de device (single-select) + checkboxes de sensores (multi-select).

import { esc } from "../lib/dom.js";
import { STATUS_COLORS } from "../lib/colors.js";
import { detectMetrics } from "../lib/metrics.js";

function statusColor(status) {
  return STATUS_COLORS[status] || STATUS_COLORS.INACTIVE;
}

// Chaves numericas expostas por um sensor (para o sublabel). Como o sensor em si
// nao declara isso, inferimos a partir dos ingests carregados desse sensor.
function sensorMetricKeys(state, sensorId) {
  const rows = state.ingests.filter((i) => i.sensor_id === sensorId);
  return detectMetrics(rows);
}

export function renderSidebar(root, state, { onSelectDevice, onToggleSensor }) {
  const devicesHtml = state.devices
    .map((d) => {
      const active = d.id === state.activeDeviceId;
      const sensorsHtml = active ? renderSensors(state, onToggleSensor) : "";
      return `
        <div class="iot-device-block">
          <button type="button" class="iot-device-row${active ? " is-active" : ""}"
                  data-device-id="${esc(d.id)}">
            <span class="iot-dot" style="background:${statusColor(d.status)}"></span>
            <span class="iot-device-meta">
              <span class="iot-device-name">${esc(d.name)}</span>
              <span class="iot-device-model">${esc(d.model)}</span>
            </span>
          </button>
          ${sensorsHtml}
        </div>`;
    })
    .join("");

  root.innerHTML = `
    <div class="iot-sidebar-head">
      <div class="iot-eyebrow">IOT MONITORING</div>
      <div class="iot-fleet">Fleet</div>
    </div>
    <div class="iot-section-label">DEVICES</div>
    <div class="iot-device-list">${devicesHtml || '<div class="iot-empty-mini">Sem devices</div>'}</div>
  `;

  root.querySelectorAll(".iot-device-row").forEach((btn) => {
    btn.addEventListener("click", () => onSelectDevice(btn.dataset.deviceId));
  });
  root.querySelectorAll(".iot-sensor-row").forEach((row) => {
    row.addEventListener("click", () => onToggleSensor(row.dataset.sensorId));
  });
}

function renderSensors(state, _onToggleSensor) {
  if (!state.sensors.length) {
    return '<div class="iot-sensor-list"><div class="iot-empty-mini">Sem sensores</div></div>';
  }
  const selected = new Set(state.selectedSensorIds);
  const rows = state.sensors
    .map((s) => {
      const checked = selected.has(s.id);
      const keys = sensorMetricKeys(state, s.id);
      const sub = keys.length ? keys.join(" · ") : "—";
      return `
        <div class="iot-sensor-row${checked ? " is-checked" : ""}" data-sensor-id="${esc(s.id)}"
             role="checkbox" aria-checked="${checked}" tabindex="0">
          <span class="iot-checkbox${checked ? " is-checked" : ""}">${checked ? "✓" : ""}</span>
          <span class="iot-sensor-meta">
            <span class="iot-sensor-name">${esc(s.name)}</span>
            <span class="iot-sensor-keys">${esc(sub)}</span>
          </span>
        </div>`;
    })
    .join("");
  return `<div class="iot-sensor-list">${rows}</div>`;
}
