ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "images" jsonb DEFAULT '[]'::jsonb NOT NULL;
