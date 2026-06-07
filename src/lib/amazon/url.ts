import type { Product } from '../types'

/** India marketplace — prices are ₹ and SKUs/ASINs are Amazon.in. */
const AMAZON_MARKETPLACE = 'https://www.amazon.in'

/**
 * Resolve the public Amazon listing URL for a product:
 *   1. an explicit amazonUrl override, if set
 *   2. a deep link built from the ASIN
 *   3. null when the product isn't on Amazon (hide the button)
 */
export function amazonProductUrl(p: Pick<Product, 'amazonUrl' | 'asin'>): string | null {
  if (p.amazonUrl && p.amazonUrl.trim()) return p.amazonUrl.trim()
  if (p.asin && p.asin.trim()) return `${AMAZON_MARKETPLACE}/dp/${p.asin.trim()}`
  return null
}
