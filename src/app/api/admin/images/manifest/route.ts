import { NextRequest, NextResponse } from 'next/server'
import { parseAmazonCsv } from '@/lib/amazon/csv'
import { fetchAmazonImageUrls } from '@/lib/amazon/product-image-assets'
import { isAdminRequest } from '@/lib/admin-auth'

export const maxDuration = 300

type ManifestRow = {
  sku: string
  asin: string
  title: string
  urls: string[]
  error?: string
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(rows: ManifestRow[]): string {
  const maxImages = rows.reduce((max, row) => Math.max(max, row.urls.length), 0)
  const headers = ['SKU', 'ASIN', 'Product Title', ...Array.from({ length: maxImages }, (_, index) => `Image URL ${index + 1}`), 'Image Count', 'Error']
  const lines = [headers.map(csvCell).join(',')]
  for (const row of rows) {
    lines.push([
      row.sku,
      row.asin,
      row.title,
      ...Array.from({ length: maxImages }, (_, index) => row.urls[index] ?? ''),
      row.urls.length,
      row.error ?? '',
    ].map(csvCell).join(','))
  }
  return `\uFEFF${lines.join('\n')}\n`
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let csvText: string
  try {
    if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file')
      if (!(file instanceof File)) return NextResponse.json({ error: 'No CSV file uploaded.' }, { status: 400 })
      csvText = await file.text()
    } else {
      csvText = await req.text()
    }
  } catch {
    return NextResponse.json({ error: 'Could not read upload.' }, { status: 400 })
  }

  if (!csvText.trim()) return NextResponse.json({ error: 'The CSV file is empty.' }, { status: 400 })

  let records
  try {
    records = parseAmazonCsv(csvText)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to parse CSV.' }, { status: 400 })
  }
  if (records.length === 0) return NextResponse.json({ error: 'No product rows found. Expected columns: SKU, ASIN, Product Title…' }, { status: 400 })

  const rows: ManifestRow[] = new Array(records.length)
  let nextIndex = 0
  const worker = async () => {
    while (true) {
      const index = nextIndex++
      if (index >= records.length) return
      const record = records[index]
      if (!record.asin) {
        rows[index] = { sku: record.amazonSku, asin: '', title: record.title ?? '', urls: [], error: 'Missing ASIN' }
        continue
      }
      try {
        const urls = await fetchAmazonImageUrls(record.asin)
        rows[index] = {
          sku: record.amazonSku,
          asin: record.asin,
          title: record.title ?? '',
          urls,
          ...(urls.length === 0 ? { error: 'Amazon storefront did not expose product images' } : {}),
        }
      } catch (error) {
        rows[index] = {
          sku: record.amazonSku,
          asin: record.asin,
          title: record.title ?? '',
          urls: [],
          error: error instanceof Error ? error.message : 'Amazon image URL fetch failed',
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, records.length) }, () => worker()))

  const csv = toCsv(rows)
  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="amazon-image-urls-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
