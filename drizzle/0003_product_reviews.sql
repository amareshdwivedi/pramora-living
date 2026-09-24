ALTER TABLE products
ADD COLUMN IF NOT EXISTS reviews jsonb NOT NULL DEFAULT '[]'::jsonb;
