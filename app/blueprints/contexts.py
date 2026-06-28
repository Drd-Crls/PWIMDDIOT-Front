from flask import (
    Blueprint,
    flash,
    redirect,
    render_template,
    request,
    url_for,
)

from app import api_client
from app.auth_utils import login_required

bp = Blueprint("contexts", __name__, url_prefix="/contexts")


@bp.route("/")
@login_required
def list_contexts():
    params = {
        "page": request.args.get("page", 1, type=int),
        "limit": request.args.get("limit", 10, type=int),
    }
    name = request.args.get("name")
    if name:
        params["name"] = name
    data = api_client.get("/contexts", params=params)
    return render_template("contexts/list.html", data=data, filters=request.args)


@bp.route("/new", methods=["GET", "POST"])
@login_required
def create_context():
    if request.method == "POST":
        payload = {
            "name": request.form["name"].strip(),
            "description": request.form.get("description") or None,
        }
        api_client.post("/contexts", json=payload)
        flash("Contexto criado!", "success")
        return redirect(url_for("contexts.list_contexts"))
    return render_template("contexts/form.html", context=None)


@bp.route("/<context_id>/edit", methods=["GET", "POST"])
@login_required
def edit_context(context_id):
    if request.method == "POST":
        payload = {
            "name": request.form["name"].strip(),
            "description": request.form.get("description") or None,
        }
        api_client.put(f"/contexts/{context_id}", json=payload)
        flash("Contexto atualizado!", "success")
        return redirect(url_for("contexts.list_contexts"))
    context = api_client.get(f"/contexts/{context_id}")
    return render_template("contexts/form.html", context=context)


@bp.route("/<context_id>/delete", methods=["POST"])
@login_required
def delete_context(context_id):
    api_client.delete(f"/contexts/{context_id}")
    flash("Contexto removido.", "info")
    return redirect(url_for("contexts.list_contexts"))
