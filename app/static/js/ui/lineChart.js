// ui/lineChart.js
// Grafico de linhas desenhado a mao em SVG (viewBox 0 0 900 430), sem biblioteca.
// Uma polyline independente por metrica selecionada; hover com guia + tooltip.

import { esc } from "../lib/dom.js";
import { metricColor } from "../lib/colors.js";
import {
  niceScale,
  metricValue,
  formatTick,
  formatValue,
  formatTime,
  formatDate,
  formatFull,
  spansMultipleDays,
} from "../lib/metrics.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// Retangulo de plotagem. A altura e fixa, mas a LARGURA acompanha o container.
//
// Com VW = largura real em px (e VH fixo), o viewBox mapeia 1:1 para pixels de
// tela: o grafico fica sempre com VH de altura e texto/tracos nunca escalam.
// Com VW fixo em 900 o painel em tela cheia esticava o viewBox e levava junto
// os rotulos (12px viravam ~29px num monitor de 2560px) e a altura (~1050px).
const L = 60;
const T = 22;
const B = 380;
const VH = 430;
const RIGHT_GUTTER = 18; // respiro a direita, como no layout original (900-882)

// Espaco que o .iot-chart-card come na horizontal: padding (18px) + borda (1px)
// dos dois lados.
const CARD_H_SPACE = 38;
const MIN_VW = 640; // abaixo disto o grafico volta a escalar, em vez de espremer

function geometry(root) {
  const avail = Math.round((root.clientWidth || 0) - CARD_H_SPACE);
  const VW = Math.max(MIN_VW, avail > 0 ? avail : 900);
  return { L, T, B, VH, VW, R: VW - RIGHT_GUTTER };
}

const MAX_DOTS = 80; // acima disto, esconde os pontos

function buildModel(state, geo) {
  const { selectedMetrics, detectedMetrics, ingests, normalize } = state;
  const { L, R, T, B } = geo;

  // Ingests ordenados por tempo.
  const sorted = ingests
    .map((i) => ({ ...i, _t: Date.parse(i.created_at) }))
    .filter((i) => Number.isFinite(i._t))
    .sort((a, b) => a._t - b._t);

  // Uma serie por metrica: apenas pontos com valor numerico (missing e pulado).
  const series = selectedMetrics.map((key) => {
    const pts = [];
    for (const ing of sorted) {
      const raw = metricValue(ing, key);
      if (raw == null) continue;
      pts.push({ t: ing._t, raw });
    }
    let sMin = Infinity;
    let sMax = -Infinity;
    for (const p of pts) {
      if (p.raw < sMin) sMin = p.raw;
      if (p.raw > sMax) sMax = p.raw;
    }
    return { key, color: metricColor(key, detectedMetrics), pts, sMin, sMax };
  });

  const allPts = series.flatMap((s) => s.pts);
  if (!allPts.length) return { empty: true, series };

  let minT = Infinity;
  let maxT = -Infinity;
  let gMin = Infinity;
  let gMax = -Infinity;
  for (const p of allPts) {
    if (p.t < minT) minT = p.t;
    if (p.t > maxT) maxT = p.t;
    if (p.raw < gMin) gMin = p.raw;
    if (p.raw > gMax) gMax = p.raw;
  }

  const yDomain = normalize
    ? { min: 0, max: 100, step: 20, ticks: [0, 20, 40, 60, 80, 100] }
    : niceScale(gMin, gMax, 5);

  const xScale = (t) => (maxT === minT ? (L + R) / 2 : L + ((t - minT) / (maxT - minT)) * (R - L));
  const yScale = (v) => B - ((v - yDomain.min) / (yDomain.max - yDomain.min || 1)) * (B - T);

  // Valor plotado (normalizado por serie ou cru).
  const plotVal = (s, raw) => {
    if (!normalize) return raw;
    if (s.sMax === s.sMin) return 50;
    return ((raw - s.sMin) / (s.sMax - s.sMin)) * 100;
  };

  // Coordenadas por serie + mapa t->ponto (para hover exato).
  for (const s of series) {
    s.byT = new Map();
    s.coords = s.pts.map((p) => {
      const x = xScale(p.t);
      const y = yScale(plotVal(s, p.raw));
      const c = { x, y, t: p.t, raw: p.raw };
      s.byT.set(p.t, c);
      return c;
    });
  }

  // Anchors = uniao ordenada de todos os tempos (para snap do hover).
  const tset = new Set();
  for (const s of series) for (const p of s.pts) tset.add(p.t);
  const anchors = [...tset].sort((a, b) => a - b).map((t) => ({ t, x: xScale(t) }));

  const multiDay = spansMultipleDays(minT, maxT);

  return { empty: false, series, minT, maxT, yDomain, xScale, yScale, anchors, multiDay, normalize };
}

function svgSkeleton(model, geo) {
  const { L, R, T, B, VW, VH } = geo;

  if (model.empty) {
    return `
      <svg class="iot-chart-svg" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid meet" role="img">
        <text x="${VW / 2}" y="${VH / 2}" text-anchor="middle" class="iot-chart-empty">No ingests in selected range</text>
      </svg>`;
  }

  const { yDomain, xScale, yScale, minT, maxT, multiDay, normalize } = model;

  // Grade horizontal (y ticks) + rotulos Y.
  let grid = "";
  let yLabels = "";
  for (const v of yDomain.ticks) {
    const y = yScale(v);
    if (y < T - 0.5 || y > B + 0.5) continue;
    grid += `<line x1="${L}" y1="${y.toFixed(1)}" x2="${R}" y2="${y.toFixed(1)}" class="iot-grid"/>`;
    const label = normalize ? `${v}%` : formatTick(v, yDomain.step);
    yLabels += `<text x="${L - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" class="iot-axis-label">${esc(label)}</text>`;
  }

  // Grade vertical + rotulos X. A quantidade acompanha a largura (~1 a cada
  // 120px): 7 marcacoes fixas ficavam ralas num painel em tela cheia. Na
  // largura antiga (822px de area util) isto da 7, como antes.
  let xLabels = "";
  const N = Math.max(5, Math.min(12, Math.round((R - L) / 120)));
  for (let i = 0; i < N; i++) {
    const t = maxT === minT ? minT : minT + ((maxT - minT) * i) / (N - 1);
    const x = xScale(t);
    grid += `<line x1="${x.toFixed(1)}" y1="${T}" x2="${x.toFixed(1)}" y2="${B}" class="iot-grid"/>`;
    const label = multiDay ? formatDate(t) : formatTime(t);
    xLabels += `<text x="${x.toFixed(1)}" y="${B + 18}" text-anchor="middle" class="iot-axis-label">${esc(label)}</text>`;
    if (maxT === minT) break;
  }

  // Eixos com setas.
  const axes = `
    <line x1="${L}" y1="${B}" x2="${R}" y2="${B}" class="iot-axis"/>
    <line x1="${L}" y1="${B}" x2="${L}" y2="${T}" class="iot-axis"/>
    <polygon points="${R},${B} ${R - 7},${B - 4} ${R - 7},${B + 4}" class="iot-axis-arrow"/>
    <polygon points="${L},${T} ${L - 4},${T + 7} ${L + 4},${T + 7}" class="iot-axis-arrow"/>`;

  // Polylines + pontos.
  let lines = "";
  for (const s of model.series) {
    if (!s.coords.length) continue;
    const pointsAttr = s.coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    lines += `<polyline points="${pointsAttr}" fill="none" stroke="${s.color}" class="iot-line"/>`;
    if (s.coords.length <= MAX_DOTS) {
      for (const c of s.coords) {
        lines += `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="2.4" class="iot-dot-marker" stroke="${s.color}" stroke-width="1.6"/>`;
      }
    }
  }

  return `
    <svg class="iot-chart-svg" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid meet" role="img">
      <g class="iot-grid-g">${grid}</g>
      ${axes}
      <g class="iot-axis-labels">${yLabels}${xLabels}</g>
      <g class="iot-lines">${lines}</g>
      <line class="iot-guide" x1="0" y1="${T}" x2="0" y2="${B}" style="display:none"/>
      <g class="iot-hover-dots"></g>
      <rect class="iot-hit" x="${L}" y="${T}" width="${R - L}" height="${B - T}" fill="transparent"/>
    </svg>`;
}

export function renderLineChart(root, state) {
  // Medido ANTES de escrever o innerHTML: o root ja esta no layout e o seu
  // clientWidth nao depende do conteudo do grafico.
  const geo = geometry(root);
  const model = buildModel(state, geo);

  root.innerHTML = `
    <div class="iot-card iot-chart-card">
      <div class="iot-chart-wrap">
        ${svgSkeleton(model, geo)}
        <div class="iot-tooltip" style="display:none"></div>
      </div>
    </div>`;

  if (model.empty) return;

  const svg = root.querySelector(".iot-chart-svg");
  const wrap = root.querySelector(".iot-chart-wrap");
  const guide = svg.querySelector(".iot-guide");
  const dotsG = svg.querySelector(".iot-hover-dots");
  const tooltip = root.querySelector(".iot-tooltip");

  function onMove(ev) {
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    const vbX = ((ev.clientX - rect.left) / rect.width) * geo.VW;

    // Snap ao anchor mais proximo.
    let best = null;
    let bestD = Infinity;
    for (const a of model.anchors) {
      const d = Math.abs(a.x - vbX);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    if (!best) return;

    // Guia vertical.
    guide.setAttribute("x1", best.x.toFixed(1));
    guide.setAttribute("x2", best.x.toFixed(1));
    guide.style.display = "";

    // Dots por serie que tenha ponto exatamente neste tempo.
    dotsG.textContent = "";
    const rows = [];
    for (const s of model.series) {
      const c = s.byT.get(best.t);
      if (!c) {
        rows.push({ key: s.key, color: s.color, raw: null });
        continue;
      }
      const dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute("cx", c.x.toFixed(1));
      dot.setAttribute("cy", c.y.toFixed(1));
      dot.setAttribute("r", "4");
      dot.setAttribute("fill", s.color);
      dot.setAttribute("class", "iot-hover-dot");
      dot.setAttribute("stroke-width", "1.8");
      dotsG.appendChild(dot);
      rows.push({ key: s.key, color: s.color, raw: c.raw });
    }

    // Tooltip (mostra sempre o valor CRU, mesmo normalizado).
    const rowsHtml = rows
      .map(
        (r) => `<div class="iot-tt-row">
            <span class="iot-tt-swatch" style="background:${r.color}"></span>
            <span class="iot-tt-key">${esc(r.key)}</span>
            <span class="iot-tt-val">${esc(formatValue(r.raw))}</span>
          </div>`
      )
      .join("");
    tooltip.innerHTML = `<div class="iot-tt-time">${esc(formatFull(best.t))}</div>${rowsHtml}`;
    tooltip.style.display = "";

    // Posicionamento em px, com flip perto da borda direita.
    const px = (best.x / geo.VW) * rect.width;
    const py = ev.clientY - rect.top;
    if (px > rect.width * 0.62) {
      tooltip.style.left = `${px - 14}px`;
      tooltip.style.transform = "translate(-100%, -50%)";
    } else {
      tooltip.style.left = `${px + 14}px`;
      tooltip.style.transform = "translate(0, -50%)";
    }
    const topClamped = Math.max(40, Math.min(rect.height - 20, py));
    tooltip.style.top = `${topClamped}px`;
  }

  function onLeave() {
    guide.style.display = "none";
    dotsG.textContent = "";
    tooltip.style.display = "none";
  }

  svg.addEventListener("mousemove", onMove);
  svg.addEventListener("mouseleave", onLeave);
}
