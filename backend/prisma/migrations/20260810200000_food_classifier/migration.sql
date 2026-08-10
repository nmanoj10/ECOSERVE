-- Step 96 — dish enrichment from the Python food classifier (ai-service).
-- Nullable columns on ai_predictions, set once when a donation photo is
-- classified via POST /predict-url. Null when the AI service isn't configured
-- or the call failed — enrichment is advisory and never blocks listing.

-- AlterTable
ALTER TABLE "ai_predictions" ADD COLUMN "foodClass" TEXT,
ADD COLUMN "foodClassConfidence" DOUBLE PRECISION,
ADD COLUMN "foodClassUncertain" BOOLEAN,
ADD COLUMN "foodClassifierModel" TEXT;
