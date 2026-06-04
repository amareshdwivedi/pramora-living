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
}
