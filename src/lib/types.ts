export interface Product {
  id: string
  handle: string
  title: string
  description: string
  aboutItem: string[]
  type: string
  tags: string[]
  price: number
  compareAtPrice: number
  sku: string
  image: string
  images?: string[]
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

export interface HeroSlide {
  id: string
  productId: string
  imageUrl: string
  enabled: boolean
}

export interface SiteLayout {
  catalogOrder: string[]
  featuredOrder: string[]
  storyOrder: string[]
  heroSlides: HeroSlide[]
}
