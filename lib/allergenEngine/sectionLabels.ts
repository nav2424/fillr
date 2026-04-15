// Bilingual section labels for allergen evidence sources
// Used in ScanResultModal, AllergenDetailModal, and related UI

const SECTION_LABELS: Record<string, { en: string; fr: string }> = {
  ingredients: { en: 'Ingredients', fr: 'Ingrédients' },
  contains: { en: 'Contains', fr: 'Contient' },
  may_contain: { en: 'May contain', fr: 'Peut contenir' },
  product_name_hint: { en: 'Unverified (name)', fr: 'Non vérifié (nom)' },
  off_tags: { en: 'OFF tags', fr: 'Étiquettes OFF' },
  unknown: { en: 'Unknown', fr: 'Inconnu' },
}

/** Normalize raw section/source values to canonical keys */
function normalizeSection(section: string): string {
  const s = (section || '').toLowerCase().trim()
  if (!s) return 'unknown'
  switch (s) {
    case 'ingredients':
    case 'ingredients_text':
      return 'ingredients'
    case 'contains':
    case 'allergens':
    case 'allergen':
    case 'contains_text':
    case 'allergens_tags':
      return 'contains'
    case 'may_contain':
    case 'traces':
    case 'traces_tags':
    case 'may_contain_text':
      return 'may_contain'
    case 'product_name':
    case 'product_name_hint':
      return 'product_name_hint'
    case 'off_tags':
    case 'off':
      return 'off_tags'
    case 'unknown':
    case 'insufficient_data':
    case 'insufficient':
      return 'unknown'
    default:
      return 'unknown'
  }
}

/**
 * Get a section label for display in the allergen UI.
 * @param section - Raw section value (e.g. 'ingredients', 'allergens', 'traces', 'product_name')
 * @param opts.bilingual - If true, returns "English / Français" format
 */
export function getSectionLabel(
  section: string,
  opts?: { bilingual?: boolean }
): string {
  const canonical = normalizeSection(section)
  const labels = SECTION_LABELS[canonical] ?? SECTION_LABELS.unknown
  if (opts?.bilingual) {
    return `${labels.en} / ${labels.fr}`
  }
  return labels.en
}

