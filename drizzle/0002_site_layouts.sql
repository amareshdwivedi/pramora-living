CREATE TABLE IF NOT EXISTS site_layouts (
  id text PRIMARY KEY,
  catalog_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  featured_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  story_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  hero_slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
