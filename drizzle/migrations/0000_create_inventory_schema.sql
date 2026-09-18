-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Ensure profile + role after sign-in (first user becomes admin)
CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  claims jsonb := auth.jwt();
  uname text;
  uemail text;
  r text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  uemail := COALESCE(claims->>'email', '');
  uname := COALESCE(NULLIF(claims->'user_metadata'->>'name', ''), split_part(uemail, '@', 1), 'User');
  INSERT INTO public.profiles (id, name, email) VALUES (uid, uname, uemail)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid) THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'user');
    ELSE
      INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin');
    END IF;
  END IF;
  SELECT role::text INTO r FROM public.user_roles WHERE user_id = uid ORDER BY (role = 'admin') DESC LIMIT 1;
  RETURN r;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ensure_profile() TO authenticated;

-- Lookup tables
CREATE TABLE public.manufacturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX manufacturers_name_ci ON public.manufacturers (lower(manufacturer_name));

CREATE TABLE public.item_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX item_types_name_ci ON public.item_types (lower(type_name));

CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX units_name_ci ON public.units (lower(unit_name));

GRANT SELECT, INSERT, DELETE ON public.manufacturers, public.item_types, public.units TO authenticated;
GRANT ALL ON public.manufacturers, public.item_types, public.units TO service_role;
ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read manufacturers" ON public.manufacturers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Add manufacturers" ON public.manufacturers FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admin delete manufacturers" ON public.manufacturers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Read types" ON public.item_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Add types" ON public.item_types FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admin delete types" ON public.item_types FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Read units" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Add units" ON public.units FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admin delete units" ON public.units FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.item_types (type_name) VALUES
 ('Tablet'),('Capsule'),('Syrup'),('Injection'),('Cream'),('Gel'),('Drops'),('Powder'),('Suspension'),('Other');
INSERT INTO public.units (unit_name) VALUES
 ('Tablets'),('Capsules'),('Strips'),('Bottles'),('Tubes'),('Boxes'),('Pieces'),('Vials'),('Sachets'),('Packs'),('ml'),('g'),('kg');

-- Inventory
CREATE TABLE public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  item_name text NOT NULL,
  manufacturer text NOT NULL,
  type text NOT NULL,
  batch_code text NOT NULL,
  pack_size text NOT NULL,
  no_of_pack numeric NOT NULL,
  units text NOT NULL,
  mrp numeric NOT NULL,
  expiry_month integer NOT NULL,
  expiry_year integer NOT NULL,
  sheet_synced boolean NOT NULL DEFAULT false,
  sheet_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_user_idx ON public.inventory (user_id, created_at DESC);
CREATE INDEX inventory_created_idx ON public.inventory (created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO authenticated;
GRANT ALL ON public.inventory TO service_role;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or admin" ON public.inventory FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert own" ON public.inventory FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own or admin" ON public.inventory FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Delete own or admin" ON public.inventory FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- App settings (single row)
CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  spreadsheet_id text,
  sheet_name text NOT NULL DEFAULT 'Sheet1',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin insert settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.app_settings (id) VALUES (1);