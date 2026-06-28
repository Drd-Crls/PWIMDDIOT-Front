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

bp = Blueprint("api_keys", __name__, url_prefix="/api-keys")

# Espelha o PermissionValidator da API (recursos/acoes aceitos).
RESOURCES = ["devices", "sensors", "ingests", "contexts"]
ACTIONS = ["read", "write", "delete"]


@bp.route("/")
@login_required
def list_api_keys():
    data = api_client.get("/api-keys")
    return render_template("api_keys/list.html", api_keys=data)


@bp.route("/new", methods=["GET", "POST"])
@login_required
def create_api_key():
    if request.method == "POST":
        # Monta {recurso: [acoes]} a partir dos checkboxes, omitindo recursos vazios.
        permissions = {}
        for resource in RESOURCES:
            actions = request.form.getlist(f"perm_{resource}")
            if actions:
                permissions[resource] = actions

        if not permissions:
            flash("Selecione ao menos uma permissão.", "warning")
            return render_template(
                "api_keys/form.html",
                resources=RESOURCES,
                actions=ACTIONS,
                selected={},
            )

        created = api_client.post("/api-keys", json={"permissions": permissions})
        flash("API Key criada! Copie o valor abaixo, ele não será exibido novamente.", "success")
        return render_template("api_keys/created.html", api_key=created)

    return render_template(
        "api_keys/form.html",
        resources=RESOURCES,
        actions=ACTIONS,
        selected={},
    )


@bp.route("/<api_key_id>/revoke", methods=["POST"])
@login_required
def revoke_api_key(api_key_id):
    api_client.delete(f"/api-keys/{api_key_id}")
    flash("API Key revogada.", "info")
    return redirect(url_for("api_keys.list_api_keys"))


@bp.route("/<api_key_id>/rotate", methods=["POST"])
@login_required
def rotate_api_key(api_key_id):
    created = api_client.post(f"/api-keys/{api_key_id}/rotate")
    flash("API Key rotacionada! A chave anterior foi revogada.", "success")
    return render_template("api_keys/created.html", api_key=created)
