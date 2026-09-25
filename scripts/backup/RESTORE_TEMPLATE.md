# Pramora Living restore guide

Read the backup's root `BACKUP-REPORT.md` first. Restore only from a snapshot whose report says `VERIFIED` and that contains `COMPLETE.json`.

## Restore the database

Install PostgreSQL 17+ tools and provision a new, empty destination database. Set `PGHOST`, `PGPORT`, `PGUSER`, and `PGDATABASE` for that destination. Supply the destination password through a private `.pgpass` file (mode 0600) or the PostgreSQL client's prompt. Do not use the source `DATABASE_URL` as the restore destination.

```sh
pg_restore --exit-on-error --single-transaction --no-owner --no-privileges \\
  --dbname="$PGDATABASE" database/production.dump
```

The tested restore uses `--no-owner --no-privileges` because managed database owner/ACL names do not generally exist on a new host. Recreate destination roles and permissions explicitly. The dump does not recreate PostgreSQL cluster-level roles, credentials, Neon infrastructure, or a Neon Auth provider account. Review `database/source-metadata.json`, `database/source-table-manifest.json` and `verification/database-restore.json`.

Exportable Vercel settings are encrypted in `configuration/production-environment.aes-256-gcm.json`. The report shows where the separate environment encryption key is stored; the key is not included in the archive. Copy that key to the restore machine and run:

```sh
node tools/backup-utility/backup.mjs decrypt-config \\
  --input configuration/production-environment.aes-256-gcm.json \\
  --key /secure/path/production-env.aes-key \\
  --output /secure/path/production-environment.json
```

The result is mode 0600 JSON. Any values Vercel marked `[SENSITIVE]` must be reissued. The Blob token lives in the original Mac's Keychain and is not in the archive.

## Restore files and image paths

The `blobs/` tree preserves each Vercel store's file paths. Copy its contents into the deployed site's `public/restored-media/` folder, preserving all subdirectories. Then review and apply the SQL to the restored database only:

```sh
psql -X --set=ON_ERROR_STOP=1 --dbname="$PGDATABASE" \\
  --file=tools/remap-media-to-local.sql
```

The SQL updates product image fields and hero-slide image URLs while retaining product content, reviews, image order and slide settings. `manifests/url-remapping.json` has the old-to-new URL mapping. For another object store, adapt that mapping to the destination URLs and preserve the MIME types in `manifests/blob-manifest.json`.

## Rebuild the site

The source archive and exact production Git commit are in `configuration/production-source.json`. Extract `source-production.tar.gz` or check out that commit from GitHub. Install the destination's supported Node.js version and dependencies, then configure:

- A standard PostgreSQL driver in place of the app's Neon HTTP client, if the destination is not Neon.
- An image storage adapter for uploads/deletes; local URL remapping restores existing images but does not enable future media management.
- A new admin password, public site URL, mail provider settings, domain/DNS, HTTPS, a server process manager and the destination's environment variables.
- An authentication provider if the site uses any Neon Auth functionality. Database table data alone does not recreate the managed provider.

Run storefront, admin, database and image checks on a staging hostname before routing production DNS. This backup's isolated restore verification does not certify a full migration to another cloud.

## Protect the recovery copy

The archive excludes Vercel credentials and database passwords. Issue new destination credentials during migration; do not commit them to GitHub. Keep a second copy of the backup archive on a different disk. Enable FileVault for this Mac's local backup folder and keep any separate encryption/recovery keys somewhere other than the backup disk.
