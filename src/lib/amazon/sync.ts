import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { products, syncRuns, type ProductRow, type SyncChange, type FieldChange } from '../db/schema'
import type { AmazonRecord } from './types'

export interface SyncReport {
  runId: string
  source: string
  itemsCreated: number
  itemsUpdated: number
  itemsUnchanged: number
  changes: SyncChange[]
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '') || 'product'
}

function uniqueHandle(base: string, taken: Set<string>): string {
  let handle = base
  let n = 2
  while (taken.has(handle)) handle = `${base}-${n++}`
  taken.add(handle)
  return handle
}

const str = (v: unknown): string | null => (v == null ? null : String(v))
/** Compare two money values tolerant of "500" vs "500.00" string forms. */
const moneyEq = (a: number | null, b: string | null): boolean => {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return Number(a) === Number(b)
}

/**
 * Apply a batch of Amazon records to the catalog.
 *
 * - Matches existing products by amazonSku, then asin.
 * - Updates only Amazon-owned columns + the storefront price (Amazon is the
 *   price source of truth). Curated content (description, image, tags, title,
 *   compareAtPrice) is never touched.
 * - Unknown SKUs are created as drafts for the admin to enrich.
 * - Records a sync_runs row and returns a per-item diff report.
 */
export async function runSync(records: AmazonRecord[], source: 'csv' | 'sp-api'): Promise<SyncReport> {
  const existing = await db.select().from(products)
  const bySku = new Map<string, ProductRow>()
  const byAsin = new Map<string, ProductRow>()
  const handles = new Set<string>()
  for (const p of existing) {
    if (p.amazonSku) bySku.set(p.amazonSku, p)
    if (p.asin) byAsin.set(p.asin, p)
    handles.add(p.handle)
  }

  const now = new Date()
  const changes: SyncChange[] = []
  let created = 0
  let updated = 0
  let unchanged = 0

  for (const rec of records) {
    const match = bySku.get(rec.amazonSku) ?? (rec.asin ? byAsin.get(rec.asin) : undefined)

    // ---- existing product: refresh Amazon snapshot + storefront price ----
    if (match) {
      const fields: FieldChange[] = []

      if (!moneyEq(rec.currentPrice, match.price)) {
        fields.push({ field: 'price', before: str(match.price), after: str(rec.currentPrice) })
      }
      if ((rec.availableInventory ?? null) !== (match.availableInventory ?? null)) {
        fields.push({ field: 'inventory', before: match.availableInventory, after: rec.availableInventory })
      }
      if ((rec.status ?? null) !== (match.amazonStatus ?? null)) {
        fields.push({ field: 'status', before: match.amazonStatus, after: rec.status })
      }
      if ((rec.title ?? null) !== (match.amazonTitle ?? null)) {
        fields.push({ field: 'title', before: match.amazonTitle, after: rec.title })
      }

      await db
        .update(products)
        .set({
          amazonTitle: rec.title,
          amazonStatus: rec.status,
          currentPrice: str(rec.currentPrice),
          buyBoxPrice: str(rec.buyBoxPrice),
          availableInventory: rec.availableInventory,
          totalFees: str(rec.totalFees),
          amazonLastChanged: rec.lastChanged,
          amazonSyncedAt: now,
          // storefront price follows Amazon (only when Amazon has a price)
          ...(rec.currentPrice != null ? { price: str(rec.currentPrice)! } : {}),
          updatedAt: now,
        })
        .where(eq(products.id, match.id))

      if (fields.length > 0) {
        updated++
        changes.push({ amazonSku: rec.amazonSku, asin: rec.asin, handle: match.handle, title: rec.title, kind: 'updated', fields })
      } else {
        unchanged++
        changes.push({ amazonSku: rec.amazonSku, asin: rec.asin, handle: match.handle, title: rec.title, kind: 'unchanged', fields: [] })
      }
      continue
    }

    // ---- new listing: create a draft for the admin to enrich ----
    const handle = uniqueHandle(slugify(rec.title), handles)
    await db.insert(products).values({
      handle,
      sku: rec.amazonSku,
      amazonSku: rec.amazonSku,
      asin: rec.asin,
      title: rec.title,
      status: 'draft',
      price: str(rec.currentPrice) ?? '0',
      amazonTitle: rec.title,
      amazonStatus: rec.status,
      currentPrice: str(rec.currentPrice),
      buyBoxPrice: str(rec.buyBoxPrice),
      availableInventory: rec.availableInventory,
      totalFees: str(rec.totalFees),
      amazonLastChanged: rec.lastChanged,
      amazonSyncedAt: now,
    })
    created++
    changes.push({ amazonSku: rec.amazonSku, asin: rec.asin, handle, title: rec.title, kind: 'created', fields: [] })
  }

  const [run] = await db
    .insert(syncRuns)
    .values({
      source,
      startedAt: now,
      finishedAt: new Date(),
      itemsCreated: created,
      itemsUpdated: updated,
      itemsUnchanged: unchanged,
      changes,
    })
    .returning({ id: syncRuns.id })

  return { runId: run.id, source, itemsCreated: created, itemsUpdated: updated, itemsUnchanged: unchanged, changes }
}
