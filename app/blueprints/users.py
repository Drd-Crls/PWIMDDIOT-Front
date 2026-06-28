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

bp = Blueprint("users", __name__, url_prefix="/users")

ROLES = ["USER", "ADMIN"]


@bp.route("/new", methods=["GET", "POST"])
@login_required
def create_user():
    # Obs: a API exige autenticacao para POST /users, entao esta tela so
    # funciona para usuarios ja logados (tipicamente um ADMIN cadastrando outros).
    if request.method == "POST":
        payload = {
            "name": request.form["name"].strip(),
            "email": request.form["email"].strip(),
            "password": request.form["password"],
            "role": request.form.get("role", "USER"),
        }
        api_client.post("/users", json=payload)
        flash("Usuario criado!", "success")
        return redirect(url_for("dashboard.index"))

    return render_template("users/form.html", roles=ROLES)
