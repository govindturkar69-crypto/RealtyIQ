import os
import sys
import time
import logging
import json
from datetime import datetime, timezone
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
import config as C
from schemas import (PredictionRequest, PredictionResponse,
                     FeatureImportanceItem, HealthResponse)
from predictor import Predictor
from security import require_service_auth, safe_request_id

logger = logging.getLogger("ml-service")


class JsonFormatter(logging.Formatter):
    def format(self, record):
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "level": record.levelname.lower(),
            "service": "ml",
            "event": getattr(record, "event", "log"),
        }
        for key in ("requestId", "method", "path", "status", "durationMs", "errorType"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        return json.dumps(payload, separators=(",", ":"))


handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logger.handlers.clear()
logger.addHandler(handler)
logger.setLevel(getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO))
logger.propagate = False

app = FastAPI(title=C.API_TITLE, version=C.API_VERSION)
app.add_middleware(CORSMiddleware,
                   allow_origins=C.ALLOWED_ORIGINS,
                   allow_methods=["GET", "POST", "OPTIONS"],
                   allow_headers=["Authorization", "Content-Type", "X-Request-Id"])
predictor = Predictor()

@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = safe_request_id(request.headers.get("x-request-id"))
    request.state.request_id = request_id
    start = time.time()
    resp = await call_next(request)
    resp.headers["X-Request-Id"] = request_id
    duration_ms = round((time.time() - start) * 1000, 1)
    level = logging.ERROR if resp.status_code >= 500 and resp.status_code != 503 else logging.WARNING if resp.status_code >= 400 else logging.INFO
    logger.log(level, "request completed", extra={
        "event": "http_request_completed", "requestId": request_id, "method": request.method,
        "path": request.url.path, "status": resp.status_code, "durationMs": duration_ms,
    })
    return resp

@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", safe_request_id(None))
    logger.error("unhandled request error", extra={
        "event": "http_request_error", "requestId": request_id, "method": request.method,
        "path": request.url.path, "status": 500, "errorType": type(exc).__name__,
    })
    return JSONResponse(status_code=500, content={"detail": "Internal server error", "requestId": request_id})

@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(status="ok", model_loaded=predictor.ready,
                          model_name=predictor.meta.get("model_name"))

@app.get("/localities", dependencies=[Depends(require_service_auth)])
def localities():
    if not predictor.ready and not predictor.enums():
        raise HTTPException(503, "Metadata not loaded")
    return predictor.enums()

@app.get("/model-info", dependencies=[Depends(require_service_auth)])
def model_info():
    if not predictor.meta:
        raise HTTPException(503, "Model not loaded")
    return predictor.info()

@app.get("/feature-importance", response_model=list[FeatureImportanceItem], dependencies=[Depends(require_service_auth)])
def feature_importance(top: int = 15):
    if not predictor.meta:
        raise HTTPException(503, "Model not loaded")
    return predictor.feature_importance(top)

@app.post("/predict", response_model=PredictionResponse, dependencies=[Depends(require_service_auth)])
def predict(req: PredictionRequest, request: Request):
    if not predictor.ready:
        raise HTTPException(503, "Model not loaded. Run training first.")
    try:
        return predictor.predict(req.model_dump())
    except Exception as exc:
        logger.error("prediction failed", extra={
            "event": "prediction_failed", "requestId": getattr(request.state, "request_id", None),
            "method": request.method, "path": request.url.path, "status": 500,
            "errorType": type(exc).__name__,
        })
        raise HTTPException(500, "Prediction failed")
