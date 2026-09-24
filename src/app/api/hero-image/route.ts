import { get } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')
  if (!rawUrl) return NextResponse.json({ error: 'Missing image URL.' }, { status: 400 })
  let url: URL
  try { url = new URL(rawUrl) } catch { return NextResponse.json({ error: 'Invalid image URL.' }, { status: 400 }) }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.blob.vercel-storage.com') || !url.pathname.startsWith('/hero-images/')) return NextResponse.json({ error: 'Image not allowed.' }, { status: 403 })
  try {
    const blob = await get(url.toString(), { access: 'private' })
    if (!blob || blob.statusCode !== 200) return new NextResponse('Not found', { status: 404 })
    return new NextResponse(blob.stream, { headers: { 'Content-Type': blob.blob.contentType, 'Cache-Control': 'public, max-age=31536000, immutable', ETag: blob.blob.etag } })
  } catch {
    return NextResponse.json({ error: 'Could not read hero image.' }, { status: 502 })
  }
}
