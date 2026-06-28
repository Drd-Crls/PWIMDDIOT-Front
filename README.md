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

## Observacoes sobre a API atual

- **Cadastro de usuario (`POST /users`) exige estar logado** (a rota nao e publica
  no backend). Por isso a tela de "novo usuario" so aparece para quem ja autenticou.
- **`created_by` do device** e enviado a partir do usuario logado (`/auth/me`).
  Quando o backend passar a derivar isso do token, basta remover esse campo do form.
- **Token expira em ~30 min e nao ha refresh**: ao receber 401, o front limpa a
  sessao e manda para o login automaticamente.

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
run.py
```
