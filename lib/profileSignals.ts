/**
 * profileSignals.ts
 *
 * Declarative mapping from user profile keys to ingredient-level detection patterns.
 * This is the single source of truth for how profile preferences translate to
 * ingredient matches, conflicts, and scoring signals.
 *
 * To add a new sensitivity, preference, or goal:
 * 1. Add the key to the appropriate option set in types/index.ts
 * 2. Add its signal entry here
 * 3. Nothing else needs to change
 */

export interface SensitivitySignal {
  /** Regex tested against each ingredient name to detect this sensitivity trigger */
  ingredientPattern: RegExp
  /** Human-readable label for UI display */
  label: string
  /** Score penalty applied when signal is detected (positive number = penalty) */
  penalty: number
  /** Whether detection should cap score at 50 (tier 2) */
  triggersTier2: boolean
}

export interface PreferenceSignal {
  label: string
  /** Ingredients that SUPPORT this preference (boosts score) */
  matchPattern?: RegExp
  /** Ingredients that CONFLICT with this preference (penalizes score) */
  conflictPattern?: RegExp
  /** Score boost per matching ingredient */
  matchBoost?: number
  /** Score penalty per conflicting ingredient */
  conflictPenalty?: number
}

export interface GoalSignal {
  label: string
  /** Ingredients that align with this goal */
  alignPattern?: RegExp
  /** Ingredients that conflict with this goal */
  conflictPattern?: RegExp
  alignBoost?: number
  conflictPenalty?: number
  /** If true, conflicts hard-cap the score */
  hardCapOnConflict?: boolean
  hardCapValue?: number
}

// --- SENSITIVITY SIGNALS ----------------------------------------------------

export const SENSITIVITY_SIGNALS: Record<string, SensitivitySignal> = {
  lactose: {
    label: 'Lactose',
    ingredientPattern: /lactose|milk|dairy|whey|casein|cream|butter|yogurt|yoghurt|cheese|lacto/i,
    penalty: 20,
    triggersTier2: true,
  },
  gluten_sensitivity: {
    label: 'Gluten sensitivity',
    ingredientPattern:
      /wholewheat|whole wheat|\bwheat\b|wheat\s*(?:flour|starch|germ|bran|protein|dextrin|berries)|enriched\s+wheat|vital\s+wheat\s+gluten|hydroly(?:zed|sed)\s+wheat|bulgur|couscous|farro|einkorn|emmer|semolina|durum|spelt|kamut|triticale|seitan|soy\s+sauce|shoyu|\bbarley\b|\brye\b|\btrigo\b|\bcebada\b|\bcenteno\b|\bgluten\b(?![- ]\s*free)|\bmalt\b(?!odextrin)|malt\s+extract|malt\s+syrup|malt\s+vinegar|malted\s+barley|brewer'?s?\s+yeast/i,
    penalty: 20,
    triggersTier2: true,
  },
  artificial_sweeteners: {
    label: 'Artificial sweeteners',
    ingredientPattern:
      /aspartame|sucralose|saccharin|acesulfame|stevia|sorbitol|xylitol|erythritol|maltitol|e951|e955|e954|e950|e952/i,
    penalty: 15,
    triggersTier2: false,
  },
  high_sodium: {
    label: 'High sodium',
    ingredientPattern: /salt|sodium|soy sauce|msg|monosodium glutamate|e621|brine|miso|tamari/i,
    penalty: 10,
    triggersTier2: false,
  },
  msg: {
    label: 'MSG',
    ingredientPattern: /monosodium glutamate|msg|e621|glutamate|yeast extract|hydrolysed.*protein/i,
    penalty: 15,
    triggersTier2: false,
  },
  sulfites: {
    label: 'Sulfites',
    ingredientPattern:
      /sulfite|sulphite|sulphur dioxide|sulfur dioxide|e220|e221|e222|e223|e224|e225|e226|e227|e228/i,
    penalty: 15,
    triggersTier2: false,
  },
  caffeine: {
    label: 'Caffeine',
    ingredientPattern: /caffeine|coffee|tea\b|guarana|yerba|maté|mate|cola extract|guaraná/i,
    penalty: 12,
    triggersTier2: false,
  },
  fructose: {
    label: 'Fructose',
    ingredientPattern:
      /fructose|high.fructose|hfcs|fruit juice concentrate|agave syrup|agave nectar|apple juice concentrate|pear juice concentrate/i,
    penalty: 15,
    triggersTier2: false,
  },
  histamine: {
    label: 'Histamine',
    ingredientPattern:
      /histamine|fermented|aged cheese|smoked fish|wine vinegar|vinegar|sauerkraut|kimchi|yeast extract|miso|soy sauce/i,
    penalty: 12,
    triggersTier2: false,
  },
  nightshades: {
    label: 'Nightshades',
    ingredientPattern:
      /\btomato\b|tomatoes|potato|eggplant|aubergine|paprika|chili|chilli|goji|bell pepper|pimiento|capsicum/i,
    penalty: 15,
    triggersTier2: false,
  },
  fodmaps: {
    label: 'FODMAPs',
    ingredientPattern:
      /inulin|chicory|fructooligosaccharide|\bfos\b|polyol|sorbitol|mannitol|xylitol|lactitol|isomalt|wheat fructan|garlic|onion|honey|agave/i,
    penalty: 15,
    triggersTier2: true,
  },
}

// --- PREFERENCE SIGNALS -----------------------------------------------------

export const PREFERENCE_SIGNALS: Record<string, PreferenceSignal> = {
  high_protein: {
    label: 'High protein',
    matchPattern:
      /protein|whey|casein|egg|chicken|beef|turkey|tuna|salmon|soy protein|pea protein|hemp protein|greek yogurt/i,
    matchBoost: 10,
  },
  low_sugar: {
    label: 'Low sugar',
    conflictPattern:
      /\bsugar\b|glucose|fructose|corn syrup|dextrose|maltose|sucrose|honey|agave|maple syrup|molasses|cane juice/i,
    conflictPenalty: 12,
  },
  low_carb: {
    label: 'Low carb',
    conflictPattern:
      /sugar|flour|wheat|starch|maltodextrin|corn syrup|rice|oats|potato|bread|pasta|dextrose/i,
    conflictPenalty: 10,
  },
  low_calorie: {
    label: 'Low calorie',
    conflictPattern: /oil|butter|cream|sugar|glucose|fructose|corn syrup|lard|shortening/i,
    conflictPenalty: 8,
  },
  vegan: {
    label: 'Vegan',
    conflictPattern:
      /milk|eggs?\b|meat|chicken|beef|pork|lamb|fish|shellfish|honey|gelatin|gelatine|whey|casein|lactose|cream|butter|cheese|yogurt|yoghurt|lard|tallow|anchov|rennet|isinglass|carmine|e120|cochineal|shellac|e904|l.cysteine|e920|castoreum/i,
    conflictPenalty: 25,
  },
  vegetarian: {
    label: 'Vegetarian',
    conflictPattern:
      /\bmeat\b|chicken|beef|pork|lamb|turkey|\bfish\b|shellfish|gelatin|gelatine|lard|tallow|anchov|rennet|isinglass|carmine|e120|cochineal|l.cysteine|e920/i,
    conflictPenalty: 25,
  },
  plant_based: {
    label: 'Plant-based',
    conflictPattern:
      /milk|eggs?\b|meat|chicken|beef|pork|lamb|fish|shellfish|honey|gelatin|gelatine|whey|casein|lactose|cream|butter|cheese|yogurt|yoghurt|lard|tallow|anchov|rennet|isinglass|carmine|e120|cochineal|shellac|e904|l.cysteine|e920/i,
    conflictPenalty: 20,
  },
  less_processed: {
    label: 'Eat cleaner / less processed',
    conflictPattern:
      /\be\d{3}|modified starch|hydrogenated|glucose syrup|maltodextrin|artificial|sodium caseinate|carrageenan|xanthan/i,
    conflictPenalty: 8,
  },
  kosher: {
    label: 'Kosher',
    conflictPattern:
      /\bpork\b|bacon|ham|lard|shellfish|shrimp|crab|lobster|gelatin|cochineal|e120|non.kosher/i,
    conflictPenalty: 22,
  },
  halal: {
    label: 'Halal',
    conflictPattern: /\bpork\b|bacon|ham|lard|wine\b|beer\b|rum\b|vodka|whiskey|brandy|liqueur|ethanol\b/i,
    conflictPenalty: 22,
  },
  paleo: {
    label: 'Paleo',
    conflictPattern:
      /wheat|barley|rye|oats|corn syrup|legume|lentil|chickpea|black bean|soybean|tofu|peanut|milk|cheese|yogurt|refined sugar/i,
    conflictPenalty: 14,
  },
  whole30: {
    label: 'Whole30',
    conflictPattern:
      /\bsugar\b|dextrose|maltodextrin|corn syrup|soy|legume|dairy|wine|beer|msg|carrageenan|sulfite/i,
    conflictPenalty: 16,
  },
  diabetic_friendly: {
    label: 'Diabetic-friendly',
    conflictPattern: /\bsugar\b|glucose|fructose|corn syrup|maltose|maltodextrin|hfcs|dextrose/i,
    conflictPenalty: 14,
  },
}

// --- GOAL SIGNALS -----------------------------------------------------------

const MORE_PROTEIN: GoalSignal = {
  label: 'Eat more protein',
  alignPattern: /protein|whey|casein|egg|chicken|beef|soy protein|pea protein|hemp protein/i,
  alignBoost: 12,
  conflictPattern: /hydrogenated|glucose syrup|artificial/i,
  conflictPenalty: 5,
}

const BALANCED_DIET: GoalSignal = {
  label: 'Maintain a balanced diet',
  conflictPattern: /hydrogenated|glucose syrup|corn syrup|artificial|e\d{3}/i,
  conflictPenalty: 6,
}

export const GOAL_SIGNALS: Record<string, GoalSignal> = {
  more_protein: MORE_PROTEIN,
  /** @deprecated use `more_protein` — kept for persisted profiles + tests */
  build_muscle: MORE_PROTEIN,
  less_sugar: {
    label: 'Eat less sugar',
    conflictPattern:
      /\bsugar\b|glucose|fructose|corn syrup|dextrose|maltose|sucrose|honey|agave|maple syrup|molasses/i,
    conflictPenalty: 12,
  },
  lose_weight: {
    label: 'Lose weight',
    conflictPattern: /\bsugar\b|glucose syrup|corn syrup|hydrogenated|lard|shortening/i,
    conflictPenalty: 10,
  },
  gain_weight: {
    label: 'Gain weight',
    alignPattern: /protein|nut|almond|walnut|pecan|oil|butter|cream|avocado|mct|coconut oil|peanut/i,
    alignBoost: 8,
    conflictPattern: /artificial|e\d{3}|maltodextrin/i,
    conflictPenalty: 4,
  },
  gut_health: {
    label: 'Improve gut health',
    alignPattern: /fiber|fibre|prebiotic|probiotic|ferment|yogurt|yoghurt|kefir|kimchi|miso/i,
    alignBoost: 8,
    conflictPattern: /carrageenan|polysorbate|aspartame|sucralose|saccharin|acesulfame|artificial/i,
    conflictPenalty: 10,
  },
  eat_cleaner: {
    label: 'Eat cleaner',
    conflictPattern:
      /e\d{3}|modified starch|hydrogenated|glucose syrup|maltodextrin|artificial|sodium caseinate|carrageenan/i,
    conflictPenalty: 8,
    alignPattern: /organic|whole|natural|unrefined/i,
    alignBoost: 5,
  },
  balanced_diet: BALANCED_DIET,
  /** @deprecated use `balanced_diet` */
  improve_health: BALANCED_DIET,
  reduce_upf: {
    label: 'Reduce ultra-processed foods',
    conflictPattern:
      /e\d{3}|modified starch|hydrogenated|glucose syrup|maltodextrin|artificial|hydrolyzed|textured vegetable protein/i,
    conflictPenalty: 12,
  },
  lower_sodium: {
    label: 'Lower sodium',
    conflictPattern: /salt|sodium|soy sauce|msg|monosodium glutamate|e621|brine|miso|tamari/i,
    conflictPenalty: 10,
  },
  understand: {
    label: "Understand what I'm eating",
  },
}

export const AVOIDING_SIGNALS: Record<string, RegExp | null> = {
  'seed oils':
    /sunflower oil|canola oil|rapeseed oil|soybean oil|corn oil|cottonseed oil|safflower oil|grapeseed oil|vegetable oil/i,
  hfcs: /high.fructose corn syrup|hfcs|glucose.fructose syrup|corn syrup/i,
  'artificial dyes':
    /red 40|red no\.? 40|e129|yellow 5|e102|tartrazine|yellow 6|e110|blue 1|e133|blue 2|e132|green 3|e143|red 3|e127|caramel colou?r|e150/i,
  preservatives:
    /sodium benzoate|potassium sorbate|\bbha\b|\bbht\b|\btbhq\b|e211|e202|e320|e321|e319|sodium nitrate|sodium nitrite|e250|e251/i,
  'added sugar':
    /\bsugar\b|glucose syrup|fructose|corn syrup|dextrose|maltose|sucrose|cane juice|cane sugar|honey|agave|maple syrup|molasses/i,
  gluten:
    /wholewheat|whole wheat|\bwheat\b|wheat\s*(?:flour|starch|germ|bran|protein|dextrin|berries)|enriched\s+wheat|vital\s+wheat\s+gluten|hydroly(?:zed|sed)\s+wheat|bulgur|couscous|farro|einkorn|emmer|semolina|durum|spelt|kamut|triticale|seitan|soy\s+sauce|shoyu|\bbarley\b|\brye\b|\bgluten\b(?![- ]\s*free)|\bmalt\b(?!odextrin)|malt\s+extract|malt\s+syrup|malt\s+vinegar|malted\s+barley|brewer'?s?\s+yeast/i,
  'processed meat':
    /sodium nitrate|sodium nitrite|e250|e251|mechanically separated|meat by-product|meat slurry/i,
  'palm oil': /palm oil|palm kernel oil|palmitate|palmitoyl/i,
  'refined carbs': /white flour|enriched flour|bleached flour|maltodextrin|modified starch|corn starch/i,
  'artificial flavors': /artificial flavou?r(?:ing)?/i,
  carrageenan: /carrageenan|e407/i,
}

/**
 * Avoiding keys that cannot be detected from ingredient labels alone.
 * These should surface a UI note rather than attempting ingredient matching.
 */
export const UNDETECTABLE_AVOIDING_KEYS: Set<string> = new Set([
  // Intentionally empty for now.
])
