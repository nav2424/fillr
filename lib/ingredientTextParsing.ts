/**
 * English-first ingredient extraction and cleaning for Open Food Facts / bilingual labels.
 */

import { englishPrimarySegment, frenchLikelihood } from './bilingualDisplay'
import { dedupeBilingualIngredientNames } from './bilingualIngredients'
import { normalizeText } from './allergenEngine/matcher'
import type { IngredientTextParseSource } from './ingredientParseSource'

export interface ProductFieldsForIngredientParse {
  ingredients_text?: string
  ingredients_text_en?: string
  ingredients_text_fr?: string
  allergens?: string
}

/**
 * Non-English section headers that start a duplicate ingredient list after an English block.
 */
const FOREIGN_INGREDIENT_SECTION_HEADERS: RegExp[] = [
  /\bingrédients?\s*:/i,
  /\bingrédient\s*:/i,
  /\bingredientes\s*:/i,
  /\bzutaten\s*:/i,
  /\bingredienti\s*:/i,
  /\bskładnik(?:i|ów)\s*:/i,
  /\binnehåll\s*:/i,
  /\bingrediënten\s*:/i,
  /\bainesosat\s*:/i,
  /\bcomposición\s*:/i,
  /\bcomposizione\s*:/i,
  /\bzusammensetzung\s*:/i,
  /\bbestandteile\s*:/i,
  /состав\s*:/i,
  /ингредиенты\s*:/i,
]

const ENGLISH_INGREDIENT_START = /\bingredients?\s*:/i
const ENGLISH_COMPOSITION_START = /\bcomposition\s*:/i

/** OCR / packaging misreads for the word “ingredients” and related headers. */
const OCR_INGREDIENT_HEADER_PATTERNS: Array<{ re: RegExp; onlyAtStringStart?: boolean }> = [
  { re: /\blngredients?\s*:?\s*/gi },
  { re: /\bingredients?\s*:?\s*/gi },
  { re: /\bingredient\s*:?\s*/gi },
  { re: /\bngr[éeè]dients?\s*:?\s*/gi },
  { re: /(?:^|[^\w])INGREDIENTS\s*:?\s*/g },
  { re: /(?:^|[^\w])INGREDIENT\s*:?\s*/g },
  { re: /(?:^|[^\w])COMPOSITION\s*:?\s*/g },
  { re: /\bcomposition\s*:?\s*/gi },
]

function trimAfterHeaderToForeignBoundary(afterHeader: string): string {
  let end = afterHeader.length
  for (const re of FOREIGN_INGREDIENT_SECTION_HEADERS) {
    re.lastIndex = 0
    const m = re.exec(afterHeader)
    if (m && m.index !== undefined && m.index < end) {
      end = m.index
    }
  }
  return afterHeader.slice(0, end).trim()
}

function findStrictEnglishHeaderSlice(t: string): string | null {
  let enStart = -1
  let enLen = 0
  const ingM = ENGLISH_INGREDIENT_START.exec(t)
  if (ingM && ingM.index !== undefined) {
    enStart = ingM.index
    enLen = ingM[0].length
  }
  const compM = ENGLISH_COMPOSITION_START.exec(t)
  if (compM && compM.index !== undefined) {
    if (enStart === -1 || compM.index < enStart) {
      enStart = compM.index
      enLen = compM[0].length
    }
  }
  if (enStart === -1) return null
  const afterEn = t.slice(enStart + enLen)
  const sliced = trimAfterHeaderToForeignBoundary(afterEn)
  return sliced || null
}

function findOcrEnglishHeaderSlice(t: string): string | null {
  let bestIdx = -1
  let bestEnd = 0
  for (const { re, onlyAtStringStart } of OCR_INGREDIENT_HEADER_PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(t)) !== null) {
      if (onlyAtStringStart && m.index !== 0) break
      if (bestIdx === -1 || m.index < bestIdx) {
        bestIdx = m.index
        bestEnd = m.index + m[0].length
      }
    }
  }
  if (bestIdx === -1) return null
  const after = t.slice(bestEnd)
  const sliced = trimAfterHeaderToForeignBoundary(after)
  return sliced || null
}

/**
 * When a label lists ingredients in full twice (EN then FR/DE/…), keep only the English segment.
 * Barcode mode: strict `Ingredients:` / `Composition:` only.
 * OCR mode: tolerant headers (lngredients, INGREDIENTS, missing colon, etc.). If no header matches,
 * the full string is kept so a photo of only the list still parses.
 */
export function sliceToEnglishIngredientSection(
  plainText: string,
  options?: { ocr?: boolean }
): string {
  const t = plainText.trim()
  if (!t) return t
  const ocr = options?.ocr === true
  const sliced = ocr ? findOcrEnglishHeaderSlice(t) : findStrictEnglishHeaderSlice(t)
  if (sliced == null || sliced === '') {
    return t
  }
  return sliced
}

/**
 * Cut OCR text where packaging / customer-service copy starts (after the real list).
 * ML Kit often reads the whole panel; without this, commas split garbage into “ingredients”.
 */
/** Advisory lines (not formula ingredients) — strip before comma-splitting ingredient lists. */
export function stripAllergenAdvisoryClausesFromBlob(raw: string): string {
  let s = stripHtmlForIngredients(raw)
  const clausePatterns: RegExp[] = [
    /\ballergen(?:s)?\s*(?:info(?:rmation)?)?\s*:?\s*[^.;]+(?:[.;]|$)/gi,
    /\bcontains\s*:\s*[^.;]+(?:[.;]|$)/gi,
    /\bcontient\s*:\s*[^.;]+(?:[.;]|$)/gi,
    /\bmay\s+contain(?:\s+traces?\s+of)?\s*[^.;]+(?:[.;]|$)/gi,
    /\bpeut\s+contenir(?:\s+des\s+traces?\s+(?:de|d'))?\s*[^.;]+(?:[.;]|$)/gi,
    /\btraces?\s+of\s+[^.;]+(?:[.;]|$)/gi,
    /\bpossible\s+cross[\s-]?contamination[^.;]*(?:[.;]|$)/gi,
    /\bcross[\s-]?contamination[^.;]*(?:[.;]|$)/gi,
    /\b(?:made|manufactured|processed|packaged|prepared)\s+in\s+(?:a\s+)?(?:facility|plant)\s+[^.;]+(?:[.;]|$)/gi,
    /\b(?:same|shared)\s+(?:facility|equipment)\s+[^.;]+(?:[.;]|$)/gi,
    /\bprocessed\s+on\s+(?:shared\s+)?equipment\s+[^.;]+(?:[.;]|$)/gi,
    /\bmay\s+have\s+come\s+into\s+contact\s+with\s+[^.;]+(?:[.;]|$)/gi,
  ]
  for (const re of clausePatterns) {
    s = s.replace(re, ' ')
  }
  return s.replace(/\s{2,}/g, ' ').trim()
}

/**
 * Drop bare allergen tokens only when the parse looks like advisory noise, not a real formula.
 * e.g. keep "Milk" in "Milk, Cream, Carrageenan…" but drop a lone "milk" from "Contains: milk".
 */
export function filterBareAllergenTokensFromParsedList(names: string[]): string[] {
  if (names.length === 0) return names
  const nonBare = names.filter((n) => !isBareAllergenDisclosureName(n))
  if (nonBare.length === 0) return []
  if (nonBare.length < names.length && nonBare.length >= 1) return names
  return nonBare
}

/** Single-token rows like "milk" / "eggs" from advisory lines — not real ingredients. */
export function isBareAllergenDisclosureName(name: string): boolean {
  const n = normalizeText(name)
    .replace(/[.:;]+$/g, '')
    .trim()
  if (!n) return true
  const bare = new Set([
    'milk',
    'dairy',
    'egg',
    'eggs',
    'wheat',
    'gluten',
    'soy',
    'soya',
    'peanut',
    'peanuts',
    'tree nut',
    'tree nuts',
    'nuts',
    'fish',
    'shellfish',
    'sesame',
    'mustard',
    'sulfites',
    'sulphites',
    'celery',
    'lupin',
    'lupine',
    'allergen',
    'allergens',
    'allergen information',
    'allergen info',
  ])
  if (bare.has(n)) return true
  if (/^(contains|may contain|allergen)/.test(n)) return true
  if (n === 'may') return true
  return false
}

export function truncateIngredientBlobAtPackagingTail(raw: string): string {
  const t0 = raw.trim()
  const t = t0.length >= 50 ? stripAllergenAdvisoryClausesFromBlob(t0) : t0
  if (t.length < 50) return t
  let cut = t.length
  const markers: RegExp[] = [
    /\battention\s*[:\-]/i,
    /\bmay\s+contain\b/i,
    /\bcross[\s-]?contamination\b/i,
    /\b(?:same|shared)\s+facility\b/i,
    /\bhigh caffeine content\b/i,
    /\bexcessive consumption\b/i,
    /\bconsume responsibly\b/i,
    /\bnot suitable for\b/i,
    /\bsensitive to caffeine\b/i,
    /\buse under medical supervision\b/i,
    /\bnot recommended for (?:children|individuals|pregnant|breastfeeding|adolescents)\b/i,
    /\bpregnant or lactating\b/i,
    /\bimport(?:é|ee|ed)\s+par\b/i,
    /\bimported\s+by\b/i,
    /\bif\s+you\s+are\s+not\s+completely\s+satisfied\b/i,
    /\bif\s+you['']re\s+not\s+completely\s+satisfied\b/i,
    /\bnot\s+completely\s+satisfied\b/i,
    /\bveuillez\s+composer\b/i,
    /\bplease\s+call\b/i,
    /\bour\s+customer\s+service\b/i,
    /\bquestions?\s+or\s+comments\b/i,
    /\bvisit\s+us\s+at\b/i,
    /\b(?:https?:\/\/)?www\.[a-z0-9][a-z0-9.-]*\.[a-z]{2,}\b/i,
    /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i,
    /\bulg\.?\s*toronto\b/i,
    /\bhain[\s-]celestial\b/i,
    /\bhain\s+if\s+you\b/i,
    /\bmanufactured\s+for\b/i,
    /\bprepared\s+for\b/i,
    /\bdistributed\s+by\b/i,
    /\bfor\s+more\s+information\b/i,
    /(?:^|[.;]\s*)\b(?:uht\s+)?pasteuri[sz](?:ed|e|é|ée)?\b/i,
    /(?:^|[.;]\s*)\buht\s+pasteuri[sz](?:ed|e|é|ée)?\b/i,
    /(?:^|[.;]\s*)\bkeep\s+refrigerated\b/i,
    /(?:^|[.;]\s*)\bgarder\s+au\s+r[ée]frig[ée]rateur\b/i,
    /(?:^|[.;]\s*)\bdairy\s+co-?operative\b/i,
    /(?:^|[.;]\s*)\bcoop[ée]rative\s+laiti[èe]re\b/i,
  ]
  for (const re of markers) {
    re.lastIndex = 0
    const m = re.exec(t)
    /** Warnings often follow the real list — cut even when they appear relatively early. */
    if (m && m.index >= 12 && m.index < cut) cut = m.index
  }
  const phoneRe =
    /\b(?:\+?1[-.\s]?)?(?:\(\s*\d{3}\s*\)[-.\s]?\d{3}[-.\s]?\d{4}|\d{3}[-.\s]\d{3}[-.\s]\d{4}|800[-.\s]?\d{3}[-.\s]?\d{4})\b/g
  let pm: RegExpExecArray | null
  while ((pm = phoneRe.exec(t)) !== null) {
    if (pm.index >= 35 && pm.index < cut) cut = pm.index
  }
  return t.slice(0, cut).trim()
}

/**
 * OCR-specific noise: misreads, nutrition crumbs, declarations, addresses.
 * Returns a single normalized string (commas will be filled in after newlines).
 */
export function cleanIngredientTextOCR(raw: string): string {
  let s = truncateIngredientBlobAtPackagingTail(raw)
  // OCR sometimes captures keyboard/search UI text after the ingredient panel.
  // Cut hard at the first such marker so the last real ingredient remains clean.
  const uiTailMarkers: RegExp[] = [
    /\bq\s+search\b/i,
    /\bsearch\s+d?default\b/i,
    /\bdefault\s+search\b/i,
    /\bcommand\s+option\b/i,
    /\boption\s+delete\b/i,
    /\boption\s+delele\b/i,
    /\bcommand\s+delete\b/i,
  ]
  let uiCut = s.length
  for (const re of uiTailMarkers) {
    re.lastIndex = 0
    const m = re.exec(s)
    if (m && m.index > 20 && m.index < uiCut) {
      uiCut = m.index
    }
  }
  if (uiCut < s.length) {
    s = s.slice(0, uiCut).trim()
  }
  s = s.replace(/[|]/g, 'I')
  s = s.replace(/\b0il\b/gi, 'Oil')
  s = s.replace(/\bI\/\s*/g, '')
  s = s.replace(/\brn\b/g, 'm')
  s = s.replace(/\bvv\b/gi, 'w')
  s = s.replace(/\b\d+\s*%\s*(?:dv|daily|rdi|reference)\b/gi, '')
  s = s.replace(/\b\d+\s*mg\b/gi, '')
  s = s.replace(/\b\d+\s+g\b(?=\s*(?:of|or|and|,|\.|;))/gi, '')
  s = s.replace(/\bper\s+\d+[^,;.]{0,40}/gi, '')
  s = s.replace(/\(\s*\d+\s*\)/g, '')
  s = s.replace(/\bcontains?\s*:\s*[^,.;]+(?:[,.;]|$)/gi, ' ')
  s = s.replace(/\bcontient\s*:?\s*[^,.;]+(?:[,.;]|$)/gi, ' ')
  s = s.replace(/\bmay\s+contain\s*[^,.;]+(?:[,.;]|$)/gi, ' ')
  s = s.replace(/\bpeut\s+contenir\s*[^,.;]+(?:[,.;]|$)/gi, ' ')
  s = s.replace(/\bmanufactured\s+by[^,.;]+(?:[,.;]|$)/gi, ' ')
  s = s.replace(/\bdistributed\s+by[^,.;]+(?:[,.;]|$)/gi, ' ')
  s = s.replace(/\bproduced\s+by[^,.;]+(?:[,.;]|$)/gi, ' ')
  s = s.replace(/\b\d{3,}[^,]{0,80}\b(?:ave|st|rd|blvd|road|dr)\b[^,]*/gi, '')
  s = s.replace(/[A-Z]\d[A-Z]\s*\d[A-Z]\d/g, '')
  s = s.replace(/\b\d{5}(?:-\d{4})?\b/g, '')
  s = s.replace(/\bbest\s+before[^,;.]+/gi, '')
  s = s.replace(/\bmeilleur\s+avant[^,;.]+/gi, '')
  s = s.replace(/\bbb\s*:?\s*[\d/.]+/gi, '')
  s = s.replace(/\bexp\.?\s*:?\s*[\d/.]+/gi, '')
  s = s.replace(/\buse under medical supervision[^,.;]{0,200}(?:[,.;]|$)/gi, ' ')
  s = s.replace(/\bnot recommended for[^,.;]{0,200}(?:[,.;]|$)/gi, ' ')
  s = s.replace(/\bhigh caffeine content[^,.;]{0,120}(?:[,.;]|$)/gi, ' ')
  s = s.replace(/\battention\s*[:\-][^,.;]{0,200}(?:[,.;]|$)/gi, ' ')
  s = s.replace(/\r?\n+/g, ', ')
  s = s.replace(/,\s*,+/g, ',')
  s = s.replace(/\s{2,}/g, ' ')
  return s.trim()
}

/** Strip HTML to plain text before other cleaning. */
export function stripHtmlForIngredients(raw: string): string {
  if (!raw || typeof raw !== 'string') return ''
  let s = raw
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
  s = s.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
  s = s.replace(/<[^>]+>/g, ' ')
  s = s.replace(/&nbsp;/gi, ' ')
  s = s.replace(/&amp;/gi, '&')
  s = s.replace(/&lt;/gi, '<')
  s = s.replace(/&gt;/gi, '>')
  s = s.replace(/&(quot|#34);/gi, '"')
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * Strip parenthetical / bracketed sub-lists, then normalize spaces.
 * Shared by barcode scans, OCR, and OpenAI prep.
 */
export function prepareIngredientTextForAnalysis(raw: string): string {
  let s = stripHtmlForIngredients(raw)
  let prev = ''
  while (s !== prev) {
    prev = s
    s = s.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '')
  }
  return s.replace(/\s+/g, ' ').trim()
}

function isPlausibleIngredientToken(name: string): boolean {
  const t = name.trim()
  if (t.length < 2) return false
  if (/^<\s*[a-z!/]/i.test(t)) return false
  if (/\bclass\s*=\s*["']?/i.test(t)) return false
  if (!/[a-zA-Z\u00C0-\u024F]/.test(t)) return false
  return true
}

/** Drop OCR comma-split noise (articles, dates, empty tokens). */
export function isJunkOcrIngredientToken(ingredient: string): boolean {
  const t = ingredient.trim()
  if (t.length < 2) return true
  if (/^[\d\s]+$/.test(t)) return true
  if (!/[a-zA-Z\u00C0-\u024F]/.test(t)) return true
  if (/^(and|or|with|of|the|a|an)$/i.test(t)) return true
  if (/^\d{1,2}[\/\-]\d{1,2}/.test(t)) return true
  const low = t.toLowerCase()
  if (
    /^(attention|warning|caution|note)\b/i.test(t) ||
    /\bhigh caffeine content\b/.test(low) ||
    /\buse under medical supervision\b/.test(low) ||
    /\bnot recommended for\b/.test(low) ||
    /\bnot suitable for\b/.test(low) ||
    /\bsensitive to caffeine\b/.test(low) ||
    /\bexcessive consumption\b/.test(low) ||
    /\bconsume responsibly\b/.test(low) ||
    /\bpregnant women\b/.test(low) ||
    /\bbreast-?feeding\b/.test(low) ||
    /\badolescents\b/.test(low) ||
    /\beou\s+ide\b/i.test(low) ||
    /\budos\s+ditique\b/i.test(low)
  ) {
    return true
  }
  if (
    low.length > 55 &&
    /caffeine|pregnant|breastfeeding|supervision|warning|attention:/i.test(low) &&
    /ingredient|water|sugar|syrup|acid|salt|flavor|colour|color|vitamin|gum|sweetener/i.test(low) === false
  ) {
    return true
  }
  if (
    /\b(importé|imported)\s+par\b/.test(low) ||
    /\bimported\s+by\b/.test(low) ||
    /\bhain[\s-]celestial\b/.test(low) ||
    /\bhain\s+if\s+you\b/.test(low) ||
    /\bsatisfied\b/.test(low) &&
      /\b(if\s+you|please|call|composer|800|guarantee|customer)\b/.test(low)
  ) {
    return true
  }
  if (/\b(veuillez|composer|ulg\.?\s*toronto|please\s+cal)\b/.test(low)) return true
  if (/\b800[-.\s]?\d{3}\b/.test(t) || /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(t)) return true
  if (
    t.length < 96 &&
    /\b(inc\.|ltd\.)\b/.test(low) &&
    /\b(hain|celestial|toronto|canada)\b/.test(low)
  ) {
    return true
  }
  if (t.length < 48 && /\b(www\.|@|\.com\b)/.test(low)) return true
  if (/^each\s+of\s+the\s+following\.?$/i.test(low)) return true
  return false
}

function sanitizeIngredientToken(raw: string): string {
  return raw
    .trim()
    .replace(/^_|_$/g, '')
    .replace(/_/g, ' ')
    /** OCR / OFF typo: "stearoyl2lactylate" → standard name */
    .replace(/\bstearoyl\s*2\s*lactylate\b/gi, 'stearoyl-2-lactylate')
    .replace(/[)]+$/g, '')
    .replace(/\*+$/g, '')
    .replace(/^\*+/g, '')
    .replace(/\(\d+\)$/g, '')
    .replace(/†$/g, '')
    .replace(/‡$/g, '')
    .trim()
}

function stripOcrUiTailFromIngredientToken(name: string): string {
  let s = name.trim()
  if (!s) return s
  // Common OCR keyboard/search overlay tails glued to real ingredient names.
  s = s.replace(/\s+\b(?:q|w|e|r|t|y|u|i|o|p|a|s|d|f|g|h|j|k|l|z|x|c|v|b|n|m)(?:\s+[a-z0-9]){4,}\b.*$/i, '')
  s = s.replace(/\s+\b(?:default|detautt|defautt|defantt)\s+(?:search|searcl|senrch|saarc?h|s3arch)\b.*$/i, '')
  s = s.replace(/\s+\b(?:search|searcl|senrch|saarch|s3arch)\b.*$/i, '')
  s = s.replace(/\s+\b(?:command|option|delete|delele|default)\b.*$/i, '')
  s = s.replace(/\s{2,}/g, ' ').trim()
  return s
}

/** False positive when an optional `(?:each of…)?` is skipped and `(.+)` eats the phrase itself. */
function isOnlyEachOfTheFollowingPhrase(s: string): boolean {
  return /^each\s+of\s+the\s+following\.?$/.test(s.trim().toLowerCase())
}

/**
 * "Contains 2% or less of …" / "2% and less of each of the following" introduces a sub-list on labels;
 * comma-split often yields the header alone as a fake ingredient.
 */
function stripMinorIngredientListPreamble(token: string): string {
  const t = token.trim()
  if (!t) return t
  const withContains = t.match(
    /^contains?\s+(?:less\s+than\s+)?\d+\s*%\s*(?:and\s+|or\s+)?less\s+of\s*(?:each\s+of\s+the\s+following\s*)?\s*(.+)$/i
  )
  if (withContains?.[1]) {
    const inner = sanitizeIngredientToken(withContains[1].trim().replace(/^:+\s*/, ''))
    if (inner.length >= 2 && !isOnlyEachOfTheFollowingPhrase(inner)) return inner
  }
  const pctFirst = t.match(
    /^\d+\s*%\s*(?:and\s+|or\s+)?less\s+of\s*(?:each\s+of\s+the\s+following\s*)?\s*(.+)$/i
  )
  if (pctFirst?.[1]) {
    const inner = sanitizeIngredientToken(pctFirst[1].trim().replace(/^:+\s*/, ''))
    if (inner.length >= 2 && !isOnlyEachOfTheFollowingPhrase(inner)) return inner
  }
  return t
}

/** Trailing allergen crumbs sometimes split as separate "tokens" (e.g. ". contient: blé"). */
function isJunkIngredientFragment(token: string): boolean {
  const t = token.trim().toLowerCase()
  if (!t) return true
  if (/^\.?\s*contient\s*:?/.test(t)) return true
  // Short "Contains: allergen" crumbs — avoid matching "Contains 2% or less of …" (minor-ingredient list).
  if (/^contains\s*:\s*(?!\d)/.test(t) && t.length < 40) return true
  // Standalone minor-ingredient list headers (no actual substance after the phrase)
  if (
    /^contains?\s+(?:less\s+than\s+)?\d+\s*%\s*(?:and\s+|or\s+)?less\s+of\s*(?:each\s+of\s+the\s+following)?\s*$/i.test(
      t
    )
  ) {
    return true
  }
  if (/^\d+\s*%\s*(?:and\s+|or\s+)?less\s+of\s*(?:each\s+of\s+the\s+following)?\s*$/i.test(t)) return true
  if (/^contains?\s+less\s+than\s+\d+\s*%\s*(?:of\s*)?(?:each\s+of\s+the\s+following)?\s*$/i.test(t)) return true
  if (/^moins\s+de\s+\d+\s*%\s*(?:de\s*)?(?:chacun\s+des\s+)?(?:éléments?\s+)?(?:suivants?)?\s*$/i.test(t))
    return true
  if (/^each\s+of\s+the\s+following\.?$/i.test(t)) return true
  return false
}

/**
 * ML Kit often omits commas between ingredients and glues bilingual blocks ("…Paprika.Ingrédients :…", "4Ingrédients").
 * Insert lightweight separators before comma-based chunking so we do not ship one mega-ingredient to decode.
 */
export function expandOcrIngredientSeparators(blob: string): string {
  let s = blob.trim()
  if (!s) return s
  // Stray digit glued to French header (common OCR): "4Ingrédients :" → "4, Ingrédients :"
  s = s.replace(/(\d)(?=ingr[ée]dients\s*:)/gi, '$1, ')
  // Start French duplicate list on its own segment
  s = s.replace(/\s+(?=ingr[ée]dients\s*:)/gi, ', ')
  // Bullets / middle dots used as inline separators on labels
  s = s.replace(/\s*[•·]\s*/g, ', ')
  // Period between a lowercase word and a capitalized next token ("acid. Paprika")
  s = s.replace(/(?<=[a-zàâäéèêëïîôùûüç])\.(\s+)(?=[A-Z][a-z])/g, ',$1')
  // Fused tokens without space ("moutardeSel", "cassonadeMiel")
  s = s.replace(/([a-zàâäéèêëïîôùûüç])([A-Z][a-z])/g, '$1, $2')

  // French duplicate adds commas — count commas on the English lead only so we still split "Vinegar Water…".
  const frIdx = s.search(/\bingr[ée]dients\s*:/i)
  const enLead = frIdx === -1 ? s : s.slice(0, frIdx).trim()
  const frTail = frIdx === -1 ? '' : s.slice(frIdx).trim()
  const commaCountEn = (enLead.match(/,/g) ?? []).length
  let en = enLead
  if (en.length > 55 && commaCountEn <= 3) {
    en = en.replace(/(?<=[a-zàâäéèêëïîôùûüç]{2,})\s+(?=[A-Z][a-z]{2,}\b)/g, ', ')
    en = en.replace(
      /\b(disodium|trisodium|sodium|potassium|calcium|magnesium|zinc|ferrous|ferric)\s*,\s*([a-z]{3,})\b/gi,
      '$1 $2'
    )
    en = en.replace(/,\s*\b(and|or)\s*,/gi, ' $1 ')
  }
  s = [en, frTail].filter(Boolean).join(' ')

  s = s.replace(/,\s*,+/g, ',')
  return s.replace(/\s+/g, ' ').trim()
}

/** Split on comma/semicolon only outside `(...)` / `[...]` so oil-source sub-lists stay on one line. */
export function splitIngredientBlobOutsideParens(blob: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < blob.length; i++) {
    const c = blob[i]
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth = Math.max(0, depth - 1)
    else if ((c === ',' || c === ';') && depth === 0) {
      parts.push(blob.slice(start, i))
      start = i + 1
    }
  }
  parts.push(blob.slice(start))
  return parts
}

/** Bare seed names split out of oil parentheticals — not useful as standalone decode rows. */
export function isOrphanOilSourceSeedToken(name: string): boolean {
  const t = name.trim().toLowerCase()
  if (!t || /\boil\b/.test(t)) return false
  return /^(soybean|cottonseed|rapeseed|canola|corn|palm|sunflower|safflower|peanut|grapeseed)$/.test(t)
}

/** Split on comma/semicolon, pick English segment per chunk, then dedupe. */
export function chunkIngredientBlobToEnglishNames(
  blob: string,
  dedupe: 'bilingual' | 'exact' | 'auto' = 'auto'
): string[] {
  const mode: 'bilingual' | 'exact' =
    dedupe === 'auto' ? (frenchLikelihood(blob) >= 2 ? 'bilingual' : 'exact') : dedupe
  const chunks = splitIngredientBlobOutsideParens(blob)
    .map((s) => sanitizeIngredientToken(s.trim().replace(/\.\s*$/, '')))
    .filter(Boolean)
  const picked = chunks
    .map((c) => sanitizeIngredientToken(englishPrimarySegment(c)))
    .filter(Boolean)
    .map((c) => stripMinorIngredientListPreamble(c))
    .filter(Boolean)
    .filter((c) => !isJunkIngredientFragment(c))
  return mode === 'exact' ? dedupeIngredientPartsExact(picked) : dedupeBilingualIngredientNames(picked)
}

/**
 * Single pipeline for ingredient cards: HTML strip → (OCR noise) → EN section slice → paren strip → chunk/dedupe.
 */
export function parseIngredientListFromPlain(
  ingredientsText: string,
  source: IngredientTextParseSource = 'barcode'
): string[] {
  if (!ingredientsText?.trim()) return []
  const htmlStripped = stripHtmlForIngredients(ingredientsText)

  if (source === 'ocr') {
    const ocrCleaned = cleanIngredientTextOCR(htmlStripped)
    const sliced = sliceToEnglishIngredientSection(ocrCleaned, { ocr: true })
    const stripped = prepareIngredientTextForAnalysis(sliced)
    const expanded = expandOcrIngredientSeparators(stripped)
    return chunkIngredientBlobToEnglishNames(expanded)
      .map(stripOcrUiTailFromIngredientToken)
      .map((name) => name.replace(/\s+(?:ch|cmd|opt|del|delele|delete)$/i, '').trim())
      .filter(isPlausibleIngredientToken)
      .filter((s) => !isJunkOcrIngredientToken(s))
      .filter((name) => !isBareAllergenDisclosureName(name))
  }

  const englishSliced = sliceToEnglishIngredientSection(htmlStripped, { ocr: false })
  const withoutPackagingTail = truncateIngredientBlobAtPackagingTail(englishSliced)
  const advisoryStripped = stripAllergenAdvisoryClausesFromBlob(withoutPackagingTail)
  const normalized = advisoryStripped.replace(/\s+/g, ' ').trim()
  return filterBareAllergenTokensFromParsedList(
    chunkIngredientBlobToEnglishNames(normalized, 'auto')
      .filter(isPlausibleIngredientToken)
      .filter((name) => !isOrphanOilSourceSeedToken(name))
  )
}

/**
 * English ingredient section for allergen/celiac matching — HTML strip + EN slice only.
 * Parentheses and sub-ingredient lists are kept (dual haystack “raw” side).
 */
export function extractEnglishIngredientHaystackForSafetyFromBlob(
  blob: string,
  source: IngredientTextParseSource = 'barcode'
): string {
  const htmlStripped = stripHtmlForIngredients(blob.trim())
  if (!htmlStripped) return ''
  if (source === 'ocr') {
    const ocrCleaned = cleanIngredientTextOCR(htmlStripped)
    return sliceToEnglishIngredientSection(ocrCleaned, { ocr: true }).trim()
  }
  return truncateIngredientBlobAtPackagingTail(sliceToEnglishIngredientSection(htmlStripped, { ocr: false })).trim()
}

export function extractEnglishIngredientHaystackForSafety(
  product: ProductFieldsForIngredientParse,
  source: IngredientTextParseSource = 'barcode'
): string {
  let text = stripHtmlForIngredients(product.ingredients_text_en || '')
  if (!text) text = stripHtmlForIngredients(product.ingredients_text || '')
  return extractEnglishIngredientHaystackForSafetyFromBlob(text, source)
}

export function extractEnglishIngredients(
  product: ProductFieldsForIngredientParse,
  source: IngredientTextParseSource = 'barcode'
): string {
  if (source === 'ocr') {
    return parseIngredientListFromPlain(product.ingredients_text ?? '', 'ocr').join(', ')
  }

  let text = stripHtmlForIngredients(product.ingredients_text_en || '')

  if (!text) {
    text = stripHtmlForIngredients(product.ingredients_text || '')
    text = sliceToEnglishIngredientSection(text, { ocr: false })
  }

  return chunkIngredientBlobToEnglishNames(
    prepareIngredientTextForAnalysis(truncateIngredientBlobAtPackagingTail(text))
  ).join(', ')
}

const MONTH_OR_YEAR_RE =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|\d{4})\b/i

function dedupeIngredientPartsExact(parts: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const k = normalizeText(p)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(p)
  }
  return out
}

export type CleanIngredientTextOptions = {
  /**
   * `bilingual` (default): collapse known EN/FR pairs and substring equivalence (good for raw label blobs).
   * `exact`: only drop exact-normalized duplicates — required for OFF structured trees so
   * "cottonseed vegetable oil" is not merged into "vegetable oil".
   */
  ingredientDedupe?: 'bilingual' | 'exact'
}

export function cleanIngredientText(text: string, options?: CleanIngredientTextOptions): string[] {
  if (!text?.trim()) return []
  const cleaned = text
    .replace(/®tm\s+used\s+under\s+license[^,]*/gi, '')
    .replace(/®|™|©/g, '')
    .replace(/[A-Z]\d[A-Z]\s*\d[A-Z]\d/g, '')
    .replace(/toronto[^,]*/gi, '')
    .replace(/canada[^,]*/gi, '')
    .replace(/best before[^,]*/gi, '')
    .replace(/meilleur avant[^,]*/gi, '')
    .replace(/best if used[^,]*/gi, '')
    .replace(/\d{4}\s+best/gi, '')
    .replace(/may contain[^,.]*/gi, '')
    .replace(/peut contenir[^,.]*/gi, '')
    .replace(/made in a facility[^,.]*/gi, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')

  const parts = cleaned
    .split(',')
    .map((i) => sanitizeIngredientToken(englishPrimarySegment(i.trim())))
    .filter((i) => {
      if (i.length < 3) return false
      if (/^\d+$/.test(i)) return false
      if (/\d+\s+\w+\s+(street|ave|blvd|road|dr)\b/i.test(i)) return false
      if (MONTH_OR_YEAR_RE.test(i)) return false
      if (/used under license/i.test(i)) return false
      if (/(limited|inc\.|ltd\.|bakeries|boulangeries)\b/i.test(i)) return false
      return true
    })
    .filter(Boolean)

  const mode = options?.ingredientDedupe ?? 'bilingual'
  return mode === 'exact' ? dedupeIngredientPartsExact(parts) : dedupeBilingualIngredientNames(parts)
}

/** Best-effort English for cross-contact lines often present in French on OFF. */
export function crossContactLineToEnglish(raw: string): string {
  let s = raw.trim()
  if (!s) return s
  s = s.replace(/^peut aussi contenir\s*:?\s*/i, 'May also contain ')
  s = s.replace(/^peut contenir\s*:?\s*/i, 'May contain ')
  s = s.replace(/^traces?\s+(de|d')\s*/i, 'Traces of ')
  s = s.replace(/^fabriqué(e)?\s+dans\s+une\s+installation/i, 'Made in a facility')
  s = s.replace(/^préparé(e)?\s+dans\s+une\s+installation/i, 'Prepared in a facility')
  return englishPrimarySegment(s) || s
}

export function extractCrossContactWarnings(product: ProductFieldsForIngredientParse): string[] {
  const text = (
    stripHtmlForIngredients(product.ingredients_text || '') +
    ' ' +
    stripHtmlForIngredients(typeof product.allergens === 'string' ? product.allergens : '')
  ).toLowerCase()

  const patterns = [
    /may contain[^.]+/gi,
    /peut contenir[^.]+/gi,
    /made in a facility[^.]+/gi,
    /traces of[^.]+/gi,
  ]

  const warnings: string[] = []
  for (const p of patterns) {
    const matches = text.match(p)
    if (matches) warnings.push(...matches.map((m) => m.trim()))
  }
  return [...new Set(warnings.map(crossContactLineToEnglish))]
}
