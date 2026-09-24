import { config } from 'dotenv'
config({ path: '.env.local' })

import type { ProductReview } from '../src/lib/types'

const NAMES = [
  'Aarav Mehta', 'Kavita Sharma', 'Rohan Iyer', 'Ananya Desai',
  'Vikram Nair', 'Priya Kulkarni', 'Arjun Reddy', 'Meera Joshi',
  'Aditya Menon', 'Neha Kapoor', 'Rahul Banerjee', 'Pooja Shah',
  'Karan Malhotra', 'Divya Krishnan', 'Sanjay Patel', 'Isha Chatterjee',
]

function subjectFor(title: string): string {
  const name = title.toLowerCase()
  if (name.includes('tray')) return 'serving tray'
  if (name.includes('jewellery') || name.includes('jewelry')) return 'jewellery box'
  if (name.includes('masala') || name.includes('spice box')) return 'spice box'
  if (name.includes('holder') || name.includes('organizer') || name.includes('organiser')) return 'organiser'
  return 'decor piece'
}

function makeReviews(title: string, index: number): ProductReview[] {
  const subject = subjectFor(title)
  const texts = [
    `The ${subject} has a lovely finish and looks even better in person. It fits beautifully into our home. Very happy with the purchase.`,
    `I chose this for our home and really like the craftsmanship. The ${subject} feels thoughtfully made and looks just as pictured. The packing was secure as well.`,
    `Such a charming addition to our space! The ${subject} adds a warm, handcrafted touch without looking overdone. Our guests noticed it straight away.`,
    `Beautifully finished and useful too. The ${subject} sits perfectly in our home and has already become a conversation starter. I would happily gift one.`,
  ]
  return texts.map((text, offset): ProductReview => ({
    id: `sample-${index + 1}-${offset + 1}`,
    name: NAMES[(index * 4 + offset) % NAMES.length],
    rating: 5,
    text,
    source: 'illustrative',
  }))
}

async function main() {
  const { db } = await import('../src/lib/db/client')
  const { products } = await import('../src/lib/db/schema')
  const { sql } = await import('drizzle-orm')

  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS reviews jsonb NOT NULL DEFAULT '[]'::jsonb`)
  const rows = await db.select({ handle: products.handle, title: products.title, reviews: products.reviews }).from(products).orderBy(products.createdAt)
  let seeded = 0
  for (const [index, product] of rows.entries()) {
    if (product.reviews.length > 0) continue
    await db.update(products)
      .set({ reviews: makeReviews(product.title, index), updatedAt: new Date() })
      .where(sql`${products.handle} = ${product.handle}`)
    seeded += 1
  }
  console.log(`Stored four illustrative 5-star reviews for ${seeded} inventory items; preserved existing reviews on ${rows.length - seeded}.`)
  process.exit(0)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
