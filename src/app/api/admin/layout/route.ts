import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { del } from '@vercel/blob'
import { isAdminRequest } from '@/lib/admin-auth'
import { getProducts } from '@/lib/products'
import { getSiteLayout, getSiteLayoutStatus, saveLayoutSection, type LayoutSection } from '@/lib/db/site-layout.repo'
import { orderProducts } from '@/lib/site-layout'
import { heroUploadsReady } from '@/lib/hero-upload-ready'
import type { HeroSlide, Product, SiteLayout } from '@/lib/types'

function uniqueActiveIds(value: unknown, active: Product[], max?: number): string[] | null {
  if (!Array.isArray(value) || (max !== undefined && value.length > max)) return null
  const allowed = new Set(active.map(product => product.id))
  const ids = value.map(item => typeof item === 'string' ? item : '')
  return ids.every(id => allowed.has(id)) && new Set(ids).size === ids.length ? ids : null
}

function validHeroImage(url: string, product: Product): boolean {
  if ([product.image, ...(product.images ?? [])].includes(url)) return true
  if (!url.startsWith('/api/hero-image?url=')) return false
  try {
    const blobUrl = new URL(new URL(url, 'http://localhost').searchParams.get('url') ?? '')
    return blobUrl.protocol === 'https:' && blobUrl.hostname.endsWith('.blob.vercel-storage.com') && blobUrl.pathname.startsWith('/hero-images/')
  } catch { return false }
}

function validSlides(value: unknown, active: Product[]): HeroSlide[] | null {
  if (!Array.isArray(value) || value.length > 5) return null
  const byId = new Map(active.map(product => [product.id, product]))
  const slides: HeroSlide[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const slide = item as Partial<HeroSlide>
    const product = byId.get(slide.productId ?? '')
    if (!product || typeof slide.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(slide.id) || typeof slide.imageUrl !== 'string' || typeof slide.enabled !== 'boolean' || !validHeroImage(slide.imageUrl, product)) return null
    slides.push({ id: slide.id, productId: product.id, imageUrl: slide.imageUrl, enabled: slide.enabled })
  }
  return new Set(slides.map(slide => slide.id)).size === slides.length ? slides : null
}

function storedHeroUrl(proxyUrl: string): string | null {
  if (!proxyUrl.startsWith('/api/hero-image?url=')) return null
  try {
    const url = new URL(new URL(proxyUrl, 'http://localhost').searchParams.get('url') ?? '')
    return url.protocol === 'https:' && url.hostname.endsWith('.blob.vercel-storage.com') && url.pathname.startsWith('/hero-images/') ? url.toString() : null
  } catch { return null }
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [products, { layout, ready }] = await Promise.all([getProducts(), getSiteLayoutStatus()])
  return NextResponse.json({ products: orderProducts(products, layout.catalogOrder), layout, ready, uploadReady: heroUploadsReady() })
}

export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await getSiteLayoutStatus()).ready) return NextResponse.json({ error: 'Layout editing is read-only until the site_layouts database migration is applied.' }, { status: 503 })
  const body = await req.json().catch(() => null) as { section?: LayoutSection; value?: unknown } | null
  if (!body || !['catalogOrder', 'featuredOrder', 'storyOrder', 'heroSlides'].includes(body.section ?? '')) return NextResponse.json({ error: 'Invalid layout section.' }, { status: 400 })
  const active = (await getProducts()).filter(product => product.status === 'active')
  let value: string[] | HeroSlide[] | null = null
  if (body.section === 'catalogOrder') {
    value = uniqueActiveIds(body.value, active)
    if (value && value.length !== active.length) value = null
  } else if (body.section === 'featuredOrder') value = uniqueActiveIds(body.value, active, 6)
  else if (body.section === 'storyOrder') value = uniqueActiveIds(body.value, active, 4)
  else value = validSlides(body.value, active)
  if ((body.section === 'featuredOrder' || body.section === 'storyOrder') && value?.length === 0) value = null
  if (value === null) return NextResponse.json({ error: 'The layout contains invalid, duplicate, or unpublished products. Reload and try again.' }, { status: 400 })
  try {
    const oldLayout = body.section === 'heroSlides' ? await getSiteLayout() : null
    const layout = await saveLayoutSection(body.section!, value as SiteLayout[typeof body.section & LayoutSection])
    if (oldLayout && body.section === 'heroSlides') {
      const nextUrls = new Set((value as HeroSlide[]).map(slide => storedHeroUrl(slide.imageUrl)).filter(Boolean))
      const removed = [...new Set(oldLayout.heroSlides.map(slide => storedHeroUrl(slide.imageUrl)).filter((url): url is string => Boolean(url) && !nextUrls.has(url)))]
      if (removed.length > 0) await del(removed).catch(error => console.error('Could not remove unused hero images', error))
    }
    revalidatePath('/')
    revalidatePath('/products')
    return NextResponse.json({ layout })
  } catch (error) {
    console.error('Could not save site layout', error)
    return NextResponse.json({ error: 'Could not save page layout. Apply the site_layouts database migration first.' }, { status: 503 })
  }
}
