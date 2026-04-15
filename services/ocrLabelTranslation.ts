/**
 * French-only OCR labels: translate to English once before allergen + card pipeline.
 * Uses the same Supabase edge function as ingredient analysis (JSON mode).
 */

import { stripHtmlForIngredients } from '../lib/ingredientTextParsing'

export function shouldTranslateFrenchOnlyIngredientLabel(raw: string): boolean {
  const t = stripHtmlForIngredients(raw)
  if (t.length < 12) return false
  const hasFrench = /\b(ingrédients|ingrédient|contient|contiennent|sucre|farine|huile|préparé|préparée|naturel|naturelle|arôme|arome)\b/i.test(
    t
  )
  const hasEnglish = /\b(ingredients|contains|sugar|flour|oil)\b/i.test(t)
  return hasFrench && !hasEnglish
}

type TranslationResponse = {
  choices?: Array<{ message?: { content?: string } }>
}

/**
 * Returns English ingredient list text, or null if the call fails.
 */
export async function translateIngredientLabelToEnglish(frenchText: string): Promise<string | null> {
  const trimmed = frenchText.trim()
  if (!trimmed) return null

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!supabaseUrl || !supabaseAnonKey) return null

  const systemContent = `You translate food label ingredient lists into English. Return ONLY valid JSON with shape {"translated": string}. Preserve commas and structure; translate ingredient names only. No commentary.`

  const userContent = `Translate this label text to English (ingredient list). Keep the same separators (commas/semicolons) and order.

Text:
${trimmed}`

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/ingredient-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        maxTokens: 1200,
        systemContent,
        userContent,
      }),
    })

    if (!res.ok) return null
    const data = (await res.json()) as TranslationResponse
    const text = data?.choices?.[0]?.message?.content
    if (!text || typeof text !== 'string') return null

    let parsed: { translated?: string }
    try {
      parsed = JSON.parse(text) as { translated?: string }
    } catch {
      return null
    }
    const out = typeof parsed.translated === 'string' ? parsed.translated.trim() : ''
    return out.length > 0 ? out : null
  } catch {
    return null
  }
}
