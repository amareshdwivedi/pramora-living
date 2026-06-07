import Papa from 'papaparse'
import type { AmazonRecord } from './types'

/** "1,375.00" → 1375, "850.00 + 0.00" → 850, "" → null */
function parseMoney(raw: string | undefined): number | null {
  if (!raw) return null
  const first = raw.split('+')[0]            // buy-box comes as "850.00 + 0.00"
  const cleaned = first.replace(/,/g, '').trim()
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** "22 May 2026" → "2026-05-22", invalid → null */
function parseDate(raw: string | undefined): string | null {
  if (!raw) return null
  const d = new Date(raw.trim())
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

const clean = (v: string | undefined): string | null => {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

/**
 * Parse a Seller Central inventory/pricing report export.
 * Tolerates the UTF-8 BOM and varying header casing/spacing.
 */
export function parseAmazonCsv(text: string): AmazonRecord[] {
  const { data, errors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/^﻿/, '').trim(),
  })

  if (errors.length) {
    const fatal = errors.find((e) => e.type === 'Delimiter' || e.type === 'Quotes')
    if (fatal) throw new Error(`CSV parse error: ${fatal.message} (row ${fatal.row})`)
  }

  const records: AmazonRecord[] = []
  for (const row of data) {
    const amazonSku = clean(row['SKU'])
    if (!amazonSku) continue // skip blank/footer rows
    records.push({
      amazonSku,
      asin: clean(row['ASIN']),
      title: clean(row['Product Title']) ?? amazonSku,
      status: clean(row['Status']),
      currentPrice: parseMoney(row['Current Price']),
      buyBoxPrice: parseMoney(row['Buy Box Price']),
      availableInventory: clean(row['Available Inventory']),
      totalFees: parseMoney(row['Total Fees']),
      lastChanged: parseDate(row['Last Changed']),
    })
  }
  return records
}
