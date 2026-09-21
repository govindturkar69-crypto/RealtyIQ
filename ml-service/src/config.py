import os
from urllib.parse import urlparse

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATASET = os.getenv("DATASET", "bengaluru")
MODELS_DIR = os.path.join(BASE_DIR, "models")
MODEL_PATH = os.path.join(MODELS_DIR, "model.joblib")
METADATA_PATH = os.path.join(MODELS_DIR, "metadata.json")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")

RANDOM_STATE = 42
TEST_SIZE = 0.2
CV_FOLDS = 5
CONFIDENCE_Z = 1.96

API_TITLE = "RealtyIQ ML Inference Service"
API_VERSION = "1.0.0"
NODE_ENV = os.getenv("NODE_ENV", "development")
ML_SERVICE_TOKEN = os.getenv("ML_SERVICE_TOKEN", "").strip()


def parse_allowed_origins(raw: str):
    values = [item.strip().rstrip("/") for item in raw.split(",") if item.strip()]
    if not values:
        raise RuntimeError("ALLOWED_ORIGINS must contain at least one explicit origin")
    if len(values) > 20:
        raise RuntimeError("ALLOWED_ORIGINS contains too many origins")
    normalized = []
    for origin in values:
        parsed = urlparse(origin)
        if (origin == "*" or len(origin) > 2048 or parsed.scheme not in {"http", "https"}
                or not parsed.netloc or parsed.username or parsed.password
                or parsed.path not in {"", "/"}
                or parsed.params or parsed.query or parsed.fragment):
            raise RuntimeError("ALLOWED_ORIGINS must contain explicit HTTP(S) origins")
        if origin not in normalized:
            normalized.append(origin)
    return normalized


_allowed_origins_raw = os.getenv("ALLOWED_ORIGINS")
if NODE_ENV == "production" and not _allowed_origins_raw:
    raise RuntimeError("ALLOWED_ORIGINS is required in production")
ALLOWED_ORIGINS = parse_allowed_origins(_allowed_origins_raw or "http://localhost:3000")
if NODE_ENV == "production":
    if not ML_SERVICE_TOKEN:
        raise RuntimeError("ML_SERVICE_TOKEN is required in production")
    if (len(ML_SERVICE_TOKEN) < 32 or len(set(ML_SERVICE_TOKEN)) < 4 or ML_SERVICE_TOKEN in {"change_me", "change_me_ml"}
            or ML_SERVICE_TOKEN.lower().startswith("replace_with_")
            or "change_me" in ML_SERVICE_TOKEN.lower()):
        raise RuntimeError("ML_SERVICE_TOKEN must be a unique random secret of at least 32 characters")
