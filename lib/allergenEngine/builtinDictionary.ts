// Curated built-in allergen synonym dictionary
// Editable lists - expand as needed
// All matching is phrase-first with word boundaries; no partial matches (e.g., "nut" ≠ "donut")

import type { BuiltinAllergen } from './types'

export const BUILTIN_ALLERGENS: BuiltinAllergen[] = [
  {
    id: 'milk',
    name: 'Milk',
    synonyms: [
      'milk', 'whey', 'casein', 'lactose', 'cream', 'butter', 'butterfat',
      'milk powder', 'skim milk powder', 'milkfat', 'modified milk ingredients',
      'sodium caseinate', 'calcium caseinate', 'milk protein', 'milk solids',
      'nonfat dry milk', 'dry milk', 'evaporated milk', 'condensed milk',
      'lait', 'lactosérum', 'caséine', 'beurre', 'crème', 'fromage',
      'mozzarella', 'cheddar', 'ricotta', 'mascarpone', 'parmesan cheese',
      'cottage cheese', 'cream cheese', 'sour cream', 'yogurt', 'yoghurt', 'kefir', 'buttermilk',
      'half and half', 'whipping cream', 'heavy cream', 'light cream',
      'lactalbumin', 'lactoglobulin', 'galactose', 'lactulose'
    ],
  },
  {
    id: 'eggs',
    name: 'Eggs',
    synonyms: [
      'egg', 'eggs', 'egg white', 'egg yolk', 'albumen', 'albumin', 'mayonnaise',
      'ovalbumin', 'ovomucoid', 'lysozyme', 'egg powder', 'dried egg',
      'œuf', 'oeuf', 'oeufs', "blanc d'œuf", "jaune d'œuf"
    ],
  },
  {
    id: 'wheat',
    name: 'Wheat',
    synonyms: [
      'wheat', 'enriched flour', 'unbleached enriched flour', 'enriched wheat flour', 'durum', 'semolina',
      'farina', 'gluten', 'wheat gluten', 'vital wheat gluten',
      'graham flour', 'bread flour', 'cake flour', 'pastry flour', 'all-purpose flour',
      'whole wheat flour', 'whole wheat', 'wheat starch', 'wheat protein', 'wheat germ', 'wheat bran',
      'wheat dextrin', 'wheat berries', 'spelt', 'kamut', 'couscous', 'bulgur', 'panko',
      'matzo', 'matzoh', 'barley', 'rye', 'malt', 'malt extract', 'malt syrup', 'malt vinegar', 'malt flour',
      'soy sauce', 'shoyu',
      "brewer's yeast", 'brewers yeast', 'triticale', 'farro', 'einkorn', 'emmer',
      'blé', 'farine de blé', 'farine de froment', 'semoule', 'gluten', 'orge', 'seigle',
      'harina de trigo', 'salsa de soja',
    ],
    gluten_as_wheat: true,
  },
  {
    id: 'soy',
    name: 'Soy',
    synonyms: [
      'soy', 'soya', 'soybean', 'soy lecithin', 'lecithin (soy)', 'lecithin (soja)',
      'soybean oil', 'soy oil', 'textured vegetable protein', 'tvp',
      'tofu', 'tempeh', 'edamame', 'miso', 'soy sauce', 'soy protein',
      'soy flour', 'soy meal', 'hydrolyzed soy protein',
      'soja', 'lécithine de soja', 'huile de soja', 'farine de soja'
    ],
    flag_soy_derivatives: true,
  },
  {
    id: 'peanuts',
    name: 'Peanuts',
    synonyms: [
      'peanut', 'peanuts', 'groundnut', 'arachis', 'arachide', 'peanut oil', 'peanut butter',
      'peanut flour', 'peanut protein', 'cacahuète', 'cacahuètes'
    ],
  },
  {
    id: 'tree_nuts',
    name: 'Tree Nuts',
    synonyms: [
      'tree nut', 'tree nuts',
      'almond', 'almonds', 'hazelnut', 'hazelnuts', 'cashew', 'cashews',
      'walnut', 'walnuts', 'pecan', 'pecans', 'pistachio', 'pistachios',
      'macadamia', 'macadamias', 'brazil nut', 'brazil nuts', 'pine nut', 'pine nuts',
      'chestnut', 'chestnuts', 'marzipan', 'praline', 'nougat',
      'amande', 'noisette', 'noix de cajou', 'noix de Grenoble', 'pacane',
      'pistache', 'pignon', 'châtaigne'
    ],
  },
  {
    id: 'fish',
    name: 'Fish',
    synonyms: [
      'fish', 'anchovy', 'anchovies', 'salmon', 'tuna', 'cod', 'haddock',
      'tilapia', 'trout', 'sardine', 'sardines', 'halibut', 'flounder',
      'fish oil', 'fish sauce', 'fish paste', 'fish extract',
      'poisson', 'anchois', 'saumon', 'thon', 'morue', 'sardine'
    ],
  },
  {
    id: 'sesame',
    name: 'Sesame',
    synonyms: [
      'sesame', 'sesame seeds', 'sesame seed', 'tahini', 'tahina',
      'benne', 'gingelly', 'simsim', 'sesame oil', 'sesame paste',
      'sésame', 'graines de sésame', 'tahin', 'halva', 'halvah'
    ],
  },
  {
    id: 'shellfish',
    name: 'Shellfish',
    synonyms: [
      'shrimp', 'prawn', 'prawns', 'crab', 'crabs', 'lobster', 'lobsters',
      'clam', 'clams', 'mussel', 'mussels', 'oyster', 'oysters',
      'scallop', 'scallops', 'squid', 'octopus', 'crawfish', 'crayfish',
      'crustacean', 'crustaceans', 'mollusk', 'mollusks',
      'crevette', 'crabe', 'homard', 'huître', 'crustacés', 'mollusques'
    ],
  },
  {
    id: 'mustard',
    name: 'Mustard',
    synonyms: ['mustard', 'mustard seed', 'mustard seeds', 'mustard oil', 'mustard powder', 'mustard flour', 'mustard extract', 'moutarde', 'graine de moutarde'],
  },
  {
    id: 'celery',
    name: 'Celery',
    synonyms: ['celery', 'celery seed', 'celery salt', 'celery root', 'celeriac', 'céleri', 'graine de céleri'],
  },
  {
    id: 'lupin',
    name: 'Lupin',
    synonyms: ['lupin', 'lupine', 'lupini', 'lupin flour', 'lupin protein'],
  },
  {
    id: 'sulfites',
    name: 'Sulfites',
    synonyms: ['sulfites', 'sulphites', 'sulfiting agents', 'sulfur dioxide', 'sodium sulfite', 'sodium bisulfite', 'sodium metabisulfite', 'potassium sulfite', 'potassium bisulfite', 'potassium metabisulfite'],
  },
]

/** Anti-matches: terms that should NOT trigger the allergen (false positive prevention).
 * For milk: "peanut butter" etc. only apply when matching "butter"/"cream" (via shouldSkipMilkButterCream).
 * These apply when matching the allergen's generic terms. */
export const ANTI_MATCHES: Record<string, string[]> = {
  milk: [
    'soy milk', 'almond milk', 'coconut milk', 'oat milk', 'rice milk', 'hemp milk',
    'cashew milk', 'macadamia milk', 'pea milk', 'flax milk', 'quinoa milk', 'spelt milk',
    'milk thistle', 'milkweed', 'cream of tartar', 'coconut cream',
    'lactic acid', 'sodium lactate', 'calcium lactate'
    // peanut butter, cocoa butter, etc. handled by shouldSkipMilkButterCream for term "butter"/"cream"
  ],
  eggs: ['eggplant', 'eggnog'],
  wheat: [
    'wheatgrass', 'glutamate', 'monosodium glutamate', 'msg', 'glutamic acid',
    'gluten-free', 'sans gluten', 'wheat-free', 'buckwheat', 'sweet buckwheat',
    'gluten-free soy sauce', 'tamari', 'coconut aminos',
  ],
  tree_nuts: [
    'coconut', 'nutmeg', 'water chestnut', "châtaigne d'eau"
  ],
  soy: ['sunflower lecithin', 'lecithin from sunflower', 'canola lecithin', 'lecithin from canola', 'soy-free', 'sans soja'],
  fish: ['fish-free', 'sans poisson'],
  sesame: ['sesame-free', 'sans sésame'],
}

/** Non-wheat flours: "flour" alone doesn't match wheat when these are explicit */
export const NON_WHEAT_FLOURS = [
  'rice flour', 'corn flour', 'almond flour', 'coconut flour', 'oat flour',
  'quinoa flour', 'buckwheat flour', 'tapioca flour', 'potato flour',
  'chickpea flour', 'soy flour', 'peanut flour', 'millet flour', 'sorghum flour'
]

/** Non-dairy butter/cream: don't match milk when in these phrases */
export const NON_DAIRY_BUTTER_CREAM = [
  'peanut butter', 'cocoa butter', 'shea butter', 'apple butter', 'nut butter',
  'cream of tartar', 'coconut cream', 'whipped topping', 'non-dairy creamer'
]

/** Non-dairy "___ milk" phrases: never treat as dairy allergen evidence */
export const NON_DAIRY_MILK = [
  'coconut milk', 'almond milk', 'oat milk', 'rice milk', 'soy milk',
  'hemp milk', 'cashew milk', 'macadamia milk', 'pea milk', 'flax milk',
  'quinoa milk', 'spelt milk'
]

export const CELIAC_RULES = {
  EXPLICIT_GRAINS: {
    terms: [
      'wheat',
      'barley',
      'rye',
      'triticale',
      'spelt',
      'farro',
      'durum',
      'semolina',
      'einkorn',
      'emmer',
      'seitan',
      'kamut',
      'wheat flour',
      'wheat starch',
      'wheat germ',
      'wheat bran',
      'wheat protein',
      'wheat dextrin',
      'vital wheat gluten',
      'hydrolyzed wheat',
      'hydrolysed wheat',
      'modified wheat starch',
      'bulgur',
      'couscous',
      'freekeh',
      'panko',
      'graham flour',
      'matzo',
      'matzoh',
      'rye flour',
      'barley flour',
      'pearl barley',
      'soy sauce',
      'shoyu',
      'farine de ble',
      'farine de froment',
      'amidon de ble',
      'gluten de ble',
      'son de ble',
      'germe de ble',
      'harina de trigo',
      'cebada',
      'centeno',
      'salsa de soja',
    ],
    severity: 'AVOID' as const,
    signalType: 'EXPLICIT_GRAIN' as const,
    reason: 'Direct gluten source — unsafe for celiac disease',
  },
  BARLEY_MALT: {
    terms: [
      'barley malt',
      'malted barley',
      'barley malt extract',
      'barley malt flavor',
      'barley malt flavoring',
      'malt vinegar',
      'rye malt',
    ],
    severity: 'AVOID' as const,
    signalType: 'BARLEY_MALT' as const,
    reason: 'Barley-derived malt — contains gluten',
  },
  ALLERGEN_SECTION: {
    terms: [
      'contains wheat',
      'contains gluten',
      'contains barley',
      'contains rye',
      'allergens: wheat',
      'allergens: gluten',
      'contient du ble',
      'contient du gluten',
      'contient de l orge',
      'contient du seigle',
      'contient: ble',
      'contient : ble',
      'peut contenir du ble',
      'peut contenir du gluten',
      'contiene trigo',
      'contiene gluten',
      'contiene cebada',
      'contiene centeno',
    ],
    severity: 'AVOID' as const,
    signalType: 'ALLERGEN_SECTION' as const,
    reason: 'Product explicitly declares gluten source',
  },
  AMBIGUOUS_MALT: {
    terms: ['malt extract', 'malt flavor', 'malt flavour', 'malt flavoring', 'malt syrup', 'malt'],
    severity: 'CAUTION' as const,
    signalType: 'AMBIGUOUS_MALT' as const,
    reason: 'Malt is usually barley-derived — source not specified on this label',
  },
  /** Often grown on grain; not always declared GF — verify brand. */
  BREWERS_YEAST: {
    terms: ["brewer's yeast", 'brewers yeast'],
    severity: 'CAUTION' as const,
    signalType: 'BREWERS_YEAST' as const,
    reason:
      "Brewer's yeast is frequently grown on gluten-containing grains unless the label states gluten-free — verify source",
  },
  MAY_CONTAIN: {
    terms: [
      'may contain wheat',
      'may contain gluten',
      'may contain traces of wheat',
      'may contain traces of gluten',
      'made in a facility with wheat',
      'manufactured in a facility that processes wheat',
      'manufactured in a facility that also processes wheat',
      'shared equipment with wheat',
      'same equipment as wheat',
      'processed in a facility that also processes wheat',
      'traces of wheat',
      'traces de ble',
      'peut contenir des traces de ble',
      'peut contenir des traces de gluten',
    ],
    severity: 'CAUTION' as const,
    signalType: 'MAY_CONTAIN' as const,
    reason: 'Cross-contact risk — facility or equipment shared with gluten-containing products',
  },
  OATS: {
    terms: [
      'oats',
      'oat flour',
      'oat bran',
      'rolled oats',
      'quick oats',
      'steel cut oats',
      'oat fiber',
      'oatmeal',
    ],
    severity: 'CAUTION' as const,
    signalType: 'OATS' as const,
    reason:
      'Oats are often contaminated with gluten during processing unless certified gluten-free',
  },
  CERTIFIED_GF: {
    terms: ['certified gluten-free', 'gluten free', 'gluten-free', 'no gluten'],
    severity: 'SAFE_WITH_NOTE' as const,
    signalType: 'CERTIFIED_GF' as const,
    reason:
      'Labeled gluten-free — verify certification and check for cross-contact risk if highly sensitive',
  },
  /** Substrings that must skip grain rules — e.g. "buckwheat" contains "wheat" but is not wheat. */
  SAFE_NEGATIVES: [
    'certified gluten-free oats',
    'wheat-free',
    'gluten-free wheat starch',
    'buckwheat',
    'wheatgrass',
    'orgeat',
    'gluten-free soy sauce',
    'tamari',
    'coconut aminos',
    'gluten free brewers yeast',
    'gluten-free brewers yeast',
  ],
}

/** Sensitivity helpers shared by UI/score mapping. */
export const SENSITIVITY_MAP: Record<string, string[]> = {
  lactose: [
    'milk', 'whole milk', 'skim milk', 'skimmed milk', 'low fat milk', '2% milk', '1% milk', 'nonfat milk',
    'milk fat', 'milk solids', 'milk protein', 'milk powder', 'dried milk', 'dry milk', 'milk serum', 'buttermilk',
    'cream', 'heavy cream', 'light cream', 'sour cream', 'crème fraîche',
    'butter', 'clarified butter', 'ghee', 'cheese', 'cheddar', 'mozzarella', 'parmesan', 'romano',
    'cream cheese', 'cottage cheese', 'ricotta', 'whey', 'whey protein', 'whey powder',
    'casein', 'caseinate', 'sodium caseinate', 'calcium caseinate', 'lactalbumin', 'lactoglobulin',
    'lactose', 'lactose monohydrate', 'dairy', 'dairy solids',
    'cultured milk', 'cultured skim milk', 'cultured whole milk', 'yogurt', 'kefir', 'sour milk',
    'lait', 'lait écrémé', 'crème', 'beurre', 'fromage',
    'chocolate milk', 'condensed milk', 'evaporated milk', 'half and half',
  ],
}

export function getBuiltinById(id: string): BuiltinAllergen | undefined {
  return BUILTIN_ALLERGENS.find(a => a.id === id)
}

export function getAllSynonymIds(): string[] {
  return BUILTIN_ALLERGENS.map(a => a.id)
}

