-- ==============================================================================
-- Single Table Database Schema for Medicine Inventory
-- Database: Supabase PostgreSQL (Project: ximmktvbqsijgpawhcee)
-- Table: public.inventory (ONLY ONE TABLE)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

-- Performance Indexes
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
