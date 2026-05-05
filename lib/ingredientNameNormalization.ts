/**
 * Cache-key normalization for ingredient names.
 * Keeps user-facing labels unchanged; only used for storage/lookup keys.
 */

/** Exact canonical aliases (post basic cleanup). */
export const canonicalIngredientMap: Record<string, string> = {
  sugar: 'sugar',
  'cane sugar': 'sugar',
  'golden sugar': 'sugar',
  'brown sugar': 'sugar',
  salt: 'salt',
  'sea salt': 'salt',
  'sodium chloride': 'salt',
  'soy lecithin': 'soy lecithin',
  'lecithin from soy': 'soy lecithin',
  'natural flavour': 'natural flavor',
  'natural flavor': 'natural flavor',
  'high fructose corn syrup': 'high fructose corn syrup',
  'glucose-fructose': 'high fructose corn syrup',
  'glucose fructose': 'high fructose corn syrup',
  'glucose-fructose syrup': 'high fructose corn syrup',
  'glucose fructose syrup': 'high fructose corn syrup',
  carraghenine: 'carrageenan',
  'citrate de sodium': 'sodium citrate',
  'phosphate disodique': 'disodium phosphate',
  'gomme de caroube': 'locust bean gum',
  creme: 'cream',
  'creme a cafe': 'coffee cream',
  lait: 'milk',
}

function basicNormalize(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[()]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
}

const FRENCH_LOOKUP_HINTS: Array<[RegExp, string]> = [
  [/\bcarraghenine\b/, 'carrageenan'],
  [/\bcitrate de sodium\b/, 'sodium citrate'],
  [/\bphosphate disodique\b/, 'disodium phosphate'],
  [/\bgomme de caroube\b/, 'locust bean gum'],
  [/\bcreme a cafe\b|\bcreme\b/, 'cream'],
  [/\blait\b/, 'milk'],
]

/**
 * Normalized key for cache lookups/writes.
 */
export function normalizeIngredientName(name: string): string {
  const base = basicNormalize(String(name ?? ''))
  if (!base) return ''

  if (canonicalIngredientMap[base]) return canonicalIngredientMap[base]

  for (const [re, replacement] of FRENCH_LOOKUP_HINTS) {
    if (re.test(base)) return replacement
  }

  // "Lecithin (soy)" / "lecithin from soybeans" variants.
  if (/^lecithin\b.*\bsoy/.test(base) || /^soy\b.*\blecithin/.test(base)) {
    return 'soy lecithin'
  }

  // UK/CA spelling variant handling.
  if (base === 'natural flavouring') return 'natural flavor'
  if (base === 'natural flavoring') return 'natural flavor'

  // HFCS-family label variants (glucose-fructose naming).
  if (
    /\bhigh fructose corn syrup\b/.test(base) ||
    /\bglucose[- ]fructose\b/.test(base)
  ) {
    return 'high fructose corn syrup'
  }

  return base
}

/**
 * Preserve UI label text, but map known foreign-language ingredient lines to
 * the English lookup term for cache + AI decoding inputs.
 */
export function mapIngredientNameForLookup(name: string): string {
  const raw = String(name ?? '').trim()
  const base = basicNormalize(raw)
  const normalized = normalizeIngredientName(name)
  if (!normalized) return raw
  return normalized !== base ? normalized : raw
}

export function looksLikeFrenchIngredientName(name: string): boolean {
  const base = basicNormalize(String(name ?? ''))
  if (!base) return false
  return (
    /\b(de|des|du|aux|au|et)\b/.test(base) ||
    /\b(lait|creme|gomme|phosphate|citrate|carraghenine|ingredient[s]?|saveur)\b/.test(base)
  )
}

