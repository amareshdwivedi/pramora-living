import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { publishAllProducts } from '@/lib/products'
import { isAdminRequest } from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const published = await publishAllProducts()

  revalidatePath('/')
  revalidatePath('/products')
  for (const product of published) revalidatePath(`/products/${product.handle}`)

  return NextResponse.json({
    published: published.length,
    affected: published.map(product => ({
      handle: product.handle,
      title: product.title,
      image: product.image,
    })),
    message: published.length > 0
      ? `Published ${published.length} product(s).`
      : 'No draft products to publish.',
  })
}
