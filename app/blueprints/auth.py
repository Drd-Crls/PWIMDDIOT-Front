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
from app.api_client import ApiError

bp = Blueprint("auth", __name__)


@bp.route("/login", methods=["GET", "POST"])
def login():
    if "access_token" in session:
        return redirect(url_for("dashboard.index"))

    if request.method == "POST":
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "")
        try:
            data = api_client.post(
                "/auth/login", json={"email": email, "password": password}
            )
            session["access_token"] = data["access_token"]
            session["user"] = api_client.get("/auth/me")
            flash("Bem-vindo!", "success")
            return redirect(url_for("dashboard.index"))
        except ApiError as exc:
            flash(exc.message, "danger")

    return render_template("login.html")


@bp.route("/logout")
def logout():
    session.clear()
    flash("Voce saiu.", "info")
    return redirect(url_for("auth.login"))
