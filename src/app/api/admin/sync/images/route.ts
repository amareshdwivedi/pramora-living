import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getProducts } from '@/lib/products'
import { updateProduct } from '@/lib/products'

export const maxDuration = 60

const candidates = (asin: string) => [
  `https://m.media-amazon.com/images/P/${asin}.01._SX450_.jpg`,
  `https://m.media-amazon.com/images/P/${asin}.01._SX300_.jpg`,
  `https://m.media-amazon.com/images/P/${asin}.jpg`,
  `https://images-na.ssl-images-amazon.com/images/P/${asin}.jpg`,
]

async function resolveImage(asin: string): Promise<string | null> {
  for (const url of candidates(asin)) {
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
      const ct = res.headers.get('content-type') ?? ''
      if (res.ok && ct.startsWith('image/')) return url
    } catch {
      // try next pattern
    }
  }
  return null
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const all = await getProducts()
  const targets = all.filter(p => p.asin && !p.image)

  const results: { handle: string; title: string; status: 'updated' | 'not_found' }[] = []
  let updated = 0

  for (const product of targets) {
    const url = await resolveImage(product.asin!)
    if (url) {
      await updateProduct(product.handle, { image: url })
      updated++
      results.push({ handle: product.handle, title: product.title, status: 'updated' })
    } else {
      results.push({ handle: product.handle, title: product.title, status: 'not_found' })
    }
  }

  revalidatePath('/')
  revalidatePath('/products')
  for (const r of results) revalidatePath(`/products/${r.handle}`)

  return NextResponse.json({
    updated,
    notFound: targets.length - updated,
    skipped: all.length - targets.length,
    results,
  })
}
