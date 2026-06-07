import { config } from 'dotenv'
config({ path: '.env.local' })

import { readFileSync } from 'fs'
import path from 'path'
import type { NewProductRow } from '../src/lib/db/schema'

interface SeedProduct {
  handle: string
  title: string
  description: string
  type: string
  tags: string[]
  price: number
  compareAtPrice: number
  sku: string
  image: string
  status: string
  amazonUrl?: string
  flipkartUrl?: string
  meeshoUrl?: string
}

// One-time mapping: site handle → Amazon listing (SKU / ASIN), confirmed by title match.
const AMAZON_MAP: Record<string, { amazonSku: string; asin: string }> = {
  'golden-ganesha':          { amazonSku: '4T-3I81-V8IM', asin: 'B0H2ML547M' },
  'geometric-cat-duo':       { amazonSku: '7X-H6NO-7T6W', asin: 'B0H2MMV61N' },
  'black-deer-sculptures':   { amazonSku: 'XE-P0U1-T2S0', asin: 'B0H2MQ916N' },
  'royal-horse-family':      { amazonSku: 'Y6-G8SD-SWLB', asin: 'B0H2MS6B8Y' },
  'blue-owl-accent':         { amazonSku: 'ZU-WZ9W-U8QU', asin: 'B0H2LZ7QTQ' },
  'decorative-elephant-pair':{ amazonSku: 'QT-9DW5-JAW8', asin: 'B0GZF36JM2' },
  'hanging-elephant-set':    { amazonSku: 'JS-I6XR-LLNH', asin: 'B0GZF3MB97' },
  'abstract-face-art':       { amazonSku: 'KN-7DB3-1SMU', asin: 'B0GZDWPVDX' },
  'vintage-owl-tree':        { amazonSku: 'L3-WAET-EZJ5', asin: 'B0GZ7KRHPT' },
}

async function main() {
  // Imported dynamically so dotenv has loaded DATABASE_URL before the client initialises.
  const { db } = await import('../src/lib/db/client')
  const { products } = await import('../src/lib/db/schema')

  const dataPath = path.join(process.cwd(), 'src/data/products.json')
  const items: SeedProduct[] = JSON.parse(readFileSync(dataPath, 'utf-8'))

  console.log(`Seeding ${items.length} products into Neon…`)

  for (const p of items) {
    const map = AMAZON_MAP[p.handle]
    const row: NewProductRow = {
      handle: p.handle,
      title: p.title,
      description: p.description,
      type: p.type,
      tags: p.tags ?? [],
      price: String(p.price),
      compareAtPrice: String(p.compareAtPrice),
      sku: p.sku,
      image: p.image,
      status: p.status === 'draft' ? 'draft' : 'active',
      amazonUrl: p.amazonUrl ?? '',
      flipkartUrl: p.flipkartUrl ?? '',
      meeshoUrl: p.meeshoUrl ?? '',
      amazonSku: map?.amazonSku ?? null,
      asin: map?.asin ?? null,
    }

    await db
      .insert(products)
      .values(row)
      .onConflictDoUpdate({
        target: products.handle,
        // Re-running keeps curated content and refreshes the Amazon mapping keys.
        set: { amazonSku: row.amazonSku, asin: row.asin, updatedAt: new Date() },
      })

    console.log(`  ✓ ${p.handle}${map ? ` → ${map.amazonSku} / ${map.asin}` : ' (no Amazon link)'}`)
  }

  console.log('Done.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
