# PWIMDDIOT-Front

Front-end em **Flask + Jinja2** (renderizacao no servidor) que consome a API
**PWIMDDIOT** (FastAPI). O Flask funciona como um *backend-for-frontend* fininho:
o navegador fala apenas com o Flask, e o Flask repassa as chamadas para a API
guardando o token JWT na sessao do servidor.

```
Browser  <->  Flask (Jinja SSR)  <->  FastAPI (http://localhost:8000)
```

## Por que assim

- Sem necessidade de CORS na API (o browser nunca chama a API direto).
- O token JWT fica na `session` do Flask (cookie assinado), nunca exposto ao JS.

## Como rodar

1. Suba a API (backend) em `http://localhost:8000`.
2. Crie o ambiente e instale as dependencias:

   ```bash
   python -m venv .venv
   .venv\Scripts\activate        # Windows
   pip install -r requirements.txt
   ```

3. Copie `.env.example` para `.env` e ajuste `SECRET_KEY` / `API_BASE_URL`.
4. Rode:

   ```bash
   python run.py
   ```

5. Acesse `http://localhost:5000` e faca login.

## Painel de monitoramento (`/monitor`)

Dashboard de series temporais de ingests, em **HTML + CSS + JavaScript puro
(ES modules)** — sem React/Vue/Vite, sem build, sem biblioteca de grafico. O
grafico e SVG desenhado a mao. As metricas numericas sao **auto-detectadas** a
partir de `ingest.metadata` (qualquer chave `typeof === "number"` e finita);
nenhum nome de metrica e hardcoded.

Fluxo (mantem o padrao BFF do projeto — o browser nunca chama a API direto):

```
Browser (ES modules)  ->  /monitor/api/*  (proxy Flask, mesma origem)  ->  FastAPI
```

O `api.js` faz `fetch` no proxy same-origin; o cookie de sessao autentica e o
token JWT continua so no servidor. Nao ha fallback mock: se a requisicao falhar,
o painel mostra a mensagem de erro (em vez de esconder o problema com dados
falsos).

### Duas formas de rodar

1. **Backend real** — aponte `API_BASE_URL` para a API e acesse `/monitor`.
2. **Stub local** (sem o backend real): `pip install -r requirements-stub.txt`,
   depois `uvicorn stub_api:app --port 8000`, e `API_BASE_URL=http://localhost:8000`.
   O proxy Flask repassa para o stub no servidor (nem CORS e necessario).

### Estrutura do painel

```
app/templates/dashboard/monitor.html   # template Jinja (bloco content + scripts)
app/static/css/dashboard.css            # estilos, escopados sob .iot-dashboard
app/static/js/
  main.js          # entrada: init, eventos, pipeline de render
  state.js         # estado unico + logica de selecao/intervalo
  api.js           # cliente fetch (proxy same-origin)
  ui/  sidebar.js  rangeFilter.js  metricChips.js  lineChart.js  legend.js
  lib/ metrics.js (deteccao/nice-scale/formatters)  colors.js  dom.js
stub_api.py                             # stub FastAPI opcional (dev)
```

## Observacoes sobre a API atual

- **Cadastro de usuario (`POST /users`) exige estar logado** (a rota nao e publica
  no backend). Por isso a tela de "novo usuario" so aparece para quem ja autenticou.
- **`created_by` do device** e enviado a partir do usuario logado (`/auth/me`).
  Quando o backend passar a derivar isso do token, basta remover esse campo do form.
- **Token expira em ~30 min e nao ha refresh**: ao receber 401, o front limpa a
  sessao e manda para o login automaticamente. Como uma aba parada nao faz
  request nenhum, o `session.js` verifica o token no `/auth/me` a cada 1 minuto
  e redireciona para o login assim que ele deixa de valer (so no 401 — API fora
  do ar ou queda de rede nao derrubam a sessao). O polling pausa enquanto a aba
  esta em segundo plano e roda na hora quando ela volta ao foco.

## Estrutura

```
app/
  __init__.py        # create_app(), blueprints, handler global de ApiError
  config.py          # carrega API_BASE_URL e SECRET_KEY do ambiente
  api_client.py      # wrapper httpx que injeta o Bearer e normaliza erros
  auth_utils.py      # decorator login_required + helpers de sessao
  blueprints/        # auth, dashboard, contexts, devices, sensors, users
  templates/         # base.html + telas Jinja
  static/style.css
  static/js/session.js  # vigia de sessao (polling do /auth/me, em toda pagina)
run.py
```
