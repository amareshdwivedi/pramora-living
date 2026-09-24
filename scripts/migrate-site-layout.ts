import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sql } from 'drizzle-orm'
import { db } from '../src/lib/db/client'

const migration = readFileSync(resolve(process.cwd(), 'drizzle/0002_site_layouts.sql'), 'utf8')
async function main() {
  await db.execute(sql.raw(migration))
  console.log('site_layouts table is ready')
}

main().catch(error => {
  console.error('Layout migration failed:', error)
  process.exitCode = 1
})
