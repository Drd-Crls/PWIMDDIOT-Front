from flask import (
    Blueprint,
    flash,
    jsonify,
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


@bp.route("/auth/me")
def me():
    """Verificacao de sessao consumida pelo session.js (polling de 1 em 1 min).

    Repassa para o `/auth/me` da API com o JWT guardado na sessao — e o unico
    jeito de saber se o token ainda vale, ja que o `login_required` so checa se
    ele existe, nao se expirou.

    Devolve SEMPRE JSON (nunca redirect/HTML, ao contrario do handler global de
    ApiError), porque quem chama e um fetch. Contrato com o front: 401 = token
    invalido -> vai pro login; qualquer outro erro = "nao deu pra verificar" ->
    o front ignora e mantem a sessao.
    """
    if "access_token" not in session:
        return jsonify({"authenticated": False}), 401

    try:
        user = api_client.get("/auth/me")
    except ApiError as exc:
        if exc.status == 401:
            # Token expirado/revogado: mesma limpeza do handler global, mas com
            # o flash pronto para aparecer quando o front cair no login.
            session.clear()
            flash("Sua sessao expirou. Faca login novamente.", "warning")
            return jsonify({"authenticated": False}), 401
        # API fora do ar (503) ou outro erro: nao e problema de token, entao a
        # sessao continua de pe.
        return jsonify({"error": exc.message}), (exc.status if exc.status >= 400 else 502)

    # Aproveita para manter nome/role do navbar em dia (so grava se mudou, pra
    # nao reescrever o cookie de sessao a cada minuto).
    if session.get("user") != user:
        session["user"] = user
    return jsonify({"authenticated": True, "user": user})


@bp.route("/logout")
def logout():
    session.clear()
    flash("Voce saiu.", "info")
    return redirect(url_for("auth.login"))
