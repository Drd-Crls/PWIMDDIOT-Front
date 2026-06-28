from functools import wraps

from flask import redirect, session, url_for


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if "access_token" not in session:
            return redirect(url_for("auth.login"))
        return view(*args, **kwargs)

    return wrapped


def current_user() -> dict | None:
    return session.get("user")


def is_admin() -> bool:
    user = current_user()
    return bool(user) and user.get("role") == "ADMIN"
