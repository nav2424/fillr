/**
 * Adapter: Maps allergen engine DetectionOutput to Fillr ScanResult
 */

import type { DetectionOutput, MatchedAllergen } from './allergenEngine'
import type {
  CeliacResult,
  ScanResult,
  SafetyStatus,
  MatchedAllergen as FillrMatchedAllergen,
  MatchedSensitivity,
  IngredientExplanation,
  IngredientRating,
} from '../types'
import { getIngredientExplanation } from '../services/ingredientExplanations'
import { GOAL_OPTIONS, PREFERENCE_OPTIONS, SENSITIVITY_OPTIONS } from '../types'
import { migrateGoalKey } from './goalKeyMigration'
import { getCeliacInsight } from './smartInsights'
import { englishPrimarySegment } from './bilingualDisplay'
import { dedupeBilingualIngredientNames } from './bilingualIngredients'
import {
  parseIngredientListFromPlain,
  stripHtmlForIngredients,
} from './ingredientTextParsing'
import { lookupIngredientAmbiguity } from './ingredientAmbiguity'
import type { IngredientTextParseSource } from './ingredientParseSource'
import { SENSITIVITY_SIGNALS } from './profileSignals'

export { prepareIngredientTextForAnalysis } from './ingredientTextParsing'

function normalizeSensitivityKey(raw: string): string {
  const key = String(raw || '').toLowerCase().trim().replace(/\s+/g, '_')
  if (SENSITIVITY_SIGNALS[key]) return key
  const byLabel = SENSITIVITY_OPTIONS.find(
    (o) => o.label.toLowerCase() === String(raw || '').toLowerCase().trim()
  )
  return byLabel?.key ?? key
}

function matchSensitivities(
  ingredientText: string,
  userSensitivities: string[]
): MatchedSensitivity[] {
  const matches: MatchedSensitivity[] = []

  for (const rawKey of userSensitivities) {
    const key = normalizeSensitivityKey(rawKey)
    const signal = SENSITIVITY_SIGNALS[key]
    if (!signal) continue

    const ingredients = ingredientText.split(/[,;]/).map((s) => s.trim())
    for (const ing of ingredients) {
      if (signal.ingredientPattern.test(ing)) {
        const opt = SENSITIVITY_OPTIONS.find((o) => o.key === key)
        matches.push({
          sensitivityKey: key,
          sensitivityName: opt?.label ?? key,
          matchedIngredient: ing,
          explanation: `Relevant for your ${opt?.label ?? key} sensitivity.`,
        })
        break
      }
    }
  }
  return matches
}

function mapOverallStatus(
  status: DetectionOutput['overall_status']
): SafetyStatus {
  switch (status) {
    case 'SAFE':
      return 'SAFE'
    case 'CONTAINS':
      return 'UNSAFE'
    case 'MAY_CONTAIN':
      return 'CAUTION'
    case 'UNKNOWN':
    default:
      return 'UNKNOWN'
  }
}

export function formatAllergenTagsForDisplay(tags: string[]): string {
  return tags
    .map((t) =>
      englishPrimarySegment(
        t
          .replace(/^[a-z]{2}:/, '')
          .replace(/-/g, ' ')
          .replace(/_/g, ' ')
          .trim()
      )
    )
    .filter(Boolean)
    .join(', ')
}

export function parseIngredients(
  ingredientsText: string,
  source: IngredientTextParseSource = 'barcode'
): string[] {
  return parseIngredientListFromPlain(ingredientsText, source)
}

function inferIngredientVerdict(name: string, whatToKnow?: string): 'SAFE' | 'NEUTRAL' | 'LIMIT' {
  const text = `${name} ${whatToKnow ?? ''}`.toLowerCase()

  // Avoid false positives from consumer tips (“your allergy plan”) — require real risk language.
  if (
    /\b(allergen|anaphylaxis|allergic to)\b/.test(text) ||
    /\bcontains\s+(gluten|wheat|milk|dairy|egg|peanut|tree nut|soy|fish|shellfish|sesame)\b/.test(
      text
    ) ||
    /\b(must avoid|not safe for|unsafe if|do not (eat|consume) if)\b/.test(text) ||
    /\btrans fat|partially hydrogenated|vitamin k antagonist\b/.test(text)
  ) {
    return 'LIMIT'
  }

  if (
    /\bdebate[sd]?\b|\bmixed evidence\b|\bsome people\b|\bprefer to limit\b|\bcheck source\b|\bnot disclosed\b|\bhighly processed\b|\bartificial (dye|color|colour)\b/.test(
      text
    )
  ) {
    return 'NEUTRAL'
  }

  return 'SAFE'
}

/** True if text is the old generic “manufacturer lists…” / “depends on the recipe…” filler. */
export function isIngredientCopyBoilerplate(text: string | undefined): boolean {
  const t = (text ?? '').trim()
  if (!t) return false
  return (
    /how this manufacturer lists this component/i.test(t) ||
    /its role here depends on the recipe/i.test(t) ||
    /manufacturer lists this component on the ingredient panel/i.test(t) ||
    /texture, sweetness, shelf life, color, or how the line runs/i.test(t) ||
    /appears on this label, but its exact type is not clear/i.test(t) ||
    /In packaged bars, mixes, and long-shelf-life items it usually fine-tunes/i.test(t) ||
    /Impact depends on the exact compound and the amount in the serving/i.test(t) ||
    /listed on this product;\s*we could\b/i.test(t) ||
    /many labels use a short or trade name/i.test(t) ||
    /exact compound or source is not obvious from this line alone/i.test(t)
  )
}

/**
 * Honest last-resort copy when we have no exact entry—never the old “manufacturer lists…” template.
 */
function genericPackagedFoodIngredientFallback(
  clean: string,
  lower: string
): { whatItIs: string; inProduct: string; bodyEffect: string; whatToKnow: string } {
  const head = clean.split(/[,;]/)[0]?.trim() || clean

  if (/\b(protein isolate|protein concentrate)\b/.test(lower)) {
    return {
      whatItIs:
        'A concentrated protein ingredient—suppliers isolate a specific fraction (often milk, soy, egg, or pea) to boost protein on the label.',
      inProduct:
        'Improves chew, structure, and moisture retention in bars, beverages, and baked goods; also helps emulsify fat and water.',
      bodyEffect:
        'Digested like other proteins into amino acids; the important story is the source species if you have allergy or avoidance rules.',
      whatToKnow:
        'The label phrase does not always spell out animal vs plant source—use the Contains line and brand FAQs when that distinction matters.',
    }
  }
  if (/maple syrup|maple sugar/.test(lower)) {
    return {
      whatItIs:
        'Boiled-down maple tree sap—mostly sucrose with caramel notes from cooking, not a mystery sweetener code.',
      inProduct:
        'Sweetens bars and baked goods while adding moisture and a distinct maple aroma that reads clearly on the label.',
      bodyEffect:
        'Digested like other added sugars; portion and total sugars on Nutrition Facts matter more than the word “maple” alone.',
      whatToKnow:
        '“Pure maple syrup” is a single-ingredient sweetener; “maple flavor” can be a different story—this line is the real syrup.',
    }
  }
  if (/agave|brown rice syrup/.test(lower) && !/high fructose corn syrup|hfcs/.test(lower)) {
    return {
      whatItIs:
        'A plant-based liquid sweetener (agave nectar or rice syrup) used where brands want a pourable sugar that is not table sugar by name.',
      inProduct:
        'Adds sweetness and can help bind water in bars, sauces, and coatings without listing “sucrose” first.',
      bodyEffect:
        'Still metabolized as added sugar; blood-sugar impact depends on serving size and what else you eat in the meal.',
      whatToKnow:
        'Labels often split sweeteners across several lines—compare total sugars on Nutrition Facts, not just one syrup word.',
    }
  }
  if (/\bmolasses\b/.test(lower)) {
    return {
      whatItIs:
        'A thick by-product of sugar refining—rich brown color, bittersweet flavor, and small amounts of minerals from the cane.',
      inProduct:
        'Adds depth to chocolate, cookies, and bars; also helps moisture and browning compared with plain white sugar alone.',
      bodyEffect:
        'Mostly sugar by calories; the mineral contribution is small at typical recipe amounts.',
      whatToKnow:
        'Unsulphured vs sulphured molasses is a processing taste difference, not a safety claim—still counts as added sugar.',
    }
  }
  if (/\bdate\b|dates|date paste|date syrup/.test(lower)) {
    return {
      whatItIs:
        'Whole dates or date paste—fruit sugar and fiber from the date palm, often used as a “whole food” sweetener in bars.',
      inProduct:
        'Binds texture, adds chew, and sweetens while keeping a shorter-looking sweetener list than multiple syrups.',
      bodyEffect:
        'Fruit sugar plus fiber digests more slowly than a shot of refined syrup alone, but calories still add up by serving.',
      whatToKnow:
        'If you track carbs for diabetes goals, treat date-heavy bars like other sweet snacks and read total sugars.',
    }
  }
  if (/apple cider vinegar|cider vinegar|white vinegar|wine vinegar|distilled vinegar/.test(lower)) {
    return {
      whatItIs:
        'Acetic acid from fermented juice or diluted alcohol—sharp taste, low pH, classic pantry vinegar (here as a named type).',
      inProduct:
        'Brightens flavor, balances sweetness, or helps control pH so other ingredients (gums, colors, preservatives) behave predictably.',
      bodyEffect:
        'Tiny label amounts contribute negligible calories; stomach-sensitive people sometimes notice vinegar-heavy foods.',
      whatToKnow:
        '“Apple cider vinegar” on a bar is usually a small flavor note, not the same as drinking vinegar as a supplement.',
    }
  }
  if (/\b(cherry|cranberry|pomegranate|apple|grape|orange|lemon|lime|pear|peach)\s+juice\b/.test(lower)) {
    return {
      whatItIs:
        'Fruit juice concentrate or single-strength juice—natural sugar plus fruit acids and flavor compounds from that fruit.',
      inProduct:
        'Sweetens while adding fruit flavor and color; concentrates also help texture and shelf life in packaged snacks.',
      bodyEffect:
        'Contributes fructose and glucose like other fruit sugars; fiber is usually low unless whole fruit pieces are also listed.',
      whatToKnow:
        '“Juice” on a bar label is still an added sugar source—check total sugars even when the name sounds wholesome.',
    }
  }
  if (/coconut sugar|palm sugar|turbinado|demerara|muscovado/.test(lower)) {
    return {
      whatItIs:
        'Crystallized sugar from coconut palm sap or less-refined cane—brown color and caramel notes, still sucrose-heavy.',
      inProduct:
        'Replaces part of white sugar for flavor depth in cookies, bars, and coatings.',
      bodyEffect:
        'Metabolized like cane sugar; any mineral “extras” are tiny compared with the sugar calories.',
      whatToKnow:
        'Marketing often sounds healthier than white sugar—your body still counts it as added sugar on Nutrition Facts.',
    }
  }
  if (/^\s*sugars?\s*$/i.test(clean)) {
    return {
      whatItIs:
        'A grouped declaration some labels use for added sugars—your Nutrition Facts panel still lists total and added sugars for the serving.',
      inProduct:
        'Manufacturers may split sweeteners across several lines; this line tells shoppers to look at the sugar section as a whole.',
      bodyEffect:
        'All listed sweeteners contribute to the same sugar load once you eat the serving.',
      whatToKnow:
        'If you are cutting sugar, use total sugars per serving and compare similar products rather than reading one line in isolation.',
    }
  }
  if (/gluten[-\s]?free\s+oat|oat\s+flour|oat flour/.test(lower)) {
    return {
      whatItIs:
        'Finely milled oats (often certified gluten-free) used as flour for structure in bars, cookies, and gluten-free baked goods.',
      inProduct:
        'Adds chew, mild oat flavor, and some fiber compared with refined white flour blends.',
      bodyEffect:
        'Mostly starch and fiber; contains avenin (the oat protein) rather than gluten—still an issue only if you avoid oats personally.',
      whatToKnow:
        'Celiac-safe oats depend on sourcing and certification; if you react to oats, treat this like any other oat ingredient.',
    }
  }
  if (
    (/\b(dark|milk|white)\s+chocolate\b|\bchocolate\b/.test(lower)) &&
    !/\bcocoa butter\b/.test(lower)
  ) {
    return {
      whatItIs:
        'Chocolate combines cocoa solids and sugar with cocoa butter (and sometimes milk solids for milk chocolate)—a named confection, not a vague flavor.',
      inProduct:
        'Carries chocolate flavor, color, and fat that set texture in coatings, chunks, and brownie-style bars.',
      bodyEffect:
        'Adds saturated fat and sugar calories; small caffeine/theobromine from cocoa, usually far less than a coffee.',
      whatToKnow:
        'Darker chocolate usually means more cocoa and less sugar than milk chocolate—still read sugar and saturated fat for your goals.',
    }
  }
  if (/\bsyrup\b/.test(lower) && !/high fructose|maple|agave|rice syrup solids/.test(lower)) {
    return {
      whatItIs:
        'A liquid or dried syrup fraction—usually a refined sweetener or glucose blend derived from corn, tapioca, or similar starch.',
      inProduct:
        'Adds sweetness, binds water, controls crystallization, or keeps texture soft in candies, bars, and frostings.',
      bodyEffect:
        'Metabolized as sugar (glucose/fructose or related); impacts blood sugar like other added sweeteners.',
      whatToKnow:
        'Manufacturers often split sugars across several ingredients so none reads as the #1 line by weight—check total sugars on Nutrition Facts.',
    }
  }
  if (/\b(stearoyl|lactylate|succinate|fumarate|tartrate)\b/.test(lower) && lower.length < 55) {
    return {
      whatItIs:
        'A fatty-acid-derived food additive—often an emulsifier, dough conditioner, or stabilizer used in bakery and dairy-style systems.',
      inProduct:
        'Helps fat distribute evenly, strengthens dough, or keeps emulsions from breaking during freezing and thawing.',
      bodyEffect:
        'Used at low percentages; digested like other fats and salts rather than acting as a bulk nutrient.',
      whatToKnow:
        'Several similar “-ate” emulsifiers on one label usually mean the product is optimized for factory consistency, not a short ingredient list.',
    }
  }
  if (/\bgum\b/.test(lower) && !/guar gum|xanthan|locust bean|carrageenan/.test(lower)) {
    return {
      whatItIs:
        'A hydrocolloid gum—long chains that bind water to thicken, gel, or stabilize a processed food.',
      inProduct:
        'Adjusts viscosity in dressings, keeps particles suspended, or replaces fat/cream mouthfeel in reduced-fat items.',
      bodyEffect:
        'Mostly fermented or passed as fiber-like bulk; individual tolerance varies for some gums.',
      whatToKnow:
        'If gums cluster with many emulsifiers and modified starches, you are looking at a highly engineered texture package.',
    }
  }
  if (/\b(starch|dextrin)\b/.test(lower) && !/corn starch|cornstarch|modified corn starch/.test(lower)) {
    return {
      whatItIs:
        'A starch-based carbohydrate—sometimes modified for heat or acid stability—used as a thickener or processing aid.',
      inProduct:
        'Thickens fillings, prevents syneresis, or helps powders flow in dry mixes.',
      bodyEffect:
        'Digested to glucose; modified starches behave like other refined carbs in the meal.',
      whatToKnow:
        'Source (corn, wheat, potato) is not always obvious from the name alone—important if you must avoid a specific grain.',
    }
  }
  if (/-ate\b/.test(lower) && clean.split(/\s+/).length <= 5) {
    return {
      whatItIs:
        `${head} is usually a mineral salt or organic salt—common roles are leavening, buffering pH, emulsifying, or slowing spoilage.`,
      inProduct:
        'Keeps texture predictable across batches, controls acidity so other ingredients work, or combines with leaveners for rise.',
      bodyEffect:
        'Contributes small mineral loads (often sodium or calcium); not meaningful protein or fiber.',
      whatToKnow:
        'Several *-ate additives together often mean a tuned factory formula—compare ingredient count with a simpler alternative if that is your goal.',
    }
  }

  return {
    whatItIs: `Many labels use a short or trade name for “${head}”, so the exact compound or source is not obvious from this line alone.`,
    inProduct:
      'Use Nutrition Facts for sugar, sodium, and calories, and the bold Contains / may-contain lines for allergens.',
    bodyEffect:
      'Earlier on the ingredient list usually means a larger share by weight before processing.',
    whatToKnow:
      'If this looks like a blend, flavor system, or trade name, the package may not list every sub-ingredient beyond allergens.',
  }
}

export function buildFallbackIngredientExplanation(name: string): IngredientExplanation {
  const clean = name.trim()
  const lower = clean.toLowerCase()

  let commonName = clean
  let whatItIs = ''
  let inProduct = ''
  let bodyEffect = ''
  let whatToKnow = ''

  const set = (w: string, y: string, body: string, k: string) => {
    whatItIs = w
    inProduct = y
    bodyEffect = body
    whatToKnow = k
  }

  if (/\b(sodium chloride|sea salt|table salt|salt)\b/.test(lower)) {
    commonName = 'Salt'
    set(
      'Sodium chloride—most table salt is mined or produced by evaporating seawater.',
      'Here it sharpens savory flavor and can balance sweetness, bitterness, or acidity in the recipe.',
      'Sodium and chloride help nerves, muscles, and fluid balance; most diets already include plenty of sodium.',
      'Worth watching if you are limiting sodium for blood pressure or fluid retention.'
    )
  } else if (/\b(sugar|sucrose|cane sugar|beet sugar)\b/.test(lower)) {
    commonName = 'Sugar'
    set(
      'Sucrose from sugar cane or sugar beets—a simple carbohydrate used as a sweetener.',
      'Adds sweetness, can improve mouthfeel, and can participate in browning or texture in baked or cooked items.',
      'Your body breaks sucrose into glucose and fructose for quick energy.',
      'Frequent large intakes can matter for dental health and blood-sugar management depending on your goals.'
    )
  } else if (/high fructose corn syrup|hfcs|glucose[- ]?fructose/.test(lower)) {
    commonName = 'HFCS'
    set(
      'A liquid sweetener made from corn starch, processed to contain both glucose and fructose.',
      'Provides sweetness, helps retain moisture, and can keep texture consistent in industrial recipes.',
      'Metabolized like other sugars; fructose is handled mainly by the liver.',
      'Some people prefer to limit HFCS as part of broader sugar reduction—context is total diet, not one line item.'
    )
  } else if (/\bwater\b/.test(lower) && lower.length < 40) {
    commonName = 'Water'
    set(
      'Water as a formulation ingredient (carrier, solvent, or moisture source).',
      'Adjusts thickness, helps dissolve other ingredients, and controls baking or processing behavior.',
      'Essential for hydration and every cell process.',
      'No inherent concern unless you are tracking total fluids for a medical plan.'
    )
  } else if (/\b(wheat flour|enriched flour|all[- ]?purpose flour)\b/.test(lower)) {
    commonName = 'Wheat flour'
    set(
      'Milled wheat endosperm, often enriched with iron and B vitamins in many countries.',
      'Builds structure in doughs and batters through gluten formation; also adds body and browning.',
      'Provides starch (energy) and protein; contains gluten unless labeled gluten-free.',
      'Avoid if you have celiac disease or wheat allergy; gluten-sensitive individuals may react to wheat sources.'
    )
  } else if (/\b(corn starch|cornstarch|modified corn starch)\b/.test(lower)) {
    commonName = 'Corn starch'
    set(
      'Starch extracted from corn, sometimes modified for heat or acid stability.',
      'Thickens sauces and fillings, prevents weeping, or keeps powders from clumping.',
      'Digested as carbohydrate (glucose units).',
      'Generally well tolerated; “modified” refers to processing, not GMO status by itself.'
    )
  } else if (/\b(soy lecithin|lecithin)\b/.test(lower)) {
    commonName = 'Lecithin'
    set(
      'Phospholipids often from soybeans or sunflower; acts as a natural emulsifier.',
      'Helps oil and water stay blended in chocolate, spreads, and baked goods.',
      'Source of choline, used in cell membranes and neurotransmitter synthesis.',
      'Soy-derived; relevant if you avoid soy for allergy—check severity with your clinician.'
    )
  } else if (/\b(maltodextrin)\b/.test(lower)) {
    commonName = 'Maltodextrin'
    set(
      'A carbohydrate powder made by breaking down starch (commonly corn, potato, or rice).',
      'Adds bulk, improves mouthfeel, or helps spray-dry flavors into a dry mix.',
      'Rapidly digested to glucose, so it can affect blood sugar more quickly than complex carbs.',
      'Often fine in small amounts; people with diabetes may count it toward carbohydrates.'
    )
  } else if (/\b(citric acid)\b/.test(lower)) {
    commonName = 'Citric acid'
    set(
      'An organic acid originally abundant in citrus; most food-grade supply is fermentation-derived.',
      'Adds tartness, lowers pH for preservation, and can brighten other flavors.',
      'Involved in the cellular citric acid (Krebs) cycle—your body already handles citrate.',
      'Rarely an issue except in very large supplemental doses; as a food additive it is typically a small quantity.'
    )
  } else if (/\b(monosodium glutamate|msg)\b/.test(lower)) {
    commonName = 'MSG'
    set(
      'The sodium salt of glutamic acid—the same amino-acid flavor note found in tomatoes, cheese, and mushrooms.',
      'Boosts savory (“umami”) taste so less salt may be needed for perceived flavor.',
      'Glutamate is a normal neurotransmitter and flavor stimulus on the tongue.',
      'A subset of people report sensitivity symptoms; regulatory bodies generally consider typical food amounts safe.'
    )
  } else if (/sodium benzoate.*potassium sorbate|potassium sorbate.*sodium benzoate/.test(lower)) {
    commonName = 'Preservatives'
    set(
      'Two common preservatives that slow the growth of mold, yeast, and bacteria so the product lasts longer.',
      'Typical in drinks, sauces, frostings, and other foods where the recipe is a little acidic.',
      'Not eaten for nutrition—tiny amounts are used to protect the food.',
      'Some people avoid all preservatives; formulas are regulated, but ask your clinician if you need to skip them entirely.'
    )
  } else if (/\b(sodium benzoate|potassium sorbate)\b/.test(lower)) {
    commonName = lower.includes('benzoate') ? 'Sodium benzoate' : 'Potassium sorbate'
    set(
      lower.includes('benzoate')
        ? 'A common preservative used in slightly acidic foods to slow mold, yeast, and bacteria.'
        : 'A common preservative that helps stop mold and yeast in slightly acidic foods.',
      'Keeps drinks, sauces, and similar products stable longer on the shelf.',
      'Used in small amounts; not a source of meaningful calories or nutrients.',
      'Some people avoid all preservatives; if you have medical restrictions, check with your clinician.'
    )
  } else if (/\b(natural flavor|natural flavour|artificial flavor|artificial flavour)\b/.test(lower)) {
    commonName = 'Flavoring'
    set(
      lower.includes('natural')
        ? 'A mix of flavor chemicals (from plant or animal sources) blended so every batch tastes the same.'
        : 'Lab-made or nature-identical flavor chemicals blended to match a target taste.',
      'Carries most of the taste or smell you notice without listing every compound by name.',
      'Almost no calories at the tiny amounts used—it is there for flavor, not fuel.',
      'The exact blend is secret; if you worry about hidden dairy, soy, or wheat carriers, rely on the bold Contains line, not the word “flavor” alone.'
    )
  } else if (/\b(carrageenan|xanthan|guar gum|locust bean)\b/.test(lower)) {
    commonName = clean
    set(
      'A hydrocolloid gum—long carbohydrate chains that bind water in foods.',
      'Thickens, stabilizes emulsions, or stops ice crystals from growing in frozen desserts.',
      'Most gums are fermented or digested partially; they add fiber-like bulk in the gut.',
      'Carrageenan is debated for gut comfort in some people; others tolerate it well—context and portion matter.'
    )
  } else if (/\b(palm oil|canola oil|sunflower oil|soybean oil|vegetable oil)\b/.test(lower)) {
    commonName = clean
    set(
      'A refined cooking fat pressed or solvent-extracted from seeds or fruits.',
      'Provides tenderness, crunch after frying, mouthfeel, and a medium for fat-soluble flavors.',
      'Dense source of calories and essential fatty acids depending on the oil profile.',
      'Saturated fat level varies (e.g., palm vs canola); processing and reuse of frying oil can form undesirable compounds if overheated.'
    )
  } else if (/\b(whey|casein|milk powder|skim milk)\b/.test(lower)) {
    commonName = clean
    set(
      'A dairy-derived protein, sugar, or solid component from milk processing.',
      'Improves texture, browning, or protein content; whey can help emulsification in bars and beverages.',
      'Supplies complete protein, calcium, and lactose (unless further processed).',
      'Not suitable for milk allergy or strict dairy avoidance; lactose content varies by ingredient form.'
    )
  } else if (
    /\b(niacin|vitamin\s*b3)\b/.test(lower) ||
    (lower.includes('niacin') && lower.length < 36)
  ) {
    commonName = 'Niacin (vitamin B3)'
    set(
      'A B vitamin often added because milling removes some naturally occurring niacin from grain.',
      'Restores nutrition in enriched or fortified flour so the final food meets standard guidelines.',
      'Used like other B vitamins: supports energy metabolism from the foods you eat.',
      'Typical fortification amounts are small; it is not related to nitrate preservatives.'
    )
  } else if (/\b(reduced iron|ferrous sulfate|ferrous fumarate|elemental iron)\b/.test(lower)) {
    commonName = clean
    set(
      'A source of iron added to refined flour to replace iron lost during processing.',
      'Helps the finished product contribute to daily iron intake, especially in grain-based foods.',
      'Iron is essential for blood production and oxygen transport.',
      'Refined flour is commonly enriched with iron in many countries; amounts are regulated, not “metallic iron” as a filler.'
    )
  } else if (/\b(thiamine mononitrate|thiamine|vitamin\s*b1)\b/.test(lower)) {
    commonName = 'Thiamine (vitamin B1)'
    set(
      'Vitamin B1, frequently added back to enriched wheat flour after milling.',
      'Supports a predictable nutrient profile in bread, crackers, and baked bars.',
      'Your body uses thiamine to turn carbohydrates into usable energy for cells.',
      'The “mononitrate” form is a stable salt—not sodium nitrite/nitrate used in cured meats.'
    )
  } else if (/\b(riboflavin|vitamin\s*b2)\b/.test(lower)) {
    commonName = 'Riboflavin (vitamin B2)'
    set(
      'Vitamin B2, another standard enricher in refined flour alongside niacin and iron.',
      'Keeps labeled nutrient content consistent in mass-produced bakery items.',
      'Plays a role in energy release from food and normal cell function.',
      'Often responsible for a faint yellow-green tint in dough—normal and intentional.'
    )
  } else if (/\b(folic acid|folate|pteroylmonoglutamic)\b/.test(lower)) {
    commonName = /\bfolate\b/.test(lower) && !/folic/.test(lower) ? 'Folate' : 'Folic acid'
    set(
      'A B vitamin (or synthetic form) used to fortify flour and reduce neural-tube-defect risk at population level.',
      'Required or common in enriched white flour in several regions.',
      'Supports DNA synthesis and cell division—especially important around pregnancy in the broader diet.',
      'On labels it is routine enrichment, not a preservative or dye.'
    )
  } else if (
    /\b(red\s*40|allura\s*red|fd\s*[&c]?\s*red\s*#?\s*40|e129)\b/i.test(lower)
  ) {
    commonName = 'Red 40 (Allura Red)'
    set(
      'A synthetic azo dye that gives frostings, drinks, and candy a vivid red-pink color.',
      'Manufacturers use tiny amounts for a reliable shade; without it, many packaged treats would look brown or dull.',
      'Regulators set acceptable daily intake limits; the science on behavior sensitivity in some children is debated and still studied.',
      'Several markets require clearer labeling or school restrictions on synthetic dyes—families avoiding dyes often scan for “Red 40” by name.'
    )
  } else if (
    /\b(yellow\s*5|tartrazine|fd\s*[&c]?\s*yellow\s*#?\s*5|e102)\b/i.test(lower)
  ) {
    commonName = 'Yellow 5 (Tartrazine)'
    set(
      'A bright yellow synthetic dye common in snack cakes, frostings, and powdered drink mixes.',
      'A little goes a long way toward a “lemon” or golden look that natural colors struggle to match cheaply.',
      'Rarely, people with aspirin sensitivity are cautioned about tartrazine; overall safety is debated mostly around child behavior, not acute toxicity at legal use levels.',
      'If you steer clear of artificial colors, this name is one of the clearest ones to filter for.'
    )
  } else if (/\b(yellow\s*6|sunset\s*yellow|fd\s*[&c]?\s*yellow\s*#?\s*6|e110)\b/i.test(lower)) {
    commonName = 'Yellow 6 (Sunset Yellow)'
    set(
      'An orange-yellow synthetic dye often paired with Red 40 for baked-goods frostings.',
      'Standardized coloring helps every batch look like the package photo.',
      'Like other certifiable colors it is dosage-capped by regulators; some parents still prefer dye-free snacks.',
      'EU labeling has highlighted certain synthetic colors with behavioral notes; the US relies on voluntary company choices for many products.'
    )
  } else if (/\b(blue\s*1|brilliant\s*blue|fd\s*[&c]?\s*blue\s*#?\s*1|e133)\b/i.test(lower)) {
    commonName = 'Blue 1 (Brilliant Blue)'
    set(
      'A synthetic blue dye used in frostings, sports drinks, and candy to cool or deepen hues.',
      'Lets brands hit very specific Pantone-like colors in mass production.',
      'Approved within intake limits in major markets; still on many “no artificial dye” avoidance lists.',
      'Often appears next to other dyes—seeing one bright dye usually means the formula is built for shelf appeal, not minimal processing.'
    )
  } else if (/corn syrup solids?/.test(lower)) {
    commonName = 'Corn syrup solids'
    set(
      'Dehydrated corn syrup—basically corn-sugar solids without the water so manufacturers can add sweetness and bulk as a dry powder.',
      'Sweetens, binds water, and keeps texture consistent in bars, frostings, and dry mixes; often splits sugar across several lines on the label.',
      'Your body handles it like other added sugars (glucose polymers and related sugars).',
      'If you are cutting added sugar, treat this like any other corn-based sweetener and look at total sugars on the Nutrition Facts—not just the first sugar word on the list.'
    )
  } else if (/milk protein isolate/.test(lower)) {
    commonName = 'Milk protein isolate'
    set(
      'A concentrated blend of whey and casein proteins filtered from milk—very high in protein, very low in lactose compared with fluid milk.',
      'Adds protein grams to bars and baked goods, improves chew and structure, and can help emulsify fat and water in the dough or batter.',
      'Digested into amino acids like other dairy proteins; not safe if you have a milk allergy.',
      '“Isolate” refers to processing concentration, not that it is risk-free for dairy allergy—always cross-check the Contains line.'
    )
  } else if (/sodium stearoyl lactylate|calcium stearoyl lactylate|stearoyl lactylate/.test(lower)) {
    commonName = clean
    set(
      'A bread-and-pastry emulsifier made from stearic acid (a fatty acid) reacted with lactic acid and neutralized—common in industrial doughs.',
      'Strengthens gluten structure, improves volume and crumb, and helps fat distribute evenly so texture stays consistent batch to batch.',
      'Broken down like other fats and salts in digestion; used at low percentages in the formula.',
      'Vegan shoppers sometimes avoid it because stearic acid can be animal- or plant-derived unless a brand states otherwise.'
    )
  } else if (/mono[\s-]?and[\s-]?diglycerides|monoglycerides|diglycerides/.test(lower)) {
    commonName = clean
    set(
      'Fat-based emulsifiers—glycerol linked to one or two fatty acids—used to keep oil and water from separating in processed foods.',
      'Improves softness, extends shelf life, and stabilizes textures in baked goods, spreads, and frozen desserts.',
      'Metabolized as fat; tiny label amounts still mean the product is engineered for stability, not minimal processing.',
      'Source oils are not always specified on the label; people avoiding certain fats or animal-derived processing aids may want brand-specific detail.'
    )
  } else if (/polysorbate\s*\d*/.test(lower)) {
    commonName = clean
    set(
      'A synthetic emulsifier (ethylene-oxide-derived surfactant) that helps oils, flavors, and water stay blended in processed foods.',
      'Prevents separation in icings, dressings, and frozen desserts and helps carry fat-soluble flavors evenly.',
      'Not a meaningful nutrient; passes through at typical food-use levels regulated as food additives.',
      'Often appears alongside other emulsifiers—several on one label usually signals a highly formulated texture system.'
    )
  } else if (/cocoa processed with alkali|dutched cocoa|alkalized cocoa/.test(lower)) {
    commonName = 'Alkalized cocoa'
    set(
      'Cocoa powder treated with alkali to darken color, mellow acidity, and dissolve more easily—what “Dutched” or “processed with alkali” means.',
      'Delivers a smoother chocolate flavor and richer color in brownies, protein bars, and coatings.',
      'Still cocoa—caffeine and theobromine are present in smaller amounts than in a bar of dark chocolate.',
      'Alkalizing slightly changes antioxidant profile versus natural cocoa; for baking, recipes may not be 1:1 interchangeable with natural cocoa unless adjusted.'
    )
  } else if (/\bcocoa butter\b/.test(lower)) {
    commonName = clean
    set(
      'The natural fat from cocoa beans—creamy, shelf-stable fat that is not dairy; it gives chocolate coatings their melt and snap.',
      'Carries chocolate flavor and smooth texture in bars and confections; often listed next to cocoa mass or chocolate.',
      'Mostly saturated fat calories; only trace protein despite the word “butter.”',
      'Vegan bars can still list cocoa butter; check separately for milk powder or “may contain milk” if dairy is your concern.'
    )
  } else if (/\bcocoa\b/.test(lower) && !/\bcocoa butter\b/.test(lower)) {
    commonName = clean
    set(
      'Cocoa powder from roasted cacao beans—chocolate flavor and brown color without adding most of the cocoa butter you would get in a chocolate bar.',
      'Common in brownies, bars, and baked goods; often paired with sugar and fat elsewhere on the list.',
      'Contains a little caffeine and theobromine—usually far less than coffee; not a dairy ingredient unless a dairy line also appears.',
      'Natural vs Dutched cocoa behave differently in baking—if the label says “processed with alkali,” that is Dutched cocoa.'
    )
  } else if (
    /^\s*milk\s*$/i.test(clean) ||
    /^\s*(whole|skim|low[\s-]?fat|2%)\s+milk\s*$/i.test(clean)
  ) {
    commonName = 'Milk'
    set(
      'Fluid dairy milk—water, milk fat, lactose, and milk proteins (casein and whey).',
      'Adds moisture, tenderness, protein, and browning in baked goods and bars.',
      'Not suitable for milk allergy; lactose content matters for intolerance—varies with skim vs whole and serving size.',
      'Plant “milks” are labeled explicitly (oat, soy, almond, etc.); the single word “milk” on U.S./EU labels is cow’s milk unless stated otherwise.'
    )
  } else if (/baking soda|sodium bicarbonate/.test(lower)) {
    commonName = 'Baking soda'
    set(
      'Sodium bicarbonate—a classic chemical leavener that releases carbon dioxide when heated or mixed with acid.',
      'Helps baked goods rise and can influence spread, browning, and pH in batters and doughs.',
      'Supplies sodium; otherwise behaves like a normal salt component in the diet at typical use levels.',
      'If you are sodium-sensitive, remember leaveners still contribute to the sodium tally across the whole package.'
    )
  } else if (/dried egg white|egg white powder|albumen/.test(lower)) {
    commonName = clean
    set(
      'Spray-dried or pasteurized egg white solids—concentrated protein and foaming power without the water of fresh eggs.',
      'Improves structure in bars, meringues, and baked goods and can help with whipping stability.',
      'Complete protein source; not appropriate for egg allergy.',
      'Functionally similar to fresh egg white but built for shelf-stable formulas—still an egg ingredient for labeling and allergy purposes.'
    )
  } else if (/caramel color|caramel colour/.test(lower)) {
    commonName = 'Caramel color'
    set(
      'A dark brown color made by heating carbohydrates (often corn) until they caramelize; different classes exist for different food pH.',
      'Adds a brown tone to beverages, sauces, and baked goods without adding much flavor at typical doses.',
      'Considered a food color additive; not the same as “caramel” candy flavoring.',
      'Some caramel color processes historically raised questions about trace by-products; regulatory limits exist—still on watch lists for people who avoid all artificial-looking colors.'
    )
  } else if (/microcrystalline cellulose|cellulose (gum|powder)/.test(lower)) {
    commonName = clean
    set(
      'Purified plant fiber (from wood pulp or cotton linter) processed into a powder or gel—used as a filler, anti-caking aid, or texturizer.',
      'Improves mouthfeel, prevents clumping in shredded cheese or powdered mixes, or adds bulk in reduced-fat products.',
      'Indigestible fiber bulk—generally passes through without absorption like starch.',
      'Sounds industrial but is GRAS at typical levels; “fiber on the label” may still be mostly from other ingredients—check the fiber line on Nutrition Facts.'
    )
  } else if (/\b(calcium phosphate|sodium phosphate|disodium phosphate|tricalcium phosphate)\b/.test(lower)) {
    commonName = clean
    set(
      'A mineral salt of phosphate—used in foods as a leavening acid, buffer, moisture keeper, or calcium supplement depending on the exact salt.',
      'Can react with baking soda for rise, stabilize pH in processed cheese, or protect texture in meat and bakery systems.',
      'Phosphate is part of normal metabolism; added phosphates can matter for people on strict phosphate-controlled diets.',
      'If you see multiple phosphates plus baking soda, the formula is tuned for rise, shelf stability, or processed texture.'
    )
  } else if (/natural and artificial flavors?|artificial flavors?|artificial flavours?/.test(lower)) {
    commonName = 'Flavor blend'
    set(
      'A proprietary mix of flavor chemicals and carriers—natural, synthetic, or both—blended to hit a target taste that stays consistent plant to plant.',
      'Carries most of the recognizable flavor without listing every compound; often appears near the end of the list but still shapes the eating experience.',
      'Negligible calories at typical doses; sensory only.',
      'Exact composition is trade-secret—use the Contains allergen statement if you worry about hidden dairy, soy, or wheat carriers.'
    )
  } else {
    commonName = clean
    const g = genericPackagedFoodIngredientFallback(clean, lower)
    set(g.whatItIs, g.inProduct, g.bodyEffect, g.whatToKnow)
  }

  const explanation = `${whatItIs.replace(/\.$/, '')} ${inProduct}`.replace(/\s+/g, ' ').trim()
  const verdict = inferIngredientVerdict(clean, whatToKnow)
  const ingredientRating = verdictToIngredientRatingForFallback(verdict, lower)
  const { headline, funFact, ratingReason } = buildHeadlineFunFactRatingReason(
    lower,
    clean,
    whatItIs,
    inProduct,
    ingredientRating
  )

  const firstSentence = whatItIs.split('.')[0]?.trim() || whatItIs.trim()
  const labelDecoder = `${firstSentence}${/[.!?]$/.test(firstSentence) ? '' : '.'}`

  return {
    name: clean,
    commonName,
    whatItIs,
    whyItsUsed: inProduct,
    whatItDoes: inProduct,
    whatToKnow,
    bodyEffect,
    headline,
    labelDecoder,
    funFact,
    ratingReason,
    explanation,
    whereItComeFrom: whatItIs,
    whyItMatters: whatToKnow,
    quickSummary: headline,
    verdict,
    ingredientRating,
    bullets: [whatItIs.replace(/\.$/, ''), inProduct.replace(/\.$/, ''), whatToKnow.replace(/\.$/, '')],
  }
}

function enrichFromDatabaseOrFallback(base: IngredientExplanation): IngredientExplanation {
  const explanation =
    base.explanation ??
    `${base.whatItIs.replace(/\.$/, '')} ${base.whyItsUsed}`.replace(/\s+/g, ' ').trim()
  const whatItDoes = base.whatItDoes ?? base.whyItsUsed
  const bodyEffect = base.bodyEffect ?? base.whyItMatters ?? base.whatToKnow
  const headline =
    base.headline ??
    explanation
      .split(/[.!?]/)[0]
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 8)
      .join(' ')
  const funFact =
    base.funFact ?? 'Ingredient order reflects weight—earlier means more in the package.'
  const ratingReason =
    base.ratingReason ?? base.whatToKnow
  const fromWhat = (base.whatItIs ?? '').split('.')[0]?.trim()
  const labelDecoder =
    base.labelDecoder?.trim() ||
    (fromWhat
      ? `${fromWhat}${/[.!?]$/.test(fromWhat) ? '' : '.'}`
      : `On the label, “${base.name}” is one declared component—tap below for how to read it.`)

  return {
    ...base,
    explanation,
    commonName: base.commonName ?? base.name,
    whatItDoes,
    whereItComeFrom: base.whereItComeFrom ?? base.whatItIs,
    whyItMatters: base.whyItMatters ?? base.whatToKnow,
    bodyEffect,
    headline,
    labelDecoder,
    funFact,
    ratingReason,
  }
}

function computeIngredientRating(
  verdict: 'SAFE' | 'NEUTRAL' | 'LIMIT',
  hasAllergen: boolean,
  hasSensitivity: boolean
): IngredientRating {
  if (hasAllergen) return 'avoid'
  if (hasSensitivity) return 'concerning'
  if (verdict === 'LIMIT') return 'avoid'
  if (verdict === 'NEUTRAL') return 'okay'
  return 'clean'
}

function verdictToIngredientRatingForFallback(
  verdict: 'SAFE' | 'NEUTRAL' | 'LIMIT',
  lower: string
): IngredientRating {
  if (verdict === 'LIMIT') return 'avoid'
  if (verdict === 'NEUTRAL') {
    if (
      /sugar|sucrose|fructose|hfcs|corn syrup|aspartame|nitrite|nitrate|benzoate|msg|artificial|hydrogenated/i.test(
        lower
      )
    ) {
      return 'concerning'
    }
    return 'okay'
  }
  if (/hfcs|high fructose|partially hydrogenated/i.test(lower)) return 'concerning'
  return 'clean'
}

function buildHeadlineFunFactRatingReason(
  lower: string,
  clean: string,
  whatItIs: string,
  inProduct: string,
  ingredientRating: IngredientRating
): { headline: string; funFact: string; ratingReason: string } {
  if (/\b(sodium chloride|sea salt|table salt|salt)\b/.test(lower)) {
    return {
      headline: 'Tiny crystals that make savory flavors taste complete',
      funFact: 'Most dietary sodium in many countries comes from packaged foods—not the shaker.',
      ratingReason:
        'Salt itself is normal in cooking; totals across the whole day matter for some people.',
    }
  }
  if (/\b(sugar|sucrose|cane sugar|beet sugar)\b/.test(lower)) {
    return {
      headline: 'Sweet crystals that also locks moisture and browning',
      funFact: '“Sugar” on a label almost always means sucrose from cane or beets unless stated otherwise.',
      ratingReason:
        ingredientRating === 'concerning' || ingredientRating === 'avoid'
          ? 'Worth minding if you are cutting added sugar.'
          : 'Fine in context—portion and frequency drive the health story.',
    }
  }
  if (/high fructose corn syrup|hfcs|glucose[- ]?fructose/.test(lower)) {
    return {
      headline: 'A corn-sweet syrup that hits blood sugar quickly',
      funFact: 'HFCS is not chemically identical to table sugar, but your body still handles both as sugar.',
      ratingReason: 'Often flagged when people want less refined sugar overall.',
    }
  }
  if (/\bwater\b/.test(lower) && lower.length < 40) {
    return {
      headline: 'The quiet workhorse that carries and thins everything else',
      funFact: 'Water is often #1 on drinks and broths because it is most of what you are buying by weight.',
      ratingReason: 'No inherent downside—hydration is essential.',
    }
  }
  if (/\b(soy lecithin|lecithin)\b/.test(lower)) {
    return {
      headline: 'A natural fat-blender that keeps chocolate silky',
      funFact: 'Lecithin is used in tiny amounts—often under 1% in chocolate.',
      ratingReason:
        ingredientRating === 'avoid'
          ? 'Soy trace matters for some allergies.'
          : 'Generally recognized as safe at typical use levels.',
    }
  }
  const genericAmbiguityIntro =
    /many labels use a short or trade name/i.test(whatItIs || '') ||
    /exact compound or source is not obvious from this line alone/i.test(whatItIs || '')
  const words = (whatItIs || inProduct || clean).replace(/\./g, '').split(/\s+/).filter(Boolean)
  const headlineFromWords = (words.slice(0, 8).join(' ') || clean).trim()
  const headline = genericAmbiguityIntro
    ? ((clean.split(/[,;]/)[0] ?? clean).trim().split(/\s+/).slice(0, 10).join(' ') || clean).trim()
    : headlineFromWords
  const ratingReason =
    ingredientRating === 'avoid'
      ? 'Fillr treats this line as one to limit or verify—check how it fits your allergies, goals, and the full label.'
      : ingredientRating === 'concerning'
        ? 'Common in packaged foods; worth a closer look if you are cutting additives, dyes, or ultra-processed ingredients.'
        : ingredientRating === 'okay'
          ? 'Typical processed-food input—usually about texture or shelf life rather than nutrition.'
          : 'Whole-food or simple input on many labels—still check serving size and what else is in the product.'
  return {
    headline: headline.length > 0 ? headline : `About “${clean}” in this product`,
    funFact:
      'Ingredient order is by weight—what shows up first is what you are mostly eating.',
    ratingReason,
  }
}

export interface MapParams {
  allergies: string[]
  sensitivities: string[]
  preferences: string[]
  goal: string
  celiacStrictGluten?: boolean
  /** Use `ocr` when text is from a label photo (unstructured OCR blob). */
  ingredientParseSource?: IngredientTextParseSource
}

export interface MapDetectionMeta {
  brand?: string
  nutritionJson?: Record<string, unknown>
  crossContactWarnings?: string[]
  allergensTags?: string[]
  tracesTags?: string[]
}

function matchIngredientToTerm(ingredientLower: string, termLower: string): boolean {
  if (!ingredientLower || !termLower) return false
  return ingredientLower.includes(termLower) || termLower.includes(ingredientLower)
}

function getPreferenceLabel(key: string): string {
  if (key === 'low_carb') return 'keto / low carb'
  return PREFERENCE_OPTIONS.find((o) => o.key === key)?.label ?? key
}

function getGoalLabel(goal: string): string {
  const k = migrateGoalKey(goal)
  return GOAL_OPTIONS.find((o) => o.key === k)?.label ?? goal
}

function getSensitivityLabel(key: string): string {
  return SENSITIVITY_OPTIONS.find((o) => o.key === key)?.label ?? key
}

export function mapDetectionToFillrResult(
  barcode: string,
  productName: string,
  output: DetectionOutput,
  params: MapParams,
  meta?: MapDetectionMeta
): ScanResult {
  const safetyStatus = mapOverallStatus(output.overall_status)

  const matchedAllergens: FillrMatchedAllergen[] = output.matched_allergens.map(
    (m: MatchedAllergen) => ({
      allergenKey: m.allergen_id,
      allergenName: m.allergen_name,
      matchedIngredient: englishPrimarySegment(m.match_text),
      explanation: getIngredientExplanation(m.match_text)?.whatToKnow ?? 
        `⚠️ Contains ${m.allergen_name} from your allergy list — not safe for you.`,
    })
  )

  const ingredientsTextRaw = output.scan_log?.ingredients_text_used || ''
  const parseSource = params.ingredientParseSource ?? 'barcode'
  const ingredientNames = parseIngredients(ingredientsTextRaw, parseSource)
  const ingredientsText =
    ingredientNames.length > 0
      ? ingredientNames.join(', ')
      : stripHtmlForIngredients(ingredientsTextRaw)

  const safetyHaystack = output.scan_log?.ingredients_text_safety_used?.trim() || ''
  const sensitivityHaystack = safetyHaystack || ingredientsText
  const matchedSensitivities = matchSensitivities(sensitivityHaystack, params.sensitivities)
  const celiacResult: CeliacResult | undefined = output.celiac
    ? {
        celiacModeEnabled: true,
        matchedGlutenSignals: output.celiac.matchedGlutenSignals,
        celiacSeverity: output.celiac.celiacSeverity,
      }
    : undefined

  const matchedAllergenTerms = matchedAllergens.map((a) => ({
    termLower: a.matchedIngredient.toLowerCase(),
    allergenName: a.allergenName,
  }))
  const matchedSensitivityTerms = matchedSensitivities.map((s) => ({
    termLower: s.matchedIngredient.toLowerCase(),
    sensitivityName: s.sensitivityName,
  }))
  const celiacTerms = celiacResult?.matchedGlutenSignals.map((m) => ({
    termLower: m.ingredient.toLowerCase(),
    reason: m.reason,
    severity: m.severity,
  })) ?? []

  const wantsLowSugar = params.preferences.includes('low_sugar') || params.preferences.includes('low_calorie') || params.preferences.includes('low_carb')
  const wantsLowSodium = params.sensitivities.includes('high_sodium')
  const wantsLessProcessed = params.preferences.includes('less_processed')
  const wantsPlantBased =
    params.preferences.includes('vegan') || params.preferences.includes('plant_based') || params.preferences.includes('vegetarian')

  const goalLower = params.goal.toLowerCase()
  const goalKey = migrateGoalKey(params.goal)
  const goalIsCleanEating =
    /clean|understand|improve|balanced|reduce_upf|lower_sodium|gut_health|less_sugar|lose_weight/.test(goalLower) ||
    [
      'eat_cleaner',
      'improve_health',
      'balanced_diet',
      'reduce_upf',
      'gut_health',
      'lower_sodium',
      'less_sugar',
      'lose_weight',
    ].includes(goalKey)

  const lowSugarPrefKey =
    params.preferences.find((k) => k === 'low_sugar' || k === 'low_calorie' || k === 'low_carb') ?? null
  const lowSugarPrefLabel = lowSugarPrefKey ? getPreferenceLabel(lowSugarPrefKey) : 'low sugar'
  const lowSodiumPrefLabel = wantsLowSodium ? getSensitivityLabel('high_sodium') : 'high sodium'
  const lessProcessedPrefLabel = getPreferenceLabel('less_processed')
  const plantPrefKey =
    params.preferences.find((k) => k === 'vegan' || k === 'vegetarian' || k === 'plant_based') ?? null
  const plantPrefLabel = plantPrefKey ? getPreferenceLabel(plantPrefKey) : 'plant-based'
  const goalLabel = getGoalLabel(params.goal)

  const PREFERENCE_REGEX = {
    sweeteners: /aspartame|sucralose|saccharin|acesulfame|stevia|sugar|sucrose|fructose|dextrose|high fructose corn syrup/i,
    sodium: /salt|sodium|monosodium glutamate|msg|sodium chloride/i,
    lessProcessed:
      /maltodextrin|modified food starch|artificial|flavor|flavour|emulsifier|stabilizer|stabiliser|gum|hydrogenated|sodium benzoate|potassium sorbate|sulfite|benzoate/i,
    dairyEgg:
      /milk|whey|casein|lactose|cream|cheese|butter|egg|albumin|gelatin|honey/i,
  }

  /** Cocoa / fruit “butters” and fermentation acids are not dairy — avoid plant-based false flags. */
  function isNonDairyButterOrLactateSoundalike(ingredientLower: string): boolean {
    return (
      /\bcocoa butter\b/.test(ingredientLower) ||
      /\bshea butter\b/.test(ingredientLower) ||
      /\bapple butter\b/.test(ingredientLower) ||
      /\bpeanut butter\b/.test(ingredientLower) ||
      /\bcashew butter\b/.test(ingredientLower) ||
      /\balmond butter\b/.test(ingredientLower) ||
      /\bnut butter\b/.test(ingredientLower) ||
      /\blactic acid\b/.test(ingredientLower) ||
      /\bsodium lactate\b/.test(ingredientLower) ||
      /\bcalcium lactate\b/.test(ingredientLower) ||
      /\bpotassium lactate\b/.test(ingredientLower)
    )
  }

  function finalizeIngredient(
    partial: IngredientExplanation,
    hasAllergen: boolean,
    hasSensitivity: boolean
  ): IngredientExplanation {
    const enriched = enrichFromDatabaseOrFallback(partial)
    const ambiguity = lookupIngredientAmbiguity(enriched.name)
    const v = enriched.verdict ?? 'SAFE'
    return {
      ...enriched,
      ...(ambiguity ? { sourceAmbiguity: ambiguity } : {}),
      quickSummary:
        enriched.headline ?? enriched.explanation ?? enriched.quickSummary,
      ingredientRating:
        enriched.ingredientRating ?? computeIngredientRating(v, hasAllergen, hasSensitivity),
    }
  }

  const ingredientBreakdown: IngredientExplanation[] = ingredientNames.map((name) => {
    const expl = getIngredientExplanation(name)
    const base = expl
      ? enrichFromDatabaseOrFallback({ ...expl, name: name.trim() })
      : buildFallbackIngredientExplanation(name)

    const ingredientLower = name.toLowerCase()

    const matchedAllergen = matchedAllergenTerms.find((t) =>
      matchIngredientToTerm(ingredientLower, t.termLower)
    )
    if (matchedAllergen) {
      return finalizeIngredient(
        {
          ...base,
          verdict: 'LIMIT',
          bullets: base.bullets ?? [
            base.whatItIs.replace(/\.$/, ''),
            base.whyItsUsed.replace(/\.$/, ''),
            base.whatToKnow.replace(/\.$/, ''),
          ],
          personalizedNote: `You've flagged ${matchedAllergen.allergenName} — this product contains it. Not safe for you.`,
        },
        true,
        false
      )
    }

    const matchedSensitivity = matchedSensitivityTerms.find((t) =>
      matchIngredientToTerm(ingredientLower, t.termLower)
    )
    if (matchedSensitivity) {
      return finalizeIngredient(
        {
          ...base,
          verdict: 'NEUTRAL',
          bullets: base.bullets ?? [
            base.whatItIs.replace(/\.$/, ''),
            base.whyItsUsed.replace(/\.$/, ''),
            base.whatToKnow.replace(/\.$/, ''),
          ],
          personalizedNote: `Because you selected ${matchedSensitivity.sensitivityName} as a sensitivity, consider avoiding or limiting this ingredient.`,
        },
        false,
        true
      )
    }

    const matchedCeliac = celiacTerms.find((t) => matchIngredientToTerm(ingredientLower, t.termLower))
    if (params.celiacStrictGluten && matchedCeliac) {
      return finalizeIngredient(
        {
          ...base,
          verdict: matchedCeliac.severity === 'AVOID' ? 'LIMIT' : 'NEUTRAL',
          personalFlag: 'celiac',
          personalMessage: `Celiac mode risk: ${matchedCeliac.reason}`,
          personalizedNote: matchedCeliac.reason,
        },
        false,
        false
      )
    }

    const preferenceNotes: string[] = []
    let verdictOverride: 'SAFE' | 'NEUTRAL' | 'LIMIT' | null = null

    if (wantsLowSugar && PREFERENCE_REGEX.sweeteners.test(ingredientLower)) {
      preferenceNotes.push(`Based on your ${lowSugarPrefLabel} preference, you may want to limit sweeteners like this.`)
      verdictOverride = 'NEUTRAL'
    }

    if (wantsLowSodium && PREFERENCE_REGEX.sodium.test(ingredientLower)) {
      preferenceNotes.push(`Based on your ${lowSodiumPrefLabel} sensitivity, you may want to limit this.`)
      verdictOverride = 'NEUTRAL'
    }

    if (
      wantsPlantBased &&
      PREFERENCE_REGEX.dairyEgg.test(ingredientLower) &&
      !isNonDairyButterOrLactateSoundalike(ingredientLower)
    ) {
      preferenceNotes.push(`Because you’re aiming for plant-based, this ingredient may not fit your preferences.`)
      verdictOverride = 'LIMIT'
    }

    if (wantsLessProcessed && PREFERENCE_REGEX.lessProcessed.test(ingredientLower)) {
      preferenceNotes.push(
        `Based on your ${lessProcessedPrefLabel} preference, you may want to limit more processed ingredients.`
      )
      verdictOverride = verdictOverride === 'LIMIT' ? 'LIMIT' : 'NEUTRAL'
    }

    if (!verdictOverride && goalIsCleanEating && PREFERENCE_REGEX.lessProcessed.test(ingredientLower)) {
      preferenceNotes.push(`For your goal (${goalLabel}), it may be worth checking how processed this ingredient is.`)
      verdictOverride = 'NEUTRAL'
    }

    const baseVerdict = inferIngredientVerdict(base.name, base.whatToKnow)

    return finalizeIngredient(
      {
        ...base,
        verdict: verdictOverride ?? baseVerdict,
        bullets: base.bullets ?? [
          base.whatItIs.replace(/\.$/, ''),
          base.whyItsUsed.replace(/\.$/, ''),
          base.whatToKnow.replace(/\.$/, ''),
        ],
        personalizedNote: preferenceNotes.length ? preferenceNotes[0] : undefined,
      },
      false,
      false
    )
  })

  const insights: string[] = []
  if (matchedAllergens.length) {
    insights.push(
      ...matchedAllergens.map(
        (m) => `${m.allergenName}-derived ingredient detected`
      )
    )
  }
  if (ingredientNames.some((n) => /preservative|sulfite|benzoate/i.test(n))) {
    insights.push('Contains preservatives')
  }
  if (ingredientNames.some((n) => /artificial|flavor|flavour/i.test(n))) {
    insights.push('Contains artificial flavors')
  }
  if (ingredientNames.some((n) => /sugar|sucrose|fructose|dextrose/i.test(n))) {
    insights.push('Added sugars present')
  }
  const celiacInsight = getCeliacInsight(celiacResult?.celiacSeverity, celiacResult?.matchedGlutenSignals)
  if (celiacInsight) insights.push(celiacInsight)

  let preferenceAddendum = ''
  if (wantsLowSugar) {
    preferenceAddendum = `Aligned with your ${lowSugarPrefLabel} preference, we’ll flag sweeteners and similar ingredients.`
  } else if (wantsLowSodium) {
    preferenceAddendum = `Aligned with your ${lowSodiumPrefLabel} sensitivity, we’ll flag sodium/salt sources.`
  } else if (wantsLessProcessed) {
    preferenceAddendum = `Aligned with your ${lessProcessedPrefLabel} preference, we highlight more processed additives.`
  } else if (wantsPlantBased) {
    preferenceAddendum = `Aligned with your ${plantPrefLabel} preference, we’ll flag dairy/egg-style ingredients.`
  } else if (goalIsCleanEating) {
    preferenceAddendum = `Aligned with your ${goalLabel} goal, we surface “check the label” details that matter.`
  }

  let smartSummary = ''
  if (matchedAllergens.length) {
    smartSummary = `Not safe for you — contains ${matchedAllergens
      .map((m) => m.allergenName.toLowerCase())
      .join(' and ')}.`
    if (preferenceAddendum) smartSummary += ` ${preferenceAddendum}`
  } else if (safetyStatus === 'SAFE') {
    smartSummary = 'This product appears safe based on the ingredient list and your profile.'
    if (preferenceAddendum) smartSummary += ` ${preferenceAddendum}`
  } else if (safetyStatus === 'UNKNOWN') {
    smartSummary =
      'We couldn\'t fully analyze this product. Review the label carefully.'
    if (preferenceAddendum) smartSummary += ` ${preferenceAddendum}`
  } else {
    smartSummary = 'Review the matched ingredients below before consuming.'
    if (preferenceAddendum) smartSummary += ` ${preferenceAddendum}`
  }

  const allergensTags =
    meta?.allergensTags && meta.allergensTags.length > 0 ? [...meta.allergensTags] : undefined
  const tracesTags =
    meta?.tracesTags && meta.tracesTags.length > 0 ? [...meta.tracesTags] : undefined
  const declaredAllergensLabel =
    allergensTags && allergensTags.length > 0 ? formatAllergenTagsForDisplay(allergensTags) : undefined

  const product = {
    id: `prod_${barcode}`,
    barcode,
    name: englishPrimarySegment(productName.trim()),
    brand: englishPrimarySegment((meta?.brand ?? '').trim()),
    ingredientText: ingredientsText,
    ...(safetyHaystack ? { ingredientTextSafetyHaystack: safetyHaystack } : {}),
    ...(meta?.nutritionJson && Object.keys(meta.nutritionJson).length > 0
      ? { nutritionJson: meta.nutritionJson }
      : {}),
    ...(allergensTags ? { allergensTags } : {}),
    ...(tracesTags ? { tracesTags } : {}),
    source: 'openfoodfacts',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  return {
    product,
    safetyStatus,
    matchedAllergens,
    matchedSensitivities,
    ...(celiacResult ? { celiac: celiacResult } : {}),
    smartSummary,
    ingredientBreakdown,
    insights,
    ...(meta?.crossContactWarnings?.length
      ? { crossContactWarnings: [...meta.crossContactWarnings] }
      : {}),
    ...(declaredAllergensLabel ? { declaredAllergensLabel } : {}),
  }
}
