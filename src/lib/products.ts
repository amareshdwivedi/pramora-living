import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import type { Product } from './types'

const DATA_PATH = path.join(process.cwd(), 'src/data/products.json')

export function getProducts(): Product[] {
  const raw = readFileSync(DATA_PATH, 'utf-8')
  return JSON.parse(raw)
}

export function getProduct(handle: string): Product | undefined {
  return getProducts().find(p => p.handle === handle)
}

export function saveProducts(products: Product[]): void {
  writeFileSync(DATA_PATH, JSON.stringify(products, null, 2))
}

export function createProduct(product: Omit<Product, 'id'>): Product {
  const products = getProducts()
  const newProduct: Product = { ...product, id: Date.now().toString() }
  products.push(newProduct)
  saveProducts(products)
  return newProduct
}

export function updateProduct(handle: string, updates: Partial<Product>): Product | null {
  const products = getProducts()
  const idx = products.findIndex(p => p.handle === handle)
  if (idx === -1) return null
  products[idx] = { ...products[idx], ...updates }
  saveProducts(products)
  return products[idx]
}

export function deleteProduct(handle: string): boolean {
  const products = getProducts()
  const idx = products.findIndex(p => p.handle === handle)
  if (idx === -1) return false
  products.splice(idx, 1)
  saveProducts(products)
  return true
}
