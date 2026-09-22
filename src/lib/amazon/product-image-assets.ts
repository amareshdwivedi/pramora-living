import fs from 'node:fs'
import fsp from 'node:fs/promises'
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

const productImagesRoot = path.join(process.cwd(), 'public/images/products')
const imageFilePattern = /^image-\d+\.(jpe?g|png|webp)$/i

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '') || 'product'
}

function publicPathForFile(product: Pick<Product, 'handle' | 'title' | 'amazonSku' | 'asin'>, fileName: string): string {
  return `/images/products/${productImageFolderName(product)}/${fileName}`
}

export function productImageFolderName(product: Pick<Product, 'handle' | 'title' | 'amazonSku' | 'asin'>): string {
  const key = [product.amazonSku, product.asin].filter(Boolean).join('_') || product.handle
  return `${key}_${slugify(product.title || product.handle)}`
}

export function productImageFolderPath(product: Pick<Product, 'handle' | 'title' | 'amazonSku' | 'asin'>): string {
  return path.join(productImagesRoot, productImageFolderName(product))
}

export function savedProductImages(product: Pick<Product, 'handle' | 'title' | 'amazonSku' | 'asin'>): string[] {
  const dir = productImageFolderPath(product)
  if (!fs.existsSync(dir)) return []

  return fs
    .readdirSync(dir)
    .filter(file => imageFilePattern.test(file))
    .sort()
    .map(file => publicPathForFile(product, file))
}

export function usableStoredImage(image: string): string {
  if (!image) return ''
  if (/^https?:\/\//i.test(image)) return image
  if (!image.startsWith('/')) return image

  const localPath = path.join(process.cwd(), 'public', image.replace(/^\/+/, ''))
  return fs.existsSync(localPath) ? image : ''
}

async function fetchImage(url: string): Promise<Buffer | null> {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 PramoraLiving/1.0',
      accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
  })

  if (!res.ok) return null
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.startsWith('image/') || contentType.includes('gif')) return null
  return Buffer.from(await res.arrayBuffer())
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
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim()
}

function parseAboutItem(html: string): string[] {
  const start = html.indexOf('feature-bullets_feature_div')
  if (start < 0) return []
  const listStart = html.indexOf('<ul', start)
  const listEnd = listStart >= 0 ? html.indexOf('</ul>', listStart) : -1
  if (listStart < 0 || listEnd < listStart) return []
  const listHtml = html.slice(listStart, listEnd)
  return [...listHtml.matchAll(/<li[^>]*>[\s\S]*?<span[^>]*class="[^"]*a-list-item[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)]
    .map(match => decodeHtmlText(match[1]))
    .filter((item, index, items) => item.length > 0 && items.indexOf(item) === index)
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
    : html
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

  if (candidates.length === 0) {
    for (const match of galleryHtml.matchAll(/https:\/\/m\.media-amazon\.com\/images\/I\/[^"&\s]+\.(?:jpe?g|png|webp)(?:\?[^"\s]*)?/gi)) {
      addCandidate(match[0])
    }
  }

  return { candidates, aboutItem: parseAboutItem(html) }
}

async function clearSavedGallery(dir: string) {
  const entries = await fsp.readdir(dir).catch(() => [])
  await Promise.all(
    entries
      .filter(entry => imageFilePattern.test(entry) || /^main\.(jpe?g|png|webp)$/i.test(entry) || entry === 'source-url.txt')
      .map(entry => fsp.unlink(path.join(dir, entry)).catch(() => undefined)),
  )
}

async function candidatesForProduct(product: Product): Promise<{ candidates: ImageCandidate[]; aboutItem: string[]; error?: string }> {
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

export async function fetchAndStoreProductImages(product: Product): Promise<ProductImageFetchResult> {
  const dir = productImageFolderPath(product)
  await fsp.mkdir(dir, { recursive: true })
  await clearSavedGallery(dir)

  const { candidates, aboutItem, error } = await candidatesForProduct(product)
  if (candidates.length === 0) {
    await fsp.rmdir(dir).catch(() => undefined)
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

  const images: string[] = []
  const sourceUrls: string[] = []
  for (const [index, candidate] of candidates.entries()) {
    const body = await fetchImage(candidate.url)
    if (!body) continue

    const fileName = `image-${String(index + 1).padStart(2, '0')}${candidate.ext}`
    await fsp.writeFile(path.join(dir, fileName), body)
    images.push(publicPathForFile(product, fileName))
    sourceUrls.push(candidate.sourceUrl)

    if (index === 0) {
      await fsp.writeFile(path.join(dir, `main${candidate.ext}`), body)
    }
  }

  if (sourceUrls.length > 0) {
    await fsp.writeFile(path.join(dir, 'source-url.txt'), `${sourceUrls.join('\n')}\n`)
  }

  if (images.length === 0) {
    await fsp.rmdir(dir).catch(() => undefined)
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
  const entries = await fsp.readdir(productImagesRoot).catch(() => [])
  await Promise.all(entries.map(entry => fsp.rm(path.join(productImagesRoot, entry), { recursive: true, force: true })))
  return entries.length
}
