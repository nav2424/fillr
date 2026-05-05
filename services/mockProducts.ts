/**
 * Mock product data for demo when Open Food Facts is unavailable
 * Realistic barcodes and product scenarios
 */

import type { ScanResult, SafetyStatus } from '../types'
import { getIngredientExplanation } from './ingredientExplanations'

/** Demo product barcode (e.g. onboarding preview); skips cloud AI and scan quota when scanned. */
export const DEMO_SCAN_BARCODE = '810072005008'

/** True for the Fillr demo product barcode (any common formatting). */
export function isDemoScanBarcode(raw: string): boolean {
  const compact = String(raw || '').replace(/\D/g, '')
  const demo = DEMO_SCAN_BARCODE.replace(/\D/g, '')
  return compact === demo || compact.endsWith(demo)
}

const MOCK_PRODUCTS: ScanResult[] = [
  {
    product: {
      id: 'prod_810072005008',
      barcode: '810072005008',
      name: 'Mid-Day Squares Dark Chocolate',
      brand: 'Mid-Day Squares',
      imageUrl: undefined,
      ingredientText:
        'Dark chocolate (unsweetened chocolate, cocoa butter, alkalized cocoa powder, coconut sugar, vanilla powder, sea salt), sugars (maple syrup, organic tapioca syrup, cherry juice concentrate, organic apple juice concentrate, coconut sugar, red beet juice concentrate), alkalized cocoa powder, organic pea protein, Jerusalem artichoke fiber, olive oil, organic fava bean protein, shea butter, organic cacao nibs, vanilla extract, cocoa butter, organic apple cider vinegar, water, sea salt, cocoa extract.',
      source: 'mock',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    safetyStatus: 'CAUTION',
    matchedAllergens: [],
    matchedSensitivities: [],
    smartSummary:
      'Mid-Day Squares dark chocolate bar with plant proteins, multiple sugar sources, and fiber-rich ingredients. No direct milk/soy/wheat ingredients listed in this panel, but always verify cross-contact statements on pack.',
    ingredientBreakdown: [
      {
        name: 'Dark chocolate',
        headline: 'Chocolate base with cocoa solids and cocoa butter.',
        labelDecoder:
          'This is the coating/base blend: unsweetened chocolate plus cocoa butter and a small amount of sweetener.',
        whatItIs: 'A cocoa-based chocolate blend.',
        whyItsUsed: 'Provides the core chocolate flavor and texture.',
        whatToKnow: 'Still contributes saturated fat and some added sugar depending on the blend.',
        whyItMatters:
          'Useful context if you watch total sugar and saturated fat across snacks in your day.',
        ingredientRating: 'okay',
        verdict: 'NEUTRAL',
        ratingReason:
          'Chocolate ingredients are expected in this product category; impact depends mostly on serving size and total sugar/fat load.',
      },
      {
        name: 'Organic tapioca syrup',
        headline: 'A tapioca-derived syrup used as a sweet binder.',
        labelDecoder:
          'Tapioca starch is processed into a syrup to sweeten and help hold bar texture together.',
        whatItIs: 'A concentrated carbohydrate sweetener.',
        whyItsUsed: 'Adds sweetness and chew while helping cohesion.',
        whatToKnow: 'It counts toward added sugar exposure even when labeled organic.',
        whyItMatters:
          'If your goal is lowering added sugars, syrup-based sweeteners are one of the key lines to track.',
        ingredientRating: 'concerning',
        verdict: 'NEUTRAL',
        ratingReason:
          'Concentrated sweetener; fits a caution profile for frequent snacking.',
      },
      {
        name: 'Organic pea protein',
        headline: 'Plant protein isolate from yellow peas.',
        labelDecoder:
          'Protein is extracted and concentrated from peas to raise total protein per serving.',
        whatItIs: 'A concentrated plant-protein ingredient.',
        whyItsUsed: 'Boosts protein without dairy protein powders.',
        whatToKnow: 'Helpful for protein goals, but still part of a processed bar formula.',
        whyItMatters:
          'Can support satiety/protein targets, especially for plant-forward diets.',
        ingredientRating: 'okay',
        verdict: 'NEUTRAL',
        ratingReason:
          'Common functional protein source in snack bars; generally neutral in this context.',
      },
      {
        name: 'Jerusalem artichoke fiber',
        headline: 'A chicory-family fiber used for texture and fiber content.',
        labelDecoder:
          'This is an inulin-type fiber ingredient added to improve fiber numbers and bar structure.',
        whatItIs: 'A prebiotic-style soluble fiber.',
        whyItsUsed: 'Adds fiber and helps texture.',
        whatToKnow: 'Some people tolerate it well; others may notice bloating with larger amounts.',
        whyItMatters:
          'If you have sensitive digestion, fiber-enriched bars can feel different than whole-food snacks.',
        ingredientRating: 'concerning',
        verdict: 'NEUTRAL',
        ratingReason:
          'Can be beneficial for fiber intake, but GI tolerance varies person to person.',
      },
    ],
    productAnalysis: {
      ratingCounts: { clean: 0, okay: 2, concerning: 2, avoid: 0 },
      viralHook:
        'Mid-Day Squares style formula: real cocoa ingredients plus multiple sweetener sources and added plant proteins.',
      bottomLine:
        'This is a functional snack bar with a mix of cocoa, sweeteners, oils, and added proteins/fibers—best read as a convenient snack, not a minimally processed whole-food bar.',
    },
    insights: [
      'Multiple sweetener sources are present',
      'Plant proteins (pea and fava) boost protein content',
      'Fiber additive may affect sensitive digestion',
      'Always check the package may-contain statement for peanut/tree nut/sesame risk',
    ],
  },
  {
    product: {
      id: 'prod_012345678901',
      barcode: '012345678901',
      name: 'Chocolate Protein Bar',
      brand: 'PowerFuel',
      imageUrl: undefined,
      ingredientText:
        'Milk protein isolate, soy protein isolate, chocolate coating (sugar, cocoa butter, chocolate, soy lecithin), maltodextrin, glycerin, palm kernel oil, natural flavors, salt.',
      source: 'mock',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    safetyStatus: 'UNSAFE',
    matchedAllergens: [
      {
        allergenKey: 'milk',
        allergenName: 'Milk',
        matchedIngredient: 'Milk protein isolate',
        explanation:
          'Milk-derived. If you have a milk allergy, avoid products containing this ingredient.',
      },
      {
        allergenKey: 'soy',
        allergenName: 'Soy',
        matchedIngredient: 'Soy protein isolate',
        explanation:
          'Soy-derived. Relevant for soy allergies.',
      },
    ],
    matchedSensitivities: [],
    smartSummary:
      'This product contains milk-derived and soy-derived ingredients. It includes several processed stabilizers. May not align with eating less processed foods.',
    ingredientBreakdown: [
      {
        name: 'Milk protein isolate',
        whatItIs: 'Concentrated protein from milk.',
        whyItsUsed: 'Adds protein to bars and shakes.',
        whatToKnow: 'Milk-derived. Avoid if allergic to milk.',
      },
      {
        name: 'Soy protein isolate',
        whatItIs: 'Concentrated protein from soybeans.',
        whyItsUsed: 'Adds protein to bars and meat alternatives.',
        whatToKnow: 'Soy-derived. Relevant for soy allergies.',
      },
      {
        name: 'Maltodextrin',
        whatItIs: 'A processed carbohydrate made from starch.',
        whyItsUsed: 'Helps improve texture or bulk.',
        whatToKnow: 'Common in processed foods. Can digest quickly.',
      },
    ],
    insights: [
      'Milk-derived ingredient detected',
      'Soy-derived ingredient detected',
      'Added sugars present',
      'Contains preservatives',
    ],
  },
  {
    product: {
      id: 'prod_036000291452',
      barcode: '036000291452',
      name: 'Creamy Peanut Butter',
      brand: 'Nutty Co',
      ingredientText:
        'Peanuts, sugar, palm oil, salt.',
      source: 'mock',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    safetyStatus: 'UNSAFE',
    matchedAllergens: [
      {
        allergenKey: 'peanuts',
        allergenName: 'Peanuts',
        matchedIngredient: 'Peanuts',
        explanation:
          'Contains peanuts. Avoid if you have a peanut allergy.',
      },
    ],
    matchedSensitivities: [],
    smartSummary:
      'This product contains peanuts as a primary ingredient. Not suitable for peanut allergies.',
    ingredientBreakdown: [
      {
        name: 'Peanuts',
        whatItIs: 'Ground peanuts, the main ingredient in peanut butter.',
        whyItsUsed: 'Provides flavor, protein, and texture.',
        whatToKnow: 'Contains peanuts. Avoid if allergic.',
      },
      {
        name: 'Sugar',
        whatItIs: 'Added sweetener.',
        whyItsUsed: 'Sweetens the product.',
        whatToKnow: 'Some people choose to limit added sugars.',
      },
    ],
    insights: ['Peanut-derived ingredient detected', 'Added sugars present'],
  },
  {
    product: {
      id: 'prod_052000123456',
      barcode: '052000123456',
      name: 'Oat Milk Barista Edition',
      brand: 'PlantPure',
      ingredientText:
        'Oat base (water, oats), rapeseed oil, calcium carbonate, phosphates, salt, vitamins.',
      source: 'mock',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    safetyStatus: 'SAFE',
    matchedAllergens: [],
    matchedSensitivities: [],
    smartSummary:
      'This product appears safe based on the ingredient list and your profile. Dairy-free.',
    ingredientBreakdown: [
      {
        name: 'Oats',
        whatItIs: 'Whole grain oats. Used as the base for oat milk.',
        whyItsUsed: 'Provides creaminess and fiber.',
        whatToKnow: 'Check for gluten-free certification if avoiding gluten.',
      },
      {
        name: 'Calcium carbonate',
        whatItIs: 'A form of calcium used as a supplement.',
        whyItsUsed: 'Adds calcium to fortified plant milks.',
        whatToKnow: 'Common in fortified foods.',
      },
    ],
    insights: ['Vegan-friendly', 'Dairy-free'],
  },
  {
    product: {
      id: 'prod_064000123456',
      barcode: '064000123456',
      name: 'Greek Yogurt',
      brand: 'FreshDairy',
      ingredientText:
        'Cultured milk, live cultures, sugar.',
      source: 'mock',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    safetyStatus: 'UNSAFE',
    matchedAllergens: [
      {
        allergenKey: 'milk',
        allergenName: 'Milk',
        matchedIngredient: 'Cultured milk',
        explanation:
          'Milk-derived. Yogurt is a dairy product. Avoid if allergic to milk.',
      },
    ],
    matchedSensitivities: [
      {
        sensitivityKey: 'lactose',
        sensitivityName: 'Lactose',
        matchedIngredient: 'Cultured milk',
        explanation:
          'Yogurt contains lactose. Some people with lactose intolerance tolerate yogurt better than milk due to live cultures.',
      },
    ],
    smartSummary:
      'This product contains milk. If you have a milk allergy, avoid. If lactose intolerant, yogurt may be better tolerated than milk.',
    ingredientBreakdown: [
      {
        name: 'Cultured milk',
        whatItIs: 'Milk fermented with bacteria to make yogurt.',
        whyItsUsed: 'Base of yogurt. Provides protein and probiotics.',
        whatToKnow: 'Milk-derived. Contains lactose.',
      },
    ],
    insights: ['Milk-derived ingredient detected', 'High protein'],
  },
  {
    product: {
      id: 'prod_075000123456',
      barcode: '075000123456',
      name: 'Gluten-Free Crackers',
      brand: 'CleanSnack',
      ingredientText:
        'Rice flour, tapioca starch, sunflower oil, salt, yeast.',
      source: 'mock',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    safetyStatus: 'SAFE',
    matchedAllergens: [],
    matchedSensitivities: [],
    smartSummary:
      'This product appears safe based on the ingredient list. Gluten-free.',
    ingredientBreakdown: [
      {
        name: 'Rice flour',
        whatItIs: 'Ground rice. Often used in gluten-free products.',
        whyItsUsed: 'Provides structure in gluten-free baking.',
        whatToKnow: 'Gluten-free.',
      },
      {
        name: 'Tapioca starch',
        whatItIs: 'Starch from cassava root.',
        whyItsUsed: 'Thickens and adds chew in gluten-free products.',
        whatToKnow: 'Gluten-free.',
      },
    ],
    insights: ['Gluten-free', 'Vegan-friendly'],
  },
  {
    product: {
      id: 'prod_086000123456',
      barcode: '086000123456',
      name: 'Fruit Cereal',
      brand: 'ColorKids',
      ingredientText:
        'Corn flour, sugar, corn syrup, artificial colors (Red 40, Yellow 5, Blue 1), natural flavors, preservatives (BHT).',
      source: 'mock',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    safetyStatus: 'CAUTION',
    matchedAllergens: [],
    matchedSensitivities: [],
    smartSummary:
      'This product contains artificial colors and preservatives. May not align with eating less processed foods.',
    ingredientBreakdown: [
      {
        name: 'Artificial colors',
        whatItIs: 'Synthetic dyes used to add color.',
        whyItsUsed: 'Makes products visually appealing.',
        whatToKnow: 'Some people prefer to avoid them.',
      },
      {
        name: 'BHT',
        whatItIs: 'A preservative that prevents rancidity.',
        whyItsUsed: 'Extends shelf life of fatty foods.',
        whatToKnow: 'Some people choose to limit preservatives.',
      },
    ],
    insights: [
      'Contains artificial flavors',
      'Contains preservatives',
      'Added sugars present',
    ],
  },
  {
    product: {
      id: 'prod_090000123456',
      barcode: '090000123456',
      name: 'Clean Ingredient Granola Bar',
      brand: 'SimpleBar',
      ingredientText:
        'Oats, almonds, honey, dates, coconut oil, chia seeds, vanilla.',
      source: 'mock',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    safetyStatus: 'CAUTION',
    matchedAllergens: [
      {
        allergenKey: 'tree_nuts',
        allergenName: 'Tree Nuts',
        matchedIngredient: 'Almonds',
        explanation:
          'Contains almonds. Avoid if allergic to tree nuts.',
      },
    ],
    matchedSensitivities: [],
    smartSummary:
      'This product contains almonds. If you have a tree nut allergy, avoid. Otherwise, it has a relatively clean ingredient list.',
    ingredientBreakdown: [
      {
        name: 'Oats',
        whatItIs: 'Whole grain oats.',
        whyItsUsed: 'Provides fiber and texture.',
        whatToKnow: 'Check for gluten-free certification if avoiding gluten.',
      },
      {
        name: 'Almonds',
        whatItIs: 'Tree nuts. High in protein and healthy fats.',
        whyItsUsed: 'Adds crunch, protein, and flavor.',
        whatToKnow: 'Contains tree nuts. Avoid if allergic.',
      },
    ],
    insights: ['Tree nut-derived ingredient detected', 'High protein'],
  },
  {
    product: {
      id: 'prod_123456789012',
      barcode: '123456789012',
      name: 'Unknown Product',
      brand: '',
      ingredientText: '',
      source: 'mock',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    safetyStatus: 'UNKNOWN',
    matchedAllergens: [],
    matchedSensitivities: [],
    smartSummary:
      "We couldn't fully analyze this product. Review the label carefully or try scanning a different barcode.",
    ingredientBreakdown: [],
    insights: ['Review label manually'],
  },
]

const BARCODE_MAP = new Map<string, ScanResult>()
for (const p of MOCK_PRODUCTS) {
  BARCODE_MAP.set(p.product.barcode, p)
}

export function mockProductByBarcode(barcode: string): ScanResult | null {
  const digits = barcode.replace(/\D/g, '')
  const normalized = digits.slice(-12)
  return (
    BARCODE_MAP.get(normalized) ??
    BARCODE_MAP.get(barcode) ??
    BARCODE_MAP.get(digits) ??
    null
  )
}

export function getMockProducts(): ScanResult[] {
  return MOCK_PRODUCTS
}
