# Food Classifier — AI Service Contract (reference note)

> **Status:** **Implemented in `ai-service/`** — the friend's v2 code + trained weights were copied
> in Aug 2026 (junk dirs excluded, CORS `*`+credentials removed).
> Source: friend's standalone FastAPI app — `ECOSERVE_Food_AI` (`api.main:app`, port 8000,
> trained EfficientNet-B0 on the Indian Food Image Dataset, 20 classes, ~79.3% test accuracy).
> This note records the response contract and the remaining backend integration steps.

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
- **✔ Input gap closed (Step 96):** `POST /predict-url { imageUrl }` was added to `ai-service/`
  (fetches the ImageKit image server-side, 8 MB / 10 s caps) and the backend calls it on
  donation create via `AI_SERVICE_URL` (`backend/src/services/foodClassifierService.ts`).

### Intended use (implemented, Step 96)

1. Donor uploads photo → ImageKit returns URL.
2. Backend `createDonation` (Step 47 "trigger AI" block in `donationController.ts`)
   calls `POST /predict-url` with the first image URL (`classifyFoodImage`, fail-open).
3. The classification is stored on the same `AiPrediction` row as the freshness score
   (new columns `foodClass`, `foodClassConfidence`, `foodClassUncertain`,
   `foodClassifierModel` — migration `20260810200000_food_classifier`). Donor-entered
   `foodName`/category are never overwritten; the prediction is enrichment only.

---

## 3. Checklist — implementation status

- [x] Copy friend's code + **`best_food_classifier_v2.pth` weights** into `ecoserve/ai-service/`
      (done Aug 2026; `.venv`/`__pycache__`/`temp` excluded).
- [x] Add `requirements.txt` to `ai-service/` (`fastapi`, `uvicorn`, `pillow`,
      `python-multipart`, `torch`, `torchvision`).
- [x] Decide layout: kept the friend's working `api/` + `src/` + `models/` layout
      (standalone, run on port 8000) instead of the empty `app/` scaffold.
- [x] Add a URL-input path: `POST /predict-url { imageUrl }` in `ai-service/api/main.py`
      (shared `run_inference` helper; 8 MB / 10 s caps).
- [x] Backend: `AI_SERVICE_URL` added to `backend/src/config/env.ts` + `.env.example`.
      Optional — enrichment is skipped when unset.
- [x] Backend: HTTP client (`classifyFoodImage` in `services/foodClassifierService.ts`, Node
      `fetch` + abort timeout, fail-open) + call site in `donationController.ts`; new nullable
      `AiPrediction` columns via migration `20260810200000_food_classifier`.
- [x] Reuse `scoreDonation()` for freshness; only wire the classifier for food type.
