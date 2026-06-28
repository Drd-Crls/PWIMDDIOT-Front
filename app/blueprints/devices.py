from flask import (
    Blueprint,
    flash,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

from app import api_client
from app.auth_utils import login_required

bp = Blueprint("devices", __name__, url_prefix="/devices")

STATUSES = ["ACTIVE", "INACTIVE", "MAINTENANCE", "OFFLINE"]


def _contexts_for_select():
    """Lista de contextos para preencher o <select> do formulario."""
    try:
        return api_client.get("/contexts", params={"page": 1, "limit": 100})["items"]
    except Exception:
        return []


@bp.route("/")
@login_required
def list_devices():
    params = {
        "page": request.args.get("page", 1, type=int),
        "limit": request.args.get("limit", 10, type=int),
        "sort_by": request.args.get("sort_by", "created_at"),
        "sort_order": request.args.get("sort_order", "desc"),
    }
    for key in ("name", "model", "status", "context_id"):
        value = request.args.get(key)
        if value:
            params[key] = value

    data = api_client.get("/devices", params=params)
    return render_template(
        "devices/list.html",
        data=data,
        filters=request.args,
        statuses=STATUSES,
    )


@bp.route("/new", methods=["GET", "POST"])
@login_required
def create_device():
    if request.method == "POST":
        payload = {
            "name": request.form["name"].strip(),
            "model": request.form["model"].strip(),
            "location": request.form.get("location") or None,
            "status": request.form["status"],
            "context_id": request.form["context_id"],
            # created_by: derivado do usuario logado (vindo de /auth/me).
            # Quando o backend passar a derivar isso do token, remova esta linha.
            "created_by": session["user"]["id"],
        }
        api_client.post("/devices", json=payload)
        flash("Device criado!", "success")
        return redirect(url_for("devices.list_devices"))

    return render_template(
        "devices/form.html",
        device=None,
        contexts=_contexts_for_select(),
        statuses=STATUSES,
    )


@bp.route("/<device_id>/edit", methods=["GET", "POST"])
@login_required
def edit_device(device_id):
    if request.method == "POST":
        # PUT e PATCH-like: enviamos apenas os campos editaveis.
        payload = {
            "name": request.form["name"].strip(),
            "model": request.form["model"].strip(),
            "location": request.form.get("location") or None,
            "status": request.form["status"],
        }
        api_client.put(f"/devices/{device_id}", json=payload)
        flash("Device atualizado!", "success")
        return redirect(url_for("devices.list_devices"))

    device = api_client.get(f"/devices/{device_id}")
    return render_template(
        "devices/form.html",
        device=device,
        contexts=_contexts_for_select(),
        statuses=STATUSES,
    )


@bp.route("/<device_id>/delete", methods=["POST"])
@login_required
def delete_device(device_id):
    api_client.delete(f"/devices/{device_id}")
    flash("Device removido.", "info")
    return redirect(url_for("devices.list_devices"))
