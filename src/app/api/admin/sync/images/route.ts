import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getProducts, updateProduct } from '@/lib/products'

export const maxDuration = 60

// Amazon P/{ASIN} URLs return a 1x1 GIF placeholder — they don't contain real images.
const BAD_URL_PATTERN = /m\.media-amazon\.com\/images\/P\//

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const all = await getProducts()

  // Clear previously stored bad Amazon placeholder URLs.
  const toClean = all.filter(p => p.image && BAD_URL_PATTERN.test(p.image))
  for (const p of toClean) {
    await updateProduct(p.handle, { image: '' })
  }

  revalidatePath('/')
  revalidatePath('/products')
  for (const p of toClean) revalidatePath(`/products/${p.handle}`)

  return NextResponse.json({
    cleaned: toClean.length,
    message: toClean.length > 0
      ? `Cleared ${toClean.length} broken placeholder image(s). To fetch real images, SP-API credentials are required — see the admin note.`
      : 'No broken images found.',
    affected: toClean.map(p => ({ handle: p.handle, title: p.title })),
  })
}
