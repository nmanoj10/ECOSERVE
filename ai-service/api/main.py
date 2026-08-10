import os
import sys
import shutil
import uuid
import torch
import httpx
from fastapi import FastAPI, UploadFile, File, HTTPException
from contextlib import asynccontextmanager
from pydantic import BaseModel

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import config
from src.predict import predict_image

# State variables
model_loaded = False
project_root = os.path.dirname(os.path.abspath(__file__))
model_path_v2 = os.path.join(os.path.dirname(project_root), "models", "best_food_classifier_v2.pth")
model_path_v1 = os.path.join(os.path.dirname(project_root), "models", "best_food_classifier.pth")

# Default model path resolution
model_path = model_path_v2 if os.path.exists(model_path_v2) else model_path_v1
confidence_threshold = 0.70

# URL-input path (docs/ai-food-classifier.md — "input gap"): the Ecoserve
# backend stores ImageKit URLs, not raw uploads. Cap the fetched image size
# and timeout so a slow/huge remote file can't pin a worker.
MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024  # 8 MB
DOWNLOAD_TIMEOUT = 10.0  # seconds


class PredictUrlRequest(BaseModel):
    imageUrl: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model_loaded, confidence_threshold, model_path
    if config:
        confidence_threshold = config.confidence_threshold

    # Re-evaluate in case model was created since boot
    model_path = model_path_v2 if os.path.exists(model_path_v2) else model_path_v1

    if os.path.exists(model_path):
        try:
            device = torch.device("cuda" if torch.cuda.is_available() else ("mps" if hasattr(torch.backends, "mps") and torch.backends.mps.is_available() else "cpu"))
            checkpoint = torch.load(model_path, map_location=device)
            if 'model_state_dict' in checkpoint and 'class_names' in checkpoint:
                model_loaded = True
                print(f"ECOSERVE Model loaded successfully from {model_path}")
        except Exception as e:
            print(f"Error loading model on startup: {e}")
    else:
        print(f"Warning: Model file not found at {model_path}. Please train the model first.")

    yield


app = FastAPI(
    title="ECOSERVE Food Recognition API",
    description="API for food type recognition of the ECOSERVE food redistribution logistics framework.",
    version="1.0.0",
    lifespan=lifespan
)

# No CORS middleware: this service is called server-to-server by the Ecoserve
# backend only (the frontend never talks to it directly, see
# docs/architecture.md). If browser access is ever needed, add a restricted
# CORSMiddleware with an explicit origin allowlist — never `*` + credentials.


def run_inference(temp_file_path: str) -> dict:
    """
    Runs the shared classification pipeline (quality check → preprocessing →
    CNN → threshold logic) for a local temp image file and shapes the response.

    Raises HTTPException(400) when the image fails the quality checks.
    """
    global model_path, confidence_threshold

    model_path = model_path_v2 if os.path.exists(model_path_v2) else model_path_v1

    prediction_result = predict_image(
        image_path=temp_file_path,
        model_path=model_path,
        config_threshold=confidence_threshold,
        generate_cam=False
    )

    if not prediction_result["success"]:
        raise HTTPException(status_code=400, detail=prediction_result["error"])

    return {
        "success": True,
        "food_class": prediction_result["food_class"],
        "confidence": prediction_result["confidence"],
        "uncertain": prediction_result["uncertain"],
        "top_predictions": prediction_result["top_predictions"],
        "model_version": "v2" if "best_food_classifier_v2.pth" in model_path else "v1"
    }


@app.get("/health")
def health_check():
    """
    Returns service health and model loading status.
    """
    global model_loaded, model_path
    if not model_loaded:
        model_path = model_path_v2 if os.path.exists(model_path_v2) else model_path_v1
        if os.path.exists(model_path):
            try:
                device = torch.device("cuda" if torch.cuda.is_available() else ("mps" if hasattr(torch.backends, "mps") and torch.backends.mps.is_available() else "cpu"))
                checkpoint = torch.load(model_path, map_location=device)
                if 'model_state_dict' in checkpoint:
                    model_loaded = True
            except Exception:
                pass

    return {
        "status": "healthy",
        "model_loaded": model_loaded,
        "model_version": "v2" if "best_food_classifier_v2.pth" in model_path else "v1"
    }


@app.post("/predict")
async def predict_food(image: UploadFile = File(...)):
    """
    Validates an uploaded image and predicts its food category.
    """
    # Resolve target folders
    project_root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    temp_dir = os.path.join(project_root_dir, "temp")
    os.makedirs(temp_dir, exist_ok=True)

    temp_file_name = f"{uuid.uuid4()}_{image.filename}"
    temp_file_path = os.path.join(temp_dir, temp_file_name)

    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)

        return run_inference(temp_file_path)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
    finally:
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass


@app.post("/predict-url")
async def predict_url(req: PredictUrlRequest):
    """
    Classifies a food image already hosted at a URL (e.g. an ImageKit URL).

    URL-input path documented in docs/ai-food-classifier.md. The Ecoserve
    backend only sends URLs it validated against its own ImageKit endpoint,
    so the SSRF surface stays internal — keep this service unreachable from
    the public internet. Redirects are not followed (defense in depth: a
    hostile URL can't bounce the fetcher at internal hosts).
    """
    project_root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    temp_dir = os.path.join(project_root_dir, "temp")
    os.makedirs(temp_dir, exist_ok=True)

    # Forced .jpg extension: the quality pipeline re-verifies the real content
    # via Pillow regardless, so any supported format (jpg/png/webp) is fine.
    temp_file_path = os.path.join(temp_dir, f"{uuid.uuid4()}.jpg")

    try:
        # Stream the download and cap it while reading, so a huge remote file
        # can't be buffered into memory before the size check rejects it.
        async with httpx.AsyncClient(timeout=DOWNLOAD_TIMEOUT, follow_redirects=False) as client:
            async with client.stream("GET", req.imageUrl) as resp:
                resp.raise_for_status()
                total = 0
                chunks = []
                async for chunk in resp.aiter_bytes():
                    total += len(chunk)
                    if total > MAX_DOWNLOAD_BYTES:
                        raise HTTPException(status_code=400, detail="Image too large to classify")
                    chunks.append(chunk)
                content = b"".join(chunks)

        with open(temp_file_path, "wb") as buffer:
            buffer.write(content)

        return run_inference(temp_file_path)

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch image URL: HTTP {e.response.status_code}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch image URL: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
    finally:
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass
