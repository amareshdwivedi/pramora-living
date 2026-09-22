#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_CONCURRENCY = 4
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36'

function usage() {
  console.error('Usage: node index.mjs <seller-central.csv> [image-urls.csv] [--concurrency N]')
  process.exit(1)
}

function parseArgs(args) {
  const positional = []
  let concurrency = DEFAULT_CONCURRENCY
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--concurrency' || arg === '-c') {
      concurrency = Number(args[++index])
      if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 12) {
        throw new Error('--concurrency must be an integer from 1 to 12')
      }
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    } else {
      positional.push(arg)
    }
  }
  if (positional.length < 1 || positional.length > 2) usage()
  return {
    input: positional[0],
    output: positional[1] ?? path.join(path.dirname(positional[0]), `${path.basename(positional[0], path.extname(positional[0]))}-image-urls.csv`),
    concurrency,
  }
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"' && cell.length === 0) {
      quoted = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(cell)
      if (row.some(value => value.trim() !== '')) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    if (row.some(value => value.trim() !== '')) rows.push(row)
  }
  return rows
}

function normalizedHeader(value) {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function parseSellerCentralCsv(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('CSV must contain a header row and at least one product row')
  const headers = rows[0].map(normalizedHeader)
  const column = (...names) => names.map(normalizedHeader).map(name => headers.indexOf(name)).find(index => index >= 0)
  const skuColumn = column('sku')
  const asinColumn = column('asin')
  const titleColumn = column('product title', 'title')
  if (skuColumn === undefined || asinColumn === undefined) throw new Error('CSV must contain SKU and ASIN columns')

  return rows.slice(1).map(values => ({
    sku: (values[skuColumn] ?? '').trim(),
    asin: (values[asinColumn] ?? '').trim(),
    title: (titleColumn === undefined ? '' : values[titleColumn] ?? '').trim(),
  })).filter(row => row.sku)
}

function decodeUrl(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('\\/', '/')
    .replaceAll('\\u002F', '/')
    .replaceAll('\\u003A', ':')
    .replaceAll('\\u0026', '&')
    .replace(/["'<>\\]+$/g, '')
}

function validAmazonImageUrl(value) {
  try {
    const url = new URL(decodeUrl(value))
    if (url.hostname !== 'm.media-amazon.com') return null
    if (!url.pathname.includes('/images/')) return null
    if (!/\.(?:jpe?g|png|webp)(?:$|\?)/i.test(url.pathname + url.search)) return null
    return url.toString()
  } catch {
    return null
  }
}

function extractImageUrls(html) {
  const galleryStart = html.indexOf('maintain-height desktop-media-mainView')
  const galleryEnd = galleryStart >= 0 ? html.indexOf('</ul>', galleryStart) : -1
  const galleryHtml = galleryStart >= 0 && galleryEnd > galleryStart
    ? html.slice(galleryStart, galleryEnd)
    : html
  const urls = []
  const seen = new Set()
  const add = value => {
    const url = validAmazonImageUrl(value)
    if (url && !seen.has(url)) {
      seen.add(url)
      urls.push(url)
    }
  }

  for (const match of galleryHtml.matchAll(/data-old-hires=["']([^"']+)["']/gi)) add(match[1])
  if (urls.length === 0) {
    for (const match of galleryHtml.matchAll(/https?:\\?\/\\?\/m\.media-amazon\.com\\?\/images\\?\/[^"'<>\\s]+/gi)) add(match[0])
  }
  return urls
}

async function fetchImageUrls(asin, attempts = 3) {
  if (!asin) return { urls: [], error: 'Missing ASIN' }
  let lastError = 'Amazon storefront did not expose product images'
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`https://www.amazon.in/dp/${encodeURIComponent(asin)}`, {
        headers: {
          'user-agent': USER_AGENT,
          'accept-language': 'en-IN,en;q=0.9',
          accept: 'text/html,application/xhtml+xml',
        },
      })
      if (!response.ok) {
        lastError = `Amazon returned HTTP ${response.status}`
      } else {
        const urls = extractImageUrls(await response.text())
        if (urls.length > 0) return { urls }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Amazon request failed'
    }
    if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 1200))
  }
  return { urls: [], error: lastError }
}

function csvCell(value) {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toManifestCsv(rows) {
  const maxImages = rows.reduce((max, row) => Math.max(max, row.urls.length), 0)
  const headers = ['SKU', 'ASIN', 'Product Title', ...Array.from({ length: maxImages }, (_, index) => `Image URL ${index + 1}`), 'Image Count', 'Error']
  const output = [headers.map(csvCell).join(',')]
  for (const row of rows) {
    output.push([
      row.sku,
      row.asin,
      row.title,
      ...Array.from({ length: maxImages }, (_, index) => row.urls[index] ?? ''),
      row.urls.length,
      row.error ?? '',
    ].map(csvCell).join(','))
  }
  return `\uFEFF${output.join('\n')}\n`
}

export async function generateManifest(text, concurrency = DEFAULT_CONCURRENCY, onProgress = () => {}) {
  const records = parseSellerCentralCsv(text)
  const results = new Array(records.length)
  let next = 0
  let completed = 0

  const worker = async () => {
    while (true) {
      const index = next++
      if (index >= records.length) return
      const record = records[index]
      const result = await fetchImageUrls(record.asin)
      results[index] = { ...record, ...result }
      completed += 1
      onProgress(completed, records.length)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, records.length) }, () => worker()))
  return { records, results, csv: toManifestCsv(results) }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const { records, results, csv } = await generateManifest(await fs.readFile(options.input, 'utf8'), options.concurrency, (completed, total) => {
    process.stderr.write(`\rFetched ${completed}/${total}`)
  })
  process.stderr.write('\n')
  await fs.writeFile(options.output, csv, 'utf8')
  const found = results.filter(row => row.urls.length > 0).length
  console.log(`Wrote ${options.output}`)
  console.log(`Products: ${records.length}; with images: ${found}; without images: ${records.length - found}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`Error: ${error instanceof Error ? error.message : error}`)
    process.exitCode = 1
  })
}
