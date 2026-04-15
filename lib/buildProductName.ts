import { toTitleCase } from './formatProductTitle'
import { englishPrimarySegment } from './bilingualDisplay'

export interface ProductFieldsForDisplayName {
  brands?: string
  product_name_en?: string
  product_name?: string
  product_name_fr?: string
}

function deduplicateProductName(name: string): string {
  if (!name) return name
  const words = name.trim().split(/\s+/).filter(Boolean)
  const half = Math.floor(words.length / 2)
  if (words.length >= 4 && half > 0) {
    const firstHalf = words
      .slice(0, half)
      .join(' ')
      .toLowerCase()
    const secondHalf = words
      .slice(half)
      .join(' ')
      .toLowerCase()
    if (
      firstHalf === secondHalf ||
      secondHalf.includes(firstHalf) ||
      firstHalf.includes(secondHalf)
    ) {
      return words.slice(half).join(' ')
    }
  }
  return name
}

export function buildProductName(product: ProductFieldsForDisplayName): string {
  const rawBrand = (product.brands || '').split(',')[0].trim()
  const brand = englishPrimarySegment(rawBrand)
  const rawName = (
    product.product_name_en ||
    product.product_name ||
    product.product_name_fr ||
    ''
  ).trim()
  const name = deduplicateProductName(englishPrimarySegment(rawName))

  if (name && brand && name.toLowerCase().includes(brand.toLowerCase())) {
    return toTitleCase(name)
  }

  if (brand && name) {
    return toTitleCase(`${brand} ${name}`)
  }

  return toTitleCase(name || brand || 'Unknown Product')
}
