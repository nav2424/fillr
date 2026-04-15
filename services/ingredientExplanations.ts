/**
 * Ingredient explanation database
 * 30-50 common ingredients with plain-English explanations
 * TODO: Integrate OpenAI for dynamic explanations
 */

import type { IngredientExplanation } from '../types'

const EXPLANATIONS: Record<string, IngredientExplanation> = {
  'sodium caseinate': {
    name: 'Sodium Caseinate',
    whatItIs:
      'A milk-derived protein made from casein. Often used to improve texture and protein content.',
    whyItsUsed:
      'Improves texture, adds protein, and helps ingredients blend smoothly.',
    whatToKnow:
      'Derived from milk. If you have a milk allergy, avoid products containing this ingredient.',
  },
  casein: {
    name: 'Casein',
    whatItIs: 'The main protein found in milk. Used in many processed foods.',
    whyItsUsed: 'Adds protein and improves texture and mouthfeel.',
    whatToKnow:
      'Directly from milk. Relevant for anyone with a milk allergy.',
  },
  whey: {
    name: 'Whey',
    whatItIs: 'A milk protein left over from cheese production. Contains lactose.',
    whyItsUsed: 'Adds protein and can improve texture.',
    whatToKnow:
      'Milk-derived. Contains lactose and milk proteins. Avoid if allergic to milk or lactose intolerant.',
  },
  'whey protein': {
    name: 'Whey Protein',
    whatItIs: 'Concentrated protein from whey, a milk byproduct.',
    whyItsUsed: 'Adds protein to bars, shakes, and snacks.',
    whatToKnow:
      'Milk-derived. Not suitable for milk allergies or severe lactose intolerance.',
  },
  lactose: {
    name: 'Lactose',
    whatItIs: 'The natural sugar found in milk.',
    whyItsUsed: 'Used as a sweetener or filler in some products.',
    whatToKnow:
      'People with lactose intolerance may need to avoid or limit this.',
  },
  'soy lecithin': {
    name: 'Soy Lecithin',
    whatItIs: 'An emulsifier extracted from soybeans. Helps mix oil and water.',
    whyItsUsed: 'Keeps ingredients from separating; common in chocolate and baked goods.',
    whatToKnow:
      'Soy-derived. Most people with soy allergies should avoid it, though some tolerate small amounts.',
  },
  'soybean oil': {
    name: 'Soybean Oil',
    whatItIs: 'Oil pressed from soybeans.',
    whyItsUsed: 'Common cooking oil and ingredient in many packaged foods.',
    whatToKnow:
      'Soy-derived. Relevant for soy allergies.',
  },
  maltodextrin: {
    name: 'Maltodextrin',
    whatItIs: 'A processed carbohydrate made from starch (often corn, wheat, or potato).',
    whyItsUsed: 'Adds bulk, improves texture, and can act as a filler.',
    whatToKnow:
      'Common in processed foods. Can digest quickly. May be derived from wheat—check if gluten-free is important.',
  },
  maltol: {
    name: 'Maltol',
    whatItIs:
      'A flavor compound (often made synthetically) that gives a warm, caramel-like or cotton-candy note—it is not malt from germinated grain.',
    whyItsUsed: 'Used in tiny amounts to round out sweetness and aroma in baked goods, cereals, and beverages.',
    whatToKnow:
      'Chemically unrelated to barley or grain “malt.” Not a gluten concern from the name alone—follow the product’s gluten labeling if you have celiac disease.',
  },
  'modified food starch': {
    name: 'Modified Food Starch',
    whatItIs: 'Starch that has been chemically or physically altered to change its properties.',
    whyItsUsed: 'Thickens, stabilizes, and improves texture.',
    whatToKnow:
      'Can come from corn, wheat, potato, or tapioca. Source may not be listed.',
  },
  'high fructose corn syrup': {
    name: 'High Fructose Corn Syrup',
    whatItIs: 'A sweetener made from corn starch. Contains fructose and glucose.',
    whyItsUsed: 'Sweetens products and is often cheaper than sugar.',
    whatToKnow:
      'Common in sodas and processed foods. Some people choose to limit added sugars.',
  },
  'citric acid': {
    name: 'Citric Acid',
    whatItIs: 'A natural acid found in citrus fruits, often produced by fermentation.',
    whyItsUsed: 'Adds tartness, preserves color, and acts as a preservative.',
    whatToKnow:
      'Generally well tolerated. Usually not from citrus in processed foods.',
  },
  'sodium benzoate': {
    name: 'Sodium Benzoate',
    whatItIs: 'A preservative that inhibits mold and yeast growth.',
    whyItsUsed: 'Extends shelf life of acidic foods and drinks.',
    whatToKnow:
      'Commonly used in soft drinks and condiments. Generally recognized as safe.',
  },
  'potassium sorbate': {
    name: 'Potassium Sorbate',
    whatItIs: 'A preservative that prevents mold and yeast.',
    whyItsUsed: 'Extends shelf life of many packaged foods.',
    whatToKnow:
      'Widely used. Generally considered safe in normal amounts.',
  },
  'natural flavors': {
    name: 'Natural Flavors',
    whatItIs: 'Flavor compounds derived from natural sources (plants, animals, or spices).',
    whyItsUsed: 'Enhances or adds flavor to products.',
    whatToKnow:
      'Exact sources are not disclosed. Can include allergens—check "contains" statements.',
  },
  'artificial flavors': {
    name: 'Artificial Flavors',
    whatItIs: 'Synthetic compounds designed to mimic natural flavors.',
    whyItsUsed: 'Adds flavor at lower cost than some natural options.',
    whatToKnow:
      'Common in processed foods. Some people prefer to avoid them.',
  },
  'monosodium glutamate': {
    name: 'Monosodium Glutamate (MSG)',
    whatItIs: 'A flavor enhancer made from glutamic acid, an amino acid.',
    whyItsUsed: 'Enhances savory (umami) flavor in many foods.',
    whatToKnow:
      'Some people report sensitivity. Generally recognized as safe by regulators.',
  },
  msg: {
    name: 'Monosodium Glutamate (MSG)',
    whatItIs: 'A flavor enhancer made from glutamic acid.',
    whyItsUsed: 'Enhances savory flavor.',
    whatToKnow:
      'Some people report sensitivity. Check labels if you avoid MSG.',
  },
  'ascorbic acid': {
    name: 'Ascorbic Acid',
    whatItIs: 'Vitamin C, often used as an antioxidant and preservative.',
    whyItsUsed: 'Prevents browning and extends shelf life.',
    whatToKnow:
      'Generally safe. Synthetic form is common in processed foods.',
  },
  'calcium carbonate': {
    name: 'Calcium Carbonate',
    whatItIs: 'A form of calcium used as a supplement and antacid.',
    whyItsUsed: 'Adds calcium and can act as a firming agent.',
    whatToKnow:
      'Common in fortified foods and supplements.',
  },
  'xanthan gum': {
    name: 'Xanthan Gum',
    whatItIs: 'A thickening agent produced by fermenting sugar with bacteria.',
    whyItsUsed: 'Thickens and stabilizes sauces, dressings, and gluten-free baked goods.',
    whatToKnow:
      'Common in gluten-free products. Generally well tolerated.',
  },
  'guar gum': {
    name: 'Guar Gum',
    whatItIs: 'A thickening agent from guar bean seeds.',
    whyItsUsed: 'Thickens and stabilizes many packaged foods.',
    whatToKnow:
      'Common in dairy-free and gluten-free products.',
  },
  'carrageenan': {
    name: 'Carrageenan',
    whatItIs: 'A thickening agent extracted from red seaweed.',
    whyItsUsed: 'Stabilizes dairy alternatives, ice cream, and dressings.',
    whatToKnow:
      'Some debate about digestive effects. Generally approved for use.',
  },
  'pectin': {
    name: 'Pectin',
    whatItIs: 'A natural fiber found in fruits, used as a gelling agent.',
    whyItsUsed: 'Gives jams and jellies their texture; used in some beverages.',
    whatToKnow:
      'Plant-based. Generally well tolerated.',
  },
  'lecithin': {
    name: 'Lecithin',
    whatItIs: 'An emulsifier. Can come from soy, eggs, or sunflower.',
    whyItsUsed: 'Helps mix oil and water; common in chocolate and baked goods.',
    whatToKnow:
      'Source matters for allergies. Soy and egg lecithin are common.',
  },
  'palm oil': {
    name: 'Palm Oil',
    whatItIs: 'Oil from the fruit of oil palm trees.',
    whyItsUsed: 'Common in packaged foods for texture and shelf life.',
    whatToKnow:
      'Some choose to avoid for environmental reasons.',
  },
  'hydrogenated oil': {
    name: 'Hydrogenated Oil',
    whatItIs: 'Oil that has been chemically altered to be solid at room temperature.',
    whyItsUsed: 'Extends shelf life and improves texture.',
    whatToKnow:
      'Can create trans fats. Many products have moved to alternatives.',
  },
  'partially hydrogenated oil': {
    name: 'Partially Hydrogenated Oil',
    whatItIs: 'Oil partially hardened; a source of trans fats.',
    whyItsUsed: 'Historically used for texture and shelf life.',
    whatToKnow:
      'Being phased out in many regions due to trans fat concerns.',
  },
  'rice flour': {
    name: 'Rice Flour',
    whatItIs: 'Ground rice. Often used in gluten-free products.',
    whyItsUsed: 'Provides structure in gluten-free baking.',
    whatToKnow:
      'Gluten-free. Common in Asian and gluten-free products.',
  },
  'tapioca starch': {
    name: 'Tapioca Starch',
    whatItIs: 'Starch extracted from the cassava root.',
    whyItsUsed: 'Thickens and adds chew in gluten-free products.',
    whatToKnow:
      'Gluten-free. Common in bubble tea and gluten-free baked goods.',
  },
  'oat flour': {
    name: 'Oat Flour',
    whatItIs: 'Ground oats. Used in baking and as a thickener.',
    whyItsUsed: 'Adds fiber and structure. Common in gluten-free products.',
    whatToKnow:
      'Check for "gluten-free" oats if you avoid gluten—oats can be cross-contaminated.',
  },
  'peanut flour': {
    name: 'Peanut Flour',
    whatItIs: 'Defatted ground peanuts. High in protein.',
    whyItsUsed: 'Adds protein and peanut flavor to products.',
    whatToKnow:
      'Contains peanuts. Avoid if you have a peanut allergy.',
  },
  'egg white': {
    name: 'Egg White',
    whatItIs: 'The clear part of the egg, mostly protein.',
    whyItsUsed: 'Adds protein, structure, and can act as a binder.',
    whatToKnow:
      'Contains egg. Relevant for egg allergies.',
  },
  albumin: {
    name: 'Albumin',
    whatItIs: 'Protein from egg whites. Can also refer to other proteins.',
    whyItsUsed: 'Adds protein and binding in processed foods.',
    whatToKnow:
      'Often egg-derived. Check source if you have an egg allergy.',
  },
  'tahini': {
    name: 'Tahini',
    whatItIs: 'Ground sesame seed paste.',
    whyItsUsed: 'Adds flavor and creaminess; common in hummus.',
    whatToKnow:
      'Contains sesame. Avoid if you have a sesame allergy.',
  },
  'sesame oil': {
    name: 'Sesame Oil',
    whatItIs: 'Oil pressed from sesame seeds.',
    whyItsUsed: 'Adds flavor in many cuisines.',
    whatToKnow:
      'Contains sesame. Relevant for sesame allergies.',
  },
  'fish oil': {
    name: 'Fish Oil',
    whatItIs: 'Oil extracted from fish, often for omega-3 content.',
    whyItsUsed: 'Adds omega-3 fatty acids to supplements and fortified foods.',
    whatToKnow:
      'Contains fish. Avoid if you have a fish allergy.',
  },
  'hydrolyzed soy protein': {
    name: 'Hydrolyzed Soy Protein',
    whatItIs: 'Soy protein broken down into smaller pieces. Used for flavor and texture.',
    whyItsUsed: 'Adds savory flavor and can improve texture.',
    whatToKnow:
      'Soy-derived. Relevant for soy allergies.',
  },
  'textured vegetable protein': {
    name: 'Textured Vegetable Protein (TVP)',
    whatItIs: 'Often made from soy. Used as a meat substitute.',
    whyItsUsed: 'Adds protein and meat-like texture to vegetarian products.',
    whatToKnow:
      'Usually soy-based. Check label for soy if allergic.',
  },
  'sodium nitrite': {
    name: 'Sodium Nitrite',
    whatItIs: 'A preservative used in cured meats.',
    whyItsUsed: 'Prevents bacterial growth and gives cured meat its color.',
    whatToKnow:
      'Common in bacon, ham, and deli meats. Some choose to limit processed meats.',
  },
  'sodium erythorbate': {
    name: 'Sodium Erythorbate',
    whatItIs: 'A preservative and antioxidant, related to vitamin C.',
    whyItsUsed: 'Often used with nitrites in cured meats.',
    whatToKnow:
      'Generally recognized as safe.',
  },
  'sulfites': {
    name: 'Sulfites',
    whatItIs: 'Preservatives that prevent browning and spoilage.',
    whyItsUsed: 'Common in wine, dried fruit, and some processed foods.',
    whatToKnow:
      'Some people are sensitive. Must be declared when present above certain levels.',
  },
  'sodium sulfite': {
    name: 'Sodium Sulfite',
    whatItIs: 'A sulfite preservative.',
    whyItsUsed: 'Preserves color and prevents spoilage.',
    whatToKnow:
      'Relevant for sulfite sensitivity.',
  },
  'aspartame': {
    name: 'Aspartame',
    whatItIs: 'An artificial sweetener. Contains phenylalanine.',
    whyItsUsed: 'Sweetens without calories in diet products.',
    whatToKnow:
      'People with phenylketonuria (PKU) must avoid it.',
  },
  'sucralose': {
    name: 'Sucralose',
    whatItIs: 'An artificial sweetener made from sugar.',
    whyItsUsed: 'Adds sweetness without calories.',
    whatToKnow:
      'Some people prefer to limit artificial sweeteners.',
  },
  'stevia': {
    name: 'Stevia',
    whatItIs: 'A natural sweetener from the stevia plant.',
    whyItsUsed: 'Sweetens without calories. Plant-based.',
    whatToKnow:
      'Generally well tolerated. No effect on blood sugar.',
  },
  'skim milk powder': {
    name: 'Skim Milk Powder',
    whatItIs: 'Dried skim milk. Used to add dairy and protein.',
    whyItsUsed: 'Adds protein, extends shelf life, improves texture.',
    whatToKnow:
      'Milk-derived. Contains lactose and milk proteins.',
  },
  'nonfat dry milk': {
    name: 'Nonfat Dry Milk',
    whatItIs: 'Dried skim milk.',
    whyItsUsed: 'Adds protein and dairy content.',
    whatToKnow:
      'Milk-derived. Relevant for milk allergies and lactose intolerance.',
  },
  'calcium caseinate': {
    name: 'Calcium Caseinate',
    whatItIs: 'A milk-derived protein, similar to sodium caseinate.',
    whyItsUsed: 'Adds protein and improves texture.',
    whatToKnow:
      'Milk-derived. Avoid if you have a milk allergy.',
  },
  'wheat gluten': {
    name: 'Wheat Gluten',
    whatItIs: 'The protein portion of wheat. Adds structure.',
    whyItsUsed: 'Adds chew and structure to bread and meat alternatives.',
    whatToKnow:
      'Contains gluten. Avoid if you have celiac disease or gluten sensitivity.',
  },
  'vital wheat gluten': {
    name: 'Vital Wheat Gluten',
    whatItIs: 'Concentrated wheat protein.',
    whyItsUsed: 'Strengthens dough and adds protein.',
    whatToKnow:
      'Contains gluten. Not suitable for gluten-free diets.',
  },
  semolina: {
    name: 'Semolina',
    whatItIs: 'Coarsely ground durum wheat. Used in pasta.',
    whyItsUsed: 'Gives pasta its texture and structure.',
    whatToKnow:
      'Contains gluten. Not suitable for gluten-free diets.',
  },
  malt: {
    name: 'Malt',
    whatItIs: 'Germinated and dried grain, usually barley. Adds flavor and color.',
    whyItsUsed: 'Adds sweetness and color to bread, beer, and cereals.',
    whatToKnow:
      'Usually from barley. Contains gluten.',
  },
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim()
}

export function getIngredientExplanation(
  ingredientName: string
): IngredientExplanation | null {
  const norm = normalizeName(ingredientName)
  if (EXPLANATIONS[norm]) return EXPLANATIONS[norm]

  // Try partial match for known keys (avoid "malt" → maltol / maltodextrin / ethyl maltol)
  const maltAliasFalsePositive = /\b(maltodextrin|maltol|ethyl\s*maltol)\b/i
  for (const [key, value] of Object.entries(EXPLANATIONS)) {
    if (key === 'malt' && maltAliasFalsePositive.test(norm)) continue
    if (norm.includes(key) || key.includes(norm)) {
      return value
    }
  }
  return null
}
