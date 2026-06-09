const UNTRUSTED_SHARED_PRODUCT_SOURCE_RE = /(?:backfilled|photo_ocr|manual_entry|\bocr\b|\bmanual\b|\buser\b)/i

/**
 * Shared barcode cache rows can affect other users' allergen verdicts, so only
 * sources populated from trusted product feeds are safe to reuse globally.
 */
export function isTrustedSharedProductSource(sourceLabel: unknown): boolean {
  const source = typeof sourceLabel === 'string' ? sourceLabel.trim() : ''
  if (!source) return false
  if (UNTRUSTED_SHARED_PRODUCT_SOURCE_RE.test(source)) return false
  return /openfoodfacts/i.test(source)
}
