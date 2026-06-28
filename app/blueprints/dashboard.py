from flask import Blueprint, render_template

from app import api_client
from app.auth_utils import login_required

bp = Blueprint("dashboard", __name__)


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
