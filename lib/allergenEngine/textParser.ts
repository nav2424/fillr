// Text parsing - split raw product text into sections
// ingredients_text, contains_text, may_contain_text
// Handles embedded "Contains:" and "May contain:" inside ingredients_text

export interface ParsedSections {
  ingredients_text: string
  contains_text: string
  may_contain_text: string
}

const CONTAINS_PATTERNS = [
  { re: /\bcontains\s*:?\s*/i, name: 'contains' },
  { re: /\bcontient\s*:?\s*/i, name: 'contient' },
  { re: /allergens?\s*:?\s*/i, name: 'allergens' },
  { re: /allergènes?\s*:?\s*/i, name: 'allergenes' },
]

const INGREDIENTS_PREFIX = /^ingredients?\s*:?\s*/i

const MAY_CONTAIN_PATTERNS = [
  /may\s+contain\s*:?\s*/i,
  /may\s+contain\s+traces?\s+of\s*/i,
  /traces?\s+of\s*/i,
  /peut\s+contenir\s+/i,
  /peut\s+contenir\s+des\s+traces?\s+/i,
  /puede\s+contener\s+/i,
  /processed\s+in\s+(a\s+)?facility\s+/i,
  /manufactured\s+in\s+(a\s+)?facility\s+/i,
  /made\s+in\s+(a\s+)?facility\s+/i,
  /packaged\s+in\s+(a\s+)?facility\s+/i,
  /processed\s+on\s+(shared\s+)?equipment\s+/i,
  /processed\s+on\s+equipment\s+that\s+also\s+/i,
  /may\s+have\s+come\s+into\s+contact\s+/i,
  /cross\s*[- ]?contact\s+/i,
  /cross\s*[- ]?contamination\s+/i,
  /shared\s+equipment\s+/i,
  /shared\s+facility\s+/i,
  /same\s+facility\s+/i,
  /same\s+equipment\s+/i,
  /fabriqué\s+dans\s+une\s+usine\s+/i,
  /emballé\s+dans\s+une\s+usine\s+/i,
]

/**
 * Parse raw ingredient/product text into sections.
 * Handles embedded "Ingredients: ... Contains: milk, soy. May contain: peanuts."
 * Returns separated ingredients, explicit "Contains:", and "May contain / facility" segments.
 */
export function parseSections(rawText: string): ParsedSections {
  if (!rawText || typeof rawText !== 'string') {
    return { ingredients_text: '', contains_text: '', may_contain_text: '' }
  }

  let ingredients_text = rawText.trim()
  let contains_text = ''
  let may_contain_text = ''

  // Split by common delimiters to get segments (sentence-level)
  const segments = ingredients_text
    .split(/[.;•·\n]+/g)
    .map(s => s.trim())
    .filter(Boolean)

  const ingredientsSegments: string[] = []
  const containsSegments: string[] = []
  const mayContainSegments: string[] = []

  function stripLeadingColon(s: string): string {
    return s.replace(/^[,\s:]+/, '').trim()
  }

  for (const seg of segments) {
    // Check for may-contain / facility first (more specific)
    let foundMayContain = false
    for (const p of MAY_CONTAIN_PATTERNS) {
      const m = seg.match(p)
      if (m) {
        const after = stripLeadingColon(seg.slice(m.index! + m[0].length))
        if (after) mayContainSegments.push(after)
        foundMayContain = true
        break
      }
    }
    if (foundMayContain) continue

    // Check for explicit "Contains:" / "Contient:" style
    let isContains = false
    for (const { re } of CONTAINS_PATTERNS) {
      const match = seg.match(re)
      if (match) {
        const before = seg.slice(0, match.index!).trim()
        const after = stripLeadingColon(seg.slice(match.index! + match[0].length))
        if (before) ingredientsSegments.push(before)
        if (after) containsSegments.push(after)
        isContains = true
        break
      }
    }
    if (isContains) continue

    // Check for "Ingredients:" prefix - strip and add to ingredients
    const ingMatch = seg.match(INGREDIENTS_PREFIX)
    if (ingMatch) {
      const after = seg.slice(ingMatch[0].length).trim()
      if (after) ingredientsSegments.push(after)
      continue
    }

    // Default: ingredients
    ingredientsSegments.push(seg)
  }

  ingredients_text = ingredientsSegments.join('. ')
  contains_text = containsSegments.join('. ')
  may_contain_text = mayContainSegments.join('. ')

  return {
    ingredients_text,
    contains_text,
    may_contain_text,
  }
}

/**
 * Check if a segment contains "may contain" / facility language.
 */
export function hasMayContainLanguage(text: string): boolean {
  if (!text || typeof text !== 'string') return false
  return MAY_CONTAIN_PATTERNS.some(p => p.test(text))
}

