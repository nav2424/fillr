/**
 * Mock product data for demo when Open Food Facts is unavailable
 * Realistic barcodes and product scenarios
 */

import type { ScanResult, SafetyStatus } from '../types'
import { getIngredientExplanation } from './ingredientExplanations'

/** Demo product barcode (e.g. onboarding preview); skips cloud AI and scan quota when scanned. */
export const DEMO_SCAN_BARCODE = '085000211111'

/** True for the Fillr demo product barcode (any common formatting). */
export function isDemoScanBarcode(raw: string): boolean {
  const compact = String(raw || '').replace(/\D/g, '')
  const demo = DEMO_SCAN_BARCODE.replace(/\D/g, '')
  return compact === demo || compact.endsWith(demo)
}

const MOCK_PRODUCTS: ScanResult[] = [
  {
    product: {
      id: 'prod_085000211111',
      barcode: '085000211111',
      name: 'Ultra Fudge Brownie Protein Squares',
      brand: 'StackFuel',
      imageUrl: undefined,
      ingredientText:
        'Enriched wheat flour (wheat flour, niacin, reduced iron, thiamine mononitrate, riboflavin, folic acid), sugar, high fructose corn syrup, palm oil, cocoa processed with alkali, partially hydrogenated soybean oil, corn syrup solids, whey protein concentrate, milk protein isolate, soy lecithin, salt, baking soda, xanthan gum, guar gum, carrageenan, sodium stearoyl lactylate, mono- and diglycerides, polysorbate 60, natural and artificial flavors, caramel color, Yellow 5, Red 40, sodium benzoate and potassium sorbate (preservatives), soy flour, dried egg whites.',
      source: 'mock',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    safetyStatus: 'UNSAFE',
    matchedAllergens: [
      {
        allergenKey: 'milk',
        allergenName: 'Milk',
        matchedIngredient: 'Whey protein concentrate',
        explanation:
          'Contains milk-derived protein. Avoid if you have a milk allergy.',
      },
      {
        allergenKey: 'soy',
        allergenName: 'Soy',
        matchedIngredient: 'Soy lecithin',
        explanation: 'Soy-derived ingredients present. Relevant for soy allergies.',
      },
      {
        allergenKey: 'wheat',
        allergenName: 'Wheat',
        matchedIngredient: 'Enriched wheat flour',
        explanation: 'Contains wheat. Not suitable for wheat allergy or celiac disease.',
      },
      {
        allergenKey: 'eggs',
        allergenName: 'Eggs',
        matchedIngredient: 'dried egg whites',
        explanation: 'Contains egg. Avoid if you have an egg allergy.',
      },
    ],
    matchedSensitivities: [],
    smartSummary:
      'Heavily processed brownie-style bar with multiple sweeteners, gums, emulsifiers, dyes, and preservatives — plus wheat, milk, soy, and egg.',
    ingredientBreakdown: [
      {
        name: 'High fructose corn syrup',
        headline: 'A very sweet liquid sugar made from corn.',
        labelDecoder:
          'Corn is processed into a syrup that is extra sweet and cheap for factories, so it shows up a lot in packaged snacks.',
        whatItIs: 'Liquid sugar made from corn starch.',
        whyItsUsed: 'Sweetens the product and keeps texture soft.',
        whatToKnow: 'Near the top of the list means a lot of added sugar in each serving.',
        whyItMatters:
          'If you are cutting added sugar, HFCS high on the list is a sign this is more of a treat than an everyday food.',
        ingredientRating: 'concerning',
        verdict: 'NEUTRAL',
        ratingReason:
          'Highly processed sweetener linked to added sugar load; typical to rate as concerning in snack bars.',
      },
      {
        name: 'Carrageenan',
        headline: 'Thickener from seaweed that makes things feel creamy.',
        labelDecoder:
          'It comes from red seaweed and is used to thicken and smooth texture without adding cream.',
        whatItIs: 'A thickener extracted from seaweed.',
        whyItsUsed: 'Makes bars and fillings feel smoother and thicker.',
        whatToKnow: 'Some people avoid it if it bothers their digestion.',
        whyItMatters:
          'If gums tend to upset your stomach, compare labels—many bars use carrageenan or similar thickeners.',
        ingredientRating: 'concerning',
        verdict: 'NEUTRAL',
        ratingReason:
          'Widely used gum; some people limit it for GI comfort — not a whole food, typical “concerning” in Fillr.',
      },
      {
        name: 'Yellow 5',
        headline: 'Artificial yellow food coloring.',
        labelDecoder:
          'A lab-made yellow dye—only a little is needed to color the whole product.',
        whatItIs: 'Synthetic yellow dye (also called tartrazine).',
        whyItsUsed: 'Colors frosting, coatings, and snacks.',
        whatToKnow: 'Many families who skip artificial dyes watch for this name.',
        whyItMatters:
          'If you avoid artificial colors, “Yellow 5” or “tartrazine” on the list is what you are looking for.',
        ingredientRating: 'avoid',
        verdict: 'LIMIT',
        ratingReason:
          'Synthetic color additive; Fillr flags major artificial dyes as avoid for transparency.',
      },
      {
        name: 'Polysorbate 60',
        headline: 'Helps oil and water stay mixed in processed foods.',
        labelDecoder:
          'An additive that stops fat and water from separating so texture stays even on the shelf.',
        whatItIs: 'An emulsifier—ingredients that blend oil and water.',
        whyItsUsed: 'Keeps bakery items and fillings from separating.',
        whatToKnow: 'You would not usually cook with this at home.',
        whyItMatters:
          'If you want short, whole-food ingredient lists, polysorbates are a sign of a factory-made formula.',
        ingredientRating: 'concerning',
        verdict: 'NEUTRAL',
        ratingReason:
          'Industrial emulsifier common in ultra-processed foods — not harmful at typical use for everyone, but not “clean.”',
      },
    ],
    productAnalysis: {
      ratingCounts: { clean: 0, okay: 0, concerning: 3, avoid: 1 },
      viralHook:
        'Ultra-processed bar with HFCS, emulsifiers, and artificial dyes — Yellow 5 is flagged avoid.',
      bottomLine:
        'This formulation leans heavily on sweeteners, gums, emulsifiers, and artificial colors — not a “clean label” pick.',
    },
    insights: [
      'Multiple allergens: wheat, milk, soy, egg',
      'Added sugars and HFCS',
      'Artificial colors and preservatives',
      'Several gums and emulsifiers',
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
