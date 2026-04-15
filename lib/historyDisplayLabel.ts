import { formatProductTitle } from './formatProductTitle'
import type { ScanIngredientSource } from '../types'

export const DEFAULT_OCR_PRODUCT_NAME = 'Scanned Product'

function formatDateSnippet(raw: string): string {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** List / home row title for a history entry. */
export function formatHistoryListTitle(
  productName: string,
  date: string,
  source?: ScanIngredientSource
): string {
  const n = productName?.trim() ?? ''
  if (source === 'ocr' && (!n || n === DEFAULT_OCR_PRODUCT_NAME)) {
    return `Photographed product · ${formatDateSnippet(date)}`
  }
  return formatProductTitle(n || 'Product')
}
