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

bp = Blueprint("sensors", __name__, url_prefix="/sensors")


def _devices_for_select():
    try:
        return api_client.get("/devices", params={"page": 1, "limit": 100})["items"]
    except Exception:
        return []


def _num_or_none(raw):
    raw = (raw or "").strip()
    return raw if raw else None


@bp.route("/")
@login_required
def list_sensors():
    params = {
        "page": request.args.get("page", 1, type=int),
        "limit": request.args.get("limit", 10, type=int),
        "sort_by": request.args.get("sort_by", "created_at"),
        "sort_order": request.args.get("sort_order", "desc"),
    }
    for key in ("name", "type", "unit", "device_id"):
        value = request.args.get(key)
        if value:
            params[key] = value

    data = api_client.get("/sensors", params=params)
    return render_template("sensors/list.html", data=data, filters=request.args)


@bp.route("/new", methods=["GET", "POST"])
@login_required
def create_sensor():
    if request.method == "POST":
        payload = {
            "name": request.form["name"].strip(),
            "type": request.form["type"].strip(),
            "unit": request.form.get("unit") or None,
            "min_value": _num_or_none(request.form.get("min_value")),
            "max_value": _num_or_none(request.form.get("max_value")),
            "device_id": request.form["device_id"],
        }
        api_client.post("/sensors", json=payload)
        flash("Sensor criado!", "success")
        return redirect(url_for("sensors.list_sensors"))

    return render_template(
        "sensors/form.html", sensor=None, devices=_devices_for_select()
    )


@bp.route("/<sensor_id>/edit", methods=["GET", "POST"])
@login_required
def edit_sensor(sensor_id):
    if request.method == "POST":
        payload = {
            "name": request.form["name"].strip(),
            "type": request.form["type"].strip(),
            "unit": request.form.get("unit") or None,
            "min_value": _num_or_none(request.form.get("min_value")),
            "max_value": _num_or_none(request.form.get("max_value")),
            "device_id": request.form["device_id"],
        }
        api_client.put(f"/sensors/{sensor_id}", json=payload)
        flash("Sensor atualizado!", "success")
        return redirect(url_for("sensors.list_sensors"))

    sensor = api_client.get(f"/sensors/{sensor_id}")
    return render_template(
        "sensors/form.html", sensor=sensor, devices=_devices_for_select()
    )


@bp.route("/<sensor_id>/delete", methods=["POST"])
@login_required
def delete_sensor(sensor_id):
    api_client.delete(f"/sensors/{sensor_id}")
    flash("Sensor removido.", "info")
    return redirect(url_for("sensors.list_sensors"))
