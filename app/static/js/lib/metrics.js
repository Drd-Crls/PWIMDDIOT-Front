// lib/metrics.js
// Funcoes puras: deteccao de metricas numericas, "nice scale" para o eixo Y e
// formatadores de data/valor. Nenhuma dependencia externa, nenhum nome de
// metrica hardcoded.

/**
 * Retorna true apenas para numeros finitos de verdade.
 * Strings, booleanos, null, objetos aninhados etc. sao ignorados.
 */
export function isNumericValue(v) {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Detecta as chaves numericas presentes nos ingests ja filtrados.
 * A ordem de retorno e a ordem de PRIMEIRA aparicao (ordem de deteccao),
 * o que mantem as cores das series estaveis.
 */
export function detectMetrics(ingests) {
  const ordered = [];
  const seen = new Set();
  for (const ing of ingests) {
    const md = ing && ing.metadata;
    if (!md || typeof md !== "object") continue;
    for (const key of Object.keys(md)) {
      if (seen.has(key)) continue;
      if (isNumericValue(md[key])) {
        seen.add(key);
        ordered.push(key);
      }
    }
  }
  return ordered;
}

/**
 * Valor numerico de uma metrica em um ingest, ou null se ausente/nao-numerico.
 * Valores ausentes NAO viram zero — sao pulados no desenho.
 */
export function metricValue(ingest, key) {
  const md = ingest && ingest.metadata;
  if (!md || typeof md !== "object") return null;
  const v = md[key];
  return isNumericValue(v) ? v : null;
}

// ---- Nice scale (algoritmo classico de eixos "limpos") ----------------------

function niceNum(range, round) {
  const exponent = Math.floor(Math.log10(range || 1));
  const fraction = (range || 1) / Math.pow(10, exponent);
  let nice;
  if (round) {
    if (fraction < 1.5) nice = 1;
    else if (fraction < 3) nice = 2;
    else if (fraction < 7) nice = 5;
    else nice = 10;
  } else {
    if (fraction <= 1) nice = 1;
    else if (fraction <= 2) nice = 2;
    else if (fraction <= 5) nice = 5;
    else nice = 10;
  }
  return nice * Math.pow(10, exponent);
}

/**
 * Arredonda [min,max] para valores "limpos" e devolve ~maxTicks marcacoes.
 * @returns {{min:number, max:number, step:number, ticks:number[]}}
 */
export function niceScale(min, max, maxTicks = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1, step: 0.25, ticks: [0, 0.25, 0.5, 0.75, 1] };
  }
  if (min === max) {
    if (min === 0) {
      min = 0;
      max = 1;
    } else {
      const pad = Math.abs(min) * 0.1 || 1;
      min -= pad;
      max += pad;
    }
  }
  const range = niceNum(max - min, false);
  const step = niceNum(range / Math.max(1, maxTicks - 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return { min: niceMin, max: niceMax, step, ticks };
}

// ---- Formatadores -----------------------------------------------------------

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** HH:MM */
export function formatTime(d) {
  const date = d instanceof Date ? d : new Date(d);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** M/D */
export function formatDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/** M/D HH:MM */
export function formatFull(d) {
  const date = d instanceof Date ? d : new Date(d);
  return `${formatDate(date)} ${formatTime(date)}`;
}

/** Formata o valor de um tick do eixo Y de acordo com o passo. */
export function formatTick(v, step) {
  if (Number.isInteger(step) && Number.isInteger(v)) return String(v);
  const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
  return Number(v.toFixed(decimals)).toString();
}

/** Formata um valor de serie para tooltip / legenda (curto e legivel). */
export function formatValue(v) {
  if (v == null || !Number.isFinite(v)) return "—";
  if (Number.isInteger(v)) return String(v);
  const abs = Math.abs(v);
  if (abs >= 100) return v.toFixed(1);
  if (abs >= 1) return v.toFixed(2);
  return Number(v.toPrecision(3)).toString();
}

/**
 * Decide o formato do eixo X: HH:MM quando o intervalo visivel cabe em um unico
 * dia; M/D quando abrange varios dias.
 */
export function spansMultipleDays(minMs, maxMs) {
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) return false;
  return new Date(minMs).toDateString() !== new Date(maxMs).toDateString();
}
