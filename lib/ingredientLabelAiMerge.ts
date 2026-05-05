/**
 * Aligns parsed label ingredient lines to AI analysis rows so we rarely fall back
 * to deterministic copy when the model returned usable rows under different wording.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { normalizeForMatch } = require('./ingredientMatcher.js') as {
  normalizeForMatch: (name: string) => string
}

export type AiIngredientLike = {
  name: string
  ingredient_name?: string
}

/** Strip marketing prefixes / punctuation noise so "Fairtrade cocoa butter" ↔ "cocoa butter". */
export function normalizeIngredientAlignKey(s: string): string {
  let t = normalizeForMatch(s)
  t = t
    .replace(/^organic\s+/i, '')
    .replace(/^fair\s*trade\s+/i, '')
    .replace(/^fairtrade\s+/i, '')
    .replace(/^natural\s+/i, '')
    .replace(/^pure\s+/i, '')
  t = t.replace(/[,;/]/g, ' ').replace(/\s+/g, ' ').trim()
  return t
}

function tokenSetTwoPlus(s: string): Set<string> {
  return new Set(
    normalizeIngredientAlignKey(s)
      .split(' ')
      .filter((w) => w.length >= 2)
  )
}

/**
 * Higher = better match between one label segment and one AI name string.
 * Tuned so exact / high token overlap wins; weak substring matches stay below threshold.
 */
export function alignIngredientMatchScore(label: string, ai: string): number {
  const a = normalizeIngredientAlignKey(label)
  const b = normalizeIngredientAlignKey(ai)
  if (!a || !b) return 0
  if (a === b) return 10_000

  const ta = tokenSetTwoPlus(label)
  const tb = tokenSetTwoPlus(ai)
  let inter = 0
  for (const x of ta) if (tb.has(x)) inter++
  const uni = ta.size + tb.size - inter
  const jaccard = uni > 0 ? inter / uni : 0
  let score = jaccard * 6000

  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a
  if (longer.includes(shorter)) {
    if (shorter.length >= 6) {
      score = Math.max(score, 2800 + (shorter.length / longer.length) * 700)
    } else if (shorter.length >= 4) {
      score = Math.max(score, 1100 + shorter.length * 80)
    }
  }

  const aWords = a.split(' ').filter(Boolean)
  const bWords = b.split(' ').filter(Boolean)
  if (aWords.length === 1 && bWords.length >= 2) {
    const w = aWords[0]
    if (w.length >= 4 && bWords[bWords.length - 1] === w && bWords[0] !== w) {
      score *= 0.32
    }
  }

  return score
}

function collectAiNameKeys(item: AiIngredientLike): string[] {
  const raw = [item.name, item.ingredient_name].map((x) => String(x ?? '').trim()).filter(Boolean)
  return raw.length ? raw : []
}

export function scoreLabelToAiItem(label: string, item: AiIngredientLike): number {
  let max = 0
  for (const k of collectAiNameKeys(item)) {
    max = Math.max(max, alignIngredientMatchScore(label, k))
  }
  return max
}

/** Below this, treat as no match and use pool / deterministic fallback. */
const MIN_ALIGN_SCORE = 1180

/**
 * One-to-one assignment: each label line maps to at most one AI row.
 * Processes label lines in order of (best − secondBest) score so ambiguous lines
 * claim their best AI row before a clearer line would steal it.
 */
export function assignLabelsToAiItemsGreedy(
  labelNames: string[],
  aiItems: AiIngredientLike[]
): Map<number, number> {
  const labelCount = labelNames.length
  const aiCount = aiItems.length
  if (!labelCount || !aiCount) return new Map()

  const sameLen = labelCount === aiCount

  type Row = { li: number; margin: number }
  const rows: Row[] = []
  for (let li = 0; li < labelCount; li++) {
    const scores: number[] = []
    for (let ji = 0; ji < aiCount; ji++) {
      let s = scoreLabelToAiItem(labelNames[li], aiItems[ji])
      if (sameLen && li === ji) s += 450
      scores.push(s)
    }
    const sorted = [...scores].sort((a, b) => b - a)
    const margin = sorted[0] - (sorted[1] ?? 0)
    rows.push({ li, margin })
  }
  rows.sort((a, b) => b.margin - a.margin)

  const usedAi = new Set<number>()
  const out = new Map<number, number>()

  for (const r of rows) {
    let bestJi = -1
    let bestS = -1
    for (let ji = 0; ji < aiCount; ji++) {
      if (usedAi.has(ji)) continue
      let s = scoreLabelToAiItem(labelNames[r.li], aiItems[ji])
      if (sameLen && r.li === ji) s += 450
      if (s > bestS) {
        bestS = s
        bestJi = ji
      }
    }
    if (bestJi >= 0 && bestS >= MIN_ALIGN_SCORE) {
      usedAi.add(bestJi)
      out.set(r.li, bestJi)
    }
  }

  return out
}
