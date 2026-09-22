import type { Product } from '@/lib/types'

/** Add future categories here without changing the catalogue UI. */
export const PRODUCT_CATEGORY_DEFINITIONS = [
  { key: 'wooden', label: 'Wooden', description: 'Warm, handcrafted pieces with natural character.', matches: /wood|wooden|sheesham|mango|rosewood|tray|box|carved/i },
  { key: 'sculpture', label: 'Sculptures', description: 'Artful forms that make every room more expressive.', matches: /sculpture|sculptural|idol|figurine|statue|ganesha|elephant|horse|owl|deer|cat/i },
] as const

export type ProductCategoryKey = typeof PRODUCT_CATEGORY_DEFINITIONS[number]['key']

export function productCategory(product: Product): ProductCategoryKey {
  const haystack = [product.type, product.title, ...product.tags].join(' ')
  const match = PRODUCT_CATEGORY_DEFINITIONS.find(category => category.matches.test(haystack))
  return match?.key ?? 'sculpture'
}

export function categoryDefinition(key: ProductCategoryKey) {
  return PRODUCT_CATEGORY_DEFINITIONS.find(category => category.key === key) ?? PRODUCT_CATEGORY_DEFINITIONS[1]
}
