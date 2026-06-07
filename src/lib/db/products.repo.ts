import { eq, asc } from 'drizzle-orm'
import { db } from './client'
import { products, type ProductRow, type NewProductRow } from './schema'
import type { Product } from '../types'

const num = (v: string | null | undefined): number => (v == null ? 0 : Number(v))
const numOrNull = (v: string | null | undefined): number | null => (v == null ? null : Number(v))

/** Map a DB row to the Product shape used across the app. */
function toProduct(r: ProductRow): Product {
  return {
    id: r.id,
    handle: r.handle,
    title: r.title,
    description: r.description,
    type: r.type,
    tags: r.tags ?? [],
    price: num(r.price),
    compareAtPrice: num(r.compareAtPrice),
    sku: r.sku ?? '',
    image: r.image,
    status: (r.status === 'draft' ? 'draft' : 'active'),
    amazonUrl: r.amazonUrl ?? '',
    flipkartUrl: r.flipkartUrl ?? '',
    meeshoUrl: r.meeshoUrl ?? '',
    amazonSku: r.amazonSku,
    asin: r.asin,
    amazonStatus: r.amazonStatus,
    currentPrice: numOrNull(r.currentPrice),
    buyBoxPrice: numOrNull(r.buyBoxPrice),
    availableInventory: r.availableInventory,
    totalFees: numOrNull(r.totalFees),
    amazonLastChanged: r.amazonLastChanged,
    amazonSyncedAt: r.amazonSyncedAt ? r.amazonSyncedAt.toISOString() : null,
  }
}

/** Map an inbound Product (from admin forms) to DB columns. */
function toRow(p: Partial<Product>): Partial<NewProductRow> {
  const row: Partial<NewProductRow> = {}
  if (p.handle !== undefined) row.handle = p.handle
  if (p.title !== undefined) row.title = p.title
  if (p.description !== undefined) row.description = p.description
  if (p.type !== undefined) row.type = p.type
  if (p.tags !== undefined) row.tags = p.tags
  if (p.price !== undefined) row.price = String(p.price)
  if (p.compareAtPrice !== undefined) row.compareAtPrice = String(p.compareAtPrice)
  if (p.sku !== undefined) row.sku = p.sku
  if (p.image !== undefined) row.image = p.image
  if (p.status !== undefined) row.status = p.status
  if (p.amazonUrl !== undefined) row.amazonUrl = p.amazonUrl
  if (p.flipkartUrl !== undefined) row.flipkartUrl = p.flipkartUrl
  if (p.meeshoUrl !== undefined) row.meeshoUrl = p.meeshoUrl
  if (p.amazonSku !== undefined) row.amazonSku = p.amazonSku
  if (p.asin !== undefined) row.asin = p.asin
  return row
}

export async function getProducts(): Promise<Product[]> {
  const rows = await db.select().from(products).orderBy(asc(products.createdAt))
  return rows.map(toProduct)
}

export async function getProduct(handle: string): Promise<Product | undefined> {
  const rows = await db.select().from(products).where(eq(products.handle, handle)).limit(1)
  return rows[0] ? toProduct(rows[0]) : undefined
}

export async function createProduct(input: Omit<Product, 'id'>): Promise<Product> {
  const row = toRow(input) as NewProductRow
  const [created] = await db.insert(products).values(row).returning()
  return toProduct(created)
}

export async function updateProduct(handle: string, updates: Partial<Product>): Promise<Product | null> {
  const row = { ...toRow(updates), updatedAt: new Date() }
  const [updated] = await db
    .update(products)
    .set(row)
    .where(eq(products.handle, handle))
    .returning()
  return updated ? toProduct(updated) : null
}

export async function deleteProduct(handle: string): Promise<boolean> {
  const deleted = await db.delete(products).where(eq(products.handle, handle)).returning({ id: products.id })
  return deleted.length > 0
}
