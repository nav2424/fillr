// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VISION_SYSTEM_PROMPT = `You are a food product identification expert. The user has taken a photo of a food product package.

Identify the product and return ONLY a JSON object with no markdown, no explanation, just raw JSON in this exact structure:

{
  "product_name": "",
  "brand": "",
  "variant": "",
  "confidence": 0.0,
  "ingredients": [],
  "nutrition_facts": {
    "serving_size": "",
    "calories": 0,
    "fat_g": 0,
    "saturated_fat_g": 0,
    "trans_fat_g": 0,
    "carbohydrates_g": 0,
    "fibre_g": 0,
    "sugars_g": 0,
    "protein_g": 0,
    "sodium_mg": 0
  },
  "allergens": [],
  "may_contain_allergens": [],
  "country_variant": ""
}

Set confidence based on how sure you are about the product name and brand visible in the photo. Do not increase confidence because you know or infer label details from memory.

When you identify a specific branded product and variant with confidence >= 0.7, return only label data that is visible and readable in this photo:

INGREDIENTS (critical):
- Return a FLAT "ingredients" array with every individual ingredient line item visible on the photographed label, in label order.
- Do NOT collapse seasoning blends, spice mixes, or "contains:" sub-lists into a single vague entry like "seasoning blend" unless you truly cannot name any sub-ingredients.
- Example: instead of ["Potatoes", "Vegetable oil", "Poutine seasoning blend"], return ["Potatoes", "Vegetable oil (canola, sunflower and/or corn oil)", "Salt", "Maltodextrin", "Cheese powder", "Buttermilk powder", "Whey powder", "Onion powder", "Garlic powder", "Yeast extract", "Natural flavours", "Spice extracts", "Lactic acid", "Citric acid"] only when those sub-ingredients are visible/readable on the photographed label.
- Include parenthetical oil types and sub-ingredients inside the string when that is how they appear on the label.
- If the ingredients panel is not visible/readable, return an empty "ingredients" array.

ALLERGENS:
- "allergens": confirmed contains allergens visible on the photographed label (e.g. "Milk ingredients", "Wheat").
- "may_contain_allergens": visible cross-contact / facility warnings (e.g. "Soy", "Wheat").
- If allergen statements are not visible/readable, return empty arrays.

NUTRITION:
- Populate "nutrition_facts" per serving only from a visible/readable nutrition facts panel (serving_size, calories, fat_g, saturated_fat_g, carbohydrates_g, fibre_g, sugars_g, protein_g, sodium_mg).
- If the nutrition panel is not visible/readable, leave nutrition fields empty/zero.

If you cannot identify the product name or brand with reasonable confidence, return confidence below 0.5 and leave other fields empty. Do not invent data for unbranded, homemade, or ambiguous products where the exact variant is unclear.`

type ProductVisionRequest = {
  imageBase64?: string
  mimeType?: string
}

serve(async (req: Request) => {
  const requestId = crypto.randomUUID()
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim()
  if (!openaiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  let body: ProductVisionRequest
  try {
    body = (await req.json()) as ProductVisionRequest
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const imageBase64 = String(body.imageBase64 ?? '').trim()
  if (!imageBase64) {
    return new Response(JSON.stringify({ error: 'imageBase64 is required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const mimeType = String(body.mimeType ?? 'image/jpeg').trim() || 'image/jpeg'
  const dataUrl = `data:${mimeType};base64,${imageBase64}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)

  let upstream: Response
  try {
    upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: VISION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Identify this packaged food product from the photo. Return ingredient, allergen, may-contain, and nutrition details only when those label panels are visible and readable in this photo. Do not use memory or published data for label details that are not visible.',
              },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
            ],
          },
        ],
      }),
    })
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err ? String((err as Error).name) : ''
    const isTimeout = name === 'AbortError'
    console.error(`[product-vision] ${requestId} ${isTimeout ? 'timeout' : 'failed'}`)
    return new Response(
      JSON.stringify({ error: isTimeout ? 'Vision request timed out' : 'Vision request failed' }),
      {
        status: isTimeout ? 504 : 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    )
  } finally {
    clearTimeout(timeout)
  }

  const text = await upstream.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // passthrough
  }

  return new Response(JSON.stringify(json ?? { raw: text.slice(0, 1000) }), {
    status: upstream.status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})
