# Freshness Endpoint — AI Service Contract (Step 51, reference note)

> **Status:** Contract documented only. Model **not implemented** yet — implement later per the
> checklist at the bottom. This endpoint is the seam where the backend's rule-based
> `scoreDonation()` (in `backend/src/services/freshnessService.ts`) gets replaced by a real
> HTTP call to the Python AI service.

---

## 1. Endpoint

| | |
|---|---|
| Method / path | `POST /predict/freshness` |
| Content type | `application/json` |
| Auth | internal (backend → AI service) |

### Request body

```json
{
  "foodType": "Cooked Meals",
  "preparedTime": "2026-08-10T10:00:00Z",
  "expiryTime": "2026-08-10T18:00:00Z",
  "storageCondition": "refrigerated",
  "temperature": 4,
  "humidity": 55
}
```

### Field meanings

| Field | Type | Required | Meaning |
|---|---|---|---|
| `foodType` | string | ✅ | Category / dish, e.g. `"Cooked Meals"`, `"Dosa"` — matches backend `FoodCategory.name` |
| `preparedTime` | ISO-8601 datetime | ✅ | When the food was cooked/prepared (backend `Donation.preparedAt`) |
| `expiryTime` | ISO-8601 datetime | ✅ | When the food is no longer safe (backend `Donation.expiryTime`) |
| `storageCondition` | string | ✅ | `refrigerated` \| `ambient` \| `frozen` |
| `temperature` | number (°C) | optional | Current storage temperature — lowers safe hours when high |
| `humidity` | number (% RH) | optional | Ambient humidity — higher = faster spoilage for produce |

### Response body

```json
{
  "success": true,
  "freshnessScore": 67,
  "safeHours": 4.0,
  "spoilageRisk": "MEDIUM",
  "priority": 3,
  "confidence": 0.9,
  "modelVersion": "freshness-v1"
}
```

### Field meanings

| Field | Type | Range / values | Meaning |
|---|---|---|---|
| `success` | bool | — | Inference ran OK |
| `freshnessScore` | float | 0–100 | Overall freshness (higher = fresher) |
| `safeHours` | float | ≥ 0 | Hours the food remains safe to travel/redistribute |
| `spoilageRisk` | string | `LOW` \| `MEDIUM` \| `HIGH` | Risk of spoilage before expiry |
| `priority` | int | 1–5 | Redistribution urgency (5 = most urgent) |
| `confidence` | float | 0–1 | Model certainty |
| `modelVersion` | string | — | Add this for the DB — see below |

> ⚠️ `modelVersion` wasn't in the spec but the DB requires it — **add it to the response**.

---

## 2. Why this maps 1:1 to your database

The output columns are **exactly** the `AiPrediction` table in `backend/prisma/schema.prisma`:

```
AiPrediction: freshnessScore  safeHours  spoilageRisk  priority  confidence  modelVersion
                   ↑             ↑            ↑            ↑           ↑            ↑
             freshnessScore  safeHours   spoilageRisk  priority  confidence  modelVersion
                              (freshness endpoint response)
```

So the backend flow after implementing: `createDonation` (Step 47 block in
`donationController.ts`) → call `POST /predict/freshness` → `prisma.aiPrediction.create({...})`.
No schema changes needed.

### Input mapping from the Donation you already store

| Endpoint input | Source |
|---|---|
| `foodType` | `donation.category.name` (or `foodName`) |
| `preparedTime` | `donation.preparedAt` |
| `expiryTime` | `donation.expiryTime` |
| `storageCondition` / `temperature` / `humidity` | ❌ **Not in the DB yet** — backend must either default them (`"ambient"`, etc.) or add fields to the donation form/schema later |

---

## 3. Implementation sketch (for later — follows the `ai-service/app/` scaffold)

**`app/schemas/freshness.py`**
```python
from pydantic import BaseModel
from typing import Literal, Optional

class FreshnessRequest(BaseModel):
    foodType: str
    preparedTime: str  # ISO-8601
    expiryTime: str
    storageCondition: Literal["refrigerated", "ambient", "frozen"]
    temperature: Optional[float] = None   # °C
    humidity: Optional[float] = None      # % RH

class FreshnessResponse(BaseModel):
    success: bool = True
    freshnessScore: float
    safeHours: float
    spoilageRisk: Literal["LOW", "MEDIUM", "HIGH"]
    priority: int
    confidence: float
    modelVersion: str
```

**`app/services/freshness.py`**
```python
class FreshnessModel:
    """Trained freshness model — not implemented yet.
    Replace the raise below with real inference when a labeled dataset is acquired."""

    def predict(self, req: FreshnessRequest) -> FreshnessResponse:
        raise NotImplementedError("FreshnessModel: no trained weights yet — see docs/ai-freshness-endpoint.md")
```

**`app/routes/predict.py`**
```python
from fastapi import APIRouter
from ..schemas.freshness import FreshnessRequest, FreshnessResponse
from ..services.freshness import FreshnessModel

router = APIRouter(prefix="/predict", tags=["predict"])
model = FreshnessModel()

@router.post("/freshness", response_model=FreshnessResponse)
def predict_freshness(req: FreshnessRequest) -> FreshnessResponse:
    return model.predict(req)
```

**Backend call site (`donationController.ts`)** — keep the rule-based `scoreDonation()`
as the fallback until the model ships, then swap it for:
```ts
const resp = await fetch(`${env.AI_SERVICE_URL}/predict/freshness`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    foodType: donation.category.name,
    preparedTime: donation.preparedAt?.toISOString(),
    expiryTime: donation.expiryTime?.toISOString(),
    storageCondition: 'ambient',
  }),
}).then((r) => r.json())
// resp → AiPrediction.create({ ...resp })
```

---

## 4. Checklist — when you implement later

- [ ] Add `app/schemas/freshness.py`, `app/services/freshness.py`, `app/routes/predict.py` (sketch above)
- [ ] Implement real inference in `FreshnessModel.predict()` (needs a freshness-labeled dataset — the food-classifier data has **no** freshness labels)
- [ ] Add `modelVersion` to the response (DB requires it)
- [ ] Backend: add `AI_SERVICE_URL` to `backend/src/config/env.ts` + `.env.example`
- [ ] Swap `scoreDonation()` call in `donationController.ts` for the HTTP call (keep rule model as fallback on error)
- [ ] Decide where `storageCondition`/`temperature`/`humidity` come from (defaults now, form fields later)
