// lib/colors.js
// Paleta fixa das series. A cor de uma metrica e estavel: depende da sua posicao
// na ORDEM DE DETECCAO, entao chip, linha do grafico e legenda sempre combinam.

export const SERIES_COLORS = [
  "oklch(0.58 0.15 255)",
  "oklch(0.62 0.15 30)",
  "oklch(0.60 0.13 155)",
  "oklch(0.58 0.15 310)",
  "oklch(0.62 0.13 90)",
  "oklch(0.60 0.13 205)",
];

export function metricColor(key, detectedMetrics) {
  const i = detectedMetrics.indexOf(key);
  const idx = i < 0 ? 0 : i;
  return SERIES_COLORS[idx % SERIES_COLORS.length];
}

// Cores dos status de device (bolinha na sidebar).
export const STATUS_COLORS = {
  ACTIVE: "oklch(0.65 0.15 150)",
  MAINTENANCE: "oklch(0.72 0.15 75)",
  INACTIVE: "#b7c0d0",
  OFFLINE: "oklch(0.62 0.18 25)",
};
