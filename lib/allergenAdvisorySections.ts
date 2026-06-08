import { parseSections } from './allergenEngine/textParser'
import { stripHtmlForIngredients } from './ingredientTextParsing'

export type AllergenAdvisorySections = {
  contains_text: string
  may_contain_text: string
}

const EMPTY_ADVISORY_SECTIONS: AllergenAdvisorySections = {
  contains_text: '',
  may_contain_text: '',
}

function mergeTextParts(...parts: (string | undefined)[]): string {
  const seen = new Set<string>()
  const out: string[] = []

  for (const part of parts) {
    const text = String(part ?? '').trim()
    if (!text) continue
    for (const chunk of text.split(/[;.]\s*/)) {
      const trimmed = chunk.trim()
      const key = trimmed.toLowerCase()
      if (!trimmed || seen.has(key)) continue
      seen.add(key)
      out.push(trimmed)
    }
  }

  return out.join('. ')
}

export function mergeAllergenAdvisorySections(
  ...sections: (AllergenAdvisorySections | undefined | null)[]
): AllergenAdvisorySections {
  return {
    contains_text: mergeTextParts(...sections.map((section) => section?.contains_text)),
    may_contain_text: mergeTextParts(...sections.map((section) => section?.may_contain_text)),
  }
}

export function extractAllergenAdvisorySectionsFromBlob(
  rawText: string | undefined | null
): AllergenAdvisorySections {
  const text = stripHtmlForIngredients(String(rawText ?? ''))
  if (!text) return EMPTY_ADVISORY_SECTIONS

  const parsed = parseSections(text)
  return {
    contains_text: parsed.contains_text.trim(),
    may_contain_text: parsed.may_contain_text.trim(),
  }
}

export function extractAllergenAdvisorySectionsFromBlobs(
  ...rawTexts: (string | undefined | null)[]
): AllergenAdvisorySections {
  return mergeAllergenAdvisorySections(
    ...rawTexts.map((rawText) => extractAllergenAdvisorySectionsFromBlob(rawText))
  )
}
