# Database Relationships

The full relationship map for the Ecoserve PostgreSQL schema (17 tables, 19 foreign keys — all live in Supabase's default `postgres` database). Source of truth: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).

## Relationship diagram

```
User (users)
 ├── 1—1  Donor        (donors.userId → users.id)
 ├── 1—1  Ngo          (ngos.userId → users.id)
 ├── 1—1  Volunteer    (volunteers.userId → users.id)
 ├── 1—N  Notification (notifications.userId → users.id)
 ├── 1—N  Review       as reviewer (reviews.reviewerId) and reviewee (reviews.revieweeId)
 ├── 1—N  Session      (sessions.userId → users.id)
 └── 1—N  AuditLog     (audit_logs.userId → users.id, nullable, SET NULL on delete)

Donor
 └── 1—N  Donation     (donations.donorId → donors.id, CASCADE)

FoodCategory
 └── 1—N  Donation     (donations.categoryId → food_categories.id, RESTRICT)

Donation
 ├── 1—N  DonationImage      (donation_images.donationId → donations.id, CASCADE)
 ├── 1—N  AiPrediction       (ai_predictions.donationId → donations.id, CASCADE)
 ├── 1—N  NgoRequest         (ngo_requests.donationId → donations.id, CASCADE)
 └── 1—N  VolunteerAssignment (volunteer_assignments.donationId → donations.id, CASCADE)
        └── 1—1  Delivery    (deliveries.assignmentId → volunteer_assignments.id, CASCADE)

Ngo
 └── 1—N  NgoRequest   (ngo_requests.ngoId → ngos.id, CASCADE)

Volunteer
 └── 1—N  VolunteerAssignment (volunteer_assignments.volunteerId → volunteers.id, CASCADE)

Delivery
 ├── 1—N  DeliveryLocation (delivery_locations.deliveryId → deliveries.id, CASCADE)
 └── 1—N  Review           (reviews.deliveryId → deliveries.id, CASCADE)
```

## Key design decisions

| Relationship | Cardinality | On delete | Why |
|---|---|---|---|
| User → Donor / Ngo / Volunteer | 1—1 (unique FK) | CASCADE | A user owns exactly one role profile; deleting the account removes it |
| Donor → Donations | 1—N | CASCADE | Donation history is removed with the donor account |
| Donation → category | N—1 | **RESTRICT** | Categories are reference data; never silently delete a category that has donations |
| Donation → NgoRequest / VolunteerAssignment / images / predictions | 1—N | CASCADE | All child records die with the donation listing |
| Assignment → Delivery | 1—1 (unique FK) | CASCADE | One delivery run per accepted assignment |
| Delivery → locations / reviews | 1—N | CASCADE | GPS trail and reviews are delivery-scoped |
| User → AuditLog | 1—N (nullable) | **SET NULL** | Audit history survives account deletion |

## Integrity rules worth knowing

- `NgoRequest` is unique per `(ngoId, donationId)` — an NGO can't double-request a donation.
- `Review` is unique per `(deliveryId, reviewerId)` — each reviewer rates a delivery once.
- `Delivery.assignmentId` is unique — strictly one delivery per assignment.
- `sessions.refreshTokenHash` is unique — the refresh flow looks sessions up by token.
- `analytics.date` is unique — one daily rollup row per day (normalize to midnight UTC).
- `rating` (1–5) and `priority` (1–5) ranges are enforced at the API validator layer, not the DB.

## Performance indexes (Phase 8)

Applied in migration `phase8_indexes`. Composite indexes are chosen to match real query patterns while covering the single-column lookups via leftmost-prefix rules.

| Table | Index | Serves |
|---|---|---|
| users | `(role, status)` | Admin user lists by role, and role + status filters (email is already unique-indexed) |
| donations | `(status, expiryTime)` | "Available food expiring soon" feed — status-only queries use the prefix |
| donations | `(categoryId, status)` | Browse donations by category + status |
| donations | `(donorId, createdAt)` | A donor's listing history, newest first (also indexes the FK) |
| donations | `(createdAt)` | Global recent-donations feed |
| ngos | `(verificationStatus)` | Admin verification queue |
| volunteers | `(availability)` | "Available volunteers" matching |
| delivery_locations | `(deliveryId, timestamp)` | GPS trail replay per delivery (also indexes the FK) |
| delivery_locations | `(timestamp)` | Time-window queries (e.g. all live samples for the realtime map) |
| notifications | `(userId, isRead)` | Unread counts and per-user inbox (also indexes the FK) |
| notifications | `(isRead)` | Spec-required; low selectivity, kept for compliance |

Note: Prisma does **not** auto-index foreign-key columns — the `donorId`, `categoryId`, `deliveryId`, and `userId` indexes above close that gap.

## Verification

All 19 foreign keys were verified live against the Supabase database (`information_schema` foreign-key audit, August 2026). See [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma) for the authoritative model definitions.
