#!/usr/bin/env bash
set -e
export DATASET=${DATASET:-bengaluru}
python src/train.py --dataset "$DATASET"
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001} --app-dir app
