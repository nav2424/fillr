// Evidence-based Allergen Engine - Types
// Deterministic, no AI, every alert cites exact match + source

export type OverallStatus = 'SAFE' | 'CONTAINS' | 'MAY_CONTAIN' | 'UNKNOWN'

export type Severity = 'CONTAINS' | 'MAY_CONTAIN'

export type SectionSource = 'ingredients' | 'contains' | 'may_contain'

export type CeliacSignalType =
  | 'EXPLICIT_GRAIN'
  | 'BARLEY_MALT'
  | 'AMBIGUOUS_MALT'
  | 'BREWERS_YEAST'
  | 'ALLERGEN_SECTION'
  | 'MAY_CONTAIN'
  | 'OATS'
  | 'CERTIFIED_GF'

export interface CeliacMatch {
  ingredient: string
  signalType: CeliacSignalType
  severity: 'AVOID' | 'CAUTION' | 'SAFE_WITH_NOTE'
  reason: string
}

/** Every match must include exact evidence - no hallucinations */
export interface MatchedAllergen {
  allergen_id: string
  allergen_name: string
  severity: Severity
  section: SectionSource
  match_text: string
}

export interface DetectionInput {
  ingredients_text?: string
  /**
   * Unstripped English ingredient section (parentheses kept) for allergen text matching.
   * When set, used instead of `ingredients_text` for parseSections/runMatching on the ingredients section.
   */
  ingredients_text_safety?: string
  contains_text?: string
  may_contain_text?: string
  product_name?: string
  /** OFF structured fields - used for CONTAINS/MAY_CONTAIN when present */
  allergens_tags?: string[]
  traces_tags?: string[]
  allergens_hierarchy?: string[]
  traces_hierarchy?: string[]
  ingredients_tags?: string[]
  ingredients?: Array<{ text?: string }>
}

/** Unverified hint from product name - only when UNKNOWN, never confirmed */
export interface ProductNameHint {
  allergen_id: string
  allergen_name: string
  hint_text: string
}

export interface DetectionOutput {
  overall_status: OverallStatus
  matched_allergens: MatchedAllergen[]
  /** Only when UNKNOWN - optional hints from product name (never confirmed) */
  product_name_hints?: ProductNameHint[]
  /** Logged for debugging - exact text used for detection */
  scan_log: {
    ingredients_text_used: string
    /** Haystack used for safety matching (parens preserved); omitted when identical to stripped. */
    ingredients_text_safety_used?: string
    contains_text_used: string
    may_contain_text_used: string
    has_ingredient_data: boolean
    /** 0-100: +60 ingredients_text, +20 allergens_tags, +10 traces_tags, +10 structured ingredients */
    source_coverage_score?: number
  }
  /** CTAs when UNKNOWN */
  fallback_ctas?: {
    scan_label_photo?: boolean
    paste_ingredients_manually?: boolean
  }
  celiac?: {
    celiacModeEnabled: boolean
    matchedGlutenSignals: CeliacMatch[]
    celiacSeverity: 'SAFE' | 'CAUTION' | 'AVOID'
  }
}

export interface BuiltinAllergen {
  id: string
  name: string
  synonyms: string[]
  /** Treat "gluten" as wheat unless user disables */
  gluten_as_wheat?: boolean
  /** soy lecithin, soybean oil - still flag */
  flag_soy_derivatives?: boolean
}

export type CustomAllergenMatchMode = 'EXACT_PHRASE' | 'KEYWORDS'

export type CustomAllergenSeverity = 'allergy' | 'preference'

export interface CustomAllergenRule {
  id: string
  name: string
  match_mode: CustomAllergenMatchMode
  terms: string[]
  enabled_sections: SectionSource[]
  severity_level: CustomAllergenSeverity
  /** User-approved synonyms - NOT auto-added */
  approved_synonyms?: string[]
}

export interface UserAllergenConfig {
  builtin_ids: string[]
  custom_rules: CustomAllergenRule[]
}

