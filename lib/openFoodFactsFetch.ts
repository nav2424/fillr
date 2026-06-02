/**
 * Open Food Facts API fetch with timeout and retries (first scan reliability).
 * OFF requires a custom User-Agent — generic clients are often blocked.
 * US UPC-A (12 digits) must be queried as EAN-13 with a leading 0.
 * @see https://openfoodfacts.github.io/openfoodfacts-server/api/
 */

export const OPEN_FOOD_FACTS_USER_AGENT = 'Fillr/1.2.0 (https://usefillr.com)'

export type OpenFoodFactsApiResponse = {
  status?: number
  product?: Record<string, unknown>
}

const OFF_FETCH_TIMEOUT_MS = 8000

/** Strip non-digits; expand 12-digit UPC-A to 13-digit EAN for OFF lookup. */
export function barcodeLookupCandidates(raw: string): string[] {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (!digits) return []
  const out: string[] = [digits]
  if (digits.length === 12) {
    const ean13 = `0${digits}`
    if (!out.includes(ean13)) out.push(ean13)
  }
  if (digits.length === 13 && digits.startsWith('0')) {
    const upc12 = digits.slice(1)
    if (upc12.length === 12 && !out.includes(upc12)) out.push(upc12)
  }
  return out
}

async function fetchOpenFoodFactsProductOnce(
  barcode: string,
  retries: number
): Promise<OpenFoodFactsApiResponse | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`
  let lastErr: unknown
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), OFF_FETCH_TIMEOUT_MS)
    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': OPEN_FOOD_FACTS_USER_AGENT,
          Accept: 'application/json',
        },
      })
      clearTimeout(timeout)
      if (!resp.ok) {
        if (i === retries - 1) return null
        await new Promise((r) => setTimeout(r, 500))
        continue
      }
      const data = (await resp.json().catch(() => null)) as OpenFoodFactsApiResponse | null
      if (!data || typeof data !== 'object') {
        if (i === retries - 1) return null
        await new Promise((r) => setTimeout(r, 500))
        continue
      }
      return data
    } catch (e) {
      clearTimeout(timeout)
      lastErr = e
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 500))
    }
  }
  if (lastErr) throw lastErr
  return null
}

export async function fetchOpenFoodFactsProduct(
  barcode: string,
  retries = 2
): Promise<OpenFoodFactsApiResponse | null> {
  const candidates = barcodeLookupCandidates(barcode)
  if (candidates.length === 0) return null

  let lastErr: unknown
  for (const candidate of candidates) {
    try {
      const data = await fetchOpenFoodFactsProductOnce(candidate, retries)
      if (data?.status === 1 && data.product) return data
      if (data?.status === 1) return data
    } catch (e) {
      lastErr = e
    }
  }

  // Last candidate response (often status 0 = not in database)
  try {
    const last = await fetchOpenFoodFactsProductOnce(candidates[candidates.length - 1], 1)
    if (last) return last
  } catch (e) {
    lastErr = e
  }

  if (lastErr) throw lastErr
  return { status: 0 }
}
