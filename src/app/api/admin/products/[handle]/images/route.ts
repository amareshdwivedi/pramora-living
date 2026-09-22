import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { del, put } from '@vercel/blob'
import { getProduct, getStoredProductImages, updateProduct } from '@/lib/products'
import { productImageFolderName } from '@/lib/amazon/product-image-assets'
import { isAdminRequest } from '@/lib/admin-auth'

export const maxDuration = 300

const MAX_FILE_BYTES = 15 * 1024 * 1024
const MAX_IMAGES_PER_REQUEST = 20

function unwrapImageUrl(value: string): string {
  if (value.startsWith('/api/product-image?url=')) {
    try { return decodeURIComponent(value.slice('/api/product-image?url='.length)) } catch { return value }
  }
  return value
}

function isBlobUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname.endsWith('.blob.vercel-storage.com') && url.pathname.startsWith('/product-images/')
  } catch { return false }
}

function extensionForContentType(contentType: string): string {
  if (contentType.includes('png')) return '.png'
  if (contentType.includes('webp')) return '.webp'
  if (contentType.includes('avif')) return '.avif'
  return '.jpg'
}

async function readRemoteImage(rawUrl: string): Promise<{ body: Buffer; contentType: string } | null> {
  let url: URL
  try { url = new URL(rawUrl) } catch { return null }
  if (url.protocol !== 'https:' || /^(localhost|127\.|0\.0\.0\.0|::1)$/i.test(url.hostname)) return null
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { 'user-agent': 'Mozilla/5.0 PramoraLiving/1.0', accept: 'image/*' } })
  if (!response.ok) return null
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.startsWith('image/') || contentType.includes('gif')) return null
  const body = Buffer.from(await response.arrayBuffer())
  return body.length <= MAX_FILE_BYTES ? { body, contentType } : null
}

export async function POST(req: NextRequest, { params }: { params: { handle: string } }) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const product = await getProduct(params.handle)
  const stored = await getStoredProductImages(params.handle)
  if (!product || !stored) return NextResponse.json({ error: 'Product not found.' }, { status: 404 })

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'Could not read image upload.' }, { status: 400 }) }

  let remove: string[] = []
  try {
    const rawRemove = form.get('remove')
    const parsed = rawRemove ? JSON.parse(String(rawRemove)) : []
    remove = Array.isArray(parsed) ? parsed.map(value => unwrapImageUrl(String(value))).filter(Boolean) : []
  } catch { return NextResponse.json({ error: 'Invalid image removal list.' }, { status: 400 }) }

  const files = form.getAll('files').filter((value): value is File => value instanceof File)
  const rawUrls = form.get('urls')?.toString() ?? '[]'
  let requestedUrls: string[] = []
  try {
    const parsed = JSON.parse(rawUrls)
    requestedUrls = Array.isArray(parsed) ? parsed.map(value => String(value).trim()).filter(Boolean) : []
  } catch { return NextResponse.json({ error: 'Invalid image URL list.' }, { status: 400 }) }
  if (files.length + requestedUrls.length > MAX_IMAGES_PER_REQUEST) return NextResponse.json({ error: `Add up to ${MAX_IMAGES_PER_REQUEST} images per request.` }, { status: 400 })

  const current = [...new Set([stored.image, ...stored.images].filter(Boolean))]
  const removeSet = new Set(remove)
  const retained = current.filter(url => !removeSet.has(url))
  const removedBlobUrls = current.filter(url => removeSet.has(url) && isBlobUrl(url))
  const addedBlobUrls: string[] = []

  try {
    if (removedBlobUrls.length > 0) await del(removedBlobUrls)

    const prefix = `product-images/${productImageFolderName(product)}/`
    let index = 0
    for (const file of files) {
      if (!file.type.startsWith('image/') || file.type.includes('gif') || file.size > MAX_FILE_BYTES) continue
      const blob = await put(`${prefix}manual-${Date.now()}-${index++}${extensionForContentType(file.type)}`, Buffer.from(await file.arrayBuffer()), {
        access: 'private', addRandomSuffix: true, contentType: file.type, cacheControlMaxAge: 60 * 60 * 24 * 30,
      })
      addedBlobUrls.push(blob.url)
    }
    for (const rawUrl of requestedUrls) {
      const fetched = await readRemoteImage(rawUrl)
      if (!fetched) continue
      const blob = await put(`${prefix}manual-${Date.now()}-${index++}${extensionForContentType(fetched.contentType)}`, fetched.body, {
        access: 'private', addRandomSuffix: true, contentType: fetched.contentType, cacheControlMaxAge: 60 * 60 * 24 * 30,
      })
      addedBlobUrls.push(blob.url)
    }

    const images = [...retained, ...addedBlobUrls]
    const updated = await updateProduct(params.handle, { image: images[0] ?? '', images })
    if (!updated) throw new Error('Product was removed while updating images.')

    revalidatePath('/')
    revalidatePath('/products')
    revalidatePath(`/products/${params.handle}`)
    return NextResponse.json({ product: updated, removed: removedBlobUrls.length, added: addedBlobUrls.length })
  } catch (error) {
    if (addedBlobUrls.length > 0) await del(addedBlobUrls).catch(() => undefined)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Image update failed.' }, { status: 502 })
  }
}
