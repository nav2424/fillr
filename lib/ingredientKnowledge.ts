/**
 * Supabase-backed shared ingredient library (cache).
 * Table RLS: public SELECT; writes only via SECURITY DEFINER RPCs.
 */

import { supabase } from './supabase'
import type { IngredientAnalysisItem } from '../services/openaiIngredientAnalysisPrompt'
import { normalizeIngredientName } from './ingredientNameNormalization'

export type IngredientKnowledgeRow = {
  id: string
  name_normalized: string
  name_display: string
  common_name: string | null
  explanation: string | null
  what_it_is: string | null
  what_it_does_in_product: string | null
  body_effect: string | null
  fun_fact: string | null
  base_rating: string
  rating_reason: string | null
  context_stat: string | null
  regulatory_flags: unknown
  scan_count: number
  positive_feedback: number
  negative_feedback: number
  confidence_score: number
  source: string
  created_at: string
  last_updated: string
}

/** Alias for save/merge helpers */
export type IngredientKnowledge = IngredientKnowledgeRow

const MIN_CACHE_PROSE = 25

function endsWithSentencePunctuation(s: string): boolean {
  return /[.!?]\s*$/.test(s.trim())
}

function ensureMinProse(s: string | null | undefined, fallback: string): string {
  let t = String(s ?? '').trim()
  if (t.length < MIN_CACHE_PROSE) t = fallback
  if (!endsWithSentencePunctuation(t)) t = `${t.trim()}.`
  return t
}

function validBaseRating(r: string | null | undefined): r is IngredientAnalysisItem['rating'] {
  const x = String(r ?? '').toLowerCase()
  return x === 'clean' || x === 'okay' || x === 'concerning' || x === 'avoid'
}

export function cacheRowIsComplete(row: IngredientKnowledgeRow | null): row is IngredientKnowledgeRow {
  if (!row?.name_display?.trim()) return false
  if (!validBaseRating(row.base_rating)) return false
  return true
}

/**
 * Map DB row → model shape used before deterministic pipeline.
 * `labelName` preserves label order / casing for merge with scan.
 */
export function knowledgeRowToAnalysisItem(
  row: IngredientKnowledgeRow,
  labelName: string
): IngredientAnalysisItem {
  const name = (labelName || row.name_display).trim()
  const display = row.name_display.trim()
  const headline = (row.common_name || display || name).trim()
  const labelDecoder = ensureMinProse(
    row.explanation || row.what_it_is,
    `On the label, "${name}" is how the manufacturer names this part of the recipe.`
  )
  const whatItIs = ensureMinProse(
    row.what_it_is,
    labelDecoder === row.what_it_is ? `This is ${name}—the substance listed on the package under that name.` : labelDecoder
  )
  const whatItDoes = ensureMinProse(
    row.what_it_does_in_product,
    `Manufacturers add ${name} to help with flavor, texture, moisture, or how long the product stays fresh on the shelf.`
  )
  const bodyEffect = ensureMinProse(
    row.body_effect,
    `In normal serving sizes, ${name} is handled like other small parts of the formula—not a main protein, fat, or carb source by itself.`
  )
  const funFact = ensureMinProse(
    row.fun_fact,
    `Ingredient lists are ordered by weight—what appears earlier is usually a larger share of the formula.`
  )
  const ratingReason = ensureMinProse(
    row.rating_reason,
    `Rated ${row.base_rating} based on typical use patterns for this class of ingredient.`
  )
  const whyItMattersYou = ensureMinProse(
    row.rating_reason || row.explanation,
    `Use this row to decide how often you want this ingredient in your rotation compared with similar products.`
  )
  return {
    name,
    headline: ensureMinProse(
      headline,
      `${name} is included in this product and can affect texture, flavor, or nutrition depending on the formula.`
    ),
    labelDecoder,
    whatItIs,
    whatItDoes,
    bodyEffect,
    funFact,
    whyItMattersYou,
    rating: row.base_rating.toLowerCase() as IngredientAnalysisItem['rating'],
    ratingReason,
    contextStat: (row.context_stat ?? '').trim(),
    ratingSource: 'ai',
    from_cache: true,
    evidenceRuleMatched: 'ingredient_knowledge_cache',
    evidenceSource: 'ingredient_knowledge',
    evidenceConfidence:
      row.confidence_score >= 0.8 ? 'high' : row.confidence_score >= 0.5 ? 'medium' : 'low',
    evidenceLastVerifiedAt: row.last_updated,
  }
}

export async function getIngredientFromCache(name: string): Promise<IngredientKnowledgeRow | null> {
  const normalized = normalizeIngredientName(name)
  if (!normalized) return null
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()) return null

  const { data, error } = await supabase
    .from('ingredient_knowledge')
    .select('*')
    .eq('name_normalized', normalized)
    .maybeSingle()

  if (error || !data) return null

  const row = data as IngredientKnowledgeRow
  if (!cacheRowIsComplete(row)) return null

  void supabase.rpc('increment_ingredient_knowledge_scan_count', {
    p_name_normalized: normalized,
  })

  return row
}

const CACHE_IN_CHUNK = 80

export interface CacheBatchResult {
  /** `name_normalized` → complete row */
  cached: Map<string, IngredientKnowledgeRow>
  /** Unique label names missing cache, in first-seen order (for partial OpenAI). */
  uncached: string[]
  allCached: boolean
}

/**
 * Chunked `.in()` query + explicit cached / uncached split for partial OpenAI reuse.
 */
export async function getIngredientsFromCacheBatch(names: string[]): Promise<CacheBatchResult> {
  const empty: CacheBatchResult = { cached: new Map(), uncached: [], allCached: true }
  if (!names.length) return empty
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()) {
    const uncached = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
    return { cached: new Map(), uncached, allCached: uncached.length === 0 }
  }

  const orderKeys = names.map((n) => normalizeIngredientName(n))
  const unique = [...new Set(orderKeys.filter(Boolean))]

  const rowsByNorm = new Map<string, IngredientKnowledgeRow>()
  for (let i = 0; i < unique.length; i += CACHE_IN_CHUNK) {
    const chunk = unique.slice(i, i + CACHE_IN_CHUNK)
    const { data, error } = await supabase.from('ingredient_knowledge').select('*').in('name_normalized', chunk)

    if (!error && data) {
      for (const raw of data) {
        const row = raw as IngredientKnowledgeRow
        if (cacheRowIsComplete(row)) {
          rowsByNorm.set(row.name_normalized, row)
        }
      }
    }
  }

  const cached = new Map<string, IngredientKnowledgeRow>()
  for (const key of unique) {
    const row = rowsByNorm.get(key)
    if (row) cached.set(key, row)
  }

  const uncached: string[] = []
  const seenUncached = new Set<string>()
  for (let i = 0; i < names.length; i++) {
    const raw = names[i]?.trim() ?? ''
    const key = orderKeys[i]
    if (!key) continue
    if (cached.has(key)) continue
    if (!seenUncached.has(key)) {
      seenUncached.add(key)
      uncached.push(raw || names[i])
    }
  }

  const hitsToBump = new Set<string>()
  for (const key of orderKeys) {
    if (key && cached.has(key)) hitsToBump.add(key)
  }
  if (hitsToBump.size > 0) {
    void Promise.all(
      [...hitsToBump].map((n) =>
        supabase.rpc('increment_ingredient_knowledge_scan_count', { p_name_normalized: n })
      )
    ).catch(() => {})
  }

  return { cached, uncached, allCached: uncached.length === 0 }
}

export type IngredientKnowledgeSaveInput = {
  name_display: string
  common_name?: string | null
  explanation?: string | null
  what_it_is?: string | null
  what_it_does_in_product?: string | null
  body_effect?: string | null
  fun_fact?: string | null
  base_rating: string
  rating_reason?: string | null
  context_stat?: string | null
  regulatory_flags?: unknown
  source?: string
}

export async function saveIngredientToCache(ingredient: IngredientKnowledgeSaveInput): Promise<void> {
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()) return
  const normalized = normalizeIngredientName(ingredient.name_display)
  if (!normalized) return
  const r = String(ingredient.base_rating || '').toLowerCase()
  if (!validBaseRating(r)) return

  const flags =
    ingredient.regulatory_flags != null
      ? JSON.parse(JSON.stringify(ingredient.regulatory_flags))
      : []

  await supabase.rpc('upsert_ingredient_knowledge', {
    p_name_normalized: normalized,
    p_name_display: ingredient.name_display.trim(),
    p_common_name: ingredient.common_name ?? '',
    p_explanation: ingredient.explanation ?? '',
    p_what_it_is: ingredient.what_it_is ?? '',
    p_what_it_does_in_product: ingredient.what_it_does_in_product ?? '',
    p_body_effect: ingredient.body_effect ?? '',
    p_fun_fact: ingredient.fun_fact ?? '',
    p_base_rating: r,
    p_rating_reason: ingredient.rating_reason ?? '',
    p_context_stat: ingredient.context_stat ?? '',
    p_regulatory_flags: flags,
    p_source: ingredient.source ?? 'openai',
  })
}

export function analysisItemToSaveInput(item: IngredientAnalysisItem): IngredientKnowledgeSaveInput {
  return {
    name_display: item.name.trim(),
    common_name: item.shortLabel?.trim() || item.headline?.trim() || null,
    explanation: item.labelDecoder?.trim() || null,
    what_it_is: item.whatItIs?.trim() || null,
    what_it_does_in_product: item.whatItDoes?.trim() || null,
    body_effect: item.bodyEffect?.trim() || null,
    fun_fact: item.funFact?.trim() || null,
    base_rating: item.rating,
    rating_reason: item.ratingReason?.trim() || null,
    context_stat: item.contextStat?.trim() || null,
    regulatory_flags: [],
    source: 'openai',
  }
}

export async function updateIngredientFeedback(
  name: string,
  type: 'positive' | 'negative'
): Promise<void> {
  const normalized = normalizeIngredientName(name)
  if (!normalized || !process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()) return
  const field = type === 'positive' ? 'positive_feedback' : 'negative_feedback'
  await supabase.rpc('increment_feedback', {
    p_name: normalized,
    p_field: field,
  })
}
