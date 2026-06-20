// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_IMAGE_BASE64_CHARS = 6_500_000

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

When you identify a specific branded product and variant with confidence >= 0.7, return the fullest published label data you know for that exact SKU:

INGREDIENTS (critical):
- Return a FLAT "ingredients" array with every individual ingredient line item in typical label order.
- Do NOT collapse seasoning blends, spice mixes, or "contains:" sub-lists into a single vague entry like "seasoning blend" unless you truly cannot name any sub-ingredients.
- Example: instead of ["Potatoes", "Vegetable oil", "Poutine seasoning blend"], return ["Potatoes", "Vegetable oil (canola, sunflower and/or corn oil)", "Salt", "Maltodextrin", "Cheese powder", "Buttermilk powder", "Whey powder", "Onion powder", "Garlic powder", "Yeast extract", "Natural flavours", "Spice extracts", "Lactic acid", "Citric acid"] when that is the known formula.
- Include parenthetical oil types and sub-ingredients inside the string when that is how they appear on the label.

ALLERGENS:
- "allergens": confirmed contains allergens (e.g. "Milk ingredients", "Wheat").
- "may_contain_allergens": cross-contact / facility warnings (e.g. "Soy", "Wheat").

NUTRITION:
- Populate "nutrition_facts" per serving when known (serving_size, calories, fat_g, saturated_fat_g, carbohydrates_g, fibre_g, sugars_g, protein_g, sodium_mg).
- Use realistic published values for the identified regional variant (country_variant: US, Canada, etc.).

If you cannot identify the product name or brand with reasonable confidence, return confidence below 0.5 and leave other fields empty. Do not invent data for unbranded, homemade, or ambiguous products where the exact variant is unclear.`

type ProductVisionRequest = {
  imageBase64?: string
  mimeType?: string
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function bearerToken(req: Request): string {
  const header = req.headers.get('authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() ?? ''
}

async function requireAuthenticatedUser(req: Request): Promise<{ token: string } | Response> {
  const token = bearerToken(req)
  if (!token) return jsonResponse({ error: 'Authentication required' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'Supabase auth is not configured' }, 500)
  }

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
  }).catch(() => null)

  if (!userRes?.ok) return jsonResponse({ error: 'Authentication required' }, 401)
  return { token }
}

async function consumeVisionScanCredit(token: string): Promise<Response | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'Supabase quota is not configured' }, 500)
  }

  const quotaRes = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_vision_scan_credit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  }).catch(() => null)

  if (!quotaRes) return jsonResponse({ error: 'Could not verify scan availability' }, 503)

  const quotaJson = await quotaRes.json().catch(() => null)
  if (!quotaRes.ok) {
    console.error('[product-vision] quota check failed', quotaJson)
    return jsonResponse({ error: 'Could not verify scan availability' }, 503)
  }

  const row = Array.isArray(quotaJson) ? quotaJson[0] : quotaJson
  if (!row?.allowed) {
    return jsonResponse({ error: 'No scans available', reason: row?.reason ?? 'scan_limit_reached' }, 402)
  }

  return null
}

serve(async (req: Request) => {
  const requestId = crypto.randomUUID()
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim()
  if (!openaiKey) {
    return jsonResponse({ error: 'OPENAI_API_KEY is not configured' }, 500)
  }

  const auth = await requireAuthenticatedUser(req)
  if (auth instanceof Response) return auth

  let body: ProductVisionRequest
  try {
    body = (await req.json()) as ProductVisionRequest
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const imageBase64 = String(body.imageBase64 ?? '').trim()
  if (!imageBase64) {
    return jsonResponse({ error: 'imageBase64 is required' }, 400)
  }
  if (imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
    return jsonResponse({ error: 'Image is too large' }, 413)
  }

  const mimeType = String(body.mimeType ?? 'image/jpeg').trim() || 'image/jpeg'
  if (!/^image\/(?:jpeg|jpg|png|webp)$/i.test(mimeType)) {
    return jsonResponse({ error: 'Unsupported image type' }, 400)
  }

  const quotaError = await consumeVisionScanCredit(auth.token)
  if (quotaError) return quotaError

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
                text: 'Identify this packaged food product from the photo. Return the complete flat ingredient list (every sub-ingredient you know), per-serving nutrition_facts, allergens, and may_contain_allergens for this exact product SKU — even when the back-of-pack label is not visible in the photo.',
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
    return jsonResponse({ error: isTimeout ? 'Vision request timed out' : 'Vision request failed' }, isTimeout ? 504 : 502)
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
