// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type IngredientAnalysisRequest = {
  systemContent: string
  userContent: string
  model?: string
  temperature?: number
  maxTokens?: number
}

serve(async (req: Request) => {
  const requestId = crypto.randomUUID()
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  console.log(`[ingredient-analysis] ${requestId} start ${req.method}`)

  if (req.method !== 'POST') {
    console.warn(`[ingredient-analysis] ${requestId} rejected method ${req.method}`)
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim()
  if (!openaiKey) {
    console.error(`[ingredient-analysis] ${requestId} missing OPENAI_API_KEY`)
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  let body: IngredientAnalysisRequest
  try {
    body = (await req.json()) as IngredientAnalysisRequest
  } catch {
    console.warn(`[ingredient-analysis] ${requestId} invalid JSON body`)
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const systemContent = String(body.systemContent ?? '').trim()
  const userContent = String(body.userContent ?? '').trim()
  if (!systemContent || !userContent) {
    console.warn(`[ingredient-analysis] ${requestId} missing prompt content`)
    return new Response(JSON.stringify({ error: 'systemContent and userContent are required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const model = body.model?.trim() || 'gpt-4o-mini'
  const temperature = Number.isFinite(body.temperature) ? Number(body.temperature) : 0
  const max_tokens = Number.isFinite(body.maxTokens) ? Number(body.maxTokens) : 4096

  console.log(
    `[ingredient-analysis] ${requestId} openai request model=${model} max_tokens=${max_tokens} system_chars=${systemContent.length} user_chars=${userContent.length}`
  )

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 55_000)
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
        model,
        temperature,
        max_tokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent },
        ],
      }),
    })
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err ? String((err as Error).name) : ''
    const message = err instanceof Error ? err.message : String(err)
    const isTimeout = name === 'AbortError'
    console.error(
      `[ingredient-analysis] ${requestId} openai ${isTimeout ? 'timeout' : 'request_failed'}: ${message}`
    )
    return new Response(
      JSON.stringify({ error: isTimeout ? 'OpenAI request timed out' : 'OpenAI request failed' }),
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
    // passthrough non-JSON text
  }

  const messageContent =
    json && typeof json === 'object'
      ? String((json as any)?.choices?.[0]?.message?.content ?? '')
      : ''
  const finishReason =
    json && typeof json === 'object'
      ? String((json as any)?.choices?.[0]?.finish_reason ?? '')
      : ''
  let contentShape = 'missing'
  if (messageContent) {
    try {
      const parsedContent = JSON.parse(messageContent)
      const hasIngredients =
        typeof parsedContent?.productVerdict === 'string' && Array.isArray(parsedContent?.ingredients)
      const pa = parsedContent?.productAnalysis
      const hasProductDeep =
        typeof parsedContent?.productVerdict === 'string' &&
        pa &&
        typeof pa === 'object' &&
        (typeof pa.viralHook === 'string' || typeof pa.bottomLine === 'string')
      contentShape = hasIngredients
        ? `valid ingredients=${parsedContent.ingredients.length}`
        : hasProductDeep
          ? 'valid product_deep'
          : `invalid keys=${Object.keys(parsedContent ?? {}).join(',')}`
    } catch {
      contentShape = 'invalid_json'
    }
  }

  console.log(
    `[ingredient-analysis] ${requestId} openai response status=${upstream.status} finish_reason=${finishReason} body_chars=${text.length} content_chars=${messageContent.length} content_shape=${contentShape}`
  )

  return new Response(JSON.stringify(json ?? { raw: text.slice(0, 1000) }), {
    status: upstream.status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})
