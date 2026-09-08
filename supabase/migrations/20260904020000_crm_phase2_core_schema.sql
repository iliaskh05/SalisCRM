-- =============================================================================
-- SalisCRM PHASE 2 — Schéma CRM métier
-- Ne recrée PAS leads (déjà utilisé par le site commercial).
-- =============================================================================

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE public.client_status AS ENUM ('active', 'inactive', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.intervention_status AS ENUM (
    'to_plan', 'planned', 'in_progress', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.photo_kind AS ENUM ('before', 'after', 'technical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.quote_status AS ENUM (
    'draft', 'sent', 'accepted', 'rejected', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM (
    'unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM (
    'cash', 'transfer', 'card', 'check', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.provider_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.document_type AS ENUM (
    'quote', 'invoice', 'report', 'contract', 'photo', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.activity_type AS ENUM (
    'CLIENT_CREATED',
    'QUOTE_CREATED',
    'QUOTE_SENT',
    'QUOTE_ACCEPTED',
    'INTERVENTION_CREATED',
    'INTERVENTION_COMPLETED',
    'PHOTO_UPLOADED',
    'INVOICE_CREATED',
    'PAYMENT_RECEIVED',
    'LEAD_CONVERTED',
    'NOTE_ADDED',
    'STATUS_CHANGED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Relances leads (site a déjà next_action / next_due_at)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS next_action_date date,
  ADD COLUMN IF NOT EXISTS converted_client_id uuid;

-- ---------- Clients ----------
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text UNIQUE,
  lead_id uuid REFERENCES public.leads (id) ON DELETE SET NULL,
  company_name text NOT NULL,
  contact_name text,
  phone text,
  email text,
  address text,
  city text,
  postal_code text,
  siret text,
  business_type text,
  status public.client_status NOT NULL DEFAULT 'active',
  notes text,
  next_action text,
  next_action_date date,
  assigned_user uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_company_name_idx ON public.clients (company_name);
CREATE INDEX IF NOT EXISTS clients_city_idx ON public.clients (city);
CREATE INDEX IF NOT EXISTS clients_status_idx ON public.clients (status);
CREATE INDEX IF NOT EXISTS clients_lead_id_idx ON public.clients (lead_id);
CREATE INDEX IF NOT EXISTS clients_next_action_date_idx ON public.clients (next_action_date);

-- Lien inverse lead → client (après création clients)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_converted_client_id_fkey'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_converted_client_id_fkey
      FOREIGN KEY (converted_client_id) REFERENCES public.clients (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS leads_converted_client_id_idx ON public.leads (converted_client_id);
CREATE INDEX IF NOT EXISTS leads_next_action_date_idx ON public.leads (next_action_date);

-- ---------- Installations ----------
CREATE TABLE IF NOT EXISTS public.client_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  label text DEFAULT 'Installation principale',
  hood_length text,
  hood_type text,
  filter_count integer,
  filter_type text,
  duct_present boolean DEFAULT false,
  duct_length text,
  duct_accessibility text,
  motor_present boolean DEFAULT false,
  motor_type text,
  motor_accessibility text,
  night_intervention boolean DEFAULT false,
  schedule_preference text,
  soil_level text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_installations_client_id_idx
  ON public.client_installations (client_id);

-- ---------- Prestataires ----------
CREATE TABLE IF NOT EXISTS public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_name text,
  phone text,
  email text,
  city text,
  intervention_zone text,
  specialty text,
  cost_rate numeric(12, 2),
  status public.provider_status NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS providers_status_idx ON public.providers (status);
CREATE INDEX IF NOT EXISTS providers_city_idx ON public.providers (city);

-- ---------- Catalogue prestations ----------
CREATE TABLE IF NOT EXISTS public.service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  label text NOT NULL,
  description text,
  unit text NOT NULL DEFAULT 'unité',
  unit_price_ht numeric(12, 2) NOT NULL DEFAULT 0,
  vat_rate numeric(5, 2) NOT NULL DEFAULT 20.00,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_catalog_vat_rate_check CHECK (vat_rate >= 0 AND vat_rate <= 100),
  CONSTRAINT service_catalog_unit_price_check CHECK (unit_price_ht >= 0)
);

CREATE INDEX IF NOT EXISTS service_catalog_active_idx ON public.service_catalog (active);

-- ---------- Interventions ----------
CREATE TABLE IF NOT EXISTS public.interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text UNIQUE,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  installation_id uuid REFERENCES public.client_installations (id) ON DELETE SET NULL,
  provider_id uuid REFERENCES public.providers (id) ON DELETE SET NULL,
  scheduled_date date,
  time_slot text,
  service_type text,
  status public.intervention_status NOT NULL DEFAULT 'to_plan',
  description text,
  price_ht numeric(12, 2),
  notes text,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interventions_client_id_idx ON public.interventions (client_id);
CREATE INDEX IF NOT EXISTS interventions_status_idx ON public.interventions (status);
CREATE INDEX IF NOT EXISTS interventions_scheduled_date_idx ON public.interventions (scheduled_date);
CREATE INDEX IF NOT EXISTS interventions_provider_id_idx ON public.interventions (provider_id);

-- ---------- Photos intervention ----------
CREATE TABLE IF NOT EXISTS public.intervention_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL REFERENCES public.interventions (id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  kind public.photo_kind NOT NULL,
  storage_path text NOT NULL,
  comment text,
  uploaded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intervention_photos_intervention_id_idx
  ON public.intervention_photos (intervention_id);
CREATE INDEX IF NOT EXISTS intervention_photos_client_id_idx
  ON public.intervention_photos (client_id);
CREATE INDEX IF NOT EXISTS intervention_photos_kind_idx
  ON public.intervention_photos (kind);

-- ---------- Devis ----------
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text UNIQUE,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads (id) ON DELETE SET NULL,
  status public.quote_status NOT NULL DEFAULT 'draft',
  issued_at date DEFAULT (CURRENT_DATE),
  valid_until date,
  notes text,
  subtotal_ht numeric(12, 2) NOT NULL DEFAULT 0,
  vat_amount numeric(12, 2) NOT NULL DEFAULT 0,
  total_ttc numeric(12, 2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quotes_amounts_non_negative CHECK (
    subtotal_ht >= 0 AND vat_amount >= 0 AND total_ttc >= 0
  )
);

CREATE INDEX IF NOT EXISTS quotes_client_id_idx ON public.quotes (client_id);
CREATE INDEX IF NOT EXISTS quotes_status_idx ON public.quotes (status);
CREATE INDEX IF NOT EXISTS quotes_issued_at_idx ON public.quotes (issued_at);

CREATE TABLE IF NOT EXISTS public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE,
  service_catalog_id uuid REFERENCES public.service_catalog (id) ON DELETE SET NULL,
  label text NOT NULL,
  description text,
  quantity numeric(12, 2) NOT NULL DEFAULT 1,
  unit_price_ht numeric(12, 2) NOT NULL DEFAULT 0,
  vat_rate numeric(5, 2) NOT NULL DEFAULT 20.00,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT quote_items_unit_price_check CHECK (unit_price_ht >= 0),
  CONSTRAINT quote_items_vat_rate_check CHECK (vat_rate >= 0 AND vat_rate <= 100)
);

CREATE INDEX IF NOT EXISTS quote_items_quote_id_idx ON public.quote_items (quote_id);

-- ---------- Factures ----------
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.quotes (id) ON DELETE SET NULL,
  issued_at date NOT NULL DEFAULT (CURRENT_DATE),
  due_at date,
  status public.invoice_status NOT NULL DEFAULT 'unpaid',
  notes text,
  subtotal_ht numeric(12, 2) NOT NULL DEFAULT 0,
  vat_amount numeric(12, 2) NOT NULL DEFAULT 0,
  total_ttc numeric(12, 2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_amounts_non_negative CHECK (
    subtotal_ht >= 0 AND vat_amount >= 0 AND total_ttc >= 0
  )
);

CREATE INDEX IF NOT EXISTS invoices_client_id_idx ON public.invoices (client_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices (status);
CREATE INDEX IF NOT EXISTS invoices_due_at_idx ON public.invoices (due_at);
CREATE INDEX IF NOT EXISTS invoices_quote_id_idx ON public.invoices (quote_id);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  label text NOT NULL,
  description text,
  quantity numeric(12, 2) NOT NULL DEFAULT 1,
  unit_price_ht numeric(12, 2) NOT NULL DEFAULT 0,
  vat_rate numeric(5, 2) NOT NULL DEFAULT 20.00,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT invoice_items_unit_price_check CHECK (unit_price_ht >= 0),
  CONSTRAINT invoice_items_vat_rate_check CHECK (vat_rate >= 0 AND vat_rate <= 100)
);

CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx ON public.invoice_items (invoice_id);

-- ---------- Paiements ----------
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL,
  paid_at date NOT NULL DEFAULT (CURRENT_DATE),
  method public.payment_method NOT NULL DEFAULT 'transfer',
  reference text,
  note text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS payments_invoice_id_idx ON public.payments (invoice_id);
CREATE INDEX IF NOT EXISTS payments_client_id_idx ON public.payments (client_id);
CREATE INDEX IF NOT EXISTS payments_paid_at_idx ON public.payments (paid_at);

-- ---------- Documents ----------
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  doc_type public.document_type NOT NULL DEFAULT 'other',
  title text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_client_id_idx ON public.documents (client_id);
CREATE INDEX IF NOT EXISTS documents_doc_type_idx ON public.documents (doc_type);

-- ---------- Historique / activités ----------
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients (id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads (id) ON DELETE CASCADE,
  activity_type public.activity_type NOT NULL,
  title text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activities_subject_check CHECK (client_id IS NOT NULL OR lead_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS activities_client_id_idx ON public.activities (client_id);
CREATE INDEX IF NOT EXISTS activities_lead_id_idx ON public.activities (lead_id);
CREATE INDEX IF NOT EXISTS activities_created_at_idx ON public.activities (created_at DESC);
CREATE INDEX IF NOT EXISTS activities_type_idx ON public.activities (activity_type);

-- ---------- Triggers updated_at ----------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients',
    'client_installations',
    'providers',
    'service_catalog',
    'interventions',
    'quotes',
    'invoices'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ---------- Totaux devis (depuis lignes) ----------
CREATE OR REPLACE FUNCTION public.recompute_quote_totals(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ht numeric(12, 2);
  v_vat numeric(12, 2);
BEGIN
  SELECT
    COALESCE(SUM(quantity * unit_price_ht), 0),
    COALESCE(SUM(quantity * unit_price_ht * vat_rate / 100), 0)
  INTO v_ht, v_vat
  FROM public.quote_items
  WHERE quote_id = p_quote_id;

  UPDATE public.quotes
  SET
    subtotal_ht = ROUND(v_ht, 2),
    vat_amount = ROUND(v_vat, 2),
    total_ttc = ROUND(v_ht + v_vat, 2),
    updated_at = now()
  WHERE id = p_quote_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recompute_quote_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_quote_totals(COALESCE(NEW.quote_id, OLD.quote_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS quote_items_recompute_totals ON public.quote_items;
CREATE TRIGGER quote_items_recompute_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_quote_totals();

-- ---------- Totaux facture (depuis lignes) ----------
CREATE OR REPLACE FUNCTION public.recompute_invoice_totals(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ht numeric(12, 2);
  v_vat numeric(12, 2);
BEGIN
  SELECT
    COALESCE(SUM(quantity * unit_price_ht), 0),
    COALESCE(SUM(quantity * unit_price_ht * vat_rate / 100), 0)
  INTO v_ht, v_vat
  FROM public.invoice_items
  WHERE invoice_id = p_invoice_id;

  UPDATE public.invoices
  SET
    subtotal_ht = ROUND(v_ht, 2),
    vat_amount = ROUND(v_vat, 2),
    total_ttc = ROUND(v_ht + v_vat, 2),
    updated_at = now()
  WHERE id = p_invoice_id;

  PERFORM public.refresh_invoice_payment_status(p_invoice_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recompute_invoice_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_invoice_totals(COALESCE(NEW.invoice_id, OLD.invoice_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Placeholder forward declaration — défini juste après
CREATE OR REPLACE FUNCTION public.refresh_invoice_payment_status(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NULL;
END;
$$;

DROP TRIGGER IF EXISTS invoice_items_recompute_totals ON public.invoice_items;
CREATE TRIGGER invoice_items_recompute_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_invoice_totals();

-- ---------- Statut facture = f(paiements) — PAS de champ manuel « reste à payer » ----------
CREATE OR REPLACE FUNCTION public.refresh_invoice_payment_status(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric(12, 2);
  v_paid numeric(12, 2);
  v_due date;
  v_current public.invoice_status;
  v_next public.invoice_status;
BEGIN
  SELECT total_ttc, due_at, status
  INTO v_total, v_due, v_current
  FROM public.invoices
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_current = 'cancelled' THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM public.payments
  WHERE invoice_id = p_invoice_id;

  IF v_paid <= 0 THEN
    IF v_due IS NOT NULL AND v_due < CURRENT_DATE THEN
      v_next := 'overdue';
    ELSE
      v_next := 'unpaid';
    END IF;
  ELSIF v_paid >= v_total THEN
    v_next := 'paid';
  ELSE
    IF v_due IS NOT NULL AND v_due < CURRENT_DATE THEN
      v_next := 'overdue';
    ELSE
      v_next := 'partially_paid';
    END IF;
  END IF;

  IF v_next IS DISTINCT FROM v_current THEN
    UPDATE public.invoices
    SET status = v_next, updated_at = now()
    WHERE id = p_invoice_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_refresh_invoice_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_invoice_payment_status(COALESCE(NEW.invoice_id, OLD.invoice_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS payments_refresh_invoice_status ON public.payments;
CREATE TRIGGER payments_refresh_invoice_status
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_invoice_on_payment();

-- ---------- Vue financière (reste à payer calculé) ----------
CREATE OR REPLACE VIEW public.invoice_balances
WITH (security_invoker = true)
AS
SELECT
  i.id AS invoice_id,
  i.client_id,
  i.number,
  i.total_ttc,
  COALESCE(p.amount_paid, 0)::numeric(12, 2) AS amount_paid,
  GREATEST(i.total_ttc - COALESCE(p.amount_paid, 0), 0)::numeric(12, 2) AS amount_due,
  i.status,
  i.due_at,
  i.issued_at
FROM public.invoices i
LEFT JOIN (
  SELECT invoice_id, SUM(amount) AS amount_paid
  FROM public.payments
  GROUP BY invoice_id
) p ON p.invoice_id = i.id;

COMMENT ON VIEW public.invoice_balances IS
  'Montants payés / reste à payer dérivés des paiements. Ne jamais stocker amount_due manuellement.';

-- ---------- Vue agrégats client ----------
CREATE OR REPLACE VIEW public.client_financial_summary
WITH (security_invoker = true)
AS
SELECT
  c.id AS client_id,
  COALESCE(inv.total_invoiced, 0)::numeric(12, 2) AS total_invoiced,
  COALESCE(pay.total_paid, 0)::numeric(12, 2) AS total_paid,
  GREATEST(COALESCE(inv.total_invoiced, 0) - COALESCE(pay.total_paid, 0), 0)::numeric(12, 2)
    AS amount_due,
  last_int.last_intervention_at,
  next_int.next_intervention_at
FROM public.clients c
LEFT JOIN (
  SELECT client_id, SUM(total_ttc) AS total_invoiced
  FROM public.invoices
  WHERE status <> 'cancelled'
  GROUP BY client_id
) inv ON inv.client_id = c.id
LEFT JOIN (
  SELECT client_id, SUM(amount) AS total_paid
  FROM public.payments
  GROUP BY client_id
) pay ON pay.client_id = c.id
LEFT JOIN (
  SELECT client_id, MAX(scheduled_date) AS last_intervention_at
  FROM public.interventions
  WHERE status = 'completed'
  GROUP BY client_id
) last_int ON last_int.client_id = c.id
LEFT JOIN (
  SELECT client_id, MIN(scheduled_date) AS next_intervention_at
  FROM public.interventions
  WHERE status IN ('to_plan', 'planned', 'in_progress')
    AND scheduled_date IS NOT NULL
    AND scheduled_date >= CURRENT_DATE
  GROUP BY client_id
) next_int ON next_int.client_id = c.id;
