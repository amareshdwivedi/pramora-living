import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getProducts, reconcileAllStoredProductImages, updateProduct } from '@/lib/products'
import { clearAllStoredProductImages, fetchAndStoreProductImages, reconcileProductImageBlobs } from '@/lib/amazon/product-image-assets'
import { isAdminRequest } from '@/lib/admin-auth'

export const maxDuration = 300

export async function DELETE(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const all = await getProducts()
  const removed = await clearAllStoredProductImages()
  await Promise.all(all.map(product => updateProduct(product.handle, { image: '', images: [] })))

  revalidatePath('/')
  revalidatePath('/products')
  all.forEach(product => revalidatePath(`/products/${product.handle}`))

  return NextResponse.json({
    products: all.length,
    foldersRemoved: removed,
    message: `Cleaned image galleries for ${all.length} product(s).`,
  })
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let requestedHandle: string | null = null
  if ((req.headers.get('content-type') ?? '').includes('application/json')) {
    const body = await req.json().catch(() => ({})) as { handle?: string }
    requestedHandle = body.handle?.trim() || null
  }

  const all = await getProducts()
  const selected = requestedHandle ? all.filter(product => product.handle === requestedHandle) : all
  if (requestedHandle && selected.length === 0) {
    return NextResponse.json({ error: 'Product not found.' }, { status: 404 })
  }

  const changed: { handle: string; title: string; image: string; images: string[]; source: 'amazon' }[] = []
  const failed: { handle: string; asin: string | null; error: string }[] = []
  const queue = [...selected]

  const worker = async () => {
    while (queue.length > 0) {
      const p = queue.shift()
      if (!p) return
      const result = await fetchAndStoreProductImages(p)

      if (result.aboutItem.length > 0 || result.images.length > 0) {
        const updated = await updateProduct(p.handle, {
          ...(result.images[0] ? { image: result.images[0], images: result.images } : {}),
          ...(result.aboutItem.length > 0 ? { aboutItem: result.aboutItem } : {}),
        })
        if (updated && result.images.length > 0) await reconcileProductImageBlobs(updated, result.images)
      }

      if (result.images.length === 0) {
        failed.push({
          handle: p.handle,
          asin: p.asin ?? null,
          error: result.error ?? 'No Amazon image URL was found for this ASIN/SKU',
        })
        continue
      }

      changed.push({ handle: p.handle, title: p.title, image: result.images[0], images: result.images, source: 'amazon' })
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, () => worker()))
  const orphaned = await reconcileAllStoredProductImages()

  revalidatePath('/')
  revalidatePath('/products')
  for (const p of changed) revalidatePath(`/products/${p.handle}`)

  return NextResponse.json({
    updated: changed.length,
    imagesFetched: changed.reduce((total, p) => total + p.images.length, 0),
    failed,
    message: [
      changed.length > 0
        ? `Fetched ${changed.reduce((total, p) => total + p.images.length, 0)} image(s) for ${changed.length} product(s).`
        : 'No product images were fetched.',
      failed.length > 0 ? `${failed.length} image fetch issue(s).` : '',
      orphaned > 0 ? `Removed ${orphaned} orphaned Blob image(s).` : '',
    ].filter(Boolean).join(' '),
    affected: changed,
  })
}
