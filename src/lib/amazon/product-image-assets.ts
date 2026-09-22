import { del, list, put } from '@vercel/blob'
import path from 'node:path'
import type { Product } from '@/lib/types'

type ImageCandidate = {
  url: string
  ext: string
  sourceUrl: string
}

export type ProductImageFetchResult = {
  handle: string
  asin: string | null | undefined
  amazonSku: string | null | undefined
  images: string[]
  aboutItem: string[]
  source: 'amazon' | 'missing'
  error?: string
}

const blobRoot = 'product-images/'

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '') || 'product'
}

export function productImageFolderName(product: Pick<Product, 'handle' | 'title' | 'amazonSku' | 'asin'>): string {
  const key = [product.amazonSku, product.asin].filter(Boolean).join('_') || product.handle
  return `${key}_${slugify(product.title || product.handle)}`
}

function blobPrefixForProduct(product: Pick<Product, 'handle' | 'title' | 'amazonSku' | 'asin'>): string {
  return `${blobRoot}${productImageFolderName(product)}/`
}

async function fetchImage(url: string): Promise<{ body: Buffer; contentType: string } | null> {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 PramoraLiving/1.0',
      accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
  })

  if (!res.ok) return null
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.startsWith('image/') || contentType.includes('gif')) return null
  return { body: Buffer.from(await res.arrayBuffer()), contentType }
}

function mediaFileNameFromUrl(url: string): string | null {
  try {
    const fileName = path.basename(new URL(url).pathname)
    const match = fileName.match(/^([0-9][A-Za-z0-9+_-]*)(?:\._[^.]+)?\.(jpe?g|png|webp)$/i)
    return match ? `${match[1]}.${match[2]}` : null
  } catch {
    return null
  }
}

function decodeHtmlText(value: string): string {
  return value
    .replace(/\\u003c/gi, '<')
    .replace(/\\u003e/gi, '>')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u0022/gi, '"')
    .replace(/\\u0027/gi, "'")
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\s+/g, ' ')
    .trim()
}

function parseAboutItem(html: string): string[] {
  const marker = /feature-bullets(?:_feature_div)?|id\s*=\s*["']feature-bullets["']/i.exec(html)
  const section = marker ? html.slice(marker.index, marker.index + 100_000) : html
  const listStart = section.search(/<ul\b/i)
  const listEnd = listStart >= 0 ? section.search(/<\/ul\s*>/i) : -1
  const listHtml = listStart >= 0 && listEnd > listStart ? section.slice(listStart, listEnd) : section
  const values = [...listHtml.matchAll(/<span\b[^>]*\bclass\s*=\s*(["'])[^"']*\ba-list-item\b[^"']*\1[^>]*>([\s\S]*?)<\/span>/gi)]
    .map(match => match[2])
  if (values.length === 0) values.push(...[...listHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi)].map(match => match[1]))
  return values
    .map(decodeHtmlText)
    .map(item => item.replace(/\s*(?:See more|Read more)\s*$/i, '').trim())
    .filter((item, index, items) => item.length > 2 && items.indexOf(item) === index)
}

async function fetchAmazonStorefrontProduct(asin: string): Promise<{ candidates: ImageCandidate[]; aboutItem: string[] }> {
  const res = await fetch(`https://www.amazon.in/dp/${encodeURIComponent(asin)}`, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
      'accept-language': 'en-IN,en;q=0.9',
      accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) return { candidates: [], aboutItem: [] }

  const html = await res.text()
  const galleryStart = html.indexOf('maintain-height desktop-media-mainView')
  const galleryEnd = galleryStart >= 0 ? html.indexOf('</ul>', galleryStart) : -1
  const galleryHtml = galleryStart >= 0 && galleryEnd > galleryStart
    ? html.slice(galleryStart, galleryEnd)
    : ''
  const seen = new Set<string>()
  const candidates: ImageCandidate[] = []

  const addCandidate = (rawUrl: string) => {
    const imageName = mediaFileNameFromUrl(rawUrl.replace(/&amp;/g, '&'))
    if (!imageName || seen.has(imageName)) return
    seen.add(imageName)
    const url = `https://m.media-amazon.com/images/I/${imageName}`
    candidates.push({ url, ext: path.extname(imageName), sourceUrl: url })
  }

  for (const match of galleryHtml.matchAll(/data-old-hires="(https:\/\/m\.media-amazon\.com\/images\/I\/[^\"]+)"/gi)) {
    addCandidate(match[1])
  }

  if (candidates.length === 0 && galleryHtml) {
    for (const match of galleryHtml.matchAll(/https:\/\/m\.media-amazon\.com\/images\/I\/[^"&\s]+\.(?:jpe?g|png|webp)(?:\?[^"\s]*)?/gi)) {
      addCandidate(match[0])
    }
  }

  return { candidates, aboutItem: parseAboutItem(html) }
}

/** Return the normalized, directly-fetchable Amazon gallery URLs for an ASIN. */
export async function fetchAmazonImageUrls(asin: string): Promise<string[]> {
  if (!asin.trim()) return []
  const { candidates } = await fetchAmazonStorefrontProduct(asin.trim())
  return candidates.map(candidate => candidate.url)
}

async function blobUrlsWithPrefix(prefix: string): Promise<string[]> {
  const urls: string[] = []
  let cursor: string | undefined
  do {
    const page = await list({ prefix, cursor, limit: 1000 })
    urls.push(...page.blobs.map(blob => blob.url))
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  return urls
}

async function deleteBlobUrls(urls: string[]) {
  for (let index = 0; index < urls.length; index += 1000) {
    await del(urls.slice(index, index + 1000))
  }
}

/** Remove every Blob in a product folder that is not currently referenced by the database. */
export async function reconcileProductImageBlobs(
  product: Pick<Product, 'handle' | 'title' | 'amazonSku' | 'asin'>,
  keepUrls: string[],
): Promise<number> {
  const keep = new Set(keepUrls.filter(url => url.includes('.blob.vercel-storage.com/')))
  const existing = await blobUrlsWithPrefix(blobPrefixForProduct(product))
  const orphaned = existing.filter(url => !keep.has(url))
  if (orphaned.length > 0) await deleteBlobUrls(orphaned)
  return orphaned.length
}

/** Delete the complete product folder, including files orphaned from the DB. */
export async function deleteProductImageBlobs(product: Pick<Product, 'handle' | 'title' | 'amazonSku' | 'asin'>): Promise<number> {
  return reconcileProductImageBlobs(product, [])
}

function imageCandidateFromUrl(url: string): ImageCandidate | null {
  try {
    const parsed = new URL(url)
    const extension = path.extname(parsed.pathname).toLowerCase()
    const ext = /^\.(jpe?g|png|webp)$/i.test(extension) ? extension : '.jpg'
    return { url, ext, sourceUrl: url }
  } catch {
    return null
  }
}

async function candidatesForProduct(product: Product, imageUrls: string[]): Promise<{ candidates: ImageCandidate[]; aboutItem: string[]; error?: string }> {
  if (imageUrls.length > 0) {
    const candidates = imageUrls.map(imageCandidateFromUrl).filter((candidate): candidate is ImageCandidate => candidate !== null)
    return candidates.length > 0
      ? { candidates, aboutItem: [] }
      : { candidates: [], aboutItem: [], error: 'The CSV contained no valid image URLs' }
  }
  if (!product.asin) return { candidates: [], aboutItem: [], error: 'This product has no ASIN' }

  try {
    const { candidates, aboutItem } = await fetchAmazonStorefrontProduct(product.asin)
    return candidates.length > 0
      ? { candidates, aboutItem }
      : { candidates: [], aboutItem, error: 'Amazon storefront did not expose product images' }
  } catch (error) {
    return {
      candidates: [],
      aboutItem: [],
      error: error instanceof Error ? error.message : 'Amazon image fetch failed',
    }
  }
}

export async function fetchAndStoreProductImages(product: Product, imageUrls: string[] = []): Promise<ProductImageFetchResult> {
  const { candidates, aboutItem, error } = await candidatesForProduct(product, imageUrls)
  if (candidates.length === 0) {
    return {
      handle: product.handle,
      asin: product.asin,
      amazonSku: product.amazonSku,
      images: [],
      aboutItem,
      source: 'missing',
      error,
    }
  }

  const prefix = blobPrefixForProduct(product)
  const images: string[] = []
  try {
    for (const [index, candidate] of candidates.entries()) {
      const fetched = await fetchImage(candidate.url)
      if (!fetched) continue

      const fileName = `image-${String(index + 1).padStart(2, '0')}${candidate.ext}`
      const blob = await put(`${prefix}${fileName}`, fetched.body, {
        access: 'private',
        addRandomSuffix: true,
        contentType: fetched.contentType,
        cacheControlMaxAge: 60 * 60 * 24 * 30,
      })
      images.push(blob.url)
    }
  } catch (uploadError) {
    await deleteBlobUrls(images).catch(() => undefined)
    throw uploadError
  }

  return {
    handle: product.handle,
    asin: product.asin,
    amazonSku: product.amazonSku,
    images,
    aboutItem,
    source: images.length > 0 ? 'amazon' : 'missing',
    error,
  }
}

export async function clearAllStoredProductImages(): Promise<number> {
  const urls = await blobUrlsWithPrefix(blobRoot)
  await deleteBlobUrls(urls)
  return urls.length
}
