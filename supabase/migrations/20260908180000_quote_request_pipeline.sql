-- SalisCRM — pipeline demandes de devis (site → CRM)
-- Même projet Supabase que pro-extract-hub.
-- Ne recrée PAS public.leads : le formulaire public INSERT déjà dans cette table (source = website_form).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS filter_type text,
  ADD COLUMN IF NOT EXISTS motor_type text;

COMMENT ON COLUMN public.leads.source IS
  'Origine commerciale. Le site public utilise website_form (ne pas dupliquer dans une autre table).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  END IF;
END $$;
