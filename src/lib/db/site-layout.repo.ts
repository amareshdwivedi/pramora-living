import { eq } from 'drizzle-orm'
import { db } from './client'
import { siteLayouts } from './schema'
import type { SiteLayout } from '../types'

export type LayoutSection = 'catalogOrder' | 'featuredOrder' | 'storyOrder' | 'heroSlides'

export const EMPTY_SITE_LAYOUT: SiteLayout = {
  catalogOrder: [],
  featuredOrder: [],
  storyOrder: [],
  heroSlides: [],
}

function isMissingTable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const details = error as { code?: string; message?: string; cause?: { code?: string } }
  return details.code === '42P01' || details.cause?.code === '42P01' || /relation ["']?site_layouts["']? does not exist/i.test(details.message ?? '')
}

export async function getSiteLayoutStatus(): Promise<{ layout: SiteLayout; ready: boolean }> {
  try {
    const [row] = await db.select().from(siteLayouts).where(eq(siteLayouts.id, 'main')).limit(1)
    return { ready: true, layout: row ? {
      catalogOrder: row.catalogOrder,
      featuredOrder: row.featuredOrder,
      storyOrder: row.storyOrder,
      heroSlides: row.heroSlides,
    } : EMPTY_SITE_LAYOUT }
  } catch (error) {
    // A new build can serve the current storefront before its migration runs.
    if (isMissingTable(error)) return { layout: EMPTY_SITE_LAYOUT, ready: false }
    throw error
  }
}

export async function getSiteLayout(): Promise<SiteLayout> {
  return (await getSiteLayoutStatus()).layout
}

export async function saveLayoutSection<K extends LayoutSection>(section: K, value: SiteLayout[K]): Promise<SiteLayout> {
  await db.insert(siteLayouts).values({ id: 'main', [section]: value, updatedAt: new Date() }).onConflictDoUpdate({
    target: siteLayouts.id,
    set: { [section]: value, updatedAt: new Date() },
  })
  return getSiteLayout()
}
