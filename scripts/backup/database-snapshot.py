#!/usr/bin/env python3
"""Export one consistent Postgres snapshot and verify restoring it locally."""
import datetime, hashlib, json, os, pathlib, shutil, subprocess, sys, urllib.parse, tempfile, shlex, atexit

backup = pathlib.Path(sys.argv[1]).resolve()
pg_url = os.environ.get('DATABASE_URL_UNPOOLED') or os.environ.get('DATABASE_URL')
if not pg_url:
    raise SystemExit('Production DATABASE_URL is missing from the pulled environment.')
parsed = urllib.parse.urlparse(pg_url)
pg_bin = pathlib.Path(shutil.which('pg_dump') or '').resolve().parent
if not (pg_bin / 'pg_dump').is_file():
    brew = shutil.which('brew')
    if brew:
        prefix = subprocess.run([brew, '--prefix', 'postgresql@17'], capture_output=True, text=True)
        if prefix.returncode == 0:
            pg_bin = pathlib.Path(prefix.stdout.strip()) / 'bin'
if not (pg_bin / 'pg_dump').is_file():
    raise SystemExit('PostgreSQL 17 command line tools are required. Install with: brew install postgresql@17')

def save(rel, value):
    p = backup / rel
    p.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    p.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')

def conn_env(url, local=False, socket=None):
    u = urllib.parse.urlparse(url)
    env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
    env.update(PGCONNECT_TIMEOUT='20', PGOPTIONS='-c timezone=UTC')
    if local:
        env.update(PGHOST=str(socket), PGPORT='55439', PGDATABASE='postgres',
                   PGUSER=os.environ.get('USER', 'postgres'))
    else:
        env.update(PGHOST=u.hostname or '', PGPORT=str(u.port or 5432),
                   PGDATABASE=u.path.lstrip('/'), PGUSER=urllib.parse.unquote(u.username or ''),
                   PGPASSWORD=urllib.parse.unquote(u.password or ''), PGSSLMODE='require',
                   PGOPTIONS='-c timezone=UTC -c default_transaction_read_only=on')
    return env

def run(name, args, env, stdin=None):
    proc = subprocess.run([str(pg_bin / name), *args], env=env, input=stdin,
                          text=True, capture_output=True)
    if proc.returncode:
        # Never persist the environment, connection URI, query result, or raw error details.
        raise RuntimeError(f'{name} exited {proc.returncode}; inspect the private run log.')
    return proc.stdout

def q(sql, env, snapshot=None):
    prefix = ''
    suffix = ''
    if snapshot:
        prefix = "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET TRANSACTION SNAPSHOT '" + snapshot + "';\n"
        suffix = '\nCOMMIT;'
    return run('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], env, prefix + sql + suffix)

def canonical_hash(rows):
    rendered = '\n'.join(sorted(json.dumps(row, sort_keys=True, separators=(',', ':'), ensure_ascii=False) for row in rows))
    return hashlib.sha256(rendered.encode()).hexdigest()

def ident(s): return '"' + s.replace('"', '""') + '"'
remote = conn_env(pg_url)
work = pathlib.Path(tempfile.mkdtemp(prefix='pramora-restore-', dir=os.environ.get('TMPDIR', '/tmp')))
atexit.register(shutil.rmtree, work, True)
socket = work / 'socket'
socket.mkdir(mode=0o700)
cluster = work / 'cluster'
server = None
keeper = subprocess.Popen([str(pg_bin / 'psql'), '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'],
                          env=remote, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                          stderr=subprocess.DEVNULL, text=True, bufsize=1)
try:
    keeper.stdin.write('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSELECT pg_export_snapshot();\n')
    keeper.stdin.flush()
    snapshot_id = keeper.stdout.readline().strip()
    if not snapshot_id:
        raise RuntimeError('Could not export the production database snapshot.')
    tables = json.loads(q("SELECT coalesce(json_agg(x),'[]') FROM (SELECT n.nspname AS schema,c.relname AS name,c.relkind AS kind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p','m','f') AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' ORDER BY 1,2) x;", remote, snapshot_id))
    metadata = json.loads(q("SELECT json_build_object('database',current_database(),'role',current_user,'version',version(),'snapshot_time',now(),'extensions',(SELECT json_agg(row_to_json(e)) FROM (SELECT extname,extversion FROM pg_extension) e),'roles',(SELECT json_agg(row_to_json(r)) FROM (SELECT rolname,rolcanlogin,rolsuper FROM pg_roles WHERE rolname NOT LIKE 'pg_%') r));", remote, snapshot_id))
    metadata.update(host=parsed.hostname, exportedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
    save('database/source-metadata.json', metadata)
    run('pg_dump', ['--format=custom', '--snapshot=' + snapshot_id, '--file=' + str(backup / 'database/production.dump')], remote)
    run('pg_dump', ['--schema-only', '--snapshot=' + snapshot_id, '--file=' + str(backup / 'database/schema.sql')], remote)
    exports, manifest = {}, []
    for table in tables:
        sql = 'SELECT row_to_json(t)::text FROM ' + ident(table['schema']) + '.' + ident(table['name']) + ' t;'
        rows = [json.loads(line) for line in q(sql, remote, snapshot_id).splitlines() if line]
        key = table['schema'] + '.' + table['name']
        exports[key] = rows
        manifest.append({**table, 'rows': len(rows), 'canonicalRowsSha256': canonical_hash(rows)})
    save('database/tables.json', exports)
    save('database/source-table-manifest.json', manifest)
finally:
    try:
        keeper.stdin.write('ROLLBACK;\n\\q\n')
        keeper.stdin.flush()
        keeper.wait(timeout=30)
    except Exception:
        keeper.kill()

try:
    local = conn_env('postgres://localhost/postgres', local=True, socket=socket)
    run('initdb', ['-D', str(cluster), '--encoding=UTF8', '--locale=C', '--auth-local=trust', '--auth-host=reject'], local)
    postgres_options = '-k ' + shlex.quote(str(socket)) + ' -p 55439 -c listen_addresses='
    run('pg_ctl', ['-D', str(cluster), '-l', str(work / 'postgres.log'), '-o', postgres_options, '-w', 'start'], local)
    server = True
    run('createdb', ['pramora_restore_verify'], local)
    local['PGDATABASE'] = 'pramora_restore_verify'
    run('pg_restore', ['--exit-on-error', '--single-transaction', '--no-owner', '--no-privileges', '--dbname=pramora_restore_verify', str(backup / 'database/production.dump')], local)
    checks = []
    for table in manifest:
        sql = 'SELECT row_to_json(t)::text FROM ' + ident(table['schema']) + '.' + ident(table['name']) + ' t;'
        rows = [json.loads(line) for line in q(sql, local).splitlines() if line]
        checks.append({'table': table['schema'] + '.' + table['name'], 'rows': len(rows),
                       'canonicalRowsSha256': canonical_hash(rows),
                       'matchesProductionSnapshot': len(rows) == table['rows'] and canonical_hash(rows) == table['canonicalRowsSha256']})
    report = {'status': 'passed' if all(x['matchesProductionSnapshot'] for x in checks) else 'FAILED',
              'restoredAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'serverVersion': q('SHOW server_version;', local).strip(), 'tables': checks}
    save('verification/database-restore.json', report)
    if report['status'] != 'passed':
        raise RuntimeError('Database restore verification did not match the production snapshot.')
finally:
    if server:
        run('pg_ctl', ['-D', str(cluster), '-m', 'fast', '-w', 'stop'], local)
    shutil.rmtree(work, ignore_errors=True)
print('Database snapshot and isolated restore verification passed.')
