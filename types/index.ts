// Fillr type definitions

export type SafetyStatus = 'SAFE' | 'CAUTION' | 'UNSAFE' | 'UNKNOWN'

export interface UserProfile {
  id: string
  email: string
  fullName: string
  onboardingCompleted: boolean
  createdAt: string
}

export interface UserPreferences {
  allergies: string[]
  sensitivities: string[]
  preferences: string[]
  goal: string
  celiacStrictGluten: boolean
}

export interface Product {
  id: string
  barcode: string
  name: string
  brand: string
  imageUrl?: string
  ingredientText: string
  /**
   * English ingredient blob with parentheses kept (same slicing as cards, no paren strip).
   * Used for safety scoring / sub-ingredient signals only; UI cards still use `ingredientText`.
   */
  ingredientTextSafetyHaystack?: string
  nutritionJson?: Record<string, unknown>
  /** Open Food Facts `allergens_tags` (for disclosure when ingredient text is missing). */
  allergensTags?: string[]
  tracesTags?: string[]
  source: string
  createdAt: string
  updatedAt: string
}

/** Per-ingredient rating (OpenAI + UI). Legacy: `safe` treated as `clean`. */
export type IngredientRating = 'clean' | 'okay' | 'concerning' | 'avoid'

/** Stored + scan-time dietary profile (AsyncStorage + presets). */
export interface DietaryProfile {
  allergies: string[]
  sensitivities: string[]
  avoiding: string[]
  preferences: string[]
  /** Stored with profile for Profile tab + edit screen hydration (mirrors userStore). */
  goal?: string
  celiacStrictGluten?: boolean
  /** Raw app preference keys (e.g. `high_protein`) for Fillr scoring; optional. */
  scoringPreferenceKeys?: string[]
}

export type RiskCategory = 'allergy' | 'sensitivity' | 'celiac' | 'avoiding'

export type CeliacSeverity = 'SAFE' | 'CAUTION' | 'AVOID'

export interface CeliacSignal {
  ingredient: string
  signalType: string
  severity: 'AVOID' | 'CAUTION' | 'SAFE_WITH_NOTE'
  reason: string
}

export interface CeliacResult {
  celiacModeEnabled: boolean
  matchedGlutenSignals: CeliacSignal[]
  celiacSeverity: CeliacSeverity
}

export type PersonalFlag =
  | 'allergy'
  | 'sensitivity'
  | 'avoiding'
  | 'celiac'
  | 'preference_conflict'

/** When a label line is ambiguous — show transparency instead of a false binary “safe/unsafe”. */
export interface IngredientSourceAmbiguity {
  /** Short heading on the card */
  label: string
  /** Plain-language guidance; may include “verify with manufacturer.” */
  message: string
  /** low = source rarely on label; medium = name often misread; high = common name trap disambiguated */
  confidence: 'low' | 'medium' | 'high'
  /** The main diet/allergen axis this relates to */
  category?: 'gluten' | 'dairy' | 'soy' | 'animal' | 'general'
}

/** AI product-level analysis (OpenAI productAnalysis object). */
export interface LabelVsRealityItem {
  claim: string
  reality: string
  /** Concrete one-liner, e.g. order-of-ingredients trap. */
  example?: string
}

/** e.g. "Natural flavors" → what it can hide on a label */
export interface HiddenIngredientInsight {
  name: string
  whatItReallyIs: string
}

/** Legal / regulatory context for an ingredient */
export interface RegulatoryFlagInsight {
  ingredient: string
  issue: string
  /** Countries, agencies, or regions — free text */
  regions: string
}

export interface ProductAnalysis {
  /** Optional counts after deterministic matcher (clean / okay / concerning / avoid). */
  ratingCounts?: {
    clean: number
    okay: number
    concerning: number
    avoid: number
  }
  /** One screenshot-worthy sentence; shown at top of results. */
  viralHook?: string
  labelVsReality?: LabelVsRealityItem[]
  redFlags?: string[]
  /** Marketing vs ingredient-list reality; UI title "What the label hides". */
  whatTheyDontTellYou?: string
  whoShouldAvoid?: string
  bottomLine?: string
  /** Every named sugar / sweetener (including “hidden” forms). */
  sugarSources?: string[]
  hiddenIngredients?: HiddenIngredientInsight[]
  regulatoryFlags?: RegulatoryFlagInsight[]
  /** Misleading marketing vs formulation — one string per finding. */
  labelClaims?: string[]
  /** One sentence on ingredient order / weight. */
  ingredientOrderInsight?: string
}

export interface IngredientExplanation {
  name: string
  whatItIs: string
  whyItsUsed: string
  whatToKnow: string
  quickSummary?: string
  verdict?: 'SAFE' | 'NEUTRAL' | 'LIMIT'
  bullets?: string[]
  commonIn?: string
  approvedBy?: string
  personalizedNote?: string
  /** Legacy combined line; prefer headline + structured fields. */
  explanation?: string
  commonName?: string
  /** In this product (same as model `whatItDoes`). */
  whatItDoes?: string
  whereItComeFrom?: string
  whyItMatters?: string
  /** In your body (model `bodyEffect`). */
  bodyEffect?: string
  /** 6–8 word hook (model `headline`). */
  headline?: string
  /** Fillr intelligence: 2–5 word fast identity (model `short_label`). */
  shortLabel?: string
  /** Fillr intelligence: two plain-English bullets (model `why_it_matters`). */
  whyItMattersBullets?: readonly [string, string]
  /** Fillr intelligence: one-line system judgment. */
  systemJudgment?: string
  /** Fillr intelligence: one-line user-specific impact. */
  impactForYou?: string
  /** Structured render driver from model/pipeline. */
  flagDriver?: 'allergy' | 'sensitivity' | 'goal' | 'preference' | 'processing'
  /** Structured profile anchor (e.g. more_protein, vegan). */
  profileAnchor?: string
  /** Structured actionability for quick UX labels. */
  actionability?: 'avoid' | 'limit' | 'okay'
  /** Fillr intelligence: model confidence for the intelligence block. */
  intelligenceConfidence?: 'high' | 'medium'
  /** Structured evidence trace shown in results transparency UI. */
  evidenceTrace?: {
    ruleMatched?: string
    source?: string
    confidence?: 'high' | 'medium' | 'low'
    lastVerifiedAt?: string
  }
  /** One plain-English sentence decoding label jargon (translator lead). */
  labelDecoder?: string
  funFact?: string
  ratingReason?: string
  ingredientRating?: IngredientRating
  /** Punchy comparison or stat (e.g. sodium % DV); optional. */
  contextStat?: string
  /** Set when `lib/ingredientMatcher` overrides the model. */
  ratingSource?: 'ai' | 'deterministic' | 'personal'
  ratingOverridden?: boolean
  personalFlag?: PersonalFlag
  personalMessage?: string
  /** Non-binary context for name traps and source-unknown ingredients (see `lib/ingredientAmbiguity.ts`). */
  sourceAmbiguity?: IngredientSourceAmbiguity
  /** True when decode text came from Supabase `ingredient_knowledge` (per-line cache). */
  fromCache?: boolean
  /** Barcode fast path: AI decode still in flight — UI shows one product-level status line until merge. */
  aiDecodePending?: boolean
  /** Explicitly marks rows where real ingredient intelligence did not load. */
  ingredientDecodeStatus?: 'decoded' | 'unavailable'
}

export type ScanIngredientSource = 'barcode' | 'ocr' | 'manual'

export interface ScanResult {
  product: Product
  safetyStatus: SafetyStatus
  matchedAllergens: MatchedAllergen[]
  matchedSensitivities: MatchedSensitivity[]
  celiac?: CeliacResult
  smartSummary: string
  ingredientBreakdown: IngredientExplanation[]
  insights: string[]
  /** How this result was produced (barcode DB vs photo OCR vs typed ingredients). */
  scanSource?: ScanIngredientSource
  /** OCR: label was French-only and translated to English before parsing/analysis. */
  ocrTranslatedFromFrench?: boolean
  /** May-contain / facility lines parsed from the label (not shown as ingredient cards). */
  crossContactWarnings?: string[]
  /** Readable OFF allergens declaration for the disclosure banner. */
  declaredAllergensLabel?: string
  /** One-line shareable verdict (OpenAI `productVerdict` or local fallback). */
  productVerdict?: string
  /** Rich AI analysis: viral hook, label vs reality, red flags, etc. */
  productAnalysis?: ProductAnalysis
  /** Deterministic Fillr Fit (see `lib/fillrScoring.ts`). */
  fillrFit?: FillrFitSnapshot
  /** How processed the formulation looks (see `lib/processedRating.ts`). */
  processedRating?: ProcessedRatingSnapshot | null
  /** Inputs passed to `calculateFillrFit` (for rescoring / debug). */
  scoringData?: FillrScoringDataSnapshot
  /** Set when Fillr Fit is locked at first display — enrichment must not recompute the score. */
  scoringFrozenAt?: string
  /** Stable hash of profile inputs used for the frozen Fillr Fit. */
  scoringProfileHash?: string
  /** Every ingredient line was served from Supabase `ingredient_knowledge` (no OpenAI call). */
  ingredientDecodeMeta?: { allFromCache: boolean }
  /** 0–100 coverage score from allergen engine / heuristics (label completeness). */
  ingredientDataQualityScore?: number
  /** Product-name-only hints when status is UNKNOWN (never treated as confirmed contains). */
  productNameHints?: Array<{ allergenName: string; hintText: string }>
}

/** Persisted Fillr Fit card payload */
export interface FillrFitSnapshot {
  score: number
  verdict: string
  verdictColor: string
  progressColor: string
  reason: string
  tier: 1 | 2 | 3
}

/**
 * Whole-food vs industrial formulation (not allergy-specific).
 * `score` is 0–100 for spectrum position only (UI shows a bar, not this number).
 */
export interface ProcessedRatingSnapshot {
  score: number
  verdict: string
  verdictColor: string
  progressColor: string
  reason: string
}

/** Ingredients on the label that triggered a goal/preference conflict pattern. */
export interface GoalConflictDetail {
  label: string
  ingredients: string[]
}

export interface FillrScoringDataSnapshot {
  allergyMatches?: string[]
  celiacSeverity?: 'SAFE' | 'CAUTION' | 'AVOID'
  celiacStrictGluten?: boolean
  celiacAmbiguousCount?: number
  sensitivityMatches?: string[]
  avoidingMatches?: string[]
  goalMatches?: string[]
  goalConflicts?: string[]
  /** Populated when goalConflicts is non-empty; lists label-specific ingredient hits. */
  goalConflictDetails?: GoalConflictDetail[]
  ingredientCounts?: {
    natural: number
    processed: number
    additive: number
    flagged: number
  }
  totalIngredients?: number
  eNumberCount?: number
  genericFunctionalTermCount?: number
  industrialSweetenerCount?: number
  hydrogenatedOilCount?: number
  scoringPreferenceKeys?: string[]
  sweetenerCount?: number
  sugarScore?: number
  hasSeedOils?: boolean
  emulsifierCount?: number
  caffeineMg?: number
  proInflammatoryCount?: number
  productCategory?:
    | 'whole_food'
    | 'clean_snack'
    | 'protein_bar'
    | 'gum'
    | 'candy'
    | 'dairy'
    | 'drink'
    | 'condiment'
    | 'generic_packaged'
  /** Ingredient blob used for scoring heuristics (mirrors `FillrScoringInput.labelHaystack`). */
  labelHaystack?: string
}

export type AllergenEvidenceSection = 'ingredients' | 'contains' | 'may_contain' | 'open_food_facts'

export interface MatchedAllergen {
  allergenKey: string
  allergenName: string
  matchedIngredient: string
  explanation: string
  /** CONTAINS vs cross-contact style MAY_CONTAIN from the deterministic engine. */
  severity?: 'CONTAINS' | 'MAY_CONTAIN'
  /** Where on the label / OFF record the match was found. */
  evidenceSection?: AllergenEvidenceSection
  /** Exact substring or tag matched (for transparency chips). */
  evidenceText?: string
}

export interface MatchedSensitivity {
  sensitivityKey: string
  sensitivityName: string
  matchedIngredient: string
  explanation: string
}

// Onboarding options
export const ALLERGY_OPTIONS = [
  { key: 'milk', label: 'Milk' },
  { key: 'eggs', label: 'Eggs' },
  { key: 'peanuts', label: 'Peanuts' },
  { key: 'tree_nuts', label: 'Tree Nuts' },
  { key: 'soy', label: 'Soy' },
  { key: 'wheat', label: 'Wheat' },
  { key: 'sesame', label: 'Sesame' },
  { key: 'fish', label: 'Fish' },
  { key: 'shellfish', label: 'Shellfish' },
  { key: 'mustard', label: 'Mustard' },
  { key: 'sulfites', label: 'Sulfites' },
] as const

export const SENSITIVITY_OPTIONS = [
  { key: 'lactose', label: 'Lactose' },
  { key: 'gluten_sensitivity', label: 'Gluten sensitivity' },
  { key: 'high_sodium', label: 'High sodium' },
  { key: 'msg', label: 'MSG' },
  { key: 'sulfites', label: 'Sulfites' },
  { key: 'artificial_sweeteners', label: 'Artificial sweeteners' },
  { key: 'caffeine', label: 'Caffeine' },
  { key: 'fructose', label: 'Fructose' },
  { key: 'histamine', label: 'Histamine' },
  { key: 'nightshades', label: 'Nightshades' },
  { key: 'fodmaps', label: 'FODMAPs' },
] as const

export const PREFERENCE_OPTIONS = [
  { key: 'vegan', label: 'Vegan' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'high_protein', label: 'High protein' },
  { key: 'low_sugar', label: 'Low sugar' },
  { key: 'low_carb', label: 'Low carb' },
  { key: 'low_calorie', label: 'Low calorie' },
  { key: 'plant_based', label: 'Plant-based' },
  { key: 'less_processed', label: 'Eat cleaner / less processed' },
  { key: 'kosher', label: 'Kosher' },
  { key: 'halal', label: 'Halal' },
  { key: 'paleo', label: 'Paleo' },
  { key: 'whole30', label: 'Whole30' },
  { key: 'diabetic_friendly', label: 'Diabetic-friendly' },
] as const

export const GOAL_OPTIONS = [
  { key: 'more_protein', label: 'Eat more protein' },
  { key: 'less_sugar', label: 'Eat less sugar' },
  { key: 'lose_weight', label: 'Lose weight' },
  { key: 'gain_weight', label: 'Gain weight' },
  { key: 'gut_health', label: 'Improve gut health' },
  { key: 'eat_cleaner', label: 'Eat cleaner' },
  { key: 'balanced_diet', label: 'Maintain a balanced diet' },
  { key: 'reduce_upf', label: 'Reduce ultra-processed foods' },
  { key: 'lower_sodium', label: 'Lower sodium' },
  { key: 'understand', label: 'Understand what I\'m eating' },
] as const
