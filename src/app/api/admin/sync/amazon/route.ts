import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { parseAmazonCsv } from '@/lib/amazon/csv'
import { runSync, type SyncReport } from '@/lib/amazon/sync'
import { getProducts, updateProduct } from '@/lib/products'
import { fetchAndStoreProductImages } from '@/lib/amazon/product-image-assets'
import { isAdminRequest } from '@/lib/admin-auth'

export const maxDuration = 300

type ProgressEvent = {
  type: 'start' | 'item' | 'complete' | 'error'
  total?: number; handle?: string; title?: string; amazonSku?: string; asin?: string | null
  stage?: 'record' | 'storefront'; status?: 'success' | 'error'; message?: string
  report?: SyncReport & { imagesUpdated: number; imagesFetched: number; imageFailures: number }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let csvText: string
  try {
    if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      const form = await req.formData(); const file = form.get('file')
      if (!(file instanceof File)) return NextResponse.json({ error: 'No CSV file uploaded.' }, { status: 400 })
      csvText = await file.text()
    } else csvText = await req.text()
  } catch { return NextResponse.json({ error: 'Could not read upload.' }, { status: 400 }) }
  if (!csvText.trim()) return NextResponse.json({ error: 'The CSV file is empty.' }, { status: 400 })

  let records
  try { records = parseAmazonCsv(csvText) } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to parse CSV.' }, { status: 400 }) }
  if (records.length === 0) return NextResponse.json({ error: 'No product rows found. Expected columns: SKU, ASIN, Product Title, Current Price…' }, { status: 400 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ProgressEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      try {
        send({ type: 'start', total: records.length })
        const report = await runSync(records, 'csv', async change => send({ type: 'item', stage: 'record', status: 'success', handle: change.handle, title: change.title, amazonSku: change.amazonSku, asin: change.asin }))
        const products = await getProducts()
        const byHandle = new Map(products.map(product => [product.handle, product]))
        const recordByIdentity = new Map(records.map(record => [`${record.amazonSku}|${record.asin ?? ''}`, record]))
        const queue = Array.from(new Map(report.changes.map(change => byHandle.get(change.handle)).filter(Boolean).map(product => [product!.handle, product!])).values())
        const imageResults: { handle: string; images: number; error?: string }[] = []

        const worker = async () => {
          while (queue.length > 0) {
            const product = queue.shift(); if (!product) return
            try {
              const record = recordByIdentity.get(`${product.amazonSku ?? ''}|${product.asin ?? ''}`)
              const result = await fetchAndStoreProductImages(product, record?.imageUrls ?? [])
              await updateProduct(product.handle, {
                ...(result.images[0] ? { image: result.images[0], images: result.images } : {}),
                ...(result.aboutItem.length > 0 ? { aboutItem: result.aboutItem } : {}),
              })
              imageResults.push({ handle: product.handle, images: result.images.length, ...(result.error ? { error: result.error } : {}) })
              send({ type: 'item', stage: 'storefront', status: result.images.length > 0 || result.aboutItem.length > 0 ? 'success' : 'error', handle: product.handle, title: product.title, amazonSku: product.amazonSku ?? undefined, asin: product.asin, ...(result.error ? { message: result.error } : {}) })
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Amazon storefront fetch failed'
              imageResults.push({ handle: product.handle, images: 0, error: message })
              send({ type: 'item', stage: 'storefront', status: 'error', handle: product.handle, title: product.title, amazonSku: product.amazonSku ?? undefined, asin: product.asin, message })
            }
          }
        }
        await Promise.all(Array.from({ length: Math.min(4, Math.max(1, queue.length)) }, () => worker()))
        revalidatePath('/'); revalidatePath('/products'); report.changes.forEach(change => revalidatePath(`/products/${change.handle}`))
        send({ type: 'complete', report: { ...report, imagesUpdated: imageResults.filter(result => result.images > 0).length, imagesFetched: imageResults.reduce((total, result) => total + result.images, 0), imageFailures: imageResults.filter(result => result.images === 0).length } })
      } catch (error) { send({ type: 'error', message: error instanceof Error ? error.message : 'Sync failed.' }) }
      finally { controller.close() }
    },
  })
  return new NextResponse(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform' } })
}
