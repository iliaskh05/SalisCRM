-- SalisCRM phase 3 — opérations devis / intervention / rentabilité
-- Additive, idempotent where possible.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS installation_id uuid REFERENCES public.client_installations (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_ht numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS converted_intervention_id uuid;

ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quotes (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS address text;

CREATE INDEX IF NOT EXISTS quotes_installation_id_idx ON public.quotes (installation_id);
CREATE INDEX IF NOT EXISTS interventions_quote_id_idx ON public.interventions (quote_id);

CREATE TABLE IF NOT EXISTS public.intervention_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL REFERENCES public.interventions (id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  quantity numeric(12, 2) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'unité',
  unit_cost numeric(12, 2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT intervention_products_qty_check CHECK (quantity > 0),
  CONSTRAINT intervention_products_cost_check CHECK (unit_cost >= 0)
);

CREATE INDEX IF NOT EXISTS intervention_products_intervention_id_idx
  ON public.intervention_products (intervention_id);

CREATE TABLE IF NOT EXISTS public.intervention_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL UNIQUE REFERENCES public.interventions (id) ON DELETE CASCADE,
  work_completed text,
  observations text,
  difficulties text,
  recommendations text,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_signature text,
  client_signature text,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.electronic_invoice_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  format text NOT NULL DEFAULT 'facturx',
  status text NOT NULL DEFAULT 'ready',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  transmitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT electronic_invoice_status_check CHECK (status IN ('draft', 'ready', 'submitted', 'accepted', 'rejected'))
);

CREATE INDEX IF NOT EXISTS electronic_invoice_documents_invoice_id_idx
  ON public.electronic_invoice_documents (invoice_id);

COMMENT ON TABLE public.electronic_invoice_documents IS
  'Couche e-facture (Factur-X / UBL / CII). Ne pas marquer submitted sans PDP réellement connectée.';

ALTER TABLE public.intervention_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervention_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electronic_invoice_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intervention_products_staff ON public.intervention_products;
CREATE POLICY intervention_products_staff ON public.intervention_products
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS intervention_reports_staff ON public.intervention_reports;
CREATE POLICY intervention_reports_staff ON public.intervention_reports
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS electronic_invoice_documents_staff ON public.electronic_invoice_documents;
CREATE POLICY electronic_invoice_documents_staff ON public.electronic_invoice_documents
  FOR ALL TO authenticated
  USING (public.is_commercial_or_admin())
  WITH CHECK (public.is_commercial_or_admin());
