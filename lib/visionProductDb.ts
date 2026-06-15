import { supabase } from './supabase'
import type { VisionNutritionFacts, VisionProductIdentification } from '../types'

function supabaseConfigured(): boolean {
  return Boolean(
    (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim() &&
      (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
  )
}

export type CatalogProductMatch = {
  id: string
  name: string
  brand: string | null
  imageUrl: string | null
  ingredientText: string | null
}

export async function findCatalogProductMatch(
  name: string,
  brand: string
): Promise<CatalogProductMatch | null> {
  if (!supabaseConfigured()) return null
  const n = name.trim()
  if (!n) return null
  const b = brand.trim()

  let query = supabase
    .from('products')
    .select('id, name, brand, image_url, ingredient_text')
    .ilike('name', `%${n.slice(0, 80)}%`)
    .order('updated_at', { ascending: false })
    .limit(5)

  if (b) {
    query = query.ilike('brand', `%${b.slice(0, 60)}%`)
  }

  const { data, error } = await query
  if (error || !Array.isArray(data) || data.length === 0) return null

  const row = data.find((r) => r.image_url?.trim()) ?? data[0]
  return {
    id: String(row.id),
    name: String(row.name ?? n),
    brand: row.brand ? String(row.brand) : null,
    imageUrl: row.image_url ? String(row.image_url) : null,
    ingredientText: row.ingredient_text ? String(row.ingredient_text) : null,
  }
}

export async function searchCatalogProducts(queryText: string, limit = 8): Promise<CatalogProductMatch[]> {
  if (!supabaseConfigured()) return []
  const q = queryText.trim()
  if (q.length < 2) return []

  const pattern = `%${q.replace(/[%_]/g, '')}%`
  const { data, error } = await supabase
    .from('products')
    .select('id, name, brand, image_url, ingredient_text')
    .or(`name.ilike.${pattern},brand.ilike.${pattern}`)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error || !Array.isArray(data)) return []
  return data.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    brand: row.brand ? String(row.brand) : null,
    imageUrl: row.image_url ? String(row.image_url) : null,
    ingredientText: row.ingredient_text ? String(row.ingredient_text) : null,
  }))
}

function nutritionFactsToJson(facts: VisionNutritionFacts): Record<string, unknown> {
  return {
    fillr_vision_nutrition: facts,
  }
}

/** Insert vision-identified product when absent (barcode null). Returns remote product id. */
export async function upsertVisionIdentifiedProduct(
  identification: VisionProductIdentification,
  ingredientText: string
): Promise<string | null> {
  if (!supabaseConfigured()) return null
  const name = identification.product_name.trim() || 'Unknown product'
  const brand = identification.brand.trim() || null
  const ingredients = ingredientText.trim() || null

  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('source', 'gpt4o_vision')
    .ilike('name', name)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase
      .from('products')
      .update({
        brand,
        ingredient_text: ingredients,
        nutrition_json: nutritionFactsToJson(identification.nutrition_facts),
        vision_confidence: identification.confidence,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (error) {
      console.warn('[Fillr] vision product update failed:', error.message)
      return null
    }
    return String(existing.id)
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      barcode: null,
      name,
      brand,
      ingredient_text: ingredients,
      nutrition_json: nutritionFactsToJson(identification.nutrition_facts),
      source: 'gpt4o_vision',
      vision_confidence: identification.confidence,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle()

  if (error || !data?.id) {
    console.warn('[Fillr] vision product insert failed:', error?.message)
    return null
  }
  return String(data.id)
}
