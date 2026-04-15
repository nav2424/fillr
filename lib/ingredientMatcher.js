/**
 * Deterministic ingredient ratings — runs after OpenAI, before UI.
 * CommonJS for Metro + Node tests.
 *
 * @param {Array<Record<string, unknown>>} ingredients
 * @param {string} [fullLabelHaystack] Full label text (better for combo checks); else ingredient names joined.
 */

const ALWAYS_AVOID = [
  'yellow 5',
  'tartrazine',
  'e102',
  'yellow 6',
  'sunset yellow',
  'e110',
  'red 40',
  'allura red',
  'e129',
  'blue 1',
  'brilliant blue',
  'e133',
  'blue 2',
  'indigo carmine',
  'e132',
  'green 3',
  'fast green',
  'e143',
  'red 3',
  'erythrosine',
  'e127',
  'titanium dioxide',
  'e171',
  'potassium bromate',
  'e924',
  'brominated vegetable oil',
  'bvo',
  'propyl gallate',
  'e310',
  'tbhq',
  'tertiary butylhydroquinone',
  'e319',
  'partially hydrogenated',
  'trans fat',
  'sodium benzoate',
]

const ALWAYS_CONCERNING = [
  'high fructose corn syrup',
  'glucose-fructose syrup',
  'glucose fructose syrup',
  'glucose-fructose',
  'isoglucose',
  'hfcs',
  'corn syrup',
  'fructose syrup',
  'carrageenan',
  'e407',
  'maltodextrin',
  'sodium nitrite',
  'sodium nitrate',
  'e250',
  'e251',
  'bha',
  'butylated hydroxyanisole',
  'e320',
  'bht',
  'butylated hydroxytoluene',
  'e321',
  'carnauba wax',
  'e903',
  'soy lecithin',
  'sunflower lecithin',
  'polysorbate 60',
  'polysorbate 65',
  'polysorbate 80',
  'e435',
  'e436',
  'e433',
  'sorbitan monostearate',
  'e491',
  'xanthan gum',
  'e415',
  'modified corn starch',
  'modified starch',
  'enriched flour',
  'bleached flour',
  'enriched wheat flour',
  'bleached wheat flour',
  'artificial flavor',
  'artificial flavour',
  'monosodium glutamate',
  'msg',
  'e621',
  'acesulfame potassium',
  'acesulfame-k',
  'ace-k',
  'e950',
  'sucralose',
  'e955',
  'aspartame',
  'e951',
  'saccharin',
  'e954',
  'caramel color',
  'caramel colour',
  'caramel coloring',
  'caramel colouring',
  'colour caramel',
  'color caramel',
  'e150',
  'phosphoric acid',
  'silicon dioxide',
  'e551',
  'sodium phosphate',
  'disodium phosphate',
  'e452',
  'e340',
  'e341',
  'e322',
  'natural flavourings',
  'natural flavoring',
  'glucose syrup',
  'sodium caseinate',
  'calcium caseinate',
  'modified maize starch',
]

const ALWAYS_OKAY = [
  'sugar',
  'cane sugar',
  'brown sugar',
  'coconut sugar',
  'raw sugar',
  'beet sugar',
  'powdered sugar',
  'citric acid',
  'e330',
  'baking soda',
  'sodium bicarbonate',
  'e500',
  'baking powder',
  'yeast',
  'active dry yeast',
  'vinegar',
  'apple cider vinegar',
  'white vinegar',
  'natural flavors',
  'natural flavours',
  'stabiliser',
  'stabilisers',
  'emulsifier',
  'flavour',
  'flavoring',
  'flavouring',
  'acidity regulator',
  'anticaking agent',
  'spices',
  'emulsifiers',
  'acidity regulators',
  'flavourings',
  'colours',
  'colour',
  'food acid',
  'cheese sauce',
  'corn starch',
  'cornstarch',
  'lecithin',
  'vegetable oil',
  'canola oil',
  'sunflower oil',
  'palm oil',
  'niacin',
  'thiamine mononitrate',
  'thiamine hydrochloride',
  'riboflavin',
  'folic acid',
  'folate',
  'reduced iron',
  'ferrous sulfate',
  'ferrous fumarate',
]

/** Sea salt omitted here so it stays okay-only when matched from ALWAYS_OKAY. */
const ALWAYS_CLEAN = [
  'water',
  'filtered water',
  'purified water',
  'salt',
  'sea salt',
  'kosher salt',
  'himalayan salt',
  'sodium chloride',
  'honey',
  'pure honey',
  'raw honey',
  'maple syrup',
  'pure maple syrup',
  'olive oil',
  'extra virgin olive oil',
  'coconut oil',
  'avocado oil',
  'eggs',
  'whole eggs',
  'egg whites',
  'egg yolks',
  'whole milk',
  'milk',
  'cream',
  'cream cheese',
  'yogurt',
  'yoghurt',
  'heavy cream',
  'strawberry',
  'oats',
  'rolled oats',
  'whole oats',
  'almonds',
  'roasted almonds',
  'cashews',
  'roasted cashews',
  'peanuts',
  'roasted peanuts',
  'dry roasted peanuts',
  'walnuts',
  'pecans',
  'pistachios',
  'quinoa',
  'brown rice',
  'whole wheat',
  'wheat',
  'pasta',
  'potato',
  'potatoes',
  'blueberries',
  'strawberries',
  'raspberries',
  'banana',
  'apple',
  'mango',
  'spinach',
  'kale',
  'broccoli',
  'chicken',
  'beef',
  'salmon',
  'tuna',
  'cocoa',
  'cocoa powder',
  'cacao',
  'vanilla',
  'vanilla extract',
  'cinnamon',
  'turmeric',
  'ginger',
  'black pepper',
  'garlic',
  'onion powder',
  'lemon juice',
  'lime juice',
  'flaxseed',
  'chia seeds',
  'hemp seeds',
  'sunflower seeds',
  'pumpkin seeds',
  'dried egg whites',
  // Probiotic / fermentation cultures
  's thermophilus',
  'streptococcus thermophilus',
  'l bulgaricus',
  'lactobacillus bulgaricus',
  'l acidophilus',
  'lactobacillus acidophilus',
  'l casei',
  'lactobacillus casei',
  'l rhamnosus',
  'lactobacillus rhamnosus',
  'b bifidus',
  'bifidobacterium',
  'bifidus',
  'l lactis',
  'lactococcus lactis',
  'l delbrueckii',
  'lactobacillus delbrueckii',
  'cultures',
]

const MIN_REASON =
  'Fillr applies a deterministic safety rule for this ingredient name, overriding the model rating when they disagree.'

function deterministicReason(nameNormalized, rating) {
  if (rating === 'concerning') {
    if (
      /high fructose corn syrup|hfcs|glucose fructose syrup|glucose-fructose|corn syrup|fructose syrup/.test(
        nameNormalized
      )
    ) {
      return 'Industrial sweetener — Canadian name for high fructose corn syrup. Bypasses hunger signals and is processed entirely by the liver.'
    }
    if (/caramel color|caramel colour|caramel coloring|caramel colouring|colour caramel|color caramel|e150/.test(nameNormalized)) {
      return 'Class IV caramel color — contains 4-MEI, a compound listed as a possible carcinogen by the IARC. California requires a warning label above certain levels.'
    }
    if (/phosphoric acid/.test(nameNormalized)) {
      return 'Strong acid used to add tartness. Linked to lower bone density with regular consumption. Gives cola its sharp bite.'
    }
  }
  if (rating === 'okay' && /emulsifiers|acidity regulators|flavourings|colours|colour|food acid/.test(nameNormalized)) {
    return "Generic category term — the specific additive isn't named. Usually harmless at levels used in food but impossible to verify without the specific compound."
  }
  if (rating === 'okay' && /stabiliser|stabilisers|emulsifier|acidity regulator|anticaking agent|flavouring/.test(nameNormalized)) {
    return "Generic category term — the specific additive isn't named. Usually harmless at levels used in food but impossible to verify without the specific compound."
  }
  return MIN_REASON
}

/**
 * Normalize ingredient display names so substring rules match real label variants
 * (e.g. "FD&C Yellow #5" → contains "yellow 5", "Glucose-fructose syrup" → HFCS family).
 */
function normalizeForMatch(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[#'"().]/g, ' ')
    .replace(/&/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isENumberIngredient(nameNormalized) {
  return /\be\d{3}[a-z]{0,3}\b/i.test(nameNormalized)
}

/**
 * Priority: avoid > concerning > clean > okay > keep AI rating.
 * @param {Array<Record<string, unknown>>} ingredients
 * @param {string} [fullLabelHaystack]
 */
function applyDeterministicRatings(ingredients, _fullLabelHaystack) {
  console.log('=== MATCHER RUNNING ===')
  console.log(
    'Input ingredients:',
    ingredients.map((i) => i.name)
  )

  const out = ingredients.map((ingredient) => {
    const nameNormalized = normalizeForMatch(ingredient.name)
    if (!nameNormalized) {
      return { ...ingredient, ratingSource: ingredient.ratingSource || 'ai' }
    }

    const isAvoid = ALWAYS_AVOID.some((term) => nameNormalized.includes(term))
    if (isAvoid) {
      return {
        ...ingredient,
        rating: 'avoid',
        ratingOverridden: true,
        ratingSource: 'deterministic',
        ratingReason: deterministicReason(nameNormalized, 'avoid'),
      }
    }

    if (isENumberIngredient(nameNormalized)) {
      return {
        ...ingredient,
        rating: 'concerning',
        ratingOverridden: true,
        ratingSource: 'deterministic',
        ratingReason: deterministicReason(nameNormalized, 'concerning'),
      }
    }

    const isConcerning = ALWAYS_CONCERNING.some((term) => nameNormalized.includes(term))
    if (isConcerning) {
      return {
        ...ingredient,
        rating: 'concerning',
        ratingOverridden: true,
        ratingSource: 'deterministic',
        ratingReason: deterministicReason(nameNormalized, 'concerning'),
      }
    }

    const isClean = ALWAYS_CLEAN.some((term) => nameNormalized.includes(term))
    if (isClean) {
      return {
        ...ingredient,
        rating: 'clean',
        ratingOverridden: true,
        ratingSource: 'deterministic',
        ratingReason: deterministicReason(nameNormalized, 'clean'),
      }
    }

    const isOkay = ALWAYS_OKAY.some((term) => nameNormalized.includes(term))
    if (isOkay) {
      return {
        ...ingredient,
        rating: 'okay',
        ratingOverridden: true,
        ratingSource: 'deterministic',
        ratingReason: deterministicReason(nameNormalized, 'okay'),
      }
    }

    return {
      ...ingredient,
      ratingSource: ingredient.ratingSource || 'ai',
    }
  })

  console.log(
    'Output ratings:',
    out.map((i) => `${i.name} → ${i.rating}`)
  )

  return out
}

function recalculateProductSummary(ingredients) {
  const counts = { clean: 0, okay: 0, concerning: 0, avoid: 0 }
  ingredients.forEach((i) => {
    const r = String(i.rating || '').toLowerCase()
    if (counts[r] !== undefined) counts[r]++
  })
  return counts
}

/** allergy / sensitivity slug → ingredient substrings */
const ALLERGY_INGREDIENT_MAP = {
  peanuts: ['peanut', 'groundnut', 'arachis'],
  'tree nuts': [
    'almond',
    'cashew',
    'walnut',
    'pecan',
    'pistachio',
    'hazelnut',
    'macadamia',
    'brazil nut',
    'pine nut',
    'tree nut',
  ],
  dairy: [
    'milk',
    'cream',
    'butter',
    'cheese',
    'whey',
    'casein',
    'lactose',
    'lactalbumin',
    'ghee',
  ],
  gluten: ['wheat', 'barley', 'rye', 'malt', 'spelt', 'semolina', 'farro', 'triticale'],
  eggs: ['egg', 'albumin', 'globulin', 'lysozyme', 'mayonnaise', 'meringue'],
  soy: ['soy', 'soya', 'tofu', 'tempeh', 'edamame', 'miso', 'natto'],
  fish: [
    'cod',
    'salmon',
    'tuna',
    'tilapia',
    'bass',
    'anchovy',
    'sardine',
    'fish',
    'surimi',
  ],
  shellfish: ['shrimp', 'crab', 'lobster', 'prawn', 'oyster', 'scallop', 'clam', 'mussel', 'shellfish'],
  sesame: ['sesame', 'tahini', 'til', 'gingelly'],
  corn: ['corn', 'maize', 'cornstarch', 'corn syrup', 'dextrose', 'maltodextrin'],
  sulfites: [
    'sulfite',
    'sulphite',
    'sulfur dioxide',
    'sodium bisulfite',
    'potassium metabisulfite',
    'e220',
    'e221',
    'e222',
    'e223',
    'e224',
  ],
  msg: [
    'monosodium glutamate',
    'msg',
    'e621',
    'glutamate',
    'yeast extract',
    'hydrolyzed protein',
    'hydrolysed protein',
  ],
}

const SENSITIVITY_EXTRA_MAP = {
  caffeine: ['caffeine', 'coffee', 'guarana', 'tea extract', 'cola'],
  lactose: [
    'milk',
    'whole milk',
    'skim milk',
    'skimmed milk',
    'low fat milk',
    'nonfat milk',
    'milk fat',
    'milk solids',
    'milk protein',
    'milk powder',
    'dried milk',
    'dry milk',
    'milk serum',
    'buttermilk',
    'cream',
    'heavy cream',
    'light cream',
    'sour cream',
    'creme fraiche',
    'butter',
    'clarified butter',
    'ghee',
    'cheese',
    'cheddar',
    'mozzarella',
    'parmesan',
    'romano',
    'cream cheese',
    'cottage cheese',
    'ricotta',
    'whey',
    'whey protein',
    'whey powder',
    'casein',
    'caseinate',
    'sodium caseinate',
    'calcium caseinate',
    'lactalbumin',
    'lactoglobulin',
    'lactose',
    'lactose monohydrate',
    'dairy',
    'dairy solids',
    'cultured milk',
    'cultured skim milk',
    'cultured whole milk',
    'yogurt',
    'kefir',
    'sour milk',
    'lait',
    'lait ecreme',
    'creme',
    'beurre',
    'fromage',
    'chocolate milk',
    'condensed milk',
    'evaporated milk',
    'half and half',
  ],
  fructose: ['fructose', 'high fructose', 'hfcs'],
  histamine: ['histamine', 'tyramine', 'fermented'],
  nightshades: ['tomato', 'potato', 'eggplant', 'paprika', 'chili pepper', 'bell pepper', 'capsicum'],
  fodmaps: ['onion', 'garlic', 'inulin', 'chicory', 'mannitol', 'sorbitol'],
  'artificial sweeteners': [
    'aspartame',
    'sucralose',
    'acesulfame',
    'saccharin',
    'neotame',
    'advantame',
  ],
  alcohol: ['alcohol', 'ethanol', 'wine', 'beer', 'rum', 'vodka', 'bourbon', 'whiskey'],
  salicylates: ['salicylate', 'salicylic'],
}

const AVOIDING_MAP = {
  'seed oils': [
    'canola oil',
    'vegetable oil',
    'soybean oil',
    'sunflower oil',
    'safflower oil',
    'corn oil',
    'cottonseed oil',
    'rice bran oil',
  ],
  hfcs: ['high fructose corn syrup', 'hfcs', 'glucose-fructose', 'glucose fructose syrup', 'isoglucose'],
  'artificial dyes': [
    'red 40',
    'yellow 5',
    'yellow 6',
    'blue 1',
    'tartrazine',
    'allura red',
    'artificial color',
    'artificial colour',
  ],
  preservatives: ['bha', 'bht', 'sodium benzoate', 'potassium sorbate', 'sodium nitrite', 'sodium nitrate', 'tbhq'],
  'added sugar': [
    'sugar',
    'syrup',
    'dextrose',
    'maltose',
    'fructose',
    'sweetener',
    'invert sugar',
  ],
  gluten: ['wheat', 'barley', 'rye', 'malt extract', 'brewer'],
  'processed meat': ['sodium nitrite', 'bacon', 'pepperoni', 'salami', 'ham', 'jerky', 'hot dog'],
  'palm oil': ['palm oil', 'palm kernel'],
  'refined carbs': ['enriched flour', 'bleached flour', 'white flour', 'maltodextrin'],
  'artificial flavors': ['artificial flavor', 'artificial flavour'],
  carrageenan: ['carrageenan'],
  'hormone-treated dairy': ['rbgh', 'rBST', 'hormone', 'progesterone'],
  'factory farmed meat': [],
  'non-organic produce': [],
}

const PREFERENCE_CONFLICTS = {
  vegan: [
    'honey',
    'milk',
    'cream',
    'butter',
    'whey',
    'casein',
    'egg',
    'albumin',
    'gelatin',
    'carmine',
    'cochineal',
    'shellac',
    'lanolin',
    'fish',
    'chicken',
    'beef',
    'pork',
    'bacon',
    'lard',
    'tallow',
    'anchovy',
  ],
  vegetarian: [
    'gelatin',
    'anchovy',
    'fish',
    'chicken',
    'beef',
    'pork',
    'lard',
    'tallow',
    'meat',
    'broth chicken',
    'broth beef',
  ],
  keto: ['sugar', 'high fructose corn syrup', 'hfcs', 'maltodextrin', 'corn syrup', 'dextrose'],
  paleo: [
    'high fructose corn syrup',
    'hfcs',
    'corn syrup',
    'soy lecithin',
    'artificial flavor',
    'maltodextrin',
  ],
  halal: ['pork', 'bacon', 'ham', 'lard', 'gelatin', 'pepsin'],
  kosher: ['pork', 'bacon', 'ham', 'lard', 'shellfish', 'crab', 'lobster', 'shrimp'],
  whole30: ['sugar', 'corn syrup', 'maltodextrin', 'carrageenan', 'sulfite', 'msg'],
  carnivore: [
    'corn',
    'soy',
    'wheat',
    'sugar',
    'oats',
    'rice',
    'maltodextrin',
    'legume',
    'bean',
    'lentil',
  ],
  'low fodmap': ['onion', 'garlic', 'inulin', 'wheat', 'rye', 'barley', 'chicory'],
  'diabetic-friendly': ['high fructose corn syrup', 'hfcs', 'corn syrup', 'sugar', 'maltose', 'dextrose'],
}

function normalizeSlug(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
}

/**
 * @param {Array<Record<string, unknown>>} ingredients
 * @param {{ allergies: string[], sensitivities: string[], avoiding: string[], preferences: string[] }} userProfile
 */
function applyPersonalizedRatings(ingredients, userProfile) {
  const allergyTerms = (userProfile?.allergies || []).map((a) => normalizeSlug(a))
  const sensitivityTerms = (userProfile?.sensitivities || []).map((s) => normalizeSlug(s))
  const avoidingTerms = (userProfile?.avoiding || []).map((a) => normalizeSlug(a))
  const preferenceTerms = (userProfile?.preferences || []).map((p) => normalizeSlug(p))

  return ingredients.map((ingredient) => {
    const nameLower = normalizeForMatch(ingredient.name)
    if (!nameLower) return { ...ingredient }

    let updated = { ...ingredient }
    let priority = 0

    for (const allergy of allergyTerms) {
      const terms = ALLERGY_INGREDIENT_MAP[allergy] || [allergy]
      const matched = terms.some((term) => nameLower.includes(term))
      if (matched) {
        updated.rating = 'avoid'
        updated.personalFlag = 'allergy'
        updated.personalMessage = `⚠️ Contains ${allergy} — matches your allergy profile.`
        updated.ratingSource = 'personal'
        priority = 4
        break
      }
    }

    if (priority < 4) {
      for (const sensitivity of sensitivityTerms) {
        const baseTerms =
          ALLERGY_INGREDIENT_MAP[sensitivity] || SENSITIVITY_EXTRA_MAP[sensitivity]
        const terms = Array.isArray(baseTerms) && baseTerms.length ? baseTerms : [sensitivity]
        const matched = terms.some((term) => nameLower.includes(term))
        if (matched) {
          const r = String(updated.rating || '').toLowerCase()
          if (r === 'clean' || r === 'okay') updated.rating = 'concerning'
          updated.personalFlag = 'sensitivity'
          updated.personalMessage = `You've flagged sensitivity to ${sensitivity}.`
          updated.ratingSource = 'personal'
          priority = 3
          break
        }
      }
    }

    if (priority < 3) {
      for (const avoid of avoidingTerms) {
        const baseTerms = AVOIDING_MAP[avoid]
        const terms = baseTerms && baseTerms.length ? baseTerms : [avoid]
        const matched = terms.some((term) => nameLower.includes(term))
        if (matched) {
          updated.personalFlag = 'avoiding'
          updated.personalMessage = `🚫 You prefer to avoid ${avoid}.`
          priority = 2
          break
        }
      }
    }

    if (priority < 2) {
      for (const pref of preferenceTerms) {
        const conflicts = PREFERENCE_CONFLICTS[pref]
        if (!conflicts || !conflicts.length) continue
        const matched = conflicts.some((term) => nameLower.includes(term))
        if (matched) {
          updated.personalFlag = 'preference_conflict'
          updated.personalMessage = `This ingredient may not match your ${pref} diet.`
          priority = 1
          break
        }
      }
    }

    return updated
  })
}

module.exports = {
  applyDeterministicRatings,
  recalculateProductSummary,
  applyPersonalizedRatings,
  normalizeForMatch,
}
