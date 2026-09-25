# Pramora Living backup utility

This utility takes full local snapshots of the production PostgreSQL database, **every file in the connected production Vercel Blob store**, the production GitHub source revision and its static assets. Each snapshot has a root `BACKUP-REPORT.md`, an image-reference manifest, a database dump, file checksums and a restore guide. A snapshot is marked complete only after an isolated local PostgreSQL restore matches the source rows and the Blob inventory matches before and after download. Successful snapshots automatically retain 30 daily dates plus 12 monthly points; the newest backup is kept in either set.

The tool is read-only against production. It never uploads or deletes Blob objects or changes the database. Credentials are pulled for one run, held in process memory or a private temporary file, and discarded. Exportable production settings are encrypted in each snapshot with AES-256-GCM. The encryption key and Blob access token stay outside each snapshot in the protected backup root and macOS login Keychain, respectively. Plaintext production credentials are not written into backup files or logs.

## Requirements

- macOS, an unlocked user login session, Homebrew, Python 3, Node.js 22 or later, `@vercel/blob` and `dotenv` from the project's installed dependencies, and PostgreSQL 17 command line tools (`brew install postgresql@17`).
- The Vercel CLI linked to the correct `pramora-living` project, with permission to read production environment values, deployment metadata and the connected Blob store. Vercel CLI 60.0.0 or later is recommended; upgrade before enabling the scheduled job if the installed version is older.
- Enough free disk space for a full snapshot and its portable `.tar.gz` copy. The utility requires at least 1 GB available before a run.
- macOS FileVault enabled for data-at-rest protection. Keep a second copy of completed archives on a different disk; this Mac is not a second failure domain.

## One-time setup

Run from the repository root. Add the production store's `BLOB_READ_WRITE_TOKEN` at the hidden Keychain prompt. It needs read access for listing and downloading; it is never passed in command-line arguments. Verify the Keychain is unlocked and this command finishes before installing the background schedule.

```sh
node scripts/backup/backup.mjs setup
```

This uses macOS's `security add-generic-password` prompt and saves a generic password named `com.pramoraliving.backup.blob-token` in the current user's login Keychain. To replace a rotated token, run `setup` again. Do not paste it into a shell command, source file, `.env` file, chat, or log.

## Run and inspect a snapshot

```sh
node scripts/backup/backup.mjs run
```

The first run creates a random 32-byte environment encryption key at `<backup-root>/keys/production-env.aes-key` (by default `~/PramoraBackups/keys/production-env.aes-key`). Keep it safe and copy it to your separate recovery location along with an archive. The key is never included in a snapshot or archive. Losing this key prevents decrypting saved settings; the database and media remain restorable without it.

By default this writes dated snapshot folders and `.tar.gz` archives under `~/PramoraBackups/`. Use `--root /path/to/another/disk` to choose a different backup destination. The root is created with private permissions. Each run:

1. Confirms the Vercel project and pulls the production settings into a mode 0600 temporary file.
2. Captures a consistent read-only PostgreSQL snapshot and custom dump; restores it into an isolated temporary PostgreSQL 17 cluster and compares every table's row count and canonical row hash.
3. Pins the Git revision used by the current production deployment and saves that source archive plus its public assets.
4. Paginates the connected Blob store, downloads every object, hashes every file, lists the store again, and fails if any object changed during the download.
5. Matches each database product and hero image reference to the saved Blob objects and writes both JSON and CSV manifests plus SQL for remapping image URLs on a different host.
6. Writes `BACKUP-REPORT.md`, checksums, and a `COMPLETE.json` marker; creates and checks a portable archive and adjacent SHA-256 sidecar; then applies snapshot retention.

Use the report at the top of every snapshot as the first status check. A run interrupted by an error stays in a `.partial` folder without a `COMPLETE.json`; it is not treated as a valid restore point. Its error report is redacted. Resolve the reported problem and start a fresh run.

## Install the daily schedule

```sh
node scripts/backup/backup.mjs install-schedule
```

This installs a per-user `launchd` agent for 02:00 local Mac time and runs it once immediately after loading. The user must be logged in and the Keychain unlocked. Set the Mac's time zone to `Asia/Kolkata` for the intended India schedule. Check `~/PramoraBackups/logs/backup.log` and `backup-error.log` after the first scheduled run and periodically afterwards.

```sh
node scripts/backup/backup.mjs uninstall-schedule
```

Removing the schedule does not remove any backup.

## Retention and cleanup

After a new database restore and all files have been verified, the utility retains the latest snapshot for each of the newest 30 UTC calendar dates and the latest snapshot in each of the newest 12 calendar months. It removes only older snapshots created by this utility that have a `COMPLETE.json` marker, a portable archive and its checksum sidecar. Incomplete runs are never automatically removed. Copy the backup to a separate disk before older local snapshots expire.

To reduce retention manually to the newest 30 successful snapshots, run this explicit cleanup command:

```sh
node scripts/backup/backup.mjs prune --keep 30 --confirm
```

Incomplete snapshots are preserved for inspection. Copy an archive and its `.sha256` sidecar to a separate disk before pruning the local copy.

## Restore

Extract one archive. Verify the archive against its sibling SHA-256 file, then run `python3 tools/backup-utility/verify-files.py` if that helper is available (for snapshots produced after this utility is installed, its source is included under `tools/backup-utility/`). Read the snapshot's root `BACKUP-REPORT.md` and `RESTORE.md` before proceeding.

Provision a new empty PostgreSQL 17+ database and configure the destination PostgreSQL client variables. Restore only into that empty destination:

```sh
pg_restore --exit-on-error --single-transaction --no-owner --no-privileges \\
  --dbname="$PGDATABASE" database/production.dump
```

The PostgreSQL dump has the database schema and data; it does not recreate Neon as a service, PostgreSQL cluster roles/passwords, or a Neon Auth provider account. Recreate destination roles and configure authentication for the selected host. Copy the contents of `blobs/` into the site's `public/restored-media/` folder, review `manifests/url-remapping.json`, then apply `tools/remap-media-to-local.sql` to the **restored destination database only**. For S3 or another object store, replace destination URLs with that store's paths and preserve each file's MIME type.

Exportable Vercel environment settings are encrypted in `configuration/production-environment.aes-256-gcm.json`. The decryption key is kept separately at `~/PramoraBackups/keys/production-env.aes-key` and is not in the snapshot archive. Copy it to the restore machine, then write the clear settings into a new private file:

```sh
node tools/backup-utility/backup.mjs decrypt-config \\
  --input configuration/production-environment.aes-256-gcm.json \\
  --key /path/to/production-env.aes-key \\
  --output /secure/path/production-environment.json
```

The output is JSON and created with mode 0600; the command refuses to overwrite an existing file. Vercel did not export values it marked `[SENSITIVE]`; the encrypted inventory lists those setting names for you to reissue. The Blob token is stored in macOS Keychain and is not exportable from this backup, so create a new storage credential when migrating.

The website needs application changes to replace Neon HTTP and Vercel Blob upload/delete behavior. This utility checks the database and files; it does not perform an AWS/Hostinger deployment or change production application settings.

## Snapshot naming and integrity

Each snapshot folder is named by its UTC start time, including milliseconds. `manifests/files.sha256.json` covers the files in that folder except the checksum list and `verification/file-integrity.json` to avoid self-referential hashes. Blob files have their own SHA-256 values in `manifests/blob-manifest.json`. The portable archive's checksum is in the adjacent `.tar.gz.sha256` file.

The database and Blob store do not share a transaction. The exporter holds a PostgreSQL snapshot for the database dump and row export, then checks that the Blob store inventory remained unchanged through the media download. If Blob files changed, it rejects the run and requests a new snapshot. New database-only product image references also cause the run to be marked incomplete until the corresponding files are available.

Source code for this utility is stored alongside the application in `scripts/backup/` and copied into each backup. The production app's source archive and commit SHA are separately saved for reconstruction.
