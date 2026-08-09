from flask import Blueprint, jsonify, render_template, request, url_for

from app import api_client
from app.api_client import ApiError
from app.auth_utils import login_required

bp = Blueprint("dashboard", __name__)


def _as_list(data):
    """Normaliza a resposta da API (array puro ou envelope paginado) em list."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        if isinstance(data.get("items"), list):
            return data["items"]
        if isinstance(data.get("data"), list):
            return data["data"]
    return []


# limite maximo por pagina aceito pela API real (valida entre 1 e 100).
PAGE_LIMIT = 100


def _fetch_all(path, params, page_limit=PAGE_LIMIT, max_pages=50):
    """Busca todas as paginas de um endpoint paginado ({items,total,page,limit})
    e devolve a lista completa de items."""
    collected = []
    page = 1
    while page <= max_pages:
        data = api_client.get(path, params={**params, "page": page, "limit": page_limit})
        items = _as_list(data)
        collected.extend(items)
        total = data.get("total") if isinstance(data, dict) else None
        if not items or total is None or len(collected) >= total:
            break
        page += 1
    return collected


def _proxy_all(path, params=None):
    """Pagina todas as paginas de uma leitura e devolve JSON (array).

    Erros viram JSON com status != 2xx (em vez do redirect global de ApiError),
    para o api.js tratar como erro e a UI mostrar a falha (em vez de receber HTML).
    """
    try:
        return jsonify(_fetch_all(path, params or {}))
    except ApiError as exc:
        return jsonify({"error": exc.message}), (exc.status if exc.status >= 400 else 502)
    except Exception as exc:  # noqa: BLE001 — nunca deixa vazar HTML pro fetch
        return jsonify({"error": str(exc)}), 502


@bp.route("/")
@login_required
def index():
    def total(path):
        try:
            return api_client.get(path, params={"page": 1, "limit": 1})["total"]
        except Exception:
            return "-"

    stats = {
        "contexts": total("/contexts"),
        "devices": total("/devices"),
        "sensors": total("/sensors"),
    }
    return render_template("index.html", stats=stats)


@bp.route("/monitor")
@login_required
def monitor():
    # O front (modulos ES em /static/js) faz fetch no proxy same-origin abaixo
    # (BFF): o token JWT fica na sessao do Flask, nunca no JS. Se a API falhar,
    # o proxy devolve JSON de erro e o painel mostra a mensagem de falha.
    return render_template(
        "dashboard/monitor.html",
        api_base=url_for("dashboard.monitor") + "/api",
    )


# ---- Proxy same-origin consumido pelo api.js (devolve arrays) ---------------


@bp.route("/monitor/api/devices")
@login_required
def monitor_devices():
    return _proxy_all("/devices")


@bp.route("/monitor/api/devices/<device_id>/sensors")
@login_required
def monitor_sensors(device_id):
    return _proxy_all("/sensors", {"device_id": device_id})


@bp.route("/monitor/api/ingests")
@login_required
def monitor_ingests():
    # Contrato do front: sensor_ids (csv), from, to (YYYY-MM-DD).
    # Contrato da API real: sensor_id (UM por vez), created_from/created_to
    # (date-time ISO), paginado. Traduzimos: 1 request por sensor + merge.
    sensor_ids = [s for s in request.args.get("sensor_ids", "").split(",") if s]
    if not sensor_ids:
        return jsonify([])

    date_params = {}
    if request.args.get("from"):
        date_params["created_from"] = f"{request.args['from']}T00:00:00Z"
    if request.args.get("to"):
        date_params["created_to"] = f"{request.args['to']}T23:59:59Z"

    try:
        merged = []
        for sid in sensor_ids:
            merged.extend(_fetch_all("/ingests", {"sensor_id": sid, **date_params}))
        return jsonify(merged)
    except ApiError as exc:
        return jsonify({"error": exc.message}), (exc.status if exc.status >= 400 else 502)
    except Exception as exc:  # noqa: BLE001 — nunca deixa vazar HTML pro fetch
        return jsonify({"error": str(exc)}), 502
