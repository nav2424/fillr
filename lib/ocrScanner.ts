/**
 * Photo → OCR → ingredient list (on-device ML Kit + preprocessing).
 * Requires a dev build with @react-native-ml-kit/text-recognition linked (not Expo Go).
 */

import { Platform } from 'react-native'
import * as ImageManipulator from 'expo-image-manipulator'
import TextRecognition from '@react-native-ml-kit/text-recognition'

export type OcrExtractResult =
  | {
      success: true
      ingredients: string[]
      rawText: string
      ingredientsText: string
    }
  | {
      success: false
      error: string
      rawText?: string
    }

export function isOcrSupportedOnDevice(): boolean {
  if (Platform.OS === 'web') return false
  return true
}

export async function extractIngredientsFromPhoto(photoUri: string): Promise<OcrExtractResult> {
  if (Platform.OS === 'web') {
    return { success: false, error: 'not_supported' }
  }
  try {
    const processed = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ resize: { width: 1500 } }],
      {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    )

    const result = await TextRecognition.recognize(processed.uri)
    const rawText =
      (result.text && result.text.trim()) ||
      (result.blocks?.map((b) => b.text).join(' ') ?? '').trim()

    if (!rawText) {
      return { success: false, error: 'empty_ocr', rawText: '' }
    }

    const ingredientsText = extractIngredientsSection(rawText)
    if (!ingredientsText) {
      return { success: false, error: 'no_ingredients_found', rawText }
    }

    const ingredients = cleanAndParseIngredients(ingredientsText)
    return {
      success: true,
      ingredients,
      rawText,
      ingredientsText,
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
    /nutrition\s+facts/i,
    /valeur\s+nutritive/i,
    /best\s+before/i,
    /keep\s+refrigerated/i,
    /allergen\s+information/i,
    /\d+\s*calories/i,
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

function cleanAndParseIngredients(text: string): string[] {
  return text
    .replace(/\/[^,\)]+/g, '')
    .replace(/®|™|©/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/contains\s+\d+%\s+or\s+less\s+of/gi, '')
    .replace(/\n+/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .split(',')
    .map((i) => i.trim())
    .filter((ingredient) => {
      if (!ingredient || ingredient.length < 2) return false
      if (/^\d+$/.test(ingredient)) return false
      if (/best before/i.test(ingredient)) return false
      if (/manufactured/i.test(ingredient)) return false
      if (/distributed/i.test(ingredient)) return false
      if (/toronto|canada|ontario/i.test(ingredient)) return false
      if (/[A-Z]\d[A-Z]\s*\d[A-Z]\d/.test(ingredient)) return false
      return true
    })
    .map((i) => i.charAt(0).toUpperCase() + i.slice(1).toLowerCase())
}
