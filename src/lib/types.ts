export interface Product {
  id: string
  handle: string
  title: string
  description: string
  type: string
  tags: string[]
  price: number
  compareAtPrice: number
  sku: string
  image: string
  status: 'active' | 'draft'
  amazonUrl?: string
  flipkartUrl?: string
  meeshoUrl?: string

  // Amazon listing link + last-synced snapshot (read-only on the site)
  amazonSku?: string | null
  asin?: string | null
  amazonStatus?: string | null
  currentPrice?: number | null
  buyBoxPrice?: number | null
  availableInventory?: string | null
  totalFees?: number | null
  amazonLastChanged?: string | null
  amazonSyncedAt?: string | null
}
