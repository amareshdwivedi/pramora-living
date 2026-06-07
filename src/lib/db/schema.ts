import { pgTable, uuid, text, numeric, date, timestamp, integer, jsonb } from 'drizzle-orm/pg-core'

/**
 * products
 *
 * Two clearly-separated groups of columns:
 *   - AMAZON-OWNED  → overwritten by every Amazon sync (price, inventory, status…)
 *   - PRAMORA-CURATED → hand-written content the sync must NEVER touch
 *
 * Matching keys: amazon_sku / asin link a row to its Amazon listing,
 * handle is the site URL slug.
 */
export const products = pgTable('products', {
  // identity / matching keys
  id: uuid('id').primaryKey().defaultRandom(),
  handle: text('handle').notNull().unique(),          // URL slug, e.g. "golden-ganesha"
  amazonSku: text('amazon_sku').unique(),             // e.g. "4T-3I81-V8IM"
  asin: text('asin').unique(),                        // e.g. "B0H2ML547M"

  // ---- AMAZON-OWNED (overwritten by sync) ----
  amazonTitle: text('amazon_title'),
  amazonStatus: text('amazon_status'),                // "Active" / "Inactive"
  currentPrice: numeric('current_price', { precision: 10, scale: 2 }),
  buyBoxPrice: numeric('buy_box_price', { precision: 10, scale: 2 }),
  availableInventory: text('available_inventory'),    // raw, e.g. "2 (FBM)"
  totalFees: numeric('total_fees', { precision: 10, scale: 2 }),
  amazonLastChanged: date('amazon_last_changed'),
  amazonSyncedAt: timestamp('amazon_synced_at', { withTimezone: true }),

  // ---- PRAMORA-CURATED (never touched by sync) ----
  sku: text('sku'),                                   // legacy/display SKU, e.g. "PL-001"
  title: text('title').notNull(),                     // display title
  description: text('description').notNull().default(''),
  type: text('type').notNull().default(''),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  price: numeric('price', { precision: 10, scale: 2 }).notNull().default('0'),
  compareAtPrice: numeric('compare_at_price', { precision: 10, scale: 2 }).notNull().default('0'),
  image: text('image').notNull().default(''),
  status: text('status').notNull().default('active'),  // site visibility: active | draft
  amazonUrl: text('amazon_url').default(''),
  flipkartUrl: text('flipkart_url').default(''),
  meeshoUrl: text('meesho_url').default(''),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * sync_runs — history of every Amazon sync, powers the "what changed" UI.
 * `changes` holds the per-item diff produced by the sync.
 */
export const syncRuns = pgTable('sync_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: text('source').notNull(),                  // "csv" | "sp-api"
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  itemsCreated: integer('items_created').notNull().default(0),
  itemsUpdated: integer('items_updated').notNull().default(0),
  itemsUnchanged: integer('items_unchanged').notNull().default(0),
  changes: jsonb('changes').$type<SyncChange[]>().notNull().default([]),
})

export type ProductRow = typeof products.$inferSelect
export type NewProductRow = typeof products.$inferInsert
export type SyncRunRow = typeof syncRuns.$inferSelect

/** A single field change recorded during a sync (before → after). */
export interface SyncChange {
  amazonSku: string
  asin: string | null
  title: string
  kind: 'created' | 'price' | 'inventory' | 'status' | 'unchanged'
  field?: string
  before?: string | null
  after?: string | null
}
