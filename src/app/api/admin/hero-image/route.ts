import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { isAdminRequest } from '@/lib/admin-auth'
import { getSiteLayoutStatus } from '@/lib/db/site-layout.repo'
import { heroUploadsReady } from '@/lib/hero-upload-ready'

const TYPES: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' }
const MAX_BYTES = 4 * 1024 * 1024

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await getSiteLayoutStatus()).ready) return NextResponse.json({ error: 'Hero uploads are unavailable until the site_layouts database migration is applied.' }, { status: 503 })
  if (!heroUploadsReady()) return NextResponse.json({ error: 'Hero uploads need Vercel Blob credentials in this environment.' }, { status: 503 })
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File) || !TYPES[file.type] || file.size > MAX_BYTES || file.size === 0) return NextResponse.json({ error: 'Choose a JPG, PNG, WebP, or AVIF image under 4 MB.' }, { status: 400 })
  try {
    const blob = await put(`hero-images/${crypto.randomUUID()}${TYPES[file.type]}`, file, { access: 'private', contentType: file.type, cacheControlMaxAge: 60 * 60 * 24 * 30 })
    return NextResponse.json({ url: `/api/hero-image?url=${encodeURIComponent(blob.url)}` })
  } catch {
    return NextResponse.json({ error: 'Could not upload hero image.' }, { status: 502 })
  }
}
