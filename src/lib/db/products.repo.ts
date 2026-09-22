import { eq, asc, inArray, and } from 'drizzle-orm'
import { del, list } from '@vercel/blob'
import { db } from './client'
import { products, type ProductRow, type NewProductRow } from './schema'
import type { Product } from '../types'
import { deleteProductImageBlobs, reconcileProductImageBlobs } from '../amazon/product-image-assets'

const num = (v: string | null | undefined): number => (v == null ? 0 : Number(v))
const numOrNull = (v: string | null | undefined): number | null => (v == null ? null : Number(v))

function storefrontImageUrl(url: string): string {
  if (!url || !url.includes('.blob.vercel-storage.com/')) return url
  return `/api/product-image?url=${encodeURIComponent(url)}`
}

function storedImageUrl(url: string): string {
  if (!url.startsWith('/api/product-image?url=')) return url
  try { return decodeURIComponent(url.slice('/api/product-image?url='.length)) } catch { return url }
}

/** Map a DB row to the Product shape used across the app. */
function toProduct(r: ProductRow): Product {
  const images = (r.images ?? []).filter(Boolean).map(storedImageUrl).map(storefrontImageUrl)
  const image = images[0] ?? storefrontImageUrl(storedImageUrl(r.image))

  return {
    id: r.id,
    handle: r.handle,
    title: r.title,
    description: r.description,
    aboutItem: r.aboutItem ?? [],
    type: r.type,
    tags: r.tags ?? [],
    price: num(r.price),
    compareAtPrice: num(r.compareAtPrice),
    sku: r.sku ?? '',
    image,
    images,
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
  if (p.aboutItem !== undefined) row.aboutItem = p.aboutItem
  if (p.type !== undefined) row.type = p.type
  if (p.tags !== undefined) row.tags = p.tags
  if (p.price !== undefined) row.price = String(p.price)
  if (p.compareAtPrice !== undefined) row.compareAtPrice = String(p.compareAtPrice)
  if (p.sku !== undefined) row.sku = p.sku
  if (p.images !== undefined) {
    const images = p.images.map(storedImageUrl).filter(Boolean)
    row.images = images
    if (p.image === undefined) row.image = images[0] ?? ''
  }
  if (p.image !== undefined) {
    row.image = storedImageUrl(p.image)
    if (p.images === undefined) row.images = row.image ? [row.image] : []
  }
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
  if (!updated) return null
  const result = toProduct(updated)
  if (updates.image !== undefined || updates.images !== undefined) {
    await reconcileProductImageBlobs(result, (row.images ?? []) as string[])
  }
  return result
}

/** Return the stored (not storefront proxy) image URLs for admin Blob operations. */
export async function getStoredProductImages(handle: string): Promise<{ image: string; images: string[] } | null> {
  const rows = await db.select({ image: products.image, images: products.images }).from(products).where(eq(products.handle, handle)).limit(1)
  if (!rows[0]) return null
  return { image: rows[0].image ?? '', images: (rows[0].images ?? []).filter(Boolean) }
}

/** Enforce the database as the source of truth for every product Blob. */
export async function reconcileAllStoredProductImages(): Promise<number> {
  const rows = await db.select({ image: products.image, images: products.images }).from(products)
  const keep = new Set(rows.flatMap(row => [row.image ?? '', ...(row.images ?? [])]).map(storedImageUrl).filter(url => url.includes('.blob.vercel-storage.com/')))
  const existing: string[] = []
  let cursor: string | undefined
  do {
    const page = await list({ prefix: 'product-images/', cursor, limit: 1000 })
    existing.push(...page.blobs.map(blob => blob.url))
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  const orphaned = existing.filter(url => !keep.has(url))
  for (let index = 0; index < orphaned.length; index += 1000) await del(orphaned.slice(index, index + 1000))
  return orphaned.length
}

export async function deleteProduct(handle: string): Promise<boolean> {
  const rows = await db.select().from(products).where(eq(products.handle, handle)).limit(1)
  const product = rows[0]
  if (!product) return false
  await deleteProductImageBlobs({ handle: product.handle, title: product.title, amazonSku: product.amazonSku, asin: product.asin })
  const deleted = await db.delete(products).where(eq(products.handle, handle)).returning({ id: products.id })
  if (deleted.length > 0) await reconcileAllStoredProductImages()
  return deleted.length > 0
}

export async function publishProducts(handles?: string[]): Promise<Product[]> {
  const filter = handles && handles.length > 0
    ? and(eq(products.status, 'draft'), inArray(products.handle, handles))
    : eq(products.status, 'draft')
  const rows = await db
    .update(products)
    .set({ status: 'active', updatedAt: new Date() })
    .where(filter)
    .returning()
  return rows.map(toProduct)
}

export async function publishAllProducts(): Promise<Product[]> {
  return publishProducts()
}
