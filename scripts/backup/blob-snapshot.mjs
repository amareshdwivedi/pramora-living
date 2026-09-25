#!/usr/bin/env node
// Full, read-only Vercel Blob export. Credential is supplied through the process environment.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const [backupRoot, repoRoot, envFile] = process.argv.slice(2);
if (!backupRoot || !repoRoot || !envFile) throw new Error('Usage: blob-snapshot.mjs BACKUP REPOSITORY ENV_FILE');
const require = createRequire(path.join(repoRoot, 'package.json'));
const { parse } = require('dotenv');
const env = parse(fs.readFileSync(envFile));
const { list, get } = require('@vercel/blob');
const token = process.env.PRAMORA_BLOB_BACKUP_TOKEN;
const storeId = env.BLOB_STORE_ID;
if (!token) throw new Error('Blob backup credential is missing from the macOS Keychain.');
if (!storeId) throw new Error('Production BLOB_STORE_ID is missing.');
const root = path.resolve(backupRoot);
const auth = { token };
const writeJson = (file, data) => fs.writeFileSync(path.join(root, file), JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

async function inventory() {
  const files = [];
  const seenCursors = new Set();
  let cursor;
  do {
    if (cursor && seenCursors.has(cursor)) throw new Error('Blob listing repeated a pagination cursor.');
    if (cursor) seenCursors.add(cursor);
    let page;
    for (let attempt = 0; attempt < 4; attempt++) {
      try { page = await list({ ...auth, limit: 1000, abortSignal: AbortSignal.timeout(60_000), ...(cursor ? { cursor } : {}) }); break; }
      catch (error) { if (attempt === 3) throw new Error(`Blob inventory request failed after retries (${error.name}).`); await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); }
    }
    files.push(...page.blobs);
    if (page.hasMore && !page.cursor) throw new Error('Blob listing has another page but no cursor.');
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const unique = new Set(files.map(b => b.url));
  if (unique.size !== files.length) throw new Error('Blob listing included duplicate file URLs.');
  return files.sort((a, b) => a.url.localeCompare(b.url));
}

function localPathFor(blob) {
  const store = new URL(blob.url).hostname.split('.')[0];
  const segments = blob.pathname.split('/').map(s => decodeURIComponent(s));
  if (segments.some(s => !s || s === '.' || s === '..' || s.includes('/') || s.includes('\\'))) {
    throw new Error('Blob pathname is unsafe; refusing to write outside backup folder.');
  }
  const rel = path.posix.join('blobs', store, ...segments);
  const target = path.resolve(root, rel);
  if (!target.startsWith(root + path.sep)) throw new Error('Blob pathname escaped backup folder.');
  return { rel, target };
}

async function download(item) {
  const { rel, target } = localPathFor(item);
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await get(item.url, { ...auth, access: 'private', useCache: false, abortSignal: AbortSignal.timeout(60_000) });
      if (!response || response.statusCode !== 200 || !response.stream) throw new Error('Blob returned no file contents.');
      if (response.blob.etag !== item.etag || response.blob.size !== item.size) throw new Error('Blob changed since its listing.');
      const temp = target + '.part';
      const hash = crypto.createHash('sha256');
      let bytes = 0;
      await pipeline(Readable.fromWeb(response.stream), new Transform({
        transform(chunk, _encoding, callback) { bytes += chunk.length; hash.update(chunk); callback(null, chunk); },
      }), fs.createWriteStream(temp, { flags: 'w', mode: 0o600 }));
      if (bytes !== item.size) { fs.unlinkSync(temp); throw new Error('Blob size verification failed.'); }
      fs.renameSync(temp, target);
      return { ...item, storeId, access: 'private', contentType: response.blob.contentType,
        localPath: rel, bytes, sha256: hash.digest('hex'), downloadMethod: 'Vercel Blob SDK get()' };
    } catch (error) {
      if (attempt === 3) throw new Error(`Could not download ${item.pathname} after four attempts (${error.name}).`);
      await new Promise(resolve => setTimeout(resolve, 750 * (attempt + 1)));
    }
  }
}

function dbReferences(tables) {
  const refs = [];
  function add(table, rowId, field, storedValue, extra = {}) {
    if (!storedValue) return;
    let url = storedValue;
    try {
      const parsed = new URL(storedValue, 'https://www.pramoraliving.com');
      if (/^\/api\/(product|hero)-image$/.test(parsed.pathname)) url = parsed.searchParams.get('url') || storedValue;
    } catch {}
    refs.push({ table, rowId, field, storedValue, originalUrl: url, ...extra });
  }
  for (const row of tables['public.products'] || []) {
    const extra = { productId: row.id, handle: row.handle, title: row.title, sku: row.amazon_sku };
    add('public.products', row.id, 'image', row.image, extra);
    (row.images || []).forEach((v, i) => add('public.products', row.id, `images[${i}]`, v, extra));
  }
  for (const row of tables['public.site_layouts'] || []) {
    (row.hero_slides || []).forEach((slide, i) => add('public.site_layouts', row.id,
      `hero_slides[${i}].imageUrl`, slide.imageUrl, { slideId: slide.id, productId: slide.productId }));
  }
  return refs;
}

function compareInventory(a, b) {
  const signature = rows => JSON.stringify(rows.map(x => [x.url, x.pathname, x.size, x.etag, x.uploadedAt]));
  return signature(a) === signature(b);
}

const csvFields = ['table', 'rowId', 'field', 'productId', 'handle', 'sku', 'storedValue', 'originalUrl', 'localPath', 'bytes', 'sha256', 'status'];
const csvCell = v => `"${String(v ?? '').replaceAll('"', '""')}"`;

async function main() {
  const before = await inventory();
  writeJson('manifests/blob-list-before.json', { capturedAt: new Date().toISOString(), storeId, count: before.length, blobs: before });
  let next = 0;
  const saved = [];
  async function worker() {
    while (next < before.length) {
      const item = before[next++];
      saved.push(await download(item));
      if (saved.length % 25 === 0) console.log(`Saved ${saved.length} of ${before.length} Blob files.`);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  saved.sort((a, b) => a.url.localeCompare(b.url));
  const after = await inventory();
  writeJson('manifests/blob-list-after.json', { capturedAt: new Date().toISOString(), storeId, count: after.length, blobs: after });
  if (!compareInventory(before, after)) throw new Error('Blob store changed during download. This snapshot must be repeated.');

  const tables = readJson('database/tables.json');
  const byUrl = new Map(saved.map(b => [b.url, b]));
  const refs = dbReferences(tables).map(ref => {
    const b = byUrl.get(ref.originalUrl);
    return { ...ref, ...(b ? { localPath: b.localPath, bytes: b.bytes, sha256: b.sha256, status: 'backed-up' } : { status: 'MISSING' }) };
  });
  writeJson('manifests/blob-manifest.json', saved);
  writeJson('manifests/image-references.json', refs);
  fs.writeFileSync(path.join(root, 'manifests/image-references.csv'),
    csvFields.join(',') + '\n' + refs.map(r => csvFields.map(k => csvCell(r[k])).join(',')).join('\n') + '\n', { mode: 0o600 });
  const report = { status: refs.every(r => r.status === 'backed-up') ? 'passed' : 'FAILED', mode: 'complete-paginated-store-inventory',
    files: saved.length, bytes: saved.reduce((n, b) => n + b.bytes, 0), unreferencedFiles: saved.filter(b => !refs.some(r => r.originalUrl === b.url)).length,
    imageReferences: refs.length, missingReferences: refs.filter(r => r.status === 'MISSING').length,
    allStoreFilesEnumerated: true, inventoryStableDuringDownload: true };
  writeJson('verification/blob-backup.json', report);
  if (report.status !== 'passed') throw new Error('One or more database image references are missing from the Blob store backup.');
  console.log(`Saved ${report.files} files (${report.bytes} bytes); all ${refs.length} database image references are present.`);
}

main().catch(error => { console.error(`Blob backup failed: ${error.message}`); process.exitCode = 1; });
