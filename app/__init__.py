from flask import Flask, flash, redirect, session, url_for

from app.api_client import ApiError
from app.auth_utils import current_user
from app.config import Config


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    # Disponibiliza o usuario logado em todos os templates como `current_user`.
    @app.context_processor
    def inject_user():
        return {"current_user": current_user()}

    # Tratamento global dos erros vindos da API.
    @app.errorhandler(ApiError)
    def handle_api_error(exc: ApiError):
        # Token invalido/expirado -> limpa sessao e volta pro login.
        if exc.status == 401:
            session.clear()
            flash("Sua sessao expirou. Faca login novamente.", "warning")
            return redirect(url_for("auth.login"))
        flash(exc.message, "danger")
        # Volta para a pagina anterior, ou para o dashboard.
        from flask import request

        return redirect(request.referrer or url_for("dashboard.index"))

    # Registro dos blueprints.
    from app.blueprints import (
        api_keys,
        auth,
        contexts,
        dashboard,
        devices,
        sensors,
        users,
    )

    app.register_blueprint(auth.bp)
    app.register_blueprint(dashboard.bp)
    app.register_blueprint(contexts.bp)
    app.register_blueprint(devices.bp)
    app.register_blueprint(sensors.bp)
    app.register_blueprint(users.bp)
    app.register_blueprint(api_keys.bp)

    return app
