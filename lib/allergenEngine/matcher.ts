// Deterministic matching engine - NO HALLUCINATIONS
// Phrase-first with word boundaries; every match cites exact match_text

import type { CeliacMatch, MatchedAllergen, SectionSource, Severity } from './types'
import {
  ANTI_MATCHES,
  CELIAC_RULES,
  NON_DAIRY_BUTTER_CREAM,
  NON_WHEAT_FLOURS,
  getBuiltinById,
} from './builtinDictionary'
import type { CustomAllergenRule } from './types'
import { hasMayContainLanguage } from './textParser'

/** Normalize text: lowercase, strip accents/diacritics, collapse whitespace, normalize punctuation */
export function normalizeText(text: string): string {
  if (!text || typeof text !== 'string') return ''
  return text
    .toLowerCase()
    .replace(/\u0153/g, 'oe') // œ → oe (œufs, œuf)
    .replace(/\u0152/g, 'oe') // Œ → oe
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics (arachide variants, etc.)
    .replace(/[\u2018\u2019\u201a\u201b\u201c\u201d\u201e\u201f]/g, "'") // curly apostrophes
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, ' ') // various dashes
    .replace(/[\u2022\u2023\u2043\u2219\u00b7]/g, ' ') // bullets
    .replace(/[\r\n\t]+/g, ' ') // line breaks, tabs
    .replace(/[()\[\]{}.,;:!'"\-]/g, ' ') // hyphen so "milk-free" -> "milk free"
    .replace(/\s+/g, ' ')
    .trim()
}

function sectionUsesNonWheatFlour(sectionText: string): boolean {
  const norm = normalizeText(sectionText)
  return NON_WHEAT_FLOURS.some((flour) => norm.includes(normalizeText(flour)))
}

/** Check if term matches as whole word (word boundaries) - "nut" does NOT match "donut" */
function isWholeWordMatch(text: string, term: string): boolean {
  const normalizedText = normalizeText(text)
  const normalizedTerm = normalizeText(term)

  if (normalizedTerm.includes(' ')) {
    return normalizedText.includes(normalizedTerm)
  }

  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\b${escaped}\\b`, 'i')
  return regex.test(normalizedText)
}

/** Extract exact matched substring for evidence (from original text) */
function extractMatchText(text: string, term: string): string {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\b${escaped}\\b`, 'i')
  const m = text.match(regex)
  return m ? m[0] : term
}

/** Section-level: skip when text contains anti phrase that INCLUDES our term (e.g. "soy milk" contains "milk") */
function isAntiMatchSection(allergenId: string, sectionText: string, term: string): boolean {
  const anti = ANTI_MATCHES[allergenId]
  if (!anti) return false
  const normText = normalizeText(sectionText)
  const normTerm = normalizeText(term)
  return anti.some(antiTerm => {
    const normAnti = normalizeText(antiTerm)
    return normText.includes(normAnti) && normAnti.includes(normTerm)
  })
}

/** Match-level: skip when matched text IS an anti-match */
function isMatchedTextAntiMatch(allergenId: string, matchText: string): boolean {
  const anti = ANTI_MATCHES[allergenId]
  if (!anti) return false
  const norm = normalizeText(matchText)
  return anti.some(antiTerm => normalizeText(antiTerm) === norm || norm.includes(normalizeText(antiTerm)))
}

/** Check negation patterns (e.g., "milk-free", "sans lait") */
function hasNegation(text: string, allergenId: string, terms: string[]): boolean {
  const normalized = normalizeText(text)
  const negations = ['free', 'sans', 'sans ', 'no ', 'without', 'does not contain', 'ne contient pas']
  for (const term of terms) {
    const t = normalizeText(term)
    for (const neg of negations) {
      if (normalized.includes(`${t} ${neg}`) || normalized.includes(`${neg} ${t}`)) {
        return true
      }
    }
  }
  return false
}

/** Special handling: milk + butter/cream - skip if non-dairy phrase */
function shouldSkipMilkButterCream(text: string): boolean {
  const norm = normalizeText(text)
  return NON_DAIRY_BUTTER_CREAM.some(p => norm.includes(normalizeText(p)))
}

/** Special handling: soy + lecithin - only match when soy is explicit; skip when sunflower/canola */
function shouldSkipSoyLecithin(text: string): boolean {
  const norm = normalizeText(text)
  return (
    norm.includes('sunflower lecithin') ||
    norm.includes('lécithine de tournesol') ||
    norm.includes('canola lecithin') ||
    norm.includes('lecithin from canola')
  )
}

/** Malt/gluten policy: "barley malt" etc. = CONTAINS; "malt" alone = MAY_CONTAIN */
const MALT_AMBIGUOUS_TERMS = ['malt', 'malt extract', 'malt syrup', 'malt vinegar', 'malt flour', 'malted']
const BARLEY_CONFIRMED_PHRASES = ['barley malt', 'malted barley', 'barley malt extract', 'barley malt flour']

function getMaltSeverity(sectionText: string, matchedTerm: string): 'CONTAINS' | 'MAY_CONTAIN' {
  const norm = normalizeText(sectionText)
  const termNorm = normalizeText(matchedTerm)
  const isAmbiguousMalt = MALT_AMBIGUOUS_TERMS.some(t => normalizeText(t) === termNorm || termNorm.includes(normalizeText(t)))
  if (!isAmbiguousMalt) return 'CONTAINS'
  const hasBarley = BARLEY_CONFIRMED_PHRASES.some(p => norm.includes(normalizeText(p)))
  return hasBarley ? 'CONTAINS' : 'MAY_CONTAIN'
}

/** Match built-in allergen in text section */
function matchBuiltinInSection(
  allergenId: string,
  sectionText: string,
  section: SectionSource
): { match_text: string; term: string; severity?: Severity } | null {
  const builtin = getBuiltinById(allergenId)
  if (!builtin) return null

  if (hasNegation(sectionText, allergenId, builtin.synonyms)) return null

  let severity: Severity = section === 'may_contain' ? 'MAY_CONTAIN' : 'CONTAINS'

  for (const term of builtin.synonyms) {
    if (isAntiMatchSection(allergenId, sectionText, term)) continue
    if (allergenId === 'milk' && (term === 'butter' || term === 'cream') && shouldSkipMilkButterCream(sectionText)) {
      continue
    }
    if (allergenId === 'soy' && (term.includes('lecithin') || term === 'lécithine de soja') && shouldSkipSoyLecithin(sectionText)) {
      continue
    }
    if (
      allergenId === 'wheat' &&
      (term.includes('flour') || term === 'semolina' || term === 'durum') &&
      sectionUsesNonWheatFlour(sectionText)
    ) {
      continue
    }

    if (isWholeWordMatch(sectionText, term)) {
      const match_text = extractMatchText(sectionText, term)
      if (isMatchedTextAntiMatch(allergenId, match_text)) continue
      if (allergenId === 'wheat' && ['malt', 'malt extract', 'malt syrup', 'malt vinegar', 'malt flour', 'malted'].some(t => normalizeText(t) === normalizeText(term))) {
        severity = getMaltSeverity(sectionText, match_text)
      }
      return { match_text, term, severity }
    }
  }
  return null
}

/** Parentheses proximity: "X (Y)" where Y matches allergen → explicit evidence of Y */
function extractParenthesesEvidence(
  sectionText: string,
  section: SectionSource,
  builtinIds: string[]
): Array<{ allergenId: string; match_text: string }> {
  const results: Array<{ allergenId: string; match_text: string }> = []
  const re = /(\S+(?:\s+\S+)*\s*\([^)]+\))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(sectionText)) !== null) {
    const fullPhrase = m[1]
    const parenMatch = fullPhrase.match(/\(([^)]+)\)$/)
    if (!parenMatch) continue
    const inParens = parenMatch[1].trim()
    const normInParens = normalizeText(inParens)
    for (const allergenId of builtinIds) {
      const builtin = getBuiltinById(allergenId)
      if (!builtin) continue
      const matched = builtin.synonyms.some(syn => {
        const norm = normalizeText(syn)
        return normInParens === norm || normInParens.includes(norm) || norm.includes(normInParens)
      })
      if (matched) {
        if (isAntiMatchSection(allergenId, sectionText, inParens)) continue
        if (allergenId === 'milk' && shouldSkipMilkButterCream(sectionText)) continue
        results.push({ allergenId, match_text: fullPhrase })
        break
      }
    }
  }
  return results
}

/** Match custom allergen rule in text section */
function matchCustomInSection(
  rule: CustomAllergenRule,
  sectionText: string,
  section: SectionSource
): { match_text: string } | null {
  if (!rule.enabled_sections.includes(section)) return null

  const terms = [...rule.terms, ...(rule.approved_synonyms || [])]

  for (const term of terms) {
    if (rule.match_mode === 'EXACT_PHRASE') {
      if (isWholeWordMatch(sectionText, term)) {
        return { match_text: extractMatchText(sectionText, term) }
      }
    } else {
      if (isWholeWordMatch(sectionText, term)) {
        return { match_text: extractMatchText(sectionText, term) }
      }
    }
  }
  return null
}

/** Run deterministic matching - returns ONLY evidence-based results */
export function runMatching(
  parsed: { ingredients_text: string; contains_text: string; may_contain_text: string },
  builtinIds: string[],
  customRules: CustomAllergenRule[]
): MatchedAllergen[] {
  const matched: MatchedAllergen[] = []
  const seen = new Set<string>()

  const sections: { text: string; section: SectionSource }[] = [
    { text: parsed.ingredients_text, section: 'ingredients' },
    { text: parsed.contains_text, section: 'contains' },
    { text: parsed.may_contain_text, section: 'may_contain' },
  ]

  for (const { text, section } of sections) {
    if (!text.trim()) continue

    // Determine severity from section
    const severity: Severity = section === 'may_contain' ? 'MAY_CONTAIN' : 'CONTAINS'

    // Parentheses proximity: "lecithin (soy)" → soy evidence
    const parenMatches = extractParenthesesEvidence(text, section, builtinIds)
    for (const { allergenId, match_text } of parenMatches) {
      const key = `${allergenId}:${section}`
      if (seen.has(key)) continue
      const builtin = getBuiltinById(allergenId)
      if (builtin) {
        seen.add(key)
        matched.push({
          allergen_id: allergenId,
          allergen_name: builtin.name,
          severity: section === 'may_contain' ? 'MAY_CONTAIN' : 'CONTAINS',
          section,
          match_text,
        })
      }
    }

    for (const allergenId of builtinIds) {
      const key = `${allergenId}:${section}`
      if (seen.has(key)) continue

      const result = matchBuiltinInSection(allergenId, text, section)
      if (result) {
        seen.add(key)
        const builtin = getBuiltinById(allergenId)!
        matched.push({
          allergen_id: allergenId,
          allergen_name: builtin.name,
          severity: result.severity ?? severity,
          section,
          match_text: result.match_text,
        })
      }
    }

    for (const rule of customRules) {
      const key = `custom:${rule.id}:${section}`
      if (seen.has(key)) continue
      const result = matchCustomInSection(rule, text, section)
      if (result) {
        seen.add(key)
        matched.push({
          allergen_id: rule.id,
          allergen_name: rule.name,
          severity: section === 'may_contain' || hasMayContainLanguage(text) ? 'MAY_CONTAIN' : severity,
          section,
          match_text: result.match_text,
        })
      }
    }
  }

  return matched
}

function hasWholeWordMalt(text: string): boolean {
  return /\bmalt\b/i.test(text)
}

function isSafeNegativeCeliac(text: string): boolean {
  const n = normalizeText(text)
  return CELIAC_RULES.SAFE_NEGATIVES.some((term) => n.includes(normalizeText(term)))
}

function pushUniqueCeliac(
  acc: CeliacMatch[],
  next: CeliacMatch
): void {
  const key = `${next.signalType}:${normalizeText(next.ingredient)}`
  const exists = acc.some(
    (m) => `${m.signalType}:${normalizeText(m.ingredient)}` === key
  )
  if (!exists) acc.push(next)
}

export function runCeliacCheck(
  ingredients: string[],
  fullText: string
): CeliacMatch[] {
  const matches: CeliacMatch[] = []
  const normalizedFullText = normalizeText(fullText)

  // 1) ingredient-level rules
  for (const raw of ingredients) {
    const ingredient = String(raw || '').trim()
    if (!ingredient) continue
    const lower = ingredient.toLowerCase()

    // 2) anti-matches first — skip ingredient entirely (no GF note / oats on safe lines)
    if (isSafeNegativeCeliac(lower)) continue

    // 3) certified GF note (does not short-circuit other checks)
    if (CELIAC_RULES.CERTIFIED_GF.terms.some((t) => normalizeText(lower).includes(normalizeText(t)))) {
      pushUniqueCeliac(matches, {
        ingredient,
        signalType: CELIAC_RULES.CERTIFIED_GF.signalType,
        severity: CELIAC_RULES.CERTIFIED_GF.severity,
        reason: CELIAC_RULES.CERTIFIED_GF.reason,
      })
    }

    // 4) priority order — BARLEY_MALT before EXPLICIT_GRAINS so "barley malt extract" is BARLEY_MALT, not barley grain alone
    const barleyMalt = CELIAC_RULES.BARLEY_MALT.terms.find((t) =>
      normalizeText(lower).includes(normalizeText(t))
    )
    if (barleyMalt) {
      pushUniqueCeliac(matches, {
        ingredient,
        signalType: CELIAC_RULES.BARLEY_MALT.signalType,
        severity: CELIAC_RULES.BARLEY_MALT.severity,
        reason: CELIAC_RULES.BARLEY_MALT.reason,
      })
      continue
    }

    const explicit = CELIAC_RULES.EXPLICIT_GRAINS.terms.find((t) =>
      normalizeText(lower).includes(normalizeText(t))
    )
    if (explicit) {
      pushUniqueCeliac(matches, {
        ingredient,
        signalType: CELIAC_RULES.EXPLICIT_GRAINS.signalType,
        severity: CELIAC_RULES.EXPLICIT_GRAINS.severity,
        reason: CELIAC_RULES.EXPLICIT_GRAINS.reason,
      })
      continue
    }

    const allergenSection = CELIAC_RULES.ALLERGEN_SECTION.terms.find((t) =>
      normalizeText(lower).includes(normalizeText(t))
    )
    if (allergenSection) {
      pushUniqueCeliac(matches, {
        ingredient,
        signalType: CELIAC_RULES.ALLERGEN_SECTION.signalType,
        severity: CELIAC_RULES.ALLERGEN_SECTION.severity,
        reason: CELIAC_RULES.ALLERGEN_SECTION.reason,
      })
      continue
    }

    const ambiguousMaltPhrase = CELIAC_RULES.AMBIGUOUS_MALT.terms.find((t) => {
      const nt = normalizeText(t)
      if (nt === 'malt') {
        return hasWholeWordMalt(lower) && !normalizeText(lower).includes('maltodextrin')
      }
      return normalizeText(lower).includes(nt)
    })
    if (ambiguousMaltPhrase) {
      pushUniqueCeliac(matches, {
        ingredient,
        signalType: CELIAC_RULES.AMBIGUOUS_MALT.signalType,
        severity: CELIAC_RULES.AMBIGUOUS_MALT.severity,
        reason: CELIAC_RULES.AMBIGUOUS_MALT.reason,
      })
      continue
    }

    const brewersYeast = CELIAC_RULES.BREWERS_YEAST.terms.find((t) =>
      normalizeText(lower).includes(normalizeText(t))
    )
    if (brewersYeast) {
      pushUniqueCeliac(matches, {
        ingredient,
        signalType: CELIAC_RULES.BREWERS_YEAST.signalType,
        severity: CELIAC_RULES.BREWERS_YEAST.severity,
        reason: CELIAC_RULES.BREWERS_YEAST.reason,
      })
      continue
    }

    const oats = CELIAC_RULES.OATS.terms.find((t) =>
      normalizeText(lower).includes(normalizeText(t))
    )
    if (oats) {
      pushUniqueCeliac(matches, {
        ingredient,
        signalType: CELIAC_RULES.OATS.signalType,
        severity: CELIAC_RULES.OATS.severity,
        reason: CELIAC_RULES.OATS.reason,
      })
    }
  }

  // 6) MAY_CONTAIN checks on full text
  if (normalizedFullText) {
    for (const term of CELIAC_RULES.MAY_CONTAIN.terms) {
      if (normalizedFullText.includes(normalizeText(term))) {
        pushUniqueCeliac(matches, {
          ingredient: term,
          signalType: CELIAC_RULES.MAY_CONTAIN.signalType,
          severity: CELIAC_RULES.MAY_CONTAIN.severity,
          reason: CELIAC_RULES.MAY_CONTAIN.reason,
        })
      }
    }
    for (const term of CELIAC_RULES.ALLERGEN_SECTION.terms) {
      if (normalizedFullText.includes(normalizeText(term))) {
        pushUniqueCeliac(matches, {
          ingredient: term,
          signalType: CELIAC_RULES.ALLERGEN_SECTION.signalType,
          severity: CELIAC_RULES.ALLERGEN_SECTION.severity,
          reason: CELIAC_RULES.ALLERGEN_SECTION.reason,
        })
      }
    }
  }

  return matches
}

export function getCeliacSeverity(
  matches: CeliacMatch[]
): 'SAFE' | 'CAUTION' | 'AVOID' {
  if (matches.some((m) => m.severity === 'AVOID')) return 'AVOID'
  if (matches.some((m) => m.severity === 'CAUTION')) return 'CAUTION'
  return 'SAFE'
}

