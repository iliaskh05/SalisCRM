-- =============================================================================
-- Socle partagé avec pro-extract-hub (site public) : staff_profiles, leads,
-- bucket des photos de demandes.
-- En production ces objets existent déjà : tout est conditionnel (IF NOT EXISTS,
-- policies créées seulement si absentes), rien n'est modifié.
-- Sur une base neuve (staging, dev, tests, reprise après incident), ce fichier
-- recrée l'état attendu par les migrations suivantes.
-- Sur un projet déjà migré, `supabase db push` demandera --include-all : sans risque.
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.staff_role AS ENUM ('admin', 'commercial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.staff_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.staff_role NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM (
    'new', 'contacted', 'qualified', 'quote_requested', 'quote_sent', 'won', 'lost'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Colonnes écrites par le formulaire du site (pro-extract-hub). Les colonnes
-- ajoutées par SalisCRM viennent des migrations suivantes.
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text,
  source text NOT NULL DEFAULT 'website_form',
  status public.lead_status NOT NULL DEFAULT 'new',
  priority text,
  company_name text,
  contact_name text,
  phone text,
  email text,
  business_type text,
  city text,
  postal_code text,
  need_type text,
  request_type text,
  installation_type text,
  hood_type text,
  hood_length text,
  filter_count integer,
  duct_present boolean,
  duct_length text,
  motor_present boolean,
  soil_level text,
  accessibility text,
  night_intervention boolean,
  schedule_preference text,
  last_cleaning text,
  requested_frequency text,
  maintenance_frequency text,
  urgency_level text,
  preferred_contact text,
  consent boolean,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  message text,
  notes text,
  assigned_user uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  next_action text,
  next_due_at timestamptz,
  last_intervention_at timestamptz,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  landing_page text,
  service_source text,
  zone_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_created_at_idx ON public.leads (created_at DESC);
CREATE INDEX IF NOT EXISTS leads_status_idx ON public.leads (status);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

-- Formulaire public : insertion anonyme (validée par trg_leads_public_guard plus loin)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'leads' AND cmd = 'INSERT'
  ) THEN
    CREATE POLICY "Anyone can submit a lead"
      ON public.leads FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Photos jointes aux demandes : bucket privé, dépôt anonyme par le site,
-- lecture staff (URL signées). Policies créées seulement si le bucket n'en a aucune.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lead-documents',
  'lead-documents',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%lead-documents%'
  ) THEN
    CREATE POLICY "Public upload lead documents"
      ON storage.objects FOR INSERT TO anon, authenticated
      WITH CHECK (bucket_id = 'lead-documents');

    -- is_staff() n'existe qu'après la migration phase1 : contrôle inline ici
    CREATE POLICY "Staff read lead documents"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'lead-documents'
        AND EXISTS (
          SELECT 1 FROM public.staff_profiles s
          WHERE s.user_id = auth.uid() AND s.role::text IN ('admin', 'commercial')
        )
      );
  END IF;
END $$;
