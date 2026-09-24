import { config } from 'dotenv'
config({ path: '.env.local' })

import { randomInt } from 'node:crypto'
import type { ProductReview } from '../src/lib/types'

const NAMES = [
  'Siddharth Rao', 'Nisha Verma', 'Devika Pillai', 'Manav Sethi', 'Tanvi Deshmukh',
  'Kabir Anand', 'Sakshi Bhat', 'Ishaan Mukherjee', 'Ritu Arora', 'Nikhil Das',
  'Aditi Shetty', 'Varun Khanna', 'Sneha Ghosh', 'Harish Gowda', 'Maya Chawla',
  'Pranav Bose', 'Shreya Nambiar', 'Kunal Bansal', 'Anjali Rao', 'Gaurav Sood',
]

const REVIEW_TEXTS = [
  'The finish is lovely and it looks beautiful in our home. A thoughtful piece that feels special.',
  'Really nice craftsmanship and the details are even better up close. It has settled in perfectly with our decor.',
  'A lovely addition to our home. The design feels tasteful, and it was packed carefully for delivery.',
  'I like the warm, handcrafted look. It is just the right size for the space I had in mind, and family members have admired it.',
  'Good quality and a beautiful finish. It arrived safely and makes the room feel more welcoming.',
  'The product looks as pictured and feels well made. I am pleased with it and would consider it as a gift.',
  'Very pretty and nicely finished. It suits our home beautifully, though I would have liked a little more size detail on the listing.',
  'A charming design with good attention to detail. It looks lovely on display and was carefully packed.',
  'Happy with the purchase so far. The finish is neat and it brings a nice handcrafted touch to our space.',
  'Looks elegant and feels sturdy. The design is simple to style with other pieces, and delivery was smooth.',
]

function shuffled<T>(items: T[]): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1)
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}

async function main() {
  const { db } = await import('../src/lib/db/client')
  const { products } = await import('../src/lib/db/schema')
  const { eq } = await import('drizzle-orm')

  const rows = await db.select({ handle: products.handle, reviews: products.reviews }).from(products).orderBy(products.createdAt)
  let updated = 0
  let added = 0
  for (const product of rows) {
    const batchPrefix = `extra-${product.handle}-`
    if (product.reviews.some(review => review.id.startsWith(batchPrefix))) continue

    const namePool = shuffled(NAMES.filter(name => !product.reviews.some(review => review.name === name)))
    const count = randomInt(2, 6)
    const additions: ProductReview[] = Array.from({ length: count }, (_, index) => ({
      id: `${batchPrefix}${index + 1}`,
      name: namePool[index % namePool.length],
      rating: randomInt(3, 6) as ProductReview['rating'],
      text: REVIEW_TEXTS[randomInt(REVIEW_TEXTS.length)],
      source: 'illustrative',
    }))

    await db.update(products)
      .set({ reviews: [...product.reviews, ...additions], updatedAt: new Date() })
      .where(eq(products.handle, product.handle))
    updated += 1
    added += count
  }

  console.log(`Added ${added} illustrative reviews across ${updated} inventory items; existing reviews were preserved.`)
  process.exit(0)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
