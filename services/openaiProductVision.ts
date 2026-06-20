import * as FileSystem from 'expo-file-system/legacy'
import type { VisionProductIdentification } from '../types'
import { normalizeVisionProductIdentification } from '../lib/visionProductParse'
import { supabase } from '../lib/supabase'

export {
  normalizeVisionProductIdentification,
  visionDisplayName,
  visionIngredientsText,
  visionMeetsConfidenceThreshold,
  VISION_CONFIDENCE_THRESHOLD as CONFIDENCE_THRESHOLD,
} from '../lib/visionProductParse'

const VISION_TIMEOUT_MS = 45_000

type OpenAiChatResponse = {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

function stripJsonFence(raw: string): string {
  const t = raw.trim()
  if (t.startsWith('```')) {
    return t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  }
  return t
}

function parseIdentificationFromOpenAiResponse(json: OpenAiChatResponse | null): VisionProductIdentification | null {
  const content = json?.choices?.[0]?.message?.content
  if (!content?.trim()) return null
  try {
    return normalizeVisionProductIdentification(JSON.parse(stripJsonFence(content)))
  } catch {
    return null
  }
}

async function requestVisionIdentificationOnce(
  imageBase64: string,
  mimeType: string
): Promise<{ identification: VisionProductIdentification | null; error: string | null }> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!supabaseUrl || !supabaseAnonKey) {
    return { identification: null, error: 'Supabase is not configured' }
  }
  const session = (await supabase.auth.getSession()).data.session
  const accessToken = session?.access_token?.trim()
  if (!accessToken) {
    return { identification: null, error: 'Sign in to use photo identification' }
  }

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS)
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/product-vision`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ imageBase64, mimeType }),
    })

    const json = (await res.json().catch(() => null)) as OpenAiChatResponse | { error?: string } | null
    if (!res.ok) {
      const msg =
        json && typeof json === 'object' && 'error' in json && json.error
          ? String(json.error)
          : `Vision API error (${res.status})`
      return { identification: null, error: msg }
    }

    const identification = parseIdentificationFromOpenAiResponse(json as OpenAiChatResponse)
    if (!identification) {
      return { identification: null, error: 'invalid_json' }
    }
    return { identification, error: null }
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    if (name === 'AbortError') {
      return { identification: null, error: 'timeout' }
    }
    return {
      identification: null,
      error: err instanceof Error ? err.message : 'Vision request failed',
    }
  } finally {
    clearTimeout(t)
  }
}


export async function identifyProductFromPhotoBase64(
  imageBase64: string,
  mimeType = 'image/jpeg'
): Promise<
  | { ok: true; identification: VisionProductIdentification }
  | { ok: false; error: 'invalid_json' | 'timeout' | 'network' | 'config'; message: string }
> {
  const base64 = imageBase64.trim()
  if (!base64) {
    return { ok: false, error: 'network', message: 'Could not read the photo.' }
  }

  let lastError = 'Could not identify this product.'
  for (let attempt = 0; attempt < 2; attempt++) {
    const { identification, error } = await requestVisionIdentificationOnce(base64, mimeType)
    if (identification) {
      return { ok: true, identification }
    }
    if (error === 'invalid_json' && attempt === 0) continue
    if (error === 'timeout') {
      return { ok: false, error: 'timeout', message: 'Identification timed out. Try again with better lighting.' }
    }
    if (error === 'invalid_json') {
      return { ok: false, error: 'invalid_json', message: 'Could not read the product details. Try another way.' }
    }
    lastError = error ?? lastError
  }

  return { ok: false, error: 'network', message: lastError }
}

export async function identifyProductFromPhotoUri(
  photoUri: string
): Promise<
  | { ok: true; identification: VisionProductIdentification }
  | { ok: false; error: 'invalid_json' | 'timeout' | 'network' | 'config'; message: string }
> {
  let base64: string
  try {
    base64 = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    })
  } catch {
    return { ok: false, error: 'network', message: 'Could not read the photo.' }
  }

  const mimeType = photoUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
  return identifyProductFromPhotoBase64(base64, mimeType)
}
