/**
 * Known food allergens - whitelist for custom allergen validation.
 * Only validated, real food allergens are accepted.
 * Rejects non-food items (chair, pencil, etc.).
 */

/** Canonical key -> display label. Includes builtin + common food allergens. */
const KNOWN_ALLERGENS: Array<{ key: string; label: string; searchTerms: string[] }> = [
  // Builtin allergens (FDA 9 + EU additions)
  { key: 'milk', label: 'Milk', searchTerms: ['milk', 'dairy', 'lactose'] },
  { key: 'eggs', label: 'Eggs', searchTerms: ['eggs', 'egg'] },
  { key: 'peanuts', label: 'Peanuts', searchTerms: ['peanuts', 'peanut', 'groundnut'] },
  { key: 'tree_nuts', label: 'Tree Nuts', searchTerms: ['tree nuts', 'tree nut', 'nuts', 'almond', 'almonds', 'cashew', 'cashews', 'walnut', 'walnuts', 'pecan', 'pecans', 'pistachio', 'pistachios', 'hazelnut', 'hazelnuts', 'macadamia', 'brazil nut'] },
  { key: 'soy', label: 'Soy', searchTerms: ['soy', 'soya', 'soybean', 'soybeans'] },
  { key: 'wheat', label: 'Wheat', searchTerms: ['wheat', 'gluten'] },
  { key: 'sesame', label: 'Sesame', searchTerms: ['sesame', 'sesame seeds'] },
  { key: 'fish', label: 'Fish', searchTerms: ['fish'] },
  { key: 'shellfish', label: 'Shellfish', searchTerms: ['shellfish', 'crustaceans', 'mollusks', 'molluscs', 'shrimp', 'crab', 'lobster', 'clam', 'mussel', 'oyster'] },
  { key: 'mustard', label: 'Mustard', searchTerms: ['mustard'] },
  { key: 'sulfites', label: 'Sulfites', searchTerms: ['sulfites', 'sulphites'] },
  { key: 'celery', label: 'Celery', searchTerms: ['celery', 'celeriac'] },
  { key: 'lupin', label: 'Lupin', searchTerms: ['lupin', 'lupine', 'lupini'] },
  // Fruits
  { key: 'apple', label: 'Apple', searchTerms: ['apple', 'apples'] },
  { key: 'banana', label: 'Banana', searchTerms: ['banana', 'bananas'] },
  { key: 'kiwi', label: 'Kiwi', searchTerms: ['kiwi', 'kiwis'] },
  { key: 'mango', label: 'Mango', searchTerms: ['mango', 'mangoes', 'mangos'] },
  { key: 'peach', label: 'Peach', searchTerms: ['peach', 'peaches'] },
  { key: 'strawberry', label: 'Strawberry', searchTerms: ['strawberry', 'strawberries'] },
  { key: 'orange', label: 'Orange', searchTerms: ['orange', 'oranges'] },
  { key: 'lemon', label: 'Lemon', searchTerms: ['lemon', 'lemons'] },
  { key: 'lime', label: 'Lime', searchTerms: ['lime', 'limes'] },
  { key: 'grapefruit', label: 'Grapefruit', searchTerms: ['grapefruit', 'grapefruits'] },
  { key: 'tangerine', label: 'Tangerine', searchTerms: ['tangerine', 'tangerines'] },
  { key: 'clementine', label: 'Clementine', searchTerms: ['clementine', 'clementines'] },
  { key: 'citrus', label: 'Citrus', searchTerms: ['citrus'] },
  { key: 'grape', label: 'Grape', searchTerms: ['grape', 'grapes'] },
  { key: 'melon', label: 'Melon', searchTerms: ['melon', 'melons'] },
  { key: 'watermelon', label: 'Watermelon', searchTerms: ['watermelon', 'watermelons'] },
  { key: 'cantaloupe', label: 'Cantaloupe', searchTerms: ['cantaloupe', 'cantaloupes'] },
  { key: 'honeydew', label: 'Honeydew', searchTerms: ['honeydew', 'honeydews'] },
  { key: 'avocado', label: 'Avocado', searchTerms: ['avocado', 'avocados'] },
  { key: 'cherry', label: 'Cherry', searchTerms: ['cherry', 'cherries'] },
  { key: 'plum', label: 'Plum', searchTerms: ['plum', 'plums'] },
  { key: 'apricot', label: 'Apricot', searchTerms: ['apricot', 'apricots'] },
  { key: 'pineapple', label: 'Pineapple', searchTerms: ['pineapple', 'pineapples'] },
  { key: 'papaya', label: 'Papaya', searchTerms: ['papaya', 'papayas'] },
  { key: 'coconut', label: 'Coconut', searchTerms: ['coconut', 'coconuts'] },
  { key: 'fig', label: 'Fig', searchTerms: ['fig', 'figs'] },
  { key: 'date', label: 'Date', searchTerms: ['date', 'dates'] },
  { key: 'raspberry', label: 'Raspberry', searchTerms: ['raspberry', 'raspberries'] },
  { key: 'blueberry', label: 'Blueberry', searchTerms: ['blueberry', 'blueberries'] },
  { key: 'blackberry', label: 'Blackberry', searchTerms: ['blackberry', 'blackberries'] },
  { key: 'cranberry', label: 'Cranberry', searchTerms: ['cranberry', 'cranberries'] },
  { key: 'elderberry', label: 'Elderberry', searchTerms: ['elderberry', 'elderberries'] },
  { key: 'gooseberry', label: 'Gooseberry', searchTerms: ['gooseberry', 'gooseberries'] },
  { key: 'pomegranate', label: 'Pomegranate', searchTerms: ['pomegranate', 'pomegranates'] },
  { key: 'lychee', label: 'Lychee', searchTerms: ['lychee', 'lychees'] },
  { key: 'passion_fruit', label: 'Passion fruit', searchTerms: ['passion fruit', 'passion fruits'] },
  { key: 'dragon_fruit', label: 'Dragon fruit', searchTerms: ['dragon fruit', 'dragon fruits'] },
  { key: 'tomato', label: 'Tomato', searchTerms: ['tomato', 'tomatoes'] },
  // Dairy & chocolate
  { key: 'cheese', label: 'Cheese', searchTerms: ['cheese'] },
  { key: 'chocolate', label: 'Chocolate', searchTerms: ['chocolate', 'cocoa'] },
  // Vegetables & legumes
  { key: 'corn', label: 'Corn', searchTerms: ['corn', 'maize'] },
  { key: 'garlic', label: 'Garlic', searchTerms: ['garlic'] },
  { key: 'onion', label: 'Onion', searchTerms: ['onion', 'onions'] },
  { key: 'pepper', label: 'Pepper', searchTerms: ['pepper', 'peppers', 'bell pepper', 'chili', 'chilli'] },
  { key: 'potato', label: 'Potato', searchTerms: ['potato', 'potatoes'] },
  { key: 'carrot', label: 'Carrot', searchTerms: ['carrot', 'carrots'] },
  { key: 'lentil', label: 'Lentil', searchTerms: ['lentil', 'lentils'] },
  { key: 'chickpea', label: 'Chickpea', searchTerms: ['chickpea', 'chickpeas', 'garbanzo'] },
  { key: 'bean', label: 'Bean', searchTerms: ['bean', 'beans', 'green bean', 'kidney bean', 'black bean', 'navy bean'] },
  { key: 'pea', label: 'Pea', searchTerms: ['pea', 'peas'] },
  { key: 'spinach', label: 'Spinach', searchTerms: ['spinach'] },
  { key: 'lettuce', label: 'Lettuce', searchTerms: ['lettuce'] },
  { key: 'broccoli', label: 'Broccoli', searchTerms: ['broccoli'] },
  { key: 'cabbage', label: 'Cabbage', searchTerms: ['cabbage'] },
  { key: 'asparagus', label: 'Asparagus', searchTerms: ['asparagus'] },
  { key: 'mushroom', label: 'Mushroom', searchTerms: ['mushroom', 'mushrooms'] },
  // Seeds & grains
  { key: 'sunflower', label: 'Sunflower', searchTerms: ['sunflower', 'sunflower seeds'] },
  { key: 'chia', label: 'Chia', searchTerms: ['chia', 'chia seeds'] },
  { key: 'flax', label: 'Flax', searchTerms: ['flax', 'flaxseed', 'flax seeds'] },
  { key: 'pumpkin_seed', label: 'Pumpkin seed', searchTerms: ['pumpkin seed', 'pumpkin seeds'] },
  { key: 'quinoa', label: 'Quinoa', searchTerms: ['quinoa'] },
  { key: 'rice', label: 'Rice', searchTerms: ['rice'] },
  { key: 'oats', label: 'Oats', searchTerms: ['oats', 'oat'] },
  { key: 'barley', label: 'Barley', searchTerms: ['barley'] },
  { key: 'rye', label: 'Rye', searchTerms: ['rye'] },
  // Spices & flavorings
  { key: 'cinnamon', label: 'Cinnamon', searchTerms: ['cinnamon'] },
  { key: 'vanilla', label: 'Vanilla', searchTerms: ['vanilla'] },
  { key: 'nutmeg', label: 'Nutmeg', searchTerms: ['nutmeg'] },
  { key: 'ginger', label: 'Ginger', searchTerms: ['ginger'] },
  { key: 'turmeric', label: 'Turmeric', searchTerms: ['turmeric'] },
  { key: 'cumin', label: 'Cumin', searchTerms: ['cumin'] },
  { key: 'coriander', label: 'Coriander', searchTerms: ['coriander', 'cilantro'] },
  { key: 'paprika', label: 'Paprika', searchTerms: ['paprika'] },
  { key: 'anise', label: 'Anise', searchTerms: ['anise', 'aniseed'] },
  { key: 'fennel', label: 'Fennel', searchTerms: ['fennel'] },
  { key: 'cardamom', label: 'Cardamom', searchTerms: ['cardamom'] },
  { key: 'clove', label: 'Clove', searchTerms: ['clove', 'cloves'] },
  // Meat & protein (less common but possible)
  { key: 'beef', label: 'Beef', searchTerms: ['beef'] },
  { key: 'pork', label: 'Pork', searchTerms: ['pork'] },
  { key: 'chicken', label: 'Chicken', searchTerms: ['chicken'] },
  { key: 'lamb', label: 'Lamb', searchTerms: ['lamb'] },
  { key: 'turkey', label: 'Turkey', searchTerms: ['turkey'] },
  { key: 'duck', label: 'Duck', searchTerms: ['duck'] },
  // Other common allergens
  { key: 'honey', label: 'Honey', searchTerms: ['honey'] },
  { key: 'yeast', label: 'Yeast', searchTerms: ['yeast'] },
  { key: 'gelatin', label: 'Gelatin', searchTerms: ['gelatin', 'gelatine'] },
  { key: 'carrageenan', label: 'Carrageenan', searchTerms: ['carrageenan'] },
  { key: 'annatto', label: 'Annatto', searchTerms: ['annatto'] },
  { key: 'mint', label: 'Mint', searchTerms: ['mint', 'peppermint', 'spearmint'] },
  { key: 'basil', label: 'Basil', searchTerms: ['basil'] },
  { key: 'oregano', label: 'Oregano', searchTerms: ['oregano'] },
  { key: 'thyme', label: 'Thyme', searchTerms: ['thyme'] },
  { key: 'sage', label: 'Sage', searchTerms: ['sage'] },
]

function normalize(input: string): string {
  return input.toLowerCase().trim().replace(/\s+/g, ' ')
}

export interface AllergenValidationResult {
  valid: boolean
  key?: string
  label?: string
  error?: string
}

/**
 * Validate that user input is a known food allergen.
 * Rejects non-allergens (pen, paper, chair, etc.).
 */
export function validateAllergenInput(input: string): AllergenValidationResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { valid: false, error: 'Enter an allergen name' }
  }

  const norm = normalize(trimmed)

  for (const a of KNOWN_ALLERGENS) {
    for (const term of a.searchTerms) {
      if (norm === normalize(term)) {
        return { valid: true, key: a.key, label: a.label }
      }
    }
  }

  return {
    valid: false,
    error: 'Enter a real food allergen (e.g. Apple, Banana, Chocolate, Cheese). Non-food items are not allowed.',
  }
}

/** Get display label for an allergy key (builtin or custom) */
export function getAllergyLabel(key: string): string {
  const entry = KNOWN_ALLERGENS.find((a) => a.key === key)
  if (entry) return entry.label
  // Fallback: capitalize key (e.g. custom_kiwi -> Kiwi) - only for stored custom
  return key.replace(/^custom_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** All known allergen keys for autocomplete/suggestions */
export function getKnownAllergenKeys(): string[] {
  return [...new Set(KNOWN_ALLERGENS.map((a) => a.key))]
}
