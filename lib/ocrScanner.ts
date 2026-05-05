/**
 * Photo → OCR → ingredient list (on-device ML Kit + preprocessing).
 * Requires a dev build with @react-native-ml-kit/text-recognition linked (not Expo Go).
 */

import { Platform } from 'react-native'
import TextRecognition from '@react-native-ml-kit/text-recognition'
import type { Frame, TextBlock } from '@react-native-ml-kit/text-recognition'
import { parseIngredientListFromPlain } from './ingredientTextParsing'

const OCR_RESIZE_WIDTH = 2000
const OCR_RESIZE_WIDTH_VARIANTS = [OCR_RESIZE_WIDTH, 1700] as const
const ROI_PAD = 0.15
const ROI_PAD_VARIANTS = [ROI_PAD, 0.08, 0.24] as const
const OCR_HEADER_RE = /\b(l?ingredients?|ingrédients)\s*:/i
const OCR_NOISE_RE =
  /\b(nutrition facts|valeur nutritive|calories|kcal|% ?dv|daily value|serving|sodium|cholesterol)\b/gi
const MAX_CROP_ATTEMPTS = 3

type ImageManipulatorModule = typeof import('expo-image-manipulator')
type OcrCandidate = {
  rawText: string
  ingredientsText: string | null
  ingredients: string[]
  usedCroppedSecondPass: boolean
  candidateScore: number
  qualityPenalty: number
  resizeWidth: number
  roiPad: number | null
}

async function loadImageManipulator(): Promise<ImageManipulatorModule> {
  try {
    return await import('expo-image-manipulator')
  } catch {
    throw new Error('expo_image_manipulator_unavailable')
  }
}

/**
 * Block selection for ROI crop — scores use **text content only** (ML Kit `frame` is not part of the score).
 * Tier order: explicit EN/FR list headers with colon → softer headers → word "ingredients" in head → length.
 * Bilingual labels: prefer blocks where `ingredients:` / `ingrédients:` appears early; nutrition panels are
 * demoted when they look like Nutrition Facts but lack an ingredient header in the same window.
 */
const PRIMARY_INGREDIENT_COLON: RegExp[] = [
  /\bingredients\s*:/i,
  /\blngredients\s*:/i,
  /\bingrédients\s*:/i,
]

/** Weaker signals — still content-based, not box size. */
const SECONDARY_LIST_HEADER: RegExp[] = [
  /(?:^|[\n\r])\s*contains\s*:/i,
  /(?:^|[\n\r])\s*ingredients\s+(?=[\wÀ-ÿ"'(\[])/i,
]

const NUTRITION_PANEL_HEAD = new RegExp(
  [
    'nutrition\\s+facts',
    'valeur\\s+nutritive',
    'nutritions?\\s*(facts|information)',
    '\\bdaily\\s+value\\b',
    'valeurs?\\s+quotidiennes?',
    '\\bamount\\s+per\\s+serving',
    '\\bper\\s+\\d',
  ].join('|'),
  'i'
)

const MAX_LENGTH_FALLBACK_SCORE = 9_999

export type OcrExtractResult =
  | {
      success: true
      ingredients: string[]
      rawText: string
      ingredientsText: string
      confidence: OcrConfidenceSummary
      telemetry: OcrTelemetrySummary
    }
  | {
      success: false
      error: string
      rawText?: string
      confidence?: OcrConfidenceSummary
      telemetry?: OcrTelemetrySummary
    }

export type OcrConfidenceLevel = 'high' | 'medium' | 'low'

export type OcrConfidenceSummary = {
  score: number
  level: OcrConfidenceLevel
  reasons: string[]
  guidance: string[]
  usedCroppedSecondPass: boolean
}

export type OcrTelemetrySummary = {
  candidateCount: number
  selectedResizeWidth: number | null
  selectedRoiPad: number | null
  selectedBaseScore: number
  selectedQualityPenalty: number
  selectedFinalScore: number
  usedCroppedSecondPass: boolean
}

export function isOcrSupportedOnDevice(): boolean {
  if (Platform.OS === 'web') return false
  return true
}

function firstPatternIndex(text: string, patterns: readonly RegExp[]): number {
  let best = -1
  for (const re of patterns) {
    const idx = text.search(re)
    if (idx !== -1 && (best === -1 || idx < best)) {
      best = idx
    }
  }
  return best
}

/**
 * Primary scorer: pattern match position in **text** (earlier `ingredients:` / `ingrédients:` wins).
 * Nutrition-only blocks are demoted when the start looks like a Nutrition Facts panel **and** there is
 * no `ingredients:` / `ingrédients:` anywhere in the block (same merged OCR blob can have NF then list).
 */
function scoreBlockForIngredients(block: TextBlock): number {
  const t = block.text
  const head = t.slice(0, 320)

  const primaryIdx = firstPatternIndex(t, PRIMARY_INGREDIENT_COLON)
  const secondaryIdx = firstPatternIndex(t, SECONDARY_LIST_HEADER)

  const nutritionLooksLikePanel = NUTRITION_PANEL_HEAD.test(head)
  const hasPrimaryColonAnywhere = primaryIdx >= 0

  if (nutritionLooksLikePanel && !hasPrimaryColonAnywhere) {
    return Math.min(t.length, MAX_LENGTH_FALLBACK_SCORE)
  }

  if (primaryIdx >= 0) {
    const posPenalty = Math.min(primaryIdx, 490_000)
    const tieMicro = Math.min(t.length, 50_000) / 1_000_000
    return 50_000_000 - posPenalty + tieMicro
  }

  if (secondaryIdx >= 0) {
    return 5_000_000 - Math.min(secondaryIdx, 4_900_000) + Math.min(t.length, 20_000) / 2_000_000
  }

  const ingWordInHead = head.search(/\bingredients\b/i)
  if (ingWordInHead !== -1) {
    return 400_000 - Math.min(ingWordInHead, 300_000)
  }

  const frWordInHead = head.search(/\bingrédients\b/i)
  if (frWordInHead !== -1) {
    return 350_000 - Math.min(frWordInHead, 300_000)
  }

  return Math.min(t.length, MAX_LENGTH_FALLBACK_SCORE)
}

function pickBestIngredientsBlock(blocks: TextBlock[]): TextBlock | null {
  if (!blocks.length) return null
  let best = blocks[0]!
  let bestScore = scoreBlockForIngredients(best)
  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i]!
    const s = scoreBlockForIngredients(b)
    if (s > bestScore) {
      bestScore = s
      best = b
    }
  }
  return best
}

function paddedCropRect(
  frame: Frame,
  imageWidth: number,
  imageHeight: number,
  padFraction: number
): { originX: number; originY: number; width: number; height: number } | null {
  const { left, top, width, height } = frame
  const padX = width * padFraction
  const padY = height * padFraction
  let x1 = left - padX
  let y1 = top - padY
  let x2 = left + width + padX
  let y2 = top + height + padY
  x1 = Math.max(0, x1)
  y1 = Math.max(0, y1)
  x2 = Math.min(imageWidth, x2)
  y2 = Math.min(imageHeight, y2)
  const w = Math.round(x2 - x1)
  const h = Math.round(y2 - y1)
  if (w < 16 || h < 16) return null
  return { originX: Math.round(x1), originY: Math.round(y1), width: w, height: h }
}

function rawTextFromRecognition(result: { text?: string; blocks?: { text: string }[] }): string {
  const fromText = (result.text && result.text.trim()) || ''
  if (fromText) return fromText
  return (result.blocks?.map((b) => b.text).join(' ') ?? '').trim()
}

function clamp(min: number, n: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function scoreCandidate(rawText: string, ingredientsText: string | null, ingredientsCount: number): number {
  let score = 0
  if (OCR_HEADER_RE.test(rawText)) score += 120
  if (ingredientsText) score += 140
  score += Math.min(ingredientsCount * 12, 180)
  score += Math.min(rawText.length, 4000) / 120
  score += Math.min((ingredientsText?.length ?? 0), 2000) / 30
  const noiseHits = (rawText.match(OCR_NOISE_RE) ?? []).length
  score -= Math.min(noiseHits * 8, 80)
  return score
}

function computeQualityPenalty(rawText: string, ingredientsText: string | null, ingredientsCount: number): number {
  let penalty = 0
  const compact = rawText.replace(/\s+/g, '')
  const totalChars = compact.length
  if (totalChars < 40) return 80

  // Penalize low token density: often indicates partial frame or blurry OCR.
  const tokens = (rawText.match(/[A-Za-zÀ-ÿ]{2,}/g) ?? []).length
  const tokenDensity = tokens / Math.max(totalChars / 20, 1)
  if (tokenDensity < 0.6) penalty += 28
  else if (tokenDensity < 0.9) penalty += 14

  // Penalize symbol-heavy output, common in glare/noisy captures.
  const symbolCount = (rawText.match(/[^A-Za-zÀ-ÿ0-9\s,().:%/-]/g) ?? []).length
  const symbolRatio = symbolCount / Math.max(rawText.length, 1)
  if (symbolRatio > 0.12) penalty += 24
  else if (symbolRatio > 0.08) penalty += 12

  // Penalize severe OCR jitter from repeated characters (e.g., "|||||" / "lllll").
  const repeatedRuns = (rawText.match(/([^\s])\1{4,}/g) ?? []).length
  penalty += Math.min(repeatedRuns * 10, 30)

  // Penalize when parseable ingredient yield is low for detected ingredient section.
  if (ingredientsText && ingredientsText.length > 40 && ingredientsCount < 3) {
    penalty += 22
  }

  // Penalize nutrition-heavy captures when we failed to isolate ingredient body.
  const noiseHits = (rawText.match(OCR_NOISE_RE) ?? []).length
  if (!ingredientsText && noiseHits >= 5) {
    penalty += 20
  }

  return penalty
}

function buildOcrConfidenceSummary(args: {
  rawText: string
  ingredientsText: string
  ingredientCount: number
  usedCroppedSecondPass: boolean
}): OcrConfidenceSummary {
  const { rawText, ingredientsText, ingredientCount, usedCroppedSecondPass } = args
  let score = 100
  const reasons: string[] = []
  const guidance = new Set<string>()

  const noiseHits = (rawText.match(OCR_NOISE_RE) ?? []).length
  const hasHeader = OCR_HEADER_RE.test(rawText)

  if (!hasHeader) {
    score -= 18
    reasons.push("Could not clearly detect an 'INGREDIENTS:' header.")
    guidance.add('Center the INGREDIENTS header in frame.')
  }
  if (ingredientCount < 3) {
    score -= 34
    reasons.push('Very few ingredients were parsed.')
    guidance.add('Move closer to the label.')
  } else if (ingredientCount < 6) {
    score -= 16
    reasons.push('Ingredient list looks partial.')
  }
  if (rawText.length < 120 || ingredientsText.length < 70) {
    score -= 20
    reasons.push('Detected text is shorter than expected for a full ingredients panel.')
    guidance.add('Move closer to the label.')
  }
  if (noiseHits >= 8) {
    score -= 24
    reasons.push('OCR captured nutrition-panel noise, likely from glare or framing.')
    guidance.add('Reduce glare.')
  } else if (noiseHits >= 4) {
    score -= 12
    reasons.push('OCR includes some non-ingredient panel text.')
  }
  if (!usedCroppedSecondPass) {
    score -= 6
  }

  const bounded = clamp(0, Math.round(score), 100)
  const level: OcrConfidenceLevel = bounded >= 75 ? 'high' : bounded >= 45 ? 'medium' : 'low'
  if (level === 'low' && guidance.size === 0) {
    guidance.add('Move closer to the label.')
  }
  if (level === 'low' && noiseHits > 0) {
    guidance.add('Reduce glare.')
  }
  if (level === 'low' && !hasHeader) {
    guidance.add('Center the INGREDIENTS header in frame.')
  }

  return {
    score: bounded,
    level,
    reasons,
    guidance: Array.from(guidance),
    usedCroppedSecondPass,
  }
}

export async function extractIngredientsFromPhoto(photoUri: string): Promise<OcrExtractResult> {
  if (Platform.OS === 'web') {
    return { success: false, error: 'not_supported' }
  }
  try {
    const ImageManipulator = await loadImageManipulator()
    const candidates: OcrCandidate[] = []

    const pushCandidate = (
      rawText: string,
      usedCroppedSecondPass: boolean,
      resizeWidth: number,
      roiPad: number | null
    ) => {
      const t = rawText.trim()
      if (!t) return
      const ingredientsText = extractIngredientsSection(t)
      const ingredients = parseIngredientListFromPlain(ingredientsText ?? '', 'ocr')
      const baseScore = scoreCandidate(t, ingredientsText, ingredients.length)
      const qualityPenalty = computeQualityPenalty(t, ingredientsText, ingredients.length)
      candidates.push({
        rawText: t,
        ingredientsText,
        ingredients,
        usedCroppedSecondPass,
        candidateScore: baseScore - qualityPenalty,
        qualityPenalty,
        resizeWidth,
        roiPad,
      })
    }

    for (const width of OCR_RESIZE_WIDTH_VARIANTS) {
      const processed = await ImageManipulator.manipulateAsync(
        photoUri,
        [{ resize: { width } }],
        {
          format: ImageManipulator.SaveFormat.PNG,
        }
      )
      const firstPass = await TextRecognition.recognize(processed.uri)
      pushCandidate(rawTextFromRecognition(firstPass), false, width, null)

      try {
        const blocks = firstPass.blocks ?? []
        const scored = blocks
          .map((b) => ({ block: b, score: scoreBlockForIngredients(b) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_CROP_ATTEMPTS)
        for (const { block } of scored) {
          const frame = block.frame
          if (!frame || processed.width <= 0 || processed.height <= 0) continue
          for (const padVariant of ROI_PAD_VARIANTS) {
            const crop = paddedCropRect(frame, processed.width, processed.height, padVariant)
            if (!crop) continue
            const cropped = await ImageManipulator.manipulateAsync(processed.uri, [{ crop }], {
              format: ImageManipulator.SaveFormat.PNG,
            })
            const pass = await TextRecognition.recognize(cropped.uri)
            pushCandidate(rawTextFromRecognition(pass), true, width, padVariant)
          }
        }
      } catch {
        // Crop attempts are best-effort.
      }
    }

    const best = candidates.sort((a, b) => b.candidateScore - a.candidateScore)[0]
    const telemetry: OcrTelemetrySummary = {
      candidateCount: candidates.length,
      selectedResizeWidth: best?.resizeWidth ?? null,
      selectedRoiPad: best?.roiPad ?? null,
      selectedBaseScore: (best?.candidateScore ?? 0) + (best?.qualityPenalty ?? 0),
      selectedQualityPenalty: best?.qualityPenalty ?? 0,
      selectedFinalScore: best?.candidateScore ?? 0,
      usedCroppedSecondPass: best?.usedCroppedSecondPass ?? false,
    }
    const chosenText = best?.rawText ?? ''
    if (!chosenText) {
      return {
        success: false,
        error: 'empty_ocr',
        rawText: '',
        telemetry,
        confidence: {
          score: 0,
          level: 'low',
          reasons: ['No text was detected in the captured image.'],
          guidance: ['Move closer to the label.', 'Reduce glare.', 'Center the INGREDIENTS header in frame.'],
          usedCroppedSecondPass: false,
        },
      }
    }

    const ingredientsText = best?.ingredientsText ?? extractIngredientsSection(chosenText)
    const ingredients = best?.ingredients ?? parseIngredientListFromPlain(ingredientsText ?? '', 'ocr')
    const ingredientCount = ingredients.length
    const confidence = buildOcrConfidenceSummary({
      rawText: chosenText,
      ingredientsText: ingredientsText ?? '',
      ingredientCount,
      usedCroppedSecondPass: best?.usedCroppedSecondPass ?? false,
    })
    if (!ingredientsText) {
      return { success: false, error: 'no_ingredients_found', rawText: chosenText, confidence, telemetry }
    }

    return {
      success: true,
      ingredients,
      rawText: chosenText,
      ingredientsText,
      confidence,
      telemetry,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, error: msg || 'ocr_failed' }
  }
}

function extractIngredientsSection(rawText: string): string | null {
  const startPatterns = [
    /ingredients\s*:/i,
    /lngredients\s*:/i,
    /ingredients\s+/i,
    /ingrédients\s*:/i,
    /contains\s*:/i,
  ]

  const endPatterns = [
    /contains\s+\d+%\s+or\s+less/i,
    /manufactured\s+by/i,
    /distributed\s+by/i,
    /import(?:é|ed)\s+par/i,
    /imported\s+by/i,
    /if\s+you\s+are\s+not\s+completely\s+satisfied/i,
    /not\s+completely\s+satisfied/i,
    /veuillez\s+composer/i,
    /please\s+call/i,
    /hain[\s-]celestial/i,
    /nutrition\s+facts/i,
    /valeur\s+nutritive/i,
    /best\s+before/i,
    /keep\s+refrigerated/i,
    /allergen\s+information/i,
    /\d+\s*calories/i,
    /\b800[-.\s]?\d{3}/i,
  ]

  let startIndex = -1
  let startPattern: RegExp | null = null

  for (const pattern of startPatterns) {
    const match = rawText.search(pattern)
    if (match !== -1 && (startIndex === -1 || match < startIndex)) {
      startIndex = match
      startPattern = pattern
    }
  }

  if (startIndex === -1) {
    return rawText.length > 20 ? rawText.trim() : null
  }

  let afterLabel = rawText.substring(startIndex)
  if (startPattern) {
    afterLabel = afterLabel.replace(startPattern, '').trim()
  }

  let endIndex = afterLabel.length
  for (const pattern of endPatterns) {
    const match = afterLabel.search(pattern)
    if (match !== -1 && match < endIndex) {
      endIndex = match
    }
  }

  const section = afterLabel.substring(0, endIndex).trim()
  return section.length > 0 ? section : null
}

