# syntax=docker/dockerfile:1

# ECOSERVE AI food-classifier (FastAPI + CPU PyTorch).
# Deployed by Render via ecoserve/render.yaml (service: ecoserve-ai).
# Kept CPU-only on purpose: the 16 MB EfficientNet-B0 infers fine without a
# GPU, and the CUDA wheels are ~10x larger (Render Docker builds would time out
# pulling them).

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# libgomp1 is the OpenMP runtime torch links against — python:3.11-slim does
# not ship it, and importing torch would fail with "libgomp.so.1: cannot open
# shared object file" without it.
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install CPU-only torch/torchvision from the PyTorch CPU index, pinned so pip
# can never "upgrade" them to the multi-GB CUDA wheels via requirements.txt.
# The `torch>=2.0.0` / `torchvision>=0.15.0` constraints below are satisfied.
RUN pip install --no-cache-dir \
    torch==2.5.1 torchvision==0.20.1 \
    --index-url https://download.pytorch.org/whl/cpu

# Remaining dependencies (torch/torchvision skipped as already installed).
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App code, config, and the trained weights ship in the image.
COPY config.yaml ./
COPY src ./src
COPY api ./api
COPY models ./models

# Render injects $PORT at runtime; 8000 is the local default.
EXPOSE 8000

# uvicorn must run from /app so `api.main:app` imports resolve.
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
