# Amazon image URL CSV utility

Standalone Node.js utility for turning a Seller Central inventory CSV into an image manifest CSV. It does not depend on the Pramora Living app, database, or Vercel credentials.

## Requirements

- Node.js 18 or newer
- Internet access to Amazon

## Run

From this directory:

```bash
node index.mjs /path/to/seller-central.csv /path/to/amazon-image-urls.csv
```

The output path is optional. If omitted, the utility writes a file next to the input with `-image-urls.csv` appended to its name.

To reduce or increase parallel requests:

```bash
node index.mjs seller-central.csv image-urls.csv --concurrency 2
```

The output keeps every column and value from the Seller Central CSV, replaces any existing `Image URL N` columns with one column per image found in Amazon's product carousel, and appends `About this item`, `Image Count`, and `Error`. The About column contains one bullet per line. Rows remain in the same order as the input CSV.

The utility only discovers URLs. It does not upload files to Vercel Blob or modify products. The resulting manifest is intended for a separate production Blob-import step.

## Single-click desktop app

The project includes an Electron desktop wrapper. To build installers on a development machine:

```bash
npm install
npm run desktop:build
```

Installers are written to `dist/` as a macOS `.dmg`, Windows installer/zip, and Linux AppImage/zip. The recipient only opens the installed app, clicks **Choose CSV and fetch images**, selects the Seller Central CSV, and chooses where to save the manifest.

For both Windows and macOS without setting up Node, run the GitHub Actions workflow named **Build Amazon Image CSV desktop app**. It builds each installer on its native operating system and publishes downloadable artifacts for both platforms.

The generated installers are currently unsigned. macOS may require opening the app via right-click → Open, and Windows may show a SmartScreen warning until the application is code-signed.

For local development:

```bash
npm install
npm run desktop
```

## Browser interface

To use a small local HTML interface instead of the command line:

```bash
node server.mjs
```

Open [http://localhost:8787](http://localhost:8787), choose the Seller Central CSV, and click **Fetch image URLs**. The server performs the Amazon requests locally and the browser downloads `amazon-image-urls.csv`.
