import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { parseAmazonCsv } from '@/lib/amazon/csv'
import { runSync } from '@/lib/amazon/sync'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Accept either a multipart file upload or a raw text body.
  let csvText: string
  const contentType = req.headers.get('content-type') ?? ''
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file')
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No CSV file uploaded.' }, { status: 400 })
      }
      csvText = await file.text()
    } else {
      csvText = await req.text()
    }
  } catch {
    return NextResponse.json({ error: 'Could not read upload.' }, { status: 400 })
  }

  if (!csvText.trim()) {
    return NextResponse.json({ error: 'The CSV file is empty.' }, { status: 400 })
  }

  let records
  try {
    records = parseAmazonCsv(csvText)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to parse CSV.' }, { status: 400 })
  }

  if (records.length === 0) {
    return NextResponse.json({ error: 'No product rows found. Expected columns: SKU, ASIN, Product Title, Current Price…' }, { status: 400 })
  }

  let report
  try {
    report = await runSync(records, 'csv')
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync failed.' }, { status: 500 })
  }

  // Refresh storefront so synced prices/new items show immediately.
  revalidatePath('/')
  revalidatePath('/products')
  for (const c of report.changes) revalidatePath(`/products/${c.handle}`)

  return NextResponse.json(report)
}
