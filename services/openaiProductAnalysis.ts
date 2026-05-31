/**
 * Second-pass OpenAI product analysis (regulatory hooks, label vs reality).
 * Runs after ingredient decode so the safety screen stays instant.
 */

import type { DietaryProfile, ScanResult, ProductAnalysis } from '../types'
import {
  PRODUCT_DEEP_ANALYSIS_SYSTEM_PROMPT,
  buildProductDeepAnalysisUserPrompt,
  buildPersonalizationSystemAppend,
  formatDetectedPatternsForPrompt,
  formatNutritionJsonForPrompt,
  type ProductDeepAnalysisResponse,
} from './openaiIngredientAnalysisPrompt'
import { parseIngredients } from '../lib/fillrAdapter'
import { detectProductPatterns } from '../lib/productPatternDetection'
import { detectProductCategoryFromSignals } from '../lib/buildScoringData'
import { normalizeIngredientName } from '../lib/ingredientNameNormalization'
import {
  applyAllergenPersonalizedProductCopy,
  applySensitivityPersonalizedProductCopy,
} from '../lib/personalizationEngine'
import { composeDeterministicProductSummary } from '../lib/productSummaryComposer'
import type { IngredientAnalysisItem } from './openaiIngredientAnalysisPrompt'

const PRODUCT_DEEP_TIMEOUT_MS = 24_000
const PRODUCT_DEEP_MAX_TOKENS = 1400

function extractJsonPayload(raw: string): string {
  let s = raw.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const firstBrace = s.indexOf('{')
  const lastBrace = s.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return s.slice(firstBrace, lastBrace + 1)
  }
  return s.trim()
}

function normalizeProductAnalysis(raw: unknown): ProductAnalysis | undefined {
  if (raw == null || typeof raw !== 'object') return undefined
  const p = raw as Record<string, unknown>
  const out: ProductAnalysis = {}
  if (typeof p.viralHook === 'string' && p.viralHook.trim()) {
    out.viralHook = p.viralHook.trim()
  }
  if (Array.isArray(p.labelVsReality)) {
    const items: ProductAnalysis['labelVsReality'] = []
    for (const item of p.labelVsReality) {
      if (!item || typeof item !== 'object') continue
      const x = item as Record<string, unknown>
      const claim = String(x.claim ?? '').trim()
      const reality = String(x.reality ?? '').trim()
      if (!claim && !reality) continue
      const row: NonNullable<ProductAnalysis['labelVsReality']>[number] = { claim, reality }
      const ex = x.example
      if (typeof ex === 'string' && ex.trim()) row.example = ex.trim()
      items.push(row)
    }
    if (items.length) out.labelVsReality = items
  }
  if (Array.isArray(p.redFlags)) {
    const flags = p.redFlags.map((s) => String(s ?? '').trim()).filter(Boolean)
    if (flags.length) out.redFlags = flags
  }
  if (typeof p.whatTheyDontTellYou === 'string' && p.whatTheyDontTellYou.trim()) {
    out.whatTheyDontTellYou = p.whatTheyDontTellYou.trim()
  }
  if (typeof p.whoShouldAvoid === 'string' && p.whoShouldAvoid.trim()) {
    out.whoShouldAvoid = p.whoShouldAvoid.trim()
  }
  if (typeof p.bottomLine === 'string' && p.bottomLine.trim()) {
    out.bottomLine = p.bottomLine.trim()
  }
  if (Array.isArray(p.sugarSources)) {
    const sugarSources = p.sugarSources.map((s) => String(s ?? '').trim()).filter(Boolean)
    if (sugarSources.length) out.sugarSources = sugarSources
  }
  if (Array.isArray(p.hiddenIngredients)) {
    const hi: NonNullable<ProductAnalysis['hiddenIngredients']> = []
    for (const item of p.hiddenIngredients) {
      if (!item || typeof item !== 'object') continue
      const x = item as Record<string, unknown>
      const name = String(x.name ?? '').trim()
      const whatItReallyIs = String(x.whatItReallyIs ?? '').trim()
      if (!name && !whatItReallyIs) continue
      hi.push({ name: name || 'Ingredient', whatItReallyIs: whatItReallyIs || 'See label context.' })
    }
    if (hi.length) out.hiddenIngredients = hi
  }
  if (Array.isArray(p.regulatoryFlags)) {
    const rf: NonNullable<ProductAnalysis['regulatoryFlags']> = []
    for (const item of p.regulatoryFlags) {
      if (!item || typeof item !== 'object') continue
      const x = item as Record<string, unknown>
      const ingredient = String(x.ingredient ?? '').trim()
      const issue = String(x.issue ?? '').trim()
      const regions = String(x.regions ?? '').trim()
      if (!ingredient || !issue) continue
      rf.push({ ingredient, issue, regions })
    }
    if (rf.length) out.regulatoryFlags = rf
  }
  if (Array.isArray(p.labelClaims)) {
    const lc = p.labelClaims.map((s) => String(s ?? '').trim()).filter(Boolean)
    if (lc.length) out.labelClaims = lc
  }
  if (typeof p.ingredientOrderInsight === 'string' && p.ingredientOrderInsight.trim()) {
    out.ingredientOrderInsight = p.ingredientOrderInsight.trim()
  }
  const rc = p.ratingCounts
  if (rc && typeof rc === 'object') {
    const c = rc as Record<string, unknown>
    out.ratingCounts = {
      clean: Number(c.clean) || 0,
      okay: Number(c.okay) || 0,
      concerning: Number(c.concerning) || 0,
      avoid: Number(c.avoid) || 0,
    }
  }
  return out.viralHook && out.bottomLine ? out : undefined
}

function parseProductDeepAnalysisJson(text: string): ProductDeepAnalysisResponse | null {
  try {
    const o = JSON.parse(extractJsonPayload(text)) as Record<string, unknown>
    if (typeof o.productVerdict !== 'string') return null
    const productAnalysis = normalizeProductAnalysis(o.productAnalysis)
    if (!productAnalysis) return null
    return {
      productVerdict: o.productVerdict.trim(),
      productAnalysis,
    }
  } catch (e) {
    console.warn('[Fillr] product deep analysis JSON parse failed:', e)
    return null
  }
}

function resolveModel(): string {
  return (
    process.env.EXPO_PUBLIC_OPENAI_INGREDIENT_MODEL ??
    process.env.EXPO_PUBLIC_OPENAI_MODEL ??
    'gpt-4o-mini'
  )
}

async function requestProductDeepAnalysisJson(
  userContent: string,
  systemContent: string
): Promise<ProductDeepAnalysisResponse | null> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Fillr] product deep analysis skipped: missing Supabase env')
    return null
  }

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), PRODUCT_DEEP_TIMEOUT_MS)
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/ingredient-analysis`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({
        model: resolveModel(),
        temperature: 0,
        maxTokens: PRODUCT_DEEP_MAX_TOKENS,
        systemContent,
        userContent,
      }),
    })
    if (!res.ok) {
      console.warn(`[Fillr] product deep analysis HTTP ${res.status}`)
      return null
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const text = data?.choices?.[0]?.message?.content
    if (!text || typeof text !== 'string') return null
    return parseProductDeepAnalysisJson(text)
  } catch (e) {
    const name = e && typeof e === 'object' && 'name' in e ? String((e as Error).name) : ''
    console.warn(
      `[Fillr] product deep analysis ${name === 'AbortError' ? 'timeout' : 'failed'}:`,
      e instanceof Error ? e.message : String(e)
    )
    return null
  } finally {
    clearTimeout(t)
  }
}

function buildRatingSummary(scan: ScanResult): string {
  const lines: string[] = []
  for (const ing of scan.ingredientBreakdown) {
    const rating = ing.ingredientRating ?? 'okay'
    const flags = [
      ing.personalFlag ? `flag:${ing.personalFlag}` : '',
      ing.personalizedNote ? 'noted' : '',
    ]
      .filter(Boolean)
      .join(' ')
    lines.push(`- ${ing.name}: ${rating}${flags ? ` (${flags})` : ''}`)
  }
  return lines.length ? lines.join('\n') : '- (no breakdown)'
}

function scanToMinimalAnalysisItems(scan: ScanResult): IngredientAnalysisItem[] {
  return scan.ingredientBreakdown.map((ing) => ({
    name: ing.name,
    headline: ing.headline ?? ing.name,
    labelDecoder: ing.labelDecoder ?? '',
    whatItIs: ing.whatItIs ?? '',
    whatItDoes: ing.whatItDoes ?? ing.whyItsUsed ?? '',
    bodyEffect: ing.bodyEffect ?? '',
    funFact: ing.funFact ?? '',
    whyItMattersYou: ing.whyItMatters ?? '',
    rating:
      ing.ingredientRating === 'avoid' ||
      ing.ingredientRating === 'concerning' ||
      ing.ingredientRating === 'clean'
        ? ing.ingredientRating
        : 'okay',
    ratingReason: ing.ratingReason ?? '',
    contextStat: ing.contextStat ?? '',
    personalFlag: ing.personalFlag,
    personalMessage: ing.personalMessage,
  }))
}

export async function analyzeProductDeepWithOpenAI(
  scan: ScanResult,
  dietaryProfile: DietaryProfile
): Promise<ProductDeepAnalysisResponse | null> {
  const text = scan.product.ingredientText?.trim()
  if (!text || scan.ingredientBreakdown.length === 0) return null

  const labelNames = parseIngredients(text, scan.scanSource === 'ocr' ? 'ocr' : 'barcode')
  const patterns = detectProductPatterns(labelNames, scan.product.nutritionJson)
  const category = detectProductCategoryFromSignals(
    text,
    labelNames.map((n) => normalizeIngredientName(n))
  )

  const systemContent =
    PRODUCT_DEEP_ANALYSIS_SYSTEM_PROMPT + buildPersonalizationSystemAppend(dietaryProfile)
  const userContent = buildProductDeepAnalysisUserPrompt({
    productName: scan.product.name,
    brand: scan.product.brand,
    safetyStatus: scan.safetyStatus,
    ingredientLines: text,
    ratingSummary: buildRatingSummary(scan),
    patternSummary: formatDetectedPatternsForPrompt(patterns),
    nutritionAppend: formatNutritionJsonForPrompt(scan.product.nutritionJson),
    existingVerdict: scan.productVerdict,
    allergenSummary: scan.matchedAllergens.map((m) => m.allergenName).join(', '),
    sensitivitySummary: scan.matchedSensitivities?.map((m) => m.sensitivityName).join(', '),
  })

  const parsed = await requestProductDeepAnalysisJson(userContent, systemContent)
  if (!parsed) return null

  const items = scanToMinimalAnalysisItems(scan)
  const deterministic = composeDeterministicProductSummary(
    items,
    patterns,
    scan.product.nutritionJson,
    parsed.productAnalysis,
    category
  )

  return {
    productVerdict: parsed.productVerdict,
    productAnalysis: {
      ...deterministic,
      ...parsed.productAnalysis,
      ratingCounts:
        scan.productAnalysis?.ratingCounts ??
        deterministic.ratingCounts ??
        parsed.productAnalysis.ratingCounts,
      sugarSources:
        (parsed.productAnalysis.sugarSources?.length ?? 0) > 0
          ? parsed.productAnalysis.sugarSources
          : deterministic.sugarSources,
    },
  }
}

export function mergeProductDeepAnalysisIntoScan(
  scan: ScanResult,
  deep: ProductDeepAnalysisResponse
): ScanResult {
  let next: ScanResult = {
    ...scan,
    productAnalysis: {
      ...(scan.productAnalysis ?? {}),
      ...deep.productAnalysis,
    },
  }
  const lockVerdict = scan.matchedAllergens.length > 0 && (scan.productVerdict ?? '').trim()
  if (!lockVerdict && deep.productVerdict.trim()) {
    next = { ...next, productVerdict: deep.productVerdict }
  }
  next = applyAllergenPersonalizedProductCopy(next)
  next = applySensitivityPersonalizedProductCopy(next)
  return next
}
