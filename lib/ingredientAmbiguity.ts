/**
 * Ingredients that look like a risk on name alone, or whose source is rarely on the label.
 * Used for transparency ("verify source") instead of binary allergen/celiac flags where misleading.
 */

import type { IngredientSourceAmbiguity } from '../types'

const RULES: Array<{ test: RegExp; value: IngredientSourceAmbiguity }> = [
  {
    test: /\blactic acid\b|\bsodium lactate\b|\bcalcium lactate\b|\bpotassium lactate\b/i,
    value: {
      label: 'Sounds like dairy — usually isn’t',
      message:
        'Lactic acid and lactates are almost always from fermentation, not milk sugar (lactose). They are typically dairy-free, but people with severe milk protein allergy should still confirm with the manufacturer if unsure.',
      confidence: 'medium',
      category: 'dairy',
    },
  },
  {
    test: /\bcocoa butter\b/i,
    value: {
      label: 'Name says “butter” — it’s plant fat',
      message:
        'Fat from cocoa beans only. Not dairy butter; vegan. The word “butter” here refers to texture, not cow’s milk.',
      confidence: 'high',
      category: 'dairy',
    },
  },
  {
    test: /\bcoconut aminos\b/i,
    value: {
      label: 'Not soy sauce',
      message:
        'Seasoning from coconut sap, not soy. If you avoid soy, do not confuse this with soy-based “liquid aminos” — check the exact product name.',
      confidence: 'high',
      category: 'soy',
    },
  },
  {
    test: /\bannatto\b|\bannatto extract\b|\be120\b/i,
    value: {
      label: 'Natural color — not risk-free for everyone',
      message:
        'Annatto is a seed-derived color. Some people react to it even when other “natural” colors are fine; severity varies. Not universally allergen-free.',
      confidence: 'medium',
      category: 'general',
    },
  },
  {
    test: /\bglycerin\b|\bglycerol\b/i,
    value: {
      label: 'Source rarely on the label',
      message:
        'Can be from animal fat or plant oils; manufacturers often do not specify. If animal origin matters (vegan, religious diet), contact the brand.',
      confidence: 'low',
      category: 'animal',
    },
  },
  {
    test: /\bstearic acid\b|\bstearate\b|\bstearoyl\b/i,
    value: {
      label: 'Fatty acid — animal or plant',
      message:
        'Stearic acid and stearates can come from animal or vegetable sources; labels usually do not say which. Verify with the manufacturer if you need a specific source.',
      confidence: 'low',
      category: 'animal',
    },
  },
  {
    test: /\bvitamin d3\b|\bcholecalciferol\b/i,
    value: {
      label: 'Often from lanolin (sheep wool)',
      message:
        'Vitamin D3 in foods is often from lanolin, not vegan. Vitamin D2 (ergocalciferol) is typically plant-derived. The label rarely states which form or source was used.',
      confidence: 'medium',
      category: 'animal',
    },
  },
  {
    test: /\bcasein\b|\bcaseinate\b|\bsodium caseinate\b|\bcalcium caseinate\b/i,
    value: {
      label: 'Dairy protein — wording varies',
      message:
        'Casein and caseinates are milk proteins. “Sodium caseinate” and similar names are still dairy — always treat as milk if you have a milk allergy.',
      confidence: 'high',
      category: 'dairy',
    },
  },
  {
    test: /\bcarmine\b|\bcochineal\b|\bnatural red 4\b/i,
    value: {
      label: 'Insect-derived color',
      message:
        'Made from insects; not vegetarian/vegan. Listed as carmine, cochineal, or E120 in many regions — labeling rules differ by country.',
      confidence: 'high',
      category: 'animal',
    },
  },
  {
    test: /\bcaramel color\b|\bcaramel colour\b|\bcaramel\s*\(?\s*color/i,
    value: {
      label: 'Gluten — source not always disclosed',
      message:
        'May contain gluten depending on source — verify with manufacturer. Some caramel color is made with barley; many formulations are gluten-free, but the ingredient list usually does not say.',
      confidence: 'low',
      category: 'gluten',
    },
  },
  {
    test: /\bdextrin\b|\bmaltodextrin\b/i,
    value: {
      label: 'Starch — wheat possible',
      message:
        'Usually from corn, potato, or rice, but can be wheat-derived in some regions. If you need strict gluten avoidance, confirm the starch source with the manufacturer when it is not stated.',
      confidence: 'low',
      category: 'gluten',
    },
  },
  {
    test: /\bmodified starch\b|\bmodified food starch\b/i,
    value: {
      label: 'Source almost never on the label',
      message:
        'May contain gluten depending on source — verify with manufacturer. Corn, wheat, tapioca, or potato are all common; the package rarely specifies which.',
      confidence: 'low',
      category: 'gluten',
    },
  },
  {
    test: /\bnatural flavor\b|\bnatural flavour\b|\bartificial flavor\b|\bartificial flavour\b/i,
    value: {
      label: 'Carrier not shown',
      message:
        'Flavor blends can use carriers or processing aids that are not spelled out here. For severe allergy, rely on the bold “Contains” line and ask the brand if you need certainty.',
      confidence: 'low',
      category: 'gluten',
    },
  },
  {
    test: /\bmalt extract\b|\bmalt syrup\b|\bmalt flavor\b|\bmalt flavour\b/i,
    value: {
      label: 'Usually barley unless stated otherwise',
      message:
        'Grain malt is typically barley (gluten). If the label does not say “rice malt” or “corn malt,” assume gluten risk until the manufacturer confirms.',
      confidence: 'medium',
      category: 'gluten',
    },
  },
]

export function lookupIngredientAmbiguity(ingredientName: string): IngredientSourceAmbiguity | null {
  const n = String(ingredientName || '').trim()
  if (!n) return null
  for (const { test, value } of RULES) {
    if (test.test(n)) return { ...value }
  }
  return null
}
