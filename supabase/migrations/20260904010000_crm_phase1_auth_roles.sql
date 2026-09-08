-- =============================================================================
-- SalisCRM PHASE 1 — Auth / rôles / helpers RLS
-- Projet Supabase partagé avec pro-extract-hub (leads + staff_profiles existent).
-- Idempotent autant que possible.
-- =============================================================================

-- Préparer le rôle prestataire (accès limité — modules futurs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'staff_role' AND e.enumlabel = 'prestataire'
  ) THEN
    ALTER TYPE public.staff_role ADD VALUE 'prestataire';
  END IF;
END
$$;

-- Helpers sécurité (SECURITY DEFINER, search_path fixe)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'commercial', 'prestataire')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_commercial_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'commercial')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS public.staff_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.staff_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Trigger updated_at réutilisable
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Droits staff_profiles
GRANT SELECT ON public.staff_profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.staff_profiles TO authenticated;
GRANT ALL ON public.staff_profiles TO service_role;

ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read own profile" ON public.staff_profiles;
DROP POLICY IF EXISTS "Admins manage staff profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "Admins insert staff profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "Admins update staff profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "Admins delete staff profiles" ON public.staff_profiles;

CREATE POLICY "Staff can read own profile"
  ON public.staff_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins insert staff profiles"
  ON public.staff_profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins update staff profiles"
  ON public.staff_profiles FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete staff profiles"
  ON public.staff_profiles FOR DELETE TO authenticated
  USING (public.is_admin());

-- Restreindre leads : admin/commercial uniquement (prestataire = accès limité futur)
DROP POLICY IF EXISTS "Staff can read leads" ON public.leads;
DROP POLICY IF EXISTS "Staff can update leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;

CREATE POLICY "Staff can read leads"
  ON public.leads FOR SELECT TO authenticated
  USING (public.is_commercial_or_admin());

CREATE POLICY "Staff can update leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (public.is_commercial_or_admin())
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Admins can delete leads"
  ON public.leads FOR DELETE TO authenticated
  USING (public.is_admin());

-- INSERT public (site commercial) conservé : "Anyone can submit a lead"

COMMENT ON TABLE public.staff_profiles IS
  'Profils internes SalisCRM / pro-extract-hub. Seuls les users présents ici ont accès métier. Premier admin à créer manuellement.';
