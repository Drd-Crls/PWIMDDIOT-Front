// state.js
// Estado unico da aplicacao + logica pura de selecao/intervalo.
// (Substitui o antigo hook useIngests do React.)
//
// Regra central: qualquer mudanca muta este objeto e roda o pipeline de render
// definido em main.js. Nao ha virtual DOM — cada secao se redesenha.

import { detectMetrics } from "./lib/metrics.js";

const DAY_MS = 86400000;

// Numero de DIAS de diferenca maximo entre `from` e `to`.
// 1 semana = 7 dias corridos inclusivos => diferenca de 6.
export const MAX_SPAN_DAYS = 6;

// Presets (contagem inclusiva de dias). diff = count - 1.
export const PRESETS = [
  { id: "24h", label: "24h", days: 1 },
  { id: "3d", label: "3 dias", days: 3 },
  { id: "1w", label: "1 semana", days: 7 },
];

export const state = {
  devices: [],
  activeDeviceId: null,
  sensors: [], // sensores do device ativo
  selectedSensorIds: [], // multi-select (>= 1)
  ingests: [], // ingests filtrados (janela atual)
  detectedMetrics: [], // chaves numericas na ordem de deteccao
  selectedMetrics: [], // subconjunto de detectedMetrics, na ordem de deteccao
  range: { from: null, to: null }, // YYYY-MM-DD
  normalize: false,
  loading: false,
  error: null,
};

// ---- Helpers de data (YYYY-MM-DD, horario local) ----------------------------

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function toYmd(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayYmd() {
  return toYmd(new Date());
}

function parseYmd(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysYmd(ymd, n) {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() + n);
  return toYmd(d);
}

export function diffDaysYmd(fromYmd, toYmd_) {
  return Math.round((parseYmd(toYmd_) - parseYmd(fromYmd)) / DAY_MS);
}

/**
 * Garante que a janela nunca ultrapasse MAX_SPAN_DAYS de diferenca.
 * `changed` diz qual input o usuario mexeu, para ajustar o OUTRO.
 */
export function clampRange(from, to, changed) {
  let f = from;
  let t = to;
  if (diffDaysYmd(f, t) < 0) {
    // Intervalo invertido -> colapsa no que o usuario mexeu.
    if (changed === "from") t = f;
    else f = t;
  }
  if (diffDaysYmd(f, t) > MAX_SPAN_DAYS) {
    if (changed === "from") t = addDaysYmd(f, MAX_SPAN_DAYS);
    else f = addDaysYmd(t, -MAX_SPAN_DAYS);
  }
  return { from: f, to: t };
}

/** Intervalo padrao: ultima semana terminando hoje. */
export function defaultRange() {
  const to = todayYmd();
  return { from: addDaysYmd(to, -MAX_SPAN_DAYS), to };
}

/** Aplica um preset ancorado no `anchor` (YYYY-MM-DD), ex.: ultima data com dados. */
export function presetRange(days, anchor) {
  const to = anchor || todayYmd();
  return { from: addDaysYmd(to, -(days - 1)), to };
}

// ---- Deteccao + reconciliacao de metricas -----------------------------------

/**
 * Recalcula detectedMetrics a partir dos ingests filtrados e reconcilia
 * selectedMetrics.
 * @param {boolean} reset  quando true, seleciona as 2 primeiras detectadas
 *                         (troca de device). Caso contrario mantem as validas.
 */
export function recomputeMetrics(reset) {
  const detected = detectMetrics(state.ingests);
  state.detectedMetrics = detected;

  let chosen;
  if (reset) {
    chosen = detected.slice(0, 2);
  } else {
    const kept = state.selectedMetrics.filter((k) => detected.includes(k));
    chosen = kept.length ? kept : detected.slice(0, 2);
  }
  // Reordena pela ordem de deteccao.
  const chosenSet = new Set(chosen);
  state.selectedMetrics = detected.filter((k) => chosenSet.has(k));
}

/** Data (YYYY-MM-DD) do ingest mais recente carregado, ou null. */
export function latestIngestYmd() {
  let maxT = -Infinity;
  for (const ing of state.ingests) {
    const t = Date.parse(ing.created_at);
    if (t > maxT) maxT = t;
  }
  return Number.isFinite(maxT) && maxT > 0 ? toYmd(new Date(maxT)) : null;
}
