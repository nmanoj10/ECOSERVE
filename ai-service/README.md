# AI Service — Ecoserve Food Classifier

FastAPI service that recognizes the **type of food in a photo** using a trained
EfficientNet-B0 CNN (20 Indian food classes, ~79.3% test accuracy). This is the
"food recognition" component of the Ecoserve ML architecture — it does **not**
score freshness (that stays with the backend's rule model,
`backend/src/services/freshnessService.ts`).

> Copied from the friend's standalone repo `ECOSERVE_Food_AI` (v2 model) with the
> CORS `*`+credentials anti-pattern removed — this service is called
> server-to-server by the Ecoserve backend, so it needs no browser CORS.

## Layout

```
ai-service/
├── api/main.py            # FastAPI app (lifespan checkpoint load, /health, /predict)
├── src/
│   ├── quality_check.py   # format / integrity / min-dim / brightness validation
│   ├── preprocessing.py   # 256px short-edge resize → 224×224 center crop, ImageNet norm
│   ├── model.py           # FoodClassifier (EfficientNet-B0 / -B2 / MobileNetV3 heads)
│   ├── predict.py         # softmax, top-5, τ=0.70 → "Unknown" when uncertain, CLI + Grad-CAM
│   ├── config.py          # YAML config (threshold, image size)
│   └── gradcam.py         # explainability heatmaps (off by default in the API)
├── models/
│   ├── best_food_classifier_v2.pth   # trained weights (16 MB)
│   ├── class_names_v2.json           # 20-class label mapping
│   ├── model_metadata_v2.json        # version, mean/std, threshold
│   └── training_config_v2.yaml
├── tests/                 # pytest suite (API, model, quality check, v2 pipeline)
├── config.yaml            # model + inference settings
├── requirements.txt
└── test_image.jpg         # sample for a quick smoke test
```

## Run

```bash
python -m venv .venv
.venv/Scripts/activate        # Windows (bash: source .venv/Scripts/activate)
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
```

Torch CPU wheels are enough for inference (no GPU needed for a 16 MB
EfficientNet-B0). The model is loaded once at startup (lifespan) and verified on
`/health`.

## API

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/health` | GET | `{ status, model_loaded, model_version }` |
| `/predict` | POST | `multipart/form-data`, field `image` (JPG/JPEG/PNG/WEBP, ≥ 100×100 px) |
| `/predict-url` | POST | JSON `{ "imageUrl": "..." }` — fetches an already-hosted image (e.g. ImageKit) server-side and runs the same pipeline. 8 MB / 10 s caps. Internal use only (backend → AI service). |

### `/predict` response

```json
{
  "success": true,
  "food_class": "Dosa",
  "confidence": 0.9609,
  "uncertain": false,
  "top_predictions": [
    { "class": "Dosa", "probability": 0.9609 },
    { "class": "Pav_bhaji", "probability": 0.0180 }
  ],
  "model_version": "v2"
}
```

Below the 0.70 confidence threshold, `food_class` becomes `"Unknown"` and
`uncertain` is `true`. Bad images (unsupported format, corrupt, < 100×100 px,
too dark/bright) return `400` with a descriptive message.

## Known gaps (see `docs/ai-food-classifier.md`)

- **Input gap closed:** `POST /predict-url { imageUrl }` covers the ImageKit
  URL case; the backend calls it on donation create (`AI_SERVICE_URL`).
- **Freshness is out of scope** for this model — the backend keeps using its
  rule-based `scoreDonation()` until a freshness-labeled dataset exists.

## Tests

```bash
pytest
```
