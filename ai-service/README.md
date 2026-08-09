# AI Service

The Ecoserve ML/AI service. **Planned stack:** Python + FastAPI.

## Responsibilities

- Carbon-impact estimation from activity data.
- Personalized business recommendations.
- Natural-language sustainability Q&A.

## Planned structure

```
ai-service/
└── app/
    ├── routes/    # FastAPI routers
    ├── services/  # AI/ML logic
    ├── models/    # Domain / response models
    └── schemas/   # Request validation schemas (Pydantic)
```

## Scripts (planned)

| Command | Description |
| --- | --- |
| `uvicorn app.main:app --reload` | Run with auto-reload |
| `pytest` | Run tests |
