# API design (planned)

> These endpoints are **planned** — nothing is implemented yet. Treat this document as the contract to build against.

## Conventions

- Backend base path: `/api/v1`
- JSON request/response bodies with `Content-Type: application/json`
- Errors use a structured shape: `{ "error": { "code": "...", "message": "..." } }`

## Backend — REST

### Auth

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Create account — `{ email, password, displayName }` |
| POST | `/api/v1/auth/login` | Exchange credentials for a JWT — `{ email, password }` |

### Businesses (green directory)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/businesses` | List/paginate; filter by `category`, `location`, `sustainabilityScore` |
| GET | `/api/v1/businesses/:id` | Business detail incl. certifications and reviews |
| POST | `/api/v1/businesses` | Create a business listing (owners/verified users) |

### Impact tracking

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/impact/summary` | Aggregated CO₂ saved / footprint over time |
| POST | `/api/v1/impact/entries` | Log an impact activity — `{ type, amount, occurredAt }` |
| DELETE | `/api/v1/impact/entries/:id` | Remove an entry |

## AI service — internal HTTP

| Method | Path | Description |
| --- | --- | --- |
| POST | `/v1/estimate` | Estimate carbon impact — `{ activity, quantity }` → `{ co2Kg, confidence }` |
| POST | `/v1/recommend` | Rank businesses for a user — `{ userId, context }` → `{ businessIds: [] }` |
| POST | `/v1/chat` | Natural-language Q&A about sustainability — `{ prompt, history }` → `{ answer }` |
