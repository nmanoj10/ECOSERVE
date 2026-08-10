import { env } from '../config/env.js'

/**
 * Food-type classification from the Python ai-service (EfficientNet-B0,
 * 20 Indian dishes — see `docs/ai-food-classifier.md` and `ai-service/`).
 *
 * This is the complementary "detect the dish" step (Step 96): it runs
 * alongside the rule-based freshness scoring (`scoreDonation`), never
 * replacing it — the AI service has no freshness model.
 *
 * Fail-open by design: any error (service down, timeout, 4xx/5xx, unset
 * `AI_SERVICE_URL`) returns `null` and logs, so dish enrichment can never
 * block or fail donation creation.
 */

export interface FoodClassification {
  foodClass: string
  /** 0–1 probability of `foodClass` (the raw top class, even when uncertain). */
  confidence: number
  /** true when the top class fell below the AI service's 0.70 threshold. */
  uncertain: boolean
  topPredictions: Array<{ class: string; probability: number }>
  /** "v1" | "v2" — which trained weights produced the prediction. */
  modelVersion: string
}

/** Raw snake_case payload returned by the Python ai-service `/predict-url`. */
interface RawFoodClassification {
  success: boolean
  food_class: string
  confidence: number
  uncertain: boolean
  top_predictions: Array<{ class: string; probability: number }>
  model_version: string
}

/**
 * Classifies the dish in an ImageKit-hosted photo by calling
 * `POST /predict-url` on the ai-service.
 *
 * @returns the classification, or `null` when the AI service isn't configured
 *          or the call failed (enrichment is advisory).
 */
export async function classifyFoodImage(imageUrl: string, timeoutMs = 3000): Promise<FoodClassification | null> {
  // Awaited inside createDonation (enrichment is part of the response), so the
  // timeout caps worst-case donation latency. Connection-refused fails in ms;
  // only a service that accepts but stalls costs the full timeout.
  if (!env.AI_SERVICE_URL) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const resp = await fetch(`${env.AI_SERVICE_URL}/predict-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl }),
      signal: controller.signal,
    })

    if (!resp.ok) {
      console.error(`[ai] food classifier returned HTTP ${resp.status} for ${imageUrl}`)
      return null
    }

    const data = (await resp.json()) as Partial<RawFoodClassification>
    if (data.success !== true || typeof data.food_class !== 'string') {
      console.error('[ai] food classifier returned an unexpected payload')
      return null
    }

    return {
      foodClass: data.food_class,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
      uncertain: data.uncertain === true,
      topPredictions: Array.isArray(data.top_predictions) ? data.top_predictions : [],
      modelVersion: typeof data.model_version === 'string' ? data.model_version : 'unknown',
    }
  } catch (err) {
    // AbortError from the timeout is the common case (service not running).
    console.error(`[ai] food classifier call failed for ${imageUrl}:`, err instanceof Error ? err.message : err)
    return null
  } finally {
    clearTimeout(timer)
  }
}
