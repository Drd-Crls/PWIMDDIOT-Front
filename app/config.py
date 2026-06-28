import os


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")
    # tempo maximo (segundos) de espera por resposta da API
    API_TIMEOUT = float(os.getenv("API_TIMEOUT", "10"))
