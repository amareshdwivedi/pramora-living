#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
process.umask(0o077);
const repo = path.resolve(scriptDir, '../..');
const service = 'com.pramoraliving.backup.blob-token';
const account = os.userInfo().username;
const defaultRoot = path.join(os.homedir(), 'PramoraBackups');
const activeChildren = new Set();
process.on('SIGINT', () => { for (const child of activeChildren) child.kill('SIGTERM'); });
process.on('SIGTERM', () => { for (const child of activeChildren) child.kill('SIGTERM'); });
const usage = `Pramora Living backup utility

Commands:
  setup [--root DIR]                 Securely save the Blob token in macOS Keychain
  run [--root DIR]                   Create, restore-check and package one full snapshot
  install-schedule [--root DIR]      Run a snapshot daily at 02:00 local Mac time
  uninstall-schedule                 Remove this utility's LaunchAgent
  decrypt-config --input FILE --key FILE --output NEW_FILE
                                     Decrypt this snapshot's environment settings
  prune --keep N --confirm [--root DIR]
                                     Explicitly remove old successful snapshots

Production access is read-only. Credentials are never written to backup files or logs.
`;

function parseArgs(argv) {
  const command = argv[0] || 'help';
  const options = { root: defaultRoot, keep: null, confirm: false, input: null, key: null, output: null };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--root' && argv[i + 1]) options.root = path.resolve(argv[++i]);
    else if (argv[i] === '--keep' && argv[i + 1]) options.keep = Number(argv[++i]);
    else if (argv[i] === '--input' && argv[i + 1]) options.input = path.resolve(argv[++i]);
    else if (argv[i] === '--key' && argv[i + 1]) options.key = path.resolve(argv[++i]);
    else if (argv[i] === '--output' && argv[i + 1]) options.output = path.resolve(argv[++i]);
    else if (argv[i] === '--confirm') options.confirm = true;
    else if (argv[i] === '--help' || argv[i] === '-h') return { command: 'help', options };
    else throw new Error(`Unknown or incomplete option: ${argv[i]}`);
  }
  return { command, options };
}

function saveEncryptionKey(root) {
  const directory = path.join(root, 'keys');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  const keyFile = path.join(directory, 'production-env.aes-key');
  if (!fs.existsSync(keyFile)) {
    try { fs.writeFileSync(keyFile, crypto.randomBytes(32), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  fs.chmodSync(keyFile, 0o600);
  if (fs.readFileSync(keyFile).length !== 32) throw new Error('The environment encryption key has an invalid length.');
  return keyFile;
}

function encryptEnvironment(backup, keyFile, env) {
  const values = Object.fromEntries(Object.entries(env).filter(([name]) =>
    !/^(VERCEL_|TURBO_|NX_)/.test(name) && !['CI', 'NODE_ENV'].includes(name)));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', fs.readFileSync(keyFile), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(values), 'utf8'), cipher.final()]);
  json(path.join(backup, 'configuration/production-environment.aes-256-gcm.json'), {
    algorithm: 'aes-256-gcm', iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64'), ciphertext: encrypted.toString('base64'),
  });
  json(path.join(backup, 'configuration/production-environment-inventory.json'), {
    pulledFrom: 'Vercel production environment', pulledAt: new Date().toISOString(),
    environmentVariableNames: Object.keys(values).sort(),
    sensitiveValuesUnavailable: Object.entries(values).filter(([, value]) => value === '[SENSITIVE]').map(([name]) => name),
    encryption: 'AES-256-GCM', encryptionKeyOutsideSnapshot: true,
    note: 'Temporary VERCEL_OIDC_TOKEN values are excluded. Reissue values Vercel could not export.',
  });
}

function decryptEnvironment({ input, key, output }) {
  if (!input || !key || !output) throw new Error('Use decrypt-config --input ENCRYPTED_FILE --key KEY_FILE --output NEW_FILE.');
  if (fs.existsSync(output)) throw new Error('Refusing to overwrite the requested decrypted output file.');
  const record = read(input);
  if (record.algorithm !== 'aes-256-gcm') throw new Error('Unsupported environment backup encryption.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', fs.readFileSync(key), Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
  const clear = Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()]);
  JSON.parse(clear.toString('utf8'));
  fs.writeFileSync(output, clear, { flag: 'wx', mode: 0o600 });
  console.log(`Decrypted settings saved to the requested private file: ${output}`);
}

function exec(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: opts.cwd || repo, env: opts.env || process.env,
      stdio: opts.stdio || ['ignore', 'pipe', 'pipe'] });
    activeChildren.add(child);
    const stdout = [], stderr = [];
    child.stdout?.on('data', b => stdout.push(b)); child.stderr?.on('data', b => stderr.push(b));
    child.on('error', reject);
    child.on('close', code => {
      activeChildren.delete(child);
      code === 0 ? resolve(Buffer.concat(stdout).toString('utf8')) : reject(new Error(`${path.basename(command)} exited ${code}`));
    });
  });
}

function runSync(command, args, options = {}) {
  const r = spawnSync(command, args, { cwd: options.cwd || repo, encoding: 'utf8', stdio: options.stdio || 'pipe' });
  if (r.error || r.status !== 0) throw new Error(`${path.basename(command)} failed${r.status == null ? '' : ` (${r.status})`}`);
  return (r.stdout || '').trim();
}

function keychainGet() {
  const r = spawnSync('/usr/bin/security', ['find-generic-password', '-s', service, '-a', account, '-w'], { encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout.trim()) throw new Error('Blob token is not in macOS Keychain. Run `node scripts/backup/backup.mjs setup`.');
  return r.stdout.trim();
}

async function setup() {
  console.log('Enter the Vercel Blob read/write token for the production pramora-blob store. Input is hidden and saved only in your macOS login Keychain.');
  const r = spawnSync('/usr/bin/security', ['add-generic-password', '-U', '-s', service, '-a', account, '-w'], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('Keychain did not save the Blob token.');
  keychainGet();
  console.log('Blob token saved in Keychain. It will not be included in backups or run logs.');
}

function sha256(file) {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r'), buffer = Buffer.allocUnsafe(1024 * 1024);
  try { let n; while ((n = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) h.update(buffer.subarray(0, n)); }
  finally { fs.closeSync(fd); }
  return h.digest('hex');
}

function json(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); }
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function validateRoot(root) {
  const candidate = path.resolve(root);
  const forbidden = physical => physical === path.parse(physical).root || physical === os.homedir() || physical === repo || physical.startsWith(repo + path.sep);
  if (forbidden(candidate)) throw new Error('Choose a dedicated backup directory outside the repository and home-directory root.');
  if (fs.existsSync(candidate) && forbidden(fs.realpathSync(candidate))) throw new Error('Backup directory resolves to a protected location.');
  return candidate;
}
function safeError(error) { return `${error.name || 'Error'}: ${String(error.message || 'operation failed').replace(/(postgres(?:ql)?:\/\/)[^\s]+/ig, '$1[redacted]').replace(/eyJ[A-Za-z0-9._-]{20,}/g, '[redacted]')}`; }

async function getProductionEnvironment(temp) {
  const linkFile = path.join(repo, '.vercel/project.json');
  if (!fs.existsSync(linkFile) || JSON.parse(fs.readFileSync(linkFile, 'utf8')).projectId !== 'prj_QTdknGUuZa7LWRF9O14jQnZQ6j9v') {
    throw new Error('This repository is not linked to the expected Pramora Living Vercel project.');
  }
  const file = path.join(temp, 'production.env');
  await withRetry(() => exec('vercel', ['project', 'inspect', '--non-interactive']), 'Vercel project inspection');
  await withRetry(() => exec('vercel', ['env', 'pull', file, '--environment=production', '--yes', '--non-interactive']), 'production environment pull');
  const dotenv = await import('dotenv');
  const env = dotenv.parse(fs.readFileSync(file));
  if (!env.DATABASE_URL && !env.DATABASE_URL_UNPOOLED) throw new Error('Production environment pull did not contain a database URL.');
  if (!env.BLOB_STORE_ID) throw new Error('Production environment pull did not contain a Blob store ID.');
  return { env, file };
}

async function withRetry(action, label, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    try { return await action(); }
    catch (error) { if (i === attempts - 1) throw new Error(`${label} failed after ${attempts} attempts (${error.name}).`); await new Promise(r => setTimeout(r, 1000 * (i + 1))); }
  }
}

async function currentProductionSource() {
  const inspect = JSON.parse(await withRetry(() => exec('vercel', ['inspect', 'https://pramoraliving.com', '--json', '--non-interactive']), 'production deployment inspection'));
  const deploymentId = inspect.id || inspect.uid;
  if (!deploymentId || inspect.target !== 'production') throw new Error('Could not confirm the active production deployment.');
  const deployment = JSON.parse(await withRetry(() => exec('vercel', ['api', `/v13/deployments/${deploymentId}`, '--non-interactive']), 'production deployment metadata lookup'));
  const sha = deployment.gitSource?.sha || deployment.meta?.githubCommitSha;
  const repoName = `${deployment.meta?.githubCommitOrg || 'amareshdwivedi'}/${deployment.meta?.githubCommitRepo || 'pramora-living'}`;
  if (repoName.toLowerCase() !== 'amareshdwivedi/pramora-living') throw new Error('Production deployment points to an unexpected GitHub repository.');
  if (deployment.target && deployment.target !== 'production') throw new Error('Deployment metadata is not for production.');
  if (!sha || !/^[0-9a-f]{40}$/i.test(sha)) throw new Error('Production deployment has no valid Git commit SHA.');
  return { deploymentId, target: 'production', repo: repoName, sha, url: `https://codeload.github.com/${repoName}/tar.gz/${sha}` };
}

async function downloadSource(url, target) {
  const response = await withRetry(async () => {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(120_000) });
    if (!r.ok || !r.body) { await r.body?.cancel(); throw new Error(`HTTP ${r.status}`); }
    return r;
  }, 'production source download');
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(target, { mode: 0o600 }));
  const entries = (await exec('/usr/bin/tar', ['-tzf', target])).split('\n').filter(Boolean);
  if (!entries.length || entries.some(x => x.startsWith('/') || x.split('/').includes('..'))) throw new Error('Production source archive contained an unsafe path.');
  return entries;
}

function writeImageManifests(backup) {
  const tables = read(path.join(backup, 'database/tables.json'));
  const blobs = read(path.join(backup, 'manifests/blob-manifest.json'));
  const refs = [];
  const add = (table, rowId, field, storedValue, extra = {}) => {
    if (!storedValue) return;
    let url = storedValue;
    try { const u = new URL(storedValue, 'https://www.pramoraliving.com'); if (/^\/api\/(product|hero)-image$/.test(u.pathname)) url = u.searchParams.get('url') || storedValue; } catch {}
    refs.push({ table, rowId, field, storedValue, originalUrl: url, ...extra });
  };
  for (const p of tables['public.products'] || []) {
    const e = { productId: p.id, handle: p.handle, title: p.title, sku: p.amazon_sku };
    add('public.products', p.id, 'image', p.image, e);
    (p.images || []).forEach((v, i) => add('public.products', p.id, `images[${i}]`, v, e));
  }
  for (const layout of tables['public.site_layouts'] || []) (layout.hero_slides || []).forEach((slide, i) =>
    add('public.site_layouts', layout.id, `hero_slides[${i}].imageUrl`, slide.imageUrl, { slideId: slide.id, productId: slide.productId }));
  const byUrl = new Map(blobs.map(b => [b.url, b]));
  const result = refs.map(r => {
    const b = byUrl.get(r.originalUrl);
    let isBlob = false;
    try { isBlob = new URL(r.originalUrl).hostname.endsWith('.blob.vercel-storage.com'); } catch {}
    return { ...r, ...(b ? { localPath: b.localPath, bytes: b.bytes, sha256: b.sha256, status: 'backed-up' } : { status: isBlob ? 'MISSING' : 'external-not-blob' }) };
  });
  json(path.join(backup, 'manifests/image-references.json'), result);
  const cols = ['table', 'rowId', 'field', 'productId', 'handle', 'sku', 'storedValue', 'originalUrl', 'localPath', 'bytes', 'sha256', 'status'];
  const cell = x => `"${String(x ?? '').replaceAll('"', '""')}"`;
  fs.writeFileSync(path.join(backup, 'manifests/image-references.csv'), cols.join(',') + '\n' + result.map(r => cols.map(k => cell(r[k])).join(',')).join('\n') + '\n', { mode: 0o600 });
  return result;
}

function makeMediaRemap(backup) {
  const blobs = read(path.join(backup, 'manifests/blob-manifest.json'));
  const refs = read(path.join(backup, 'manifests/image-references.json'));
  const map = [];
  for (const blob of blobs) {
    const newValue = '/restored-media/' + blob.localPath.slice('blobs/'.length);
    const oldValues = new Set([blob.url, ...refs.filter(r => r.originalUrl === blob.url).map(r => r.storedValue)]);
    for (const oldValue of oldValues) map.push({ oldValue, newValue, localPath: blob.localPath, sha256: blob.sha256 });
  }
  json(path.join(backup, 'manifests/url-remapping.json'), map);
  const lit = value => `'${value.replaceAll("'", "''")}'`;
  const sql = `-- Apply only to the NEW restored database after copying blobs/ to public/restored-media/.
BEGIN;
CREATE TEMP TABLE recovery_media_map (old_value text PRIMARY KEY, new_value text NOT NULL) ON COMMIT DROP;
INSERT INTO recovery_media_map VALUES\n${map.map(m => `(${lit(m.oldValue)}, ${lit(m.newValue)})`).join(',\n')};
UPDATE public.products p SET image=COALESCE((SELECT new_value FROM recovery_media_map m WHERE m.old_value=p.image),p.image),
images=(SELECT COALESCE(jsonb_agg(to_jsonb(COALESCE(m.new_value,e.value)) ORDER BY e.ord),'[]'::jsonb) FROM jsonb_array_elements_text(p.images) WITH ORDINALITY e(value,ord) LEFT JOIN recovery_media_map m ON m.old_value=e.value);
UPDATE public.site_layouts l SET hero_slides=(SELECT COALESCE(jsonb_agg(CASE WHEN m.new_value IS NULL THEN e.value ELSE jsonb_set(e.value,'{imageUrl}',to_jsonb(m.new_value)) END ORDER BY e.ord),'[]'::jsonb) FROM jsonb_array_elements(l.hero_slides) WITH ORDINALITY e(value,ord) LEFT JOIN recovery_media_map m ON m.old_value=e.value->>'imageUrl');
COMMIT;
`;
  fs.writeFileSync(path.join(backup, 'tools/remap-media-to-local.sql'), sql, { mode: 0o600 });
}

function renderReport(backup, state) {
  const missing = state.imageReferences.filter(r => r.status === 'MISSING').length;
  const status = state.database.status === 'passed' && state.blob.inventoryStableDuringDownload && missing === 0 ? 'VERIFIED' : 'INCOMPLETE';
  const tableRows = state.database.tables.reduce((n, t) => n + t.rows, 0);
  const backedUpReferences = state.imageReferences.filter(r => r.status === 'backed-up').length;
  const externalReferences = state.imageReferences.filter(r => r.status === 'external-not-blob').length;
  const text = `# Pramora Living backup report\n\n- **Run:** ${new Date().toISOString()}\n- **Status:** ${status}\n- **Production deployment:** ${state.source.deploymentId}\n- **GitHub source:** ${state.source.repo} @ \`${state.source.sha}\`\n- **Database:** ${state.database.status}; ${state.database.tables.length} tables, ${tableRows} rows; restored locally and compared by canonical row hashes.\n- **Vercel Blob:** ${state.blob.files} files, ${state.blob.bytes.toLocaleString('en-US')} bytes; paginated inventory stable before and after download.\n- **Image references:** ${backedUpReferences}/${state.imageReferences.length} backed up; ${externalReferences} point outside Vercel Blob; ${missing} missing.\n- **Unreferenced Blob files:** ${state.blob.unreferencedFiles}.\n- **Environment configuration:** encrypted with AES-256-GCM. Key: \`${state.configKeyPath}\` (not in the archive).\n- **Source archive:** ${state.source.archive}\n- **Database dump:** database/production.dump\n- **Image manifest:** manifests/image-references.csv\n- **Restore instructions:** RESTORE.md\n\nThe snapshot contains every listed file in the connected production Blob store and all discovered non-system PostgreSQL tables. Vercel-sensitive environment values it could not export are listed by name in the environment inventory and need to be reissued during recovery. The Blob access token is stored in the macOS login Keychain.\n`;
  fs.writeFileSync(path.join(backup, 'BACKUP-REPORT.md'), text, { mode: 0o600 });
  return status;
}

function writeChecksums(backup) {
  const entries = [];
  const walk = dir => { for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (ent.isFile() && !['manifests/files.sha256.json', 'verification/file-integrity.json'].includes(path.relative(backup, full)))
      entries.push({ path: path.relative(backup, full), bytes: fs.statSync(full).size, sha256: sha256(full) });
  } };
  walk(backup); entries.sort((a, b) => a.path.localeCompare(b.path));
  json(path.join(backup, 'manifests/files.sha256.json'), entries);
  json(path.join(backup, 'verification/file-integrity.json'), { status: 'passed', files: entries.length,
    blobs: read(path.join(backup, 'manifests/blob-manifest.json')).length,
    imageReferences: read(path.join(backup, 'manifests/image-references.json')).length,
    databaseRestore: read(path.join(backup, 'verification/database-restore.json')).status,
    generatedAt: new Date().toISOString() });
}

function verifyChecksums(backup) {
  const entries = read(path.join(backup, 'manifests/files.sha256.json'));
  for (const e of entries) {
    const p = path.resolve(backup, e.path);
    if (!p.startsWith(backup + path.sep) || !fs.existsSync(p) || fs.statSync(p).size !== e.bytes || sha256(p) !== e.sha256)
      throw new Error(`Checksum verification failed: ${e.path}`);
  }
  return entries.length;
}

async function writeRestoreGuide(backup) {
  const template = path.join(scriptDir, 'RESTORE_TEMPLATE.md');
  fs.copyFileSync(template, path.join(backup, 'RESTORE.md'));
}

async function runBackup({ root }) {
  root = validateRoot(root);
  const blobToken = keychainGet();
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  fs.chmodSync(root, 0o700);
  const lockPath = path.join(root, '.backup-lock');
  let lock;
  const createLock = () => { lock = fs.openSync(lockPath, 'wx', 0o600); fs.writeSync(lock, JSON.stringify({ pid: process.pid, started: new Date().toISOString() })); };
  try { createLock(); }
  catch {
    try {
      const previous = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      let alive = true;
      try { process.kill(previous.pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; else throw error; }
      if (alive) { const running = new Error('A backup is already running.'); running.code = 'ELOCKED'; throw running; }
      fs.unlinkSync(lockPath);
      createLock();
    } catch (error) {
      if (error.code === 'EEXIST') throw new Error('Another backup is starting; try again later.');
      if (error.code === 'ELOCKED') throw error;
      throw new Error('The prior backup lock is stale or unreadable; inspect .backup-lock before removing it.');
    }
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pramora-backup-'));
  const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('-', '').replace(/\.(\d{3})Z$/, '$1Z');
  const name = stamp;
  const partial = path.join(root, name + '.partial');
  const final = path.join(root, name);
  let published = false;
  try {
    if (fs.statfsSync(root).bavail * fs.statfsSync(root).bsize < 1024 ** 3) throw new Error('Less than 1 GB free in the backup destination.');
    fs.mkdirSync(partial, { mode: 0o700 });
    const { env, file: envFile } = await getProductionEnvironment(temp);
    await writeRestoreGuide(partial);
    const source = await currentProductionSource();
    const sourceArchive = path.join(partial, 'source-production.tar.gz');
    await downloadSource(source.url, sourceArchive);
    const publicDir = path.join(partial, 'assets/public'); fs.mkdirSync(publicDir, { recursive: true, mode: 0o700 });
    const assetManifest = JSON.parse(await exec('python3', [path.join(scriptDir, 'extract-public-assets.py'), sourceArchive, publicDir, '--manifest-only']));
    await exec('python3', [path.join(scriptDir, 'extract-public-assets.py'), sourceArchive, publicDir]);
    json(path.join(partial, 'manifests/static-assets.json'), assetManifest);
    json(path.join(partial, 'configuration/production-source.json'), { ...source, archive: 'source-production.tar.gz', sourceSha256: sha256(sourceArchive), staticAssetFileCount: assetManifest.length });
    const configKey = saveEncryptionKey(root);
    encryptEnvironment(partial, configKey, env);
    json(path.join(partial, 'configuration/encryption-key-location.json'), {
      keyPathFromBackupFolder: '../keys/production-env.aes-key', includedInSnapshotArchive: false,
      note: 'Copy and protect this key separately; it is needed to decrypt production environment settings.',
    });
    fs.mkdirSync(path.join(partial, 'verification'), { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.join(partial, 'manifests'), { recursive: true, mode: 0o700 });
    const dbEnv = { PATH: process.env.PATH || '/opt/homebrew/bin:/usr/bin:/bin', HOME: os.homedir(), USER: account,
      TMPDIR: os.tmpdir(), ...(process.env.LANG ? { LANG: process.env.LANG } : {}),
      DATABASE_URL: env.DATABASE_URL,
      ...(env.DATABASE_URL_UNPOOLED ? { DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED } : {}) };
    console.log('Exporting production database and verifying a local restore…');
    await withRetry(() => exec('python3', [path.join(scriptDir, 'database-snapshot.py'), partial], { env: dbEnv }), 'database snapshot/restore');
    const blobEnv = { PATH: process.env.PATH || '/opt/homebrew/bin:/usr/bin:/bin', HOME: os.homedir(), USER: account,
      TMPDIR: os.tmpdir(), PRAMORA_BLOB_BACKUP_TOKEN: blobToken };
    console.log('Enumerating and downloading the complete Blob store…');
    await exec(process.execPath, [path.join(scriptDir, 'blob-snapshot.mjs'), partial, repo, envFile], { cwd: repo, env: blobEnv });
    const imageReferences = writeImageManifests(partial);
    const blob = read(path.join(partial, 'verification/blob-backup.json'));
    const database = read(path.join(partial, 'verification/database-restore.json'));
    if (imageReferences.some(r => r.status === 'MISSING')) throw new Error('Some database image references are missing.');
    makeMediaRemap(partial);
    const utilitySource = path.join(partial, 'tools/backup-utility');
    fs.cpSync(scriptDir, utilitySource, { recursive: true, filter: src => !src.includes('/.build/') && !src.endsWith('.log') });
    const reportStatus = renderReport(partial, { source: { ...source, archive: 'source-production.tar.gz' }, database, blob, imageReferences,
      configKeyPath: '../keys/production-env.aes-key' });
    if (reportStatus !== 'VERIFIED') throw new Error('The complete backup integrity checks did not pass.');
    json(path.join(partial, 'COMPLETE.json'), { completedAt: new Date().toISOString(),
      databaseRestored: true, blobInventoryStable: true, imageReferencesResolved: imageReferences.length });
    writeChecksums(partial);
    const checked = verifyChecksums(partial);
    if (checked < 1) throw new Error('No backup files were verified.');
    fs.renameSync(partial, final);
    const archive = final + '.tar.gz';
    await exec('/usr/bin/tar', ['-czf', archive + '.partial', '-C', root, name]);
    fs.renameSync(archive + '.partial', archive);
    const archiveMembers = new Set((await exec('/usr/bin/tar', ['-tzf', archive])).split('\n').filter(Boolean));
    const manifest = read(path.join(final, 'manifests/files.sha256.json'));
    for (const file of manifest) if (!archiveMembers.has(`${name}/${file.path}`)) throw new Error('Portable archive omitted a checksummed file.');
    for (const required of ['COMPLETE.json', 'manifests/files.sha256.json', 'verification/file-integrity.json', 'BACKUP-REPORT.md'])
      if (!archiveMembers.has(`${name}/${required}`)) throw new Error('Portable archive is missing required recovery metadata.');
    fs.chmodSync(archive, 0o600);
    fs.writeFileSync(archive + '.sha256', `${sha256(archive)}  ${path.basename(archive)}\n`, { mode: 0o600 });
    published = true;
    let removed = 0;
    try { removed = applyRetention(root, 30, 12, final); }
    catch { console.error('The verified backup is safe; automatic retention could not finish. Check backup free space.'); }
    console.log(`Backup complete: ${final}`);
    console.log(`Portable archive: ${archive}`);
    if (removed) console.log(`Retention removed ${removed} older verified snapshot(s); kept 30 daily dates and 12 monthly snapshots.`);
  } catch (error) {
    if (fs.existsSync(partial)) json(path.join(partial, 'FAILED.json'), { failedAt: new Date().toISOString(), error: safeError(error), complete: false });
    throw error;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
    if (lock != null) fs.closeSync(lock);
    try { fs.unlinkSync(lockPath); } catch {}
    if (published) console.log('Copy the archive and ../keys/production-env.aes-key to another disk or protected location.');
  }
}

function installSchedule({ root }) {
  root = validateRoot(root);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  fs.chmodSync(root, 0o700);
  keychainGet();
  fs.mkdirSync(path.join(root, 'logs'), { recursive: true, mode: 0o700 });
  for (const file of ['backup.log', 'backup-error.log']) {
    const full = path.join(root, 'logs', file);
    const fd = fs.openSync(full, 'a', 0o600); fs.closeSync(fd); fs.chmodSync(full, 0o600);
  }
  const launchAgents = path.join(os.homedir(), 'Library/LaunchAgents');
  fs.mkdirSync(launchAgents, { recursive: true, mode: 0o700 });
  const brew = runSync('brew', ['--prefix', 'node']);
  const node = path.join(brew, 'bin/node');
  const plist = path.join(launchAgents, 'com.pramoraliving.backup.plist');
  const esc = x => x.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const args = [node, path.join(scriptDir, 'backup.mjs'), 'run', '--root', root];
  const xmlArray = args.map(a => `    <string>${esc(a)}</string>`).join('\n');
  const text = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n  <key>Label</key><string>com.pramoraliving.backup</string>\n  <key>ProgramArguments</key><array>\n${xmlArray}\n  </array>\n  <key>WorkingDirectory</key><string>${esc(repo)}</string>\n  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>2</integer><key>Minute</key><integer>0</integer></dict>\n  <key>RunAtLoad</key><true/>\n  <key>StandardOutPath</key><string>${esc(path.join(root, 'logs/backup.log'))}</string>\n  <key>StandardErrorPath</key><string>${esc(path.join(root, 'logs/backup-error.log'))}</string>\n  <key>EnvironmentVariables</key><dict><key>PATH</key><string>${esc(`${path.dirname(node)}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`)}</string></dict>\n</dict></plist>\n`;
  fs.writeFileSync(plist, text, { mode: 0o600 });
  runSync('/bin/launchctl', ['bootstrap', `gui/${process.getuid()}`, plist]);
  console.log(`Installed daily 02:00 local time schedule: ${plist}`);
}

function uninstallSchedule() {
  const plist = path.join(os.homedir(), 'Library/LaunchAgents/com.pramoraliving.backup.plist');
  try { spawnSync('/bin/launchctl', ['bootout', `gui/${process.getuid()}`, plist]); } catch {}
  try { fs.unlinkSync(plist); } catch {}
  console.log('Removed the Pramora Living backup schedule. Existing backups were left untouched.');
}

function applyRetention(root, dailyLimit, monthlyLimit, newest) {
  const rows = fs.readdirSync(root, { withFileTypes: true })
    .filter(e => e.isDirectory() && /^\d{8}T\d{9}Z$/.test(e.name))
    .map(e => e.name).sort().reverse()
    .filter(name => fs.existsSync(path.join(root, name, 'COMPLETE.json')) &&
      fs.existsSync(path.join(root, `${name}.tar.gz`)) && fs.existsSync(path.join(root, `${name}.tar.gz.sha256`)));
  const keep = new Set();
  const days = new Set();
  for (const name of rows) {
    const day = name.slice(0, 8);
    if (days.has(day)) continue;
    days.add(day);
    if (days.size <= dailyLimit) keep.add(name);
  }
  const months = new Set();
  for (const name of rows) {
    const month = name.slice(0, 6);
    if (months.has(month)) continue;
    months.add(month);
    if (months.size <= monthlyLimit) keep.add(name);
  }
  if (newest) keep.add(path.basename(newest));
  let removed = 0;
  for (const name of rows) {
    if (keep.has(name)) continue;
    const folder = path.join(root, name);
    fs.rmSync(folder, { recursive: true, force: true });
    fs.unlinkSync(path.join(root, `${name}.tar.gz`));
    fs.unlinkSync(path.join(root, `${name}.tar.gz.sha256`));
    removed++;
  }
  return removed;
}

function prune({ root, keep, confirm }) {
  root = validateRoot(root);
  if (!confirm || !Number.isInteger(keep) || keep < 1) throw new Error('Prune requires --keep N --confirm.');
  const snapshots = fs.readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory() && /^\d{8}T\d{9}Z$/.test(e.name))
    .map(e => e.name).sort().reverse();
  for (const name of snapshots.slice(keep)) {
    const dir = path.join(root, name);
    if (!fs.existsSync(path.join(dir, 'COMPLETE.json'))) continue;
    fs.rmSync(dir, { recursive: true, force: true });
    for (const file of [dir + '.tar.gz', dir + '.tar.gz.sha256']) try { fs.unlinkSync(file); } catch {}
  }
  console.log(`Pruned successful snapshots older than the ${keep} newest; incomplete runs were kept.`);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === 'help') return console.log(usage);
  if (command === 'setup') return setup();
  if (command === 'run') return runBackup(options);
  if (command === 'install-schedule') return installSchedule(options);
  if (command === 'uninstall-schedule') return uninstallSchedule();
  if (command === 'prune') return prune(options);
  if (command === 'decrypt-config') return decryptEnvironment(options);
  throw new Error(`Unknown command: ${command}\n${usage}`);
}

main().catch(error => { console.error(safeError(error)); process.exitCode = 1; });
