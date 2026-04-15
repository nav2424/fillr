/**
 * Open Food Facts API fetch with timeout and retries (first scan reliability).
 */

export type OpenFoodFactsApiResponse = {
  status?: number
  product?: Record<string, unknown>
}

export async function fetchOpenFoodFactsProduct(
  barcode: string,
  retries = 2
): Promise<OpenFoodFactsApiResponse | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`
  let lastErr: unknown
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)
    try {
      const resp = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)
      if (!resp.ok) {
        if (i === retries - 1) return null
        await new Promise((r) => setTimeout(r, 1000))
        continue
      }
      const data = (await resp.json().catch(() => null)) as OpenFoodFactsApiResponse | null
      if (!data || typeof data !== 'object') {
        if (i === retries - 1) return null
        await new Promise((r) => setTimeout(r, 1000))
        continue
      }
      return data
    } catch (e) {
      clearTimeout(timeout)
      lastErr = e
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 1000))
    }
  }
  if (lastErr) throw lastErr
  return null
}
