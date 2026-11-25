// main.js — entrada: inicializa, conecta eventos e roda o pipeline de render.
// (Substitui o componente App do React.)
//
// Pipeline unico: qualquer mudanca muta `state` e roda os renderX() abaixo.
// Mudancas que alteram os dados (device/sensor/intervalo) refazem o fetch;
// mudancas so de visualizacao (metrica/normalize) redesenham sem refetch.

import { esc } from "./lib/dom.js";
import * as api from "./api.js";
import {
  state,
  defaultRange,
  presetRange,
  clampRange,
  recomputeMetrics,
  latestIngestYmd,
  todayYmd,
} from "./state.js";
import { renderSidebar } from "./ui/sidebar.js";
import { renderRangeFilter } from "./ui/rangeFilter.js";
import { renderMetricChips } from "./ui/metricChips.js";
import { renderLineChart } from "./ui/lineChart.js";
import { renderLegend } from "./ui/legend.js";

// Referencias dos containers (definidos no template).
const els = {};

// Contador para descartar respostas de fetch obsoletas (race em cliques rapidos).
let reqSeq = 0;

// ---- Render ----------------------------------------------------------------

function renderHeader() {
  const device = state.devices.find((d) => d.id === state.activeDeviceId);
  if (!device) {
    els.header.innerHTML = `
      <div class="iot-header-main">
        <h1 class="iot-title">Monitoramento de ingestao</h1>
        <div class="iot-subline">Selecione um device na barra lateral</div>
      </div>`;
    return;
  }
  const loc = device.location || "Sem localizacao";
  const nSel = state.selectedSensorIds.length;
  const nTot = state.sensors.length;
  els.header.innerHTML = `
    <div class="iot-header-main">
      <h1 class="iot-title">${esc(device.name)}</h1>
      <div class="iot-subline">${esc(loc)} · ${nSel} de ${nTot} sensores</div>
    </div>
    <div class="iot-header-meta">${state.ingests.length} ingests · ${state.detectedMetrics.length} metricas numericas</div>`;
}

function renderFilters() {
  renderSidebar(els.sidebar, state, { onSelectDevice, onToggleSensor });
  renderRangeFilter(els.range, state, { onSetRange, onPreset });
}

function renderViz() {
  renderHeader();
  renderMetricChips(els.metrics, state, {
    onToggleMetric,
    onToggleAll,
    onToggleNormalize,
  });
  if (state.error) {
    els.chart.innerHTML =
      `<div class="iot-card iot-chart-card"><div class="iot-chart-error">` +
      `<strong>Nao foi possivel carregar os dados.</strong>` +
      `<span>${esc(state.error)}</span></div></div>`;
    els.legend.innerHTML = "";
    return;
  }
  renderLineChart(els.chart, state);
  renderLegend(els.legend, state);
}

function renderAll() {
  renderFilters();
  renderViz();
}

// O grafico e desenhado com a largura medida do container (o viewBox casa 1:1
// com pixels), entao redimensionar a janela exige redesenhar. Reage so a
// mudanca de LARGURA: o proprio redesenho altera a ALTURA do container, o que
// realimentaria o observer num laco.
function observeChartWidth() {
  if (typeof ResizeObserver === "undefined") return;
  let lastW = Math.round(els.chart.clientWidth);
  let raf = 0;
  const ro = new ResizeObserver((entries) => {
    const w = Math.round(entries[0].contentRect.width);
    if (w === lastW) return;
    lastW = w;
    cancelAnimationFrame(raf);
    // Agrupa rajadas de resize num unico redesenho por frame.
    raf = requestAnimationFrame(() => {
      if (state.error) return; // o card de erro nao depende da largura
      renderLineChart(els.chart, state);
    });
  });
  ro.observe(els.chart);
}

function setLoading(on) {
  state.loading = on;
  els.root.classList.toggle("is-loading", on);
}

function errMsg(err) {
  return String(err && err.message ? err.message : err);
}

// ---- Fetch de ingests (com guarda de corrida) ------------------------------

async function refreshIngests() {
  if (!state.selectedSensorIds.length) {
    state.ingests = [];
    state.error = null;
    return;
  }
  const seq = ++reqSeq;
  setLoading(true);
  try {
    const rows = await api.getIngests({
      sensorIds: state.selectedSensorIds,
      from: state.range.from,
      to: state.range.to,
    });
    if (seq !== reqSeq) return; // resposta obsoleta
    state.ingests = Array.isArray(rows) ? rows : [];
    state.error = null;
  } catch (err) {
    if (seq !== reqSeq) return;
    console.error("[main] falha ao carregar ingests", err);
    state.ingests = [];
    state.error = errMsg(err);
  } finally {
    if (seq === reqSeq) setLoading(false);
  }
}

// ---- Callbacks (mutam state -> rodam pipeline) -----------------------------

async function onSelectDevice(deviceId) {
  if (deviceId === state.activeDeviceId) return;
  state.activeDeviceId = deviceId;
  setLoading(true);
  let sensors;
  try {
    sensors = await api.getSensors(deviceId);
  } catch (err) {
    if (state.activeDeviceId !== deviceId) return; // clique superado por outro device
    console.error("[main] falha ao carregar sensores", err);
    state.sensors = [];
    state.selectedSensorIds = [];
    state.ingests = [];
    state.error = errMsg(err);
    setLoading(false);
    renderAll();
    return;
  }
  if (state.activeDeviceId !== deviceId) return; // clique superado por outro device
  state.sensors = Array.isArray(sensors) ? sensors : [];
  state.selectedSensorIds = state.sensors.map((s) => s.id); // todos por padrao
  state.error = null;
  await refreshIngests();
  if (state.activeDeviceId !== deviceId) return; // superado durante o fetch
  recomputeMetrics(true); // reset -> 2 primeiras metricas detectadas
  renderAll();
}

async function onToggleSensor(sensorId) {
  const set = new Set(state.selectedSensorIds);
  if (set.has(sensorId)) {
    if (set.size <= 1) return; // ao menos um sensor deve permanecer
    set.delete(sensorId);
  } else {
    set.add(sensorId);
  }
  state.selectedSensorIds = state.sensors.map((s) => s.id).filter((id) => set.has(id));
  await refreshIngests();
  recomputeMetrics(false); // mantem metricas ainda validas
  renderAll();
}

async function onSetRange(from, to, changed) {
  const clamped = clampRange(from, to, changed);
  state.range = clamped;
  await refreshIngests();
  recomputeMetrics(false);
  renderAll();
}

async function onPreset(days) {
  const anchor = latestIngestYmd() || todayYmd();
  state.range = presetRange(days, anchor);
  await refreshIngests();
  recomputeMetrics(false);
  renderAll();
}

function onToggleMetric(key) {
  const set = new Set(state.selectedMetrics);
  if (set.has(key)) {
    if (set.size <= 1) return; // ao menos uma metrica deve permanecer
    set.delete(key);
  } else {
    set.add(key);
  }
  state.selectedMetrics = state.detectedMetrics.filter((k) => set.has(k));
  renderViz();
}

function onToggleAll() {
  // "All" seleciona todas as metricas detectadas.
  state.selectedMetrics = [...state.detectedMetrics];
  renderViz();
}

function onToggleNormalize() {
  state.normalize = !state.normalize;
  renderViz();
}

// ---- Init ------------------------------------------------------------------

async function init() {
  els.root = document.querySelector(".iot-dashboard");
  els.sidebar = document.getElementById("iotSidebar");
  els.header = document.getElementById("iotHeader");
  els.range = document.getElementById("iotRange");
  els.metrics = document.getElementById("iotMetrics");
  els.chart = document.getElementById("iotChart");
  els.legend = document.getElementById("iotLegend");
  if (!els.root) return;

  state.range = defaultRange();

  try {
    setLoading(true);
    const devices = await api.getDevices();
    state.devices = Array.isArray(devices) ? devices : [];
    renderFilters();
    if (state.devices.length) {
      await onSelectDevice(state.devices[0].id);
    } else {
      renderViz();
    }
  } catch (err) {
    console.error("[main] falha na inicializacao", err);
    state.error = String(err && err.message ? err.message : err);
    renderAll();
  } finally {
    setLoading(false);
  }

  // Depois do primeiro render, para partir da largura ja assentada.
  observeChartWidth();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
