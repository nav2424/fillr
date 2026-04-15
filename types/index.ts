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
  /** Barcode fast path: AI decode still in flight — show “Decoding…” in the card. */
  aiDecodePending?: boolean
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
  /** Inputs passed to `calculateFillrFit` (for rescoring / debug). */
  scoringData?: FillrScoringDataSnapshot
  /** Every ingredient line was served from Supabase `ingredient_knowledge` (no OpenAI call). */
  ingredientDecodeMeta?: { allFromCache: boolean }
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

export interface FillrScoringDataSnapshot {
  allergyMatches?: string[]
  celiacSeverity?: 'SAFE' | 'CAUTION' | 'AVOID'
  sensitivityMatches?: string[]
  avoidingMatches?: string[]
  goalMatches?: string[]
  goalConflicts?: string[]
  ingredientCounts?: {
    natural: number
    processed: number
    additive: number
    flagged: number
  }
  totalIngredients?: number
}

export interface MatchedAllergen {
  allergenKey: string
  allergenName: string
  matchedIngredient: string
  explanation: string
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
  { key: 'artificial_sweeteners', label: 'Artificial sweeteners' },
  { key: 'high_sodium', label: 'High sodium' },
  { key: 'msg', label: 'MSG' },
  { key: 'sulfites', label: 'Sulfites' },
] as const

export const PREFERENCE_OPTIONS = [
  { key: 'high_protein', label: 'High protein' },
  { key: 'low_sugar', label: 'Low sugar' },
  { key: 'low_carb', label: 'Low carb' },
  { key: 'low_calorie', label: 'Low calorie' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'plant_based', label: 'Plant-based' },
  { key: 'less_processed', label: 'Eat cleaner / less processed' },
] as const

export const GOAL_OPTIONS = [
  { key: 'understand', label: 'Understand what I\'m eating' },
  { key: 'lose_weight', label: 'Lose weight' },
  { key: 'build_muscle', label: 'Build muscle' },
  { key: 'eat_cleaner', label: 'Eat cleaner' },
  { key: 'improve_health', label: 'Improve overall health' },
] as const
