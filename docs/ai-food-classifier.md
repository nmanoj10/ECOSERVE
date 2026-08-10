# Food Classifier — AI Service Contract (reference note)

> **Status:** Contract documented only. The model is **not implemented** in this repo yet.
> Source: friend's standalone FastAPI app — `ECOSERVE_Food_AI` (`api.main:app`, port 8000,
> trained EfficientNet-B0 on the Indian Food Image Dataset, 20 classes, ~79.3% test accuracy).
> This note records the response shape so the model can be plugged in later without re-work.

---

## 1. API contract

### Endpoint

| | |
|---|---|
| Method / path | `POST /predict` |
| Content type | `multipart/form-data` — field name `image`, value = image file |
| Input constraints | JPG / PNG / JPEG; image quality checked before inference |
| Output | JSON (below) |

### Request example

```bash
curl -X POST http://127.0.0.1:8000/predict \
  -F "image=@food dataset/Foodies_Challenge_Dataset/Dosa/dosatrain (20).jpg"
```

### Response — high confidence (≥ 0.70 threshold)

```json
{
  "success": true,
  "food_class": "Dosa",
  "confidence": 0.9609,
  "uncertain": false,
  "top_predictions": [
    { "class": "Dosa", "probability": 0.9609 },
    { "class": "Pav_bhaji", "probability": 0.0180 },
    { "class": "Samosa", "probability": 0.0047 },
    { "class": "Chole_bature", "probability": 0.0033 },
    { "class": "Dahl", "probability": 0.0030 }
  ]
}
```

### Response — low confidence (below 0.70 → rejected as "Unknown")

```json
{
  "success": true,
  "food_class": "Unknown",
  "confidence": 0.5959,
  "uncertain": true,
  "top_predictions": [
    { "class": "Chapathi", "probability": 0.5959 },
    { "class": "Idli", "probability": 0.2923 },
    { "class": "Chole_bature", "probability": 0.0619 },
    { "class": "Vada_pav", "probability": 0.0231 },
    { "class": "Dosa", "probability": 0.0063 }
  ]
}
```

### Field meanings

| Field | Type | Meaning |
|---|---|---|
| `success` | bool | Inference ran OK |
| `food_class` | string | Top predicted dish, or `"Unknown"` when `uncertain` |
| `confidence` | float 0–1 | Probability of `food_class` |
| `uncertain` | bool | `true` when top confidence < 0.70 |
| `top_predictions` | array | Top 5 `{ class, probability }` for explainability |

### Known classes (confirmed from the README — full 20-class mapping lives in the friend's code)

`Biryani, Chapathi, Dosa, Chole_bature, Aloo_matar, Pav_bhaji, Samosa, Dahl, Idli, Vada_pav, Naan, Kadai_paneer` (+ 8 more in the friend's repo, e.g. `dataset_analysis.py` / training code).

---

## 2. Where it plugs into ECOSERVE

```
frontend (React) ── REST ──► backend (Express) ── HTTP ──► ai-service (FastAPI, this model)
                                  │
                                  └─► AiPrediction table (Postgres via Prisma)
```

- **Frontend never calls the AI service directly** (per `docs/architecture.md`). Images are
  uploaded to **ImageKit** first; the backend only ever receives ImageKit `imageUrl`s.
- **Backend seam:** `backend/src/services/freshnessService.ts` → `scoreDonation()` is a local
  rule model that already fills the `AiPrediction` table
  (`freshnessScore`, `safeHours`, `spoilageRisk`, `priority`, `confidence`, `modelVersion`).
  The food classifier is **complementary** — it detects the *dish*, not freshness.
- **⚠️ Freshness is NOT covered:** the friend's `FreshnessModel` class raises
  `NotImplementedError`. Keep `scoreDonation()` for freshness scoring.
- **⚠️ Input gap:** `/predict` takes a raw image upload, but ECOSERVE has ImageKit URLs.
  Later implementation needs one of:
  - a `POST /predict-url { imageUrl }` endpoint that fetches the ImageKit image server-side, or
  - the backend fetching the image bytes and forwarding them to `/predict`.

### Intended use (decided, for later)

1. Donor uploads photo → ImageKit returns URL.
2. Backend `createDonation` (Step 47 "trigger AI" block in `donationController.ts`)
   calls the AI service with the image.
3. Use the response to: pre-fill / validate `foodName` + `FoodCategory`, and/or store the
   classification in the `AiPrediction` table alongside the freshness score.

---

## 3. Checklist — when you implement the model later

- [ ] Copy friend's code + **`best_food_classifier.pth` weights** into `ecoserve/ai-service/`
      (weights live on the friend's machine: `.../ECOSERVE_Food_AI/models/`).
- [ ] Add `requirements.txt` to `ai-service/` (`fastapi`, `uvicorn`, `pillow`,
      `python-multipart`, `torch`, `torchvision`).
- [ ] Decide layout: adapt to `app/routes/`, `app/services/`, `app/schemas/` scaffold, or keep
      standalone and run separately on port 8000.
- [ ] Add a URL-input path (see "Input gap" above).
- [ ] Backend: add `AI_SERVICE_URL` to `backend/src/config/env.ts` (+ `.env.example`).
- [ ] Backend: small HTTP client (Node 20+ `fetch`) + call site in `donationController.ts`.
- [ ] Reuse `scoreDonation()` for freshness; only wire the classifier for food type.
