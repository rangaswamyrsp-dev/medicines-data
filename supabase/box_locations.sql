-- ==============================================================================
-- Box Locations Table — RSP Medical Billing
-- Run this in Supabase SQL Editor
-- Project: ximmktvbqsijgpawhcee
-- ==============================================================================

-- Create the table
CREATE TABLE IF NOT EXISTS public.box_locations (
    id          text PRIMARY KEY,          -- Item ID from Excel (e.g. ACE0001)
    item_name   text NOT NULL,             -- Medicine name
    box_no      text NOT NULL,             -- Box / shelf number (e.g. R01-B001)
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Fast search index on item_name (case-insensitive)
CREATE INDEX IF NOT EXISTS box_locations_item_name_idx
    ON public.box_locations (lower(item_name));

-- Index on box_no for reverse lookup
CREATE INDEX IF NOT EXISTS box_locations_box_no_idx
    ON public.box_locations (box_no);

-- ── Row Level Security ──────────────────────────────────────────────────────
ALTER TABLE public.box_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read box_locations"   ON public.box_locations;
DROP POLICY IF EXISTS "Allow insert box_locations"  ON public.box_locations;
DROP POLICY IF EXISTS "Allow update box_locations"  ON public.box_locations;
DROP POLICY IF EXISTS "Allow delete box_locations"  ON public.box_locations;

CREATE POLICY "Allow read box_locations"
    ON public.box_locations FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow insert box_locations"
    ON public.box_locations FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow update box_locations"
    ON public.box_locations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete box_locations"
    ON public.box_locations FOR DELETE TO anon, authenticated USING (true);

-- ── Permissions ─────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.box_locations TO anon, authenticated;

-- ── Auto-update updated_at on every row change ───────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS box_locations_updated_at ON public.box_locations;
CREATE TRIGGER box_locations_updated_at
    BEFORE UPDATE ON public.box_locations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
