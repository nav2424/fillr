/**
 * For bilingual Canadian labels: take English segment before "/" when appropriate.
 * Skips obvious quantity ratios like "20g/100g".
 */
const FR_LEADING_TOKENS =
  /\b(eau|sucre|sel|levure|lait|beurre|crème|creme|farine|blé|ble|huile|amidon|sirop|poudre)\b/i

/** French grammar / content words — higher score ⇒ more likely French. */
const FR_LIKELY =
  /\b(de|du|des|la|le|les|et|ou|pour|avec|sans|contient|contiennent|épaississant|édulcorant|arôme|arome|huile de|sirop de|extrait de|farine de|poudre de|jus de|lait écrémé|lait ecreme)\b/i

function frenchLikelihood(s: string): number {
  const p = s.trim()
  if (!p) return 0
  let score = 0
  if (/[àâäéèêëïîôùûçœæ]/i.test(p)) score += 3
  if (FR_LIKELY.test(p)) score += 2
  if (FR_LEADING_TOKENS.test(p)) score += 2
  return score
}

function pickLeastFrenchPart(parts: string[]): string | null {
  const trimmed = parts.map((s) => s.trim()).filter(Boolean)
  if (trimmed.length < 2) return null
  const scored = trimmed.map((p) => ({ p, score: frenchLikelihood(p) }))
  scored.sort((a, b) => a.score - b.score || a.p.length - b.p.length)
  const low = scored[0].score
  const high = scored[scored.length - 1].score
  if (low < high) return scored[0].p
  // Tie: prefer segment with fewer accents (often English on bilingual labels)
  const byAccents = [...trimmed].sort(
    (a, b) => (a.match(/[àâäéèêëïîôùûçœæ]/gi) || []).length -
      (b.match(/[àâäéèêëïîôùûçœæ]/gi) || []).length
  )
  return byAccents[0] ?? null
}

/** Prefer English segment when label uses ` / ` or ` | ` between languages. */
export function englishPrimarySegment(text: string): string {
  if (!text || typeof text !== 'string') return ''
  const t = text.trim()

  const pickFromSeparators = (sep: RegExp): string | null => {
    const parts = t.split(sep).map((s) => s.trim()).filter(Boolean)
    if (parts.length < 2) return null
    if (/^\d+(\.\d+)?\s*(g|kg|ml|l|oz)\s*(\/|\|)\s*\d/i.test(t)) return null
    const asciiFriendly = parts.find(
      (p) => /^[A-Za-z0-9\s,%.'\-\(\)]+$/.test(p) && !FR_LEADING_TOKENS.test(p.trim())
    )
    if (asciiFriendly) return asciiFriendly
    const byFr = pickLeastFrenchPart(parts)
    if (byFr) return byFr
    return null
  }

  const pipePick = pickFromSeparators(/\s*\|\s*/)
  if (pipePick) return pipePick

  if (!t.includes('/')) return t
  if (/^\d+(\.\d+)?\s*(g|kg|ml|l|oz)\s*\/\s*\d/i.test(t)) return t
  const slashParts = t.split('/').map((s) => s.trim()).filter(Boolean)
  if (slashParts.length >= 2) {
    const en = slashParts.find(
      (p) => /^[A-Za-z0-9\s,%.'\-\(\)]+$/.test(p) && !FR_LEADING_TOKENS.test(p.trim())
    )
    if (en) return en
    const byFr = pickLeastFrenchPart(slashParts)
    if (byFr) return byFr
  }
  const first = slashParts[0] ?? t
  return first || t
}
