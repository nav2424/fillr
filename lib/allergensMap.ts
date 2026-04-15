// Comprehensive Allergen Synonym & Derivative Mapping
// Supports English + French (bilingual Canadian products)

export interface AllergenMap {
  canonical: string
  aliases: string[] // Direct synonyms
  derived: string[] // Derived ingredients that indicate this allergen
  french: string[] // French terms
  antiMatches?: string[] // Terms that should NOT trigger this allergen (false positive prevention)
  treeNutMembers?: string[] // For tree_nuts: specific nuts that map to this
}

// NOTE: This file is copied from SAVR. It's optional for the core engine (which uses builtinDictionary),
// but useful for displaying or extending allergen lists in UI.
export const ALLERGEN_MAP: Record<string, AllergenMap> = {
  milk: {
    canonical: "milk",
    aliases: [
      "milk", "skim milk", "whole milk", "milk powder", "nonfat milk", "dairy", "dairy product",
      "butter", "butterfat", "ghee", "cream", "sour cream", "heavy cream", "light cream",
      "whipping cream", "cheese", "yogurt", "yoghurt", "kefir", "buttermilk", "curds",
      "cream cheese", "ricotta", "mascarpone", "cottage cheese", "mozzarella", "cheddar",
      "swiss cheese", "parmesan", "feta", "goat cheese", "sheep cheese", "buffalo milk",
      "half and half", "evaporated milk", "condensed milk", "powdered milk", "dry milk"
    ],
    derived: [
      "whey", "whey powder", "whey protein", "whey isolate", "whey concentrate",
      "casein", "caseinate", "sodium caseinate", "calcium caseinate", "potassium caseinate",
      "ammonium caseinate", "magnesium caseinate", "casein hydrolysate",
      "lactose", "lactalbumin", "alpha-lactalbumin", "beta-lactalbumin",
      "lactoglobulin", "beta-lactoglobulin", "milk solids", "milk protein",
      "milk fat", "milk sugar", "nonfat dry milk", "dry milk", "milk derivative",
      "rennet", "rennin", "lactoferrin", "lactoperoxidase", "galactose", "lactulose"
    ],
    french: [
      "lait", "lait écrémé", "lait entier", "poudre de lait", "lactosérum", "caséine",
      "beurre", "beurre clarifié", "crème", "crème sure", "fromage", "yaourt", "lactose",
      "produits laitiers", "sans lactose", "lait de vache", "lait de chèvre", "lait de brebis"
    ],
    antiMatches: [
      "milk-free", "sans lait", "dairy-free", "sans produits laitiers", "non-dairy",
      "soy milk", "almond milk", "coconut milk", "oat milk", "rice milk", "hemp milk",
      "cashew milk", "macadamia milk", "hazelnut milk", "pea milk", "flax milk",
      "milk thistle", "milkweed", "milkshake",
      "cream of tartar", "coconut cream", "whipped topping", "non-dairy creamer"
    ]
  },
  eggs: {
    canonical: "eggs",
    aliases: [
      "egg", "eggs", "egg whites", "egg white", "egg yolk", "egg yolks", "albumen", "albumin",
      "whole egg", "liquid egg", "frozen egg", "dried egg", "powdered egg"
    ],
    derived: [
      "ovalbumin", "ovomucoid", "ovoglobulin", "ovotransferrin", "lysozyme",
      "lecithin",
      "egg powder", "dried egg", "egg solids", "egg protein", "globulin",
      "livetin", "phosvitin", "avidin", "conalbumin", "ovomucin",
      "egg substitute", "egg replacer"
    ],
    french: [
      "œuf", "oeuf", "oeufs", "blancs d'œufs", "blanc d'œuf", "jaune d'œuf", "jaunes d'œufs",
      "albumine", "poudre d'œuf", "œuf en poudre", "œuf liquide"
    ],
    antiMatches: [
      "eggplant"
    ]
  },
}

