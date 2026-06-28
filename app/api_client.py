"""Cliente HTTP fino para a API PWIMDDIOT (FastAPI).

Responsabilidades:
- Injetar o token JWT (guardado na sessao do Flask) no header Authorization.
- Normalizar os erros da API em uma unica excecao (ApiError), entendendo tanto
  o formato de erro de negocio ({"detail": "..."} ) quanto o de validacao do
  FastAPI (HTTP 422 com {"detail": [ {...} ]}).
"""

import httpx
from flask import current_app, session


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _headers() -> dict:
    token = session.get("access_token")
    return {"Authorization": f"Bearer {token}"} if token else {}


def _parse_error(resp: httpx.Response) -> str:
    try:
        data = resp.json()
    except Exception:
        return f"HTTP {resp.status_code}"

    detail = data.get("detail") if isinstance(data, dict) else None

    if isinstance(detail, list):
        msgs = []
        for err in detail:
            loc = err.get("loc", [])
            field = loc[-1] if loc else ""
            msg = err.get("msg", "invalido")
            msgs.append(f"{field}: {msg}" if field else msg)
        return "; ".join(msgs) or "Erro de validacao"

    if isinstance(detail, str):
        return detail

    return f"HTTP {resp.status_code}"


def request(method: str, path: str, **kwargs):
    url = f"{current_app.config['API_BASE_URL']}{path}"
    timeout = current_app.config["API_TIMEOUT"]
    try:
        resp = httpx.request(method, url, headers=_headers(), timeout=timeout, **kwargs)
    except httpx.RequestError as exc:
        raise ApiError(503, f"Nao foi possivel conectar a API: {exc}") from exc

    if resp.status_code >= 400:
        raise ApiError(resp.status_code, _parse_error(resp))

    if resp.status_code == 204 or not resp.content:
        return None
    return resp.json()


def get(path: str, **kwargs):
    return request("GET", path, **kwargs)


def post(path: str, **kwargs):
    return request("POST", path, **kwargs)


def put(path: str, **kwargs):
    return request("PUT", path, **kwargs)


def delete(path: str, **kwargs):
    return request("DELETE", path, **kwargs)
