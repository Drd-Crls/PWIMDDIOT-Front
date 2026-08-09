// api.js
// Cliente fetch para o backend.
//
// Segue a arquitetura BFF do projeto: o browser fala SOMENTE com o Flask
// (mesma origem), que repassa para a API FastAPI guardando o token JWT na
// sessao do servidor. `window.__API_BASE__` aponta para o proxy same-origin
// (ex.: "/monitor/api"). Nada de token no JS, nada de CORS.
//
// Sem fallback mock: se a requisicao falhar, o erro sobe e a UI mostra a falha
// (em vez de esconder o problema com dados falsos).

const API_BASE = (window.__API_BASE__ || "").replace(/\/$/, "");

async function apiFetch(path) {
  // credentials same-origin (padrao) envia o cookie de sessao do Flask.
  let resp;
  try {
    resp = await fetch(`${API_BASE}${path}`, { headers: { Accept: "application/json" } });
  } catch (err) {
    throw new Error(`Falha de rede ao chamar ${path}: ${err.message || err}`);
  }
  if (!resp.ok) {
    // O proxy Flask devolve {"error": "..."} em caso de falha da API.
    let detail = `HTTP ${resp.status}`;
    try {
      const body = await resp.json();
      if (body && body.error) detail = body.error;
    } catch {
      /* corpo nao-JSON: mantem "HTTP <status>" */
    }
    throw new Error(detail);
  }
  return resp.json();
}

// A API pode devolver um array puro ou um envelope paginado {items:[...]}.
function unwrap(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

// ---- API publica ------------------------------------------------------------

export async function getDevices() {
  return unwrap(await apiFetch("/devices"));
}

export async function getSensors(deviceId) {
  return unwrap(await apiFetch(`/devices/${encodeURIComponent(deviceId)}/sensors`));
}

export async function getIngests({ sensorIds, from, to }) {
  const qs = new URLSearchParams({ sensor_ids: (sensorIds || []).join(","), from, to });
  return unwrap(await apiFetch(`/ingests?${qs.toString()}`));
}
