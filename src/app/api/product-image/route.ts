import { get } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')
  if (!rawUrl) return NextResponse.json({ error: 'Missing image URL.' }, { status: 400 })

  let blobUrl: URL
  try {
    blobUrl = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid image URL.' }, { status: 400 })
  }

  if (!blobUrl.hostname.endsWith('.blob.vercel-storage.com') || !blobUrl.pathname.startsWith('/product-images/')) {
    return NextResponse.json({ error: 'Image URL is not an allowed product Blob.' }, { status: 403 })
  }

  try {
    const blob = await get(blobUrl.toString(), { access: 'private' })
    if (!blob || blob.statusCode !== 200) return new NextResponse('Not found', { status: 404 })
    return new NextResponse(blob.stream, {
      headers: {
        'Content-Type': blob.blob.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: blob.blob.etag,
      },
    })
  } catch (error) {
    console.error('Product Blob image read failed', error)
    return NextResponse.json({ error: 'Could not read product image.' }, { status: 502 })
  }
}
