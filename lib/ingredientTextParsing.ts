/**
 * English-first ingredient extraction and cleaning for Open Food Facts / bilingual labels.
 */

import { englishPrimarySegment } from './bilingualDisplay'
import { dedupeBilingualIngredientNames } from './bilingualIngredients'
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
 * OCR-specific noise: misreads, nutrition crumbs, declarations, addresses.
 * Returns a single normalized string (commas will be filled in after newlines).
 */
export function cleanIngredientTextOCR(raw: string): string {
  let s = raw
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
  return false
}

function sanitizeIngredientToken(raw: string): string {
  return raw
    .trim()
    .replace(/^_|_$/g, '')
    .replace(/_/g, ' ')
    .replace(/[)]+$/g, '')
    .replace(/\*+$/g, '')
    .replace(/^\*+/g, '')
    .replace(/\(\d+\)$/g, '')
    .replace(/†$/g, '')
    .replace(/‡$/g, '')
    .trim()
}

/** Split on comma/semicolon, pick English segment per chunk, dedupe bilingual duplicates. */
export function chunkIngredientBlobToEnglishNames(blob: string): string[] {
  const chunks = blob
    .split(/[,;]/)
    .map((s) => sanitizeIngredientToken(s.trim().replace(/\.\s*$/, '')))
    .filter(Boolean)
  const picked = chunks.map((c) => sanitizeIngredientToken(englishPrimarySegment(c))).filter(Boolean)
  return dedupeBilingualIngredientNames(picked)
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
    return chunkIngredientBlobToEnglishNames(stripped)
      .filter(isPlausibleIngredientToken)
      .filter((s) => !isJunkOcrIngredientToken(s))
  }

  const englishSliced = sliceToEnglishIngredientSection(htmlStripped, { ocr: false })
  const stripped = prepareIngredientTextForAnalysis(englishSliced)
  return chunkIngredientBlobToEnglishNames(stripped).filter(isPlausibleIngredientToken)
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
  return sliceToEnglishIngredientSection(htmlStripped, { ocr: false }).trim()
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

  return chunkIngredientBlobToEnglishNames(prepareIngredientTextForAnalysis(text)).join(', ')
}

const MONTH_OR_YEAR_RE =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|\d{4})\b/i

export function cleanIngredientText(text: string): string[] {
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

  return dedupeBilingualIngredientNames(parts)
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
