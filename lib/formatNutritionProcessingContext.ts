/**
 * Short, label-adjacent nutrition notes for the processing / “whole food vs industrial” card.
 * Keys follow Open Food Facts `nutriments` naming where possible.
 */

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const x = parseFloat(v.replace(',', '.'))
    return Number.isFinite(x) ? x : null
  }
  return null
}

function fmt1(x: number): string {
  return Math.abs(x - Math.round(x)) < 0.05 ? String(Math.round(x)) : x.toFixed(1)
}

function looksLikeMayonnaise(name: string | null | undefined): boolean {
  const n = (name || '').toLowerCase()
  return /\bmayo(nn)?aise\b|\bmayo\b/i.test(n)
}

/**
 * @returns null when there is nothing useful to show.
 */
export function formatNutritionProcessingContext(
  nutritionJson?: Record<string, unknown> | null,
  opts?: { productName?: string | null }
): string | null {
  if (!nutritionJson || typeof nutritionJson !== 'object') return null
  const o = nutritionJson
  const productName = opts?.productName

  const o3 = num(o['omega-3-fat_100g'] ?? o['omega_3_fat_100g'])
  const o6 = num(o['omega-6-fat_100g'] ?? o['omega_6_fat_100g'])
  const trans = num(o['trans-fat_100g'] ?? o['trans_fat_100g'])
  const chol = num(o['cholesterol_100g'])
  const sodiumServing = num(o['sodium_serving'])
  const sodium100 = num(o['sodium_100g'])
  const fat100 = num(o['fat_100g'] ?? o['fat'])
  const parts: string[] = []

  if (o3 != null && o3 > 0 && o6 != null && o6 > 0) {
    const ratio = o6 / o3
    const rounded = Math.max(1, Math.round(ratio))
    parts.push(
      `The omega-3 to omega-6 balance is worth noting: about ${fmt1(o3)}g omega-3 and ${fmt1(o6)}g omega-6 per 100g — roughly a 1:${rounded} ratio, which is often better than typical highly refined canola-heavy spreads (many sit closer to 1:7).`
    )
  }

  if (fat100 != null && fat100 >= 35) {
    parts.push(
      `About ${fmt1(fat100)}g total fat per 100g on the nutrition strip — typical for an oil-heavy spread, so the oil base dominates what you are consuming.`
    )
  }

  const transOk = trans != null && trans <= 0.001
  const cholOk = chol != null && chol <= 0.001
  if (transOk && cholOk && looksLikeMayonnaise(productName)) {
    parts.push(
      '0g trans fat and 0mg cholesterol on the panel are genuine positives for an egg-free oil emulsion.'
    )
  } else {
    if (transOk) {
      parts.push('0g trans fat on the nutrition panel is a genuine positive when the formula is oil-heavy.')
    }
    if (cholOk) {
      parts.push(
        looksLikeMayonnaise(productName)
          ? '0mg cholesterol matches an egg-free oil emulsion — expected, still worth confirming on your pack.'
          : '0mg cholesterol on the nutrition panel — typical when the product is plant-oil-based rather than egg-yolk emulsified.'
      )
    }
  }

  if (sodiumServing != null && sodiumServing > 0) {
    const mg = sodiumServing * 1000
    parts.push(`Sodium is about ${Math.round(mg)}mg per serving on the nutrition panel — moderate unless you use a lot at once.`)
  } else if (sodium100 != null && sodium100 > 0) {
    const mgPer100 = sodium100 * 1000
    parts.push(
      `Sodium works out to about ${Math.round(mgPer100)}mg per 100g from the nutrition strip — moderate for a condiment unless you use it heavily.`
    )
  }

  if (parts.length === 0) return null
  return parts.join(' ')
}
