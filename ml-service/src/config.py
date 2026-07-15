import os

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
