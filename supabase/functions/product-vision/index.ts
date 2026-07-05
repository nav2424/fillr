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

Set confidence based on how sure you are about the product name and brand visible in the photo — not on whether ingredients are visible (the front of the package usually does not show them). If you can read a clear product name or brand, confidence should usually be 0.7 or higher.

When you identify a specific branded product and variant with confidence >= 0.7, return label data only when it is readable in the provided photo:

INGREDIENTS (critical):
- Return a FLAT "ingredients" array only from ingredient text that is visible/readable in the image.
- Do NOT infer ingredients from brand, package front, product memory, typical formulas, or marketing claims.
- Do NOT collapse seasoning blends, spice mixes, or "contains:" sub-lists into a single vague entry when readable sub-ingredients are visible.
- Include parenthetical oil types and sub-ingredients inside the string when they are readable on the label.
- If the ingredients panel is not visible or readable, return an empty ingredients array.

ALLERGENS:
- "allergens": confirmed contains allergens only when a contains/allergen statement is readable.
- "may_contain_allergens": cross-contact / facility warnings only when readable.
- If allergen statements are not visible/readable, return empty arrays.

NUTRITION:
- Populate "nutrition_facts" per serving only from a readable nutrition facts panel in the photo.
- If the nutrition panel is not visible/readable, leave numeric fields 0 and serving_size empty.

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
                text: 'Identify this packaged food product from the photo. Return ingredients, nutrition_facts, allergens, and may_contain_allergens only when those label panels are visible and readable in this image. If the back-of-pack label is not visible, leave those arrays empty and nutrition values at 0.',
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
