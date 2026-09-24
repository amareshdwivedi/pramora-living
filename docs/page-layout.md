# Page layout controls

The `/admin/layout` page manages three independent storefront areas:

- **All Products Order:** drag rows or use the Move Up/Down buttons, then save. Only active products are shown. New active products appear at the end until reordered.
- **Homepage:** choose and order up to six Featured Pieces and four Story Images. These lists do not change when the catalog order changes.
- **Hero Banner:** manage up to five slides. Each slide links to an active product and can show a product-gallery image or a banner-specific upload. Reorder slides, disable them, or remove them. Aim for four or five enabled slides.

Each section has independent Save and Discard controls. Unsaved changes are visible only in the editor. Removing every hero slide restores the original category-based carousel.

## Database setup

This feature adds the `site_layouts` table through `drizzle/0002_site_layouts.sql`. The app can continue rendering its existing layout before the migration. Until the table exists, Admin shows a read-only preview and disables saving and banner uploads.

The migration was applied to the currently linked Neon database on 2026-09-24. At that time, the Vercel development, preview, and production environments all used the same `DATABASE_URL`, so the table is available to all three. The verification save stored an empty hero list; it did not change the storefront layout. Recheck the environment mapping before making future schema or content changes.

For a newly provisioned database, confirm that `.env.local` points to that intended database, then run:

```sh
npm run db:migrate:layout
```

The migration is additive and safe to rerun. Before an admin saves a layout, the current product order and homepage content remain the fallback. Hero uploads use the connected private Vercel Blob store; product images need no extra storage setup. Currently, Blob credentials are configured for Vercel Preview and Production but not Vercel Development. The local editor disables banner uploads without those credentials; choosing existing product images still works.

## Rules and fallbacks

- Only active products can be placed in homepage slots or hero slides.
- The server validates the full active-product list before saving catalog order, so a stale admin tab cannot silently omit a newly published product.
- An unpublished or deleted homepage product is omitted. An invalid hero slide is skipped on the storefront and shown with a warning in Admin.
- When a product-gallery image is removed, the hero uses that product’s current main image if available.
- Removing a saved banner-specific image from all hero slides deletes that image from Blob after the new layout is saved.
- A successful save refreshes the homepage and All Products page.
