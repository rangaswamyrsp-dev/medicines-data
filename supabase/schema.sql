-- ==============================================================================
-- RSP Medical Billing & Inventory Database Schema
-- Database: Supabase PostgreSQL (Project: ximmktvbqsijgpawhcee)
-- Tables: public.inventory (Batches), public.product_master (Smart Barcode Catalog)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. PRODUCT MASTER (Permanent Product Information)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.product_master (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    barcode text UNIQUE NOT NULL,
    gtin text,
    upc text,
    ean text,
    product_name text NOT NULL,
    brand_name text,
    manufacturer text,
    description text,
    category text,
    product_type text,
    pack_size text,
    unit text,
    mrp numeric,
    hsn_code text,
    gst_percentage numeric,
    composition text,
    ingredients text,
    product_image_url text,
    source text NOT NULL DEFAULT 'manual',
    source_provider text,
    source_product_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Fast Indexes for Product Master
CREATE INDEX IF NOT EXISTS product_master_barcode_idx ON public.product_master (barcode);
CREATE INDEX IF NOT EXISTS product_master_gtin_idx ON public.product_master (gtin);
CREATE INDEX IF NOT EXISTS product_master_product_name_idx ON public.product_master (lower(product_name));

-- Row Level Security (RLS) for Product Master
ALTER TABLE public.product_master ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read product_master" ON public.product_master;
CREATE POLICY "Allow read product_master"
ON public.product_master FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow insert product_master" ON public.product_master;
CREATE POLICY "Allow insert product_master"
ON public.product_master FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update product_master" ON public.product_master;
CREATE POLICY "Allow update product_master"
ON public.product_master FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete product_master" ON public.product_master;
CREATE POLICY "Allow delete product_master"
ON public.product_master FOR DELETE
TO anon, authenticated
USING (true);

GRANT ALL ON public.product_master TO anon, authenticated;

-- ==============================================================================
-- 2. BATCH INVENTORY (Batch-specific stock entries)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventory (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid DEFAULT auth.uid(),
    user_name text NOT NULL DEFAULT 'Operator',

    item_name text NOT NULL,
    manufacturer text NOT NULL,
    type text NOT NULL,

    batch_code text NOT NULL,

    pack_size text NOT NULL,
    no_of_pack numeric NOT NULL DEFAULT 0,

    units text NOT NULL,

    mrp numeric NOT NULL DEFAULT 0,

    expiry_month integer NOT NULL,
    expiry_year integer NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Performance Indexes for inventory
CREATE INDEX IF NOT EXISTS inventory_created_idx
ON public.inventory (created_at DESC);

CREATE INDEX IF NOT EXISTS inventory_item_name_idx
ON public.inventory (lower(item_name));

CREATE INDEX IF NOT EXISTS inventory_batch_code_idx
ON public.inventory (lower(batch_code));

CREATE INDEX IF NOT EXISTS inventory_manufacturer_idx
ON public.inventory (lower(manufacturer));

CREATE INDEX IF NOT EXISTS inventory_type_idx
ON public.inventory (lower(type));

-- Row Level Security (RLS)
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read inventory" ON public.inventory;
CREATE POLICY "Allow read inventory"
ON public.inventory
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow insert inventory" ON public.inventory;
CREATE POLICY "Allow insert inventory"
ON public.inventory
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update inventory" ON public.inventory;
CREATE POLICY "Allow update inventory"
ON public.inventory
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete inventory" ON public.inventory;
CREATE POLICY "Allow delete inventory"
ON public.inventory
FOR DELETE
TO anon, authenticated
USING (true);

-- Permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.inventory
TO anon, authenticated;
