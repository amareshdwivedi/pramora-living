#!/usr/bin/env node

import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { generateManifest } from './index.mjs'

const port = Number(process.env.PORT || 8787)
const maxBodyBytes = 10 * 1024 * 1024
const html = await readFile(new URL('./index.html', import.meta.url), 'utf8')

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    request.on('data', chunk => {
      size += chunk.length
      if (size > maxBodyBytes) {
        reject(new Error('CSV is larger than 10 MB.'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end(html)
      return
    }

    if (request.method === 'POST' && request.url === '/api/process') {
      const csvText = await readBody(request)
      const { csv } = await generateManifest(csvText, 4)
      response.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="amazon-image-urls.csv"',
        'Cache-Control': 'no-store',
      })
      response.end(csv)
      return
    }

    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  } catch (error) {
    response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Processing failed.' }))
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Amazon image CSV utility: http://localhost:${port}`)
})
