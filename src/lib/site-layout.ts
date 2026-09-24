import type { Product } from './types'

export function orderProducts(products: Product[], ids: string[]): Product[] {
  const rank = new Map(ids.map((id, index) => [id, index]))
  return [...products].sort((left, right) => (rank.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.id) ?? Number.MAX_SAFE_INTEGER))
}

export function selectedProducts(products: Product[], ids: string[], fallback: Product[], limit: number): Product[] {
  if (ids.length === 0) return fallback.slice(0, limit)
  const byId = new Map(products.map(product => [product.id, product]))
  return ids.map(id => byId.get(id)).filter((product): product is Product => Boolean(product)).slice(0, limit)
}
