import os
import sys
import time
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
import config as C
from schemas import (PredictionRequest, PredictionResponse,
                     FeatureImportanceItem, HealthResponse)
from predictor import Predictor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("ml-service")

app = FastAPI(title=C.API_TITLE, version=C.API_VERSION)
app.add_middleware(CORSMiddleware,
                   allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
                   allow_methods=["*"], allow_headers=["*"])
predictor = Predictor()

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    resp = await call_next(request)
    logger.info("%s %s -> %s (%.1f ms)", request.method, request.url.path,
                resp.status_code, (time.time() - start) * 1000)
    return resp

@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    logger.exception("Unhandled error")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(status="ok", model_loaded=predictor.ready,
                          model_name=predictor.meta.get("model_name"))

@app.get("/localities")
def localities():
    if not predictor.ready and not predictor.enums():
        raise HTTPException(503, "Metadata not loaded")
    return predictor.enums()

@app.get("/model-info")
def model_info():
    if not predictor.meta:
        raise HTTPException(503, "Model not loaded")
    return predictor.info()

@app.get("/feature-importance", response_model=list[FeatureImportanceItem])
def feature_importance(top: int = 15):
    if not predictor.meta:
        raise HTTPException(503, "Model not loaded")
    return predictor.feature_importance(top)

@app.post("/predict", response_model=PredictionResponse)
def predict(req: PredictionRequest):
    if not predictor.ready:
        raise HTTPException(503, "Model not loaded. Run training first.")
    try:
        return predictor.predict(req.model_dump())
    except Exception as e:
        raise HTTPException(400, str(e))
