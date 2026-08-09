"""Stub FastAPI para rodar o painel de monitoramento ponta a ponta.

Implementa apenas os 3 endpoints que o front consome, com CORS liberado e um
gerador de dados semente (varios devices/sensores; um device de alta densidade a
48 ingests/dia, os demais ~4/dia; metadata misturando chaves numericas e nao
numericas). O teto de 7 dias e aplicado tambem aqui, no handler de /ingests.

Como rodar (separado do Flask), quando voce nao tem o backend real a mao:

    pip install -r requirements-stub.txt
    uvicorn stub_api:app --port 8000 --reload

Depois aponte o Flask para ele em .env:  API_BASE_URL=http://localhost:8000
e suba o Flask normalmente (python run.py). O navegador fala com o proxy
same-origin do Flask (/monitor/api/*), que repassa para este stub no servidor
— entao nem CORS e necessario nesse fluxo. O CORS abaixo fica so como bonus,
caso alguem aponte o browser direto para o stub.
"""

import math
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="PWIMDDIOT stub API")

# CORS liberado — o navegador (Flask em :5000) faz fetch cross-origin aqui.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DAY = 86400  # segundos
MAX_WINDOW = timedelta(days=7)


def _uid(prefix: str, n: int) -> str:
    return f"{prefix}0000000-0000-4000-8000-00000000{n:04d}"


def _wave(t_ms: float, period: float, amp: float, base: float, phase: float = 0.0) -> float:
    x = (t_ms / (DAY * 1000)) * (2 * math.pi) * (1 / period) + phase
    noise = math.sin(t_ms / 137000 + phase * 3) * amp * 0.12
    return base + math.sin(x) * amp + noise


def _r(v: float, d: int = 2) -> float:
    return round(v, d)


# Cada spec gera a metadata (mistura numerico + string/bool) a partir do tempo.
def _md_temp(t):
    return {
        "temperature": _r(_wave(t, 1, 6, 22)),
        "humidity": _r(_wave(t, 1, 15, 55, 1.6)),
        "dew_point": _r(_wave(t, 1, 4, 12, 0.8)),
        "battery": _r(_wave(t, 4, 8, 82, 2)),
        "unit": "C",
        "status": "ok",
    }


def _md_wind(t):
    return {
        "wind_speed": _r(abs(_wave(t, 0.7, 5, 6, 0.5))),
        "wind_gust": _r(abs(_wave(t, 0.5, 8, 9, 0.9))),
        "direction_deg": round(abs(_wave(t, 2, 180, 180)) % 360),
        "battery": _r(_wave(t, 4, 8, 80, 2)),
        "quadrant": "NE",
    }


def _md_hvac(t):
    return {
        "setpoint": 21,
        "ambient": _r(_wave(t, 1, 3, 22, 0.4)),
        "duty_cycle": _r(abs(_wave(t, 0.8, 40, 45)), 1),
        "fan_rpm": round(900 + abs(_wave(t, 0.8, 300, 300))),
        "mode": "auto",
    }


def _md_air(t):
    return {
        "co2_ppm": round(420 + abs(_wave(t, 1, 250, 250, 0.3))),
        "pm25": _r(abs(_wave(t, 1.5, 12, 14)), 1),
        "voc_index": round(80 + abs(_wave(t, 1, 60, 60, 1.1))),
        "calibrated": True,
    }


def _md_flow(t):
    return {
        "flow_rate": _r(abs(_wave(t, 0.6, 20, 40))),
        "pressure_bar": _r(abs(_wave(t, 1, 1.2, 3.4)), 2),
        "rpm": round(1400 + abs(_wave(t, 0.6, 400, 400))),
        "vibration": _r(abs(_wave(t, 0.4, 0.8, 1.1)), 3),
        "note": "nominal",
    }


def _md_health(t):
    return {
        "cpu_pct": _r(abs(_wave(t, 0.5, 30, 40)), 1),
        "mem_pct": _r(50 + abs(_wave(t, 2, 20, 20)), 1),
        "uptime_h": round((t % (30 * DAY * 1000)) / 3600000),
        "signal_dbm": round(-60 + _wave(t, 1, 12, 0)),
        "firmware": "1.4.2",
    }


def _md_soil(t):
    return {
        "moisture_pct": _r(35 + _wave(t, 2, 12, 0, 0.7), 1),
        "soil_temp": _r(_wave(t, 1, 3, 18, 0.2)),
        "ph": _r(6.4 + _wave(t, 3, 0.5, 0) * 0.2, 2),
        "conductivity": _r(1.2 + abs(_wave(t, 1.5, 0.6, 0)), 3),
        "probe": "SP-1",
    }


SENSOR_SPECS = {
    "temp": ("Temperatura", "temperature", "C", "high", _md_temp),
    "wind": ("Vento", "wind", "m/s", "high", _md_wind),
    "hvac": ("Termostato", "temperature", "C", "low", _md_hvac),
    "air": ("Qualidade do ar", "air_quality", "aqi", "low", _md_air),
    "flow": ("Vazao", "flow", "L/min", "low", _md_flow),
    "health": ("Saude do gateway", "diagnostics", None, "low", _md_health),
    "soil": ("Solo", "moisture", "%", "low", _md_soil),
}

DEVICE_SPECS = [
    ("Estacao Meteorologica A", "WS-100", "Cobertura", "ACTIVE", ["temp", "wind"]),
    ("Controlador HVAC", "HV-22", "Andar 2", "MAINTENANCE", ["hvac", "air"]),
    ("Bomba d'agua", "WP-7", "Subsolo", "ACTIVE", ["flow"]),
    ("Gateway de Borda", "GW-3", None, "OFFLINE", ["health"]),
    ("Sonda de Solo", "SP-1", "Estufa", "INACTIVE", ["soil"]),
]


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _build_seed():
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    start = now - timedelta(days=14)
    now_iso = _iso(now)

    devices, sensors, ingests = [], [], []
    ctx = _uid("c", 1)
    s_count = 0
    i_count = 0

    for di, (name, model, location, status, skeys) in enumerate(DEVICE_SPECS, start=1):
        device_id = _uid("d", di)
        devices.append({
            "id": device_id,
            "name": name,
            "model": model,
            "location": location,
            "status": status,
            "context_id": ctx,
            "created_at": _iso(start),
            "updated_at": now_iso,
        })
        for skey in skeys:
            sname, stype, unit, density, md_fn = SENSOR_SPECS[skey]
            s_count += 1
            sensor_id = _uid("s", s_count)
            sensors.append({
                "id": sensor_id,
                "name": sname,
                "type": stype,
                "unit": unit,
                "min_value": None,
                "max_value": None,
                "device_id": device_id,
                "created_at": _iso(start),
                "updated_at": now_iso,
            })
            step = timedelta(seconds=DAY / 48) if density == "high" else timedelta(seconds=DAY / 4)
            t = start
            while t <= now:
                i_count += 1
                t_ms = t.timestamp() * 1000
                iso = _iso(t)
                ingests.append({
                    "id": _uid("i", i_count),
                    "sensor_id": sensor_id,
                    "metadata": md_fn(t_ms),
                    "created_at": iso,
                    "updated_at": iso,
                })
                t += step

    return devices, sensors, ingests


DEVICES, SENSORS, INGESTS = _build_seed()


@app.get("/devices")
def get_devices():
    return DEVICES


@app.get("/devices/{device_id}/sensors")
def get_sensors(device_id: str):
    return [s for s in SENSORS if s["device_id"] == device_id]


@app.get("/ingests")
def get_ingests(
    sensor_ids: str = Query("", description="ids de sensores separados por virgula"),
    from_: str = Query("", alias="from", description="data ISO (YYYY-MM-DD)"),
    to: str = Query("", description="data ISO (YYYY-MM-DD)"),
):
    wanted = {sid for sid in sensor_ids.split(",") if sid}
    if not wanted:
        return []

    def parse_from(s):
        return datetime.fromisoformat(s).replace(hour=0, minute=0, second=0, tzinfo=timezone.utc)

    def parse_to(s):
        return datetime.fromisoformat(s).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)

    from_dt = parse_from(from_) if from_ else None
    to_dt = parse_to(to) if to else None

    # Teto de 1 semana aplicado no servidor.
    if from_dt and to_dt and (to_dt - from_dt) > MAX_WINDOW:
        from_dt = to_dt - MAX_WINDOW

    out = []
    for ing in INGESTS:
        if ing["sensor_id"] not in wanted:
            continue
        t = datetime.fromisoformat(ing["created_at"].replace("Z", "+00:00"))
        if from_dt and t < from_dt:
            continue
        if to_dt and t > to_dt:
            continue
        out.append(ing)
    return out


@app.get("/")
def root():
    return {
        "service": "PWIMDDIOT stub API",
        "endpoints": ["/devices", "/devices/{id}/sensors", "/ingests?sensor_ids=&from=&to="],
        "devices": len(DEVICES),
        "sensors": len(SENSORS),
        "ingests": len(INGESTS),
    }
