-- =============================================================================
-- SalisCRM — Intégrité facturation
--   1. Numérotation serveur continue (clients, interventions, devis, factures, avoirs)
--   2. Totaux calculés en base, remise incluse (même arrondi que lib/quotes/calculate.ts)
--   3. Devis : transitions de statut + verrouillage hors brouillon
--   4. Factures : immuables après émission, annulation uniquement par avoir
--   5. Opérations atomiques (RPC) : create_quote, create_invoice,
--      create_invoice_from_quote, cancel_invoice
--   6. Paiements : pas de sur-encaissement, pas de paiement sur facture annulée
--   7. Tâche quotidienne : factures en retard, devis expirés
-- Idempotent autant que possible. À tester sur un projet de staging avant prod.
-- =============================================================================

-- ---------- Colonnes ----------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS discount_ht numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_discount_non_negative') THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_discount_non_negative CHECK (discount_ht >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_discount_non_negative') THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_discount_non_negative CHECK (discount_ht >= 0 AND deposit_amount >= 0);
  END IF;
END $$;

-- ---------- 1. Numérotation ----------
-- Compteur par préfixe et par année. Appelé dans la même transaction que l'INSERT :
-- un rollback annule aussi l'incrément, donc pas de trou dans la séquence.
CREATE OR REPLACE FUNCTION public.assign_document_ref(p_prefix text, p_date date DEFAULT CURRENT_DATE)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text := to_char(COALESCE(p_date, CURRENT_DATE), 'YYYY');
  v_key text := format('doc_ref_%s_%s', lower(p_prefix), v_year);
  n bigint;
BEGIN
  INSERT INTO public.document_counters (key, value)
  VALUES (v_key, 1)
  ON CONFLICT (key) DO UPDATE
    SET value = public.document_counters.value + 1
  RETURNING value INTO n;

  RETURN p_prefix || '-' || v_year || '-' || lpad(n::text, 4, '0');
END;
$$;

-- Ancienne fonction conservée pour compatibilité, mais plus appelable depuis l'API :
-- un utilisateur pouvait faire avancer les compteurs (trous dans la numérotation).
CREATE OR REPLACE FUNCTION public.next_document_ref(prefix text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.assign_document_ref(prefix, CURRENT_DATE);
$$;

-- Rattrapage des lignes existantes sans numéro (ordre chronologique)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, created_at FROM public.clients WHERE reference IS NULL ORDER BY created_at
  LOOP
    UPDATE public.clients
    SET reference = public.assign_document_ref('CLI', r.created_at::date)
    WHERE id = r.id;
  END LOOP;

  FOR r IN
    SELECT id, created_at FROM public.interventions WHERE reference IS NULL ORDER BY created_at
  LOOP
    UPDATE public.interventions
    SET reference = public.assign_document_ref('INT', r.created_at::date)
    WHERE id = r.id;
  END LOOP;

  FOR r IN
    SELECT id, COALESCE(issued_at, created_at::date) AS d
    FROM public.quotes WHERE reference IS NULL ORDER BY COALESCE(issued_at, created_at::date), created_at
  LOOP
    UPDATE public.quotes
    SET reference = public.assign_document_ref('D', r.d)
    WHERE id = r.id;
  END LOOP;

  FOR r IN
    SELECT id, issued_at FROM public.invoices WHERE number IS NULL ORDER BY issued_at, created_at
  LOOP
    UPDATE public.invoices
    SET number = public.assign_document_ref('F', r.issued_at)
    WHERE id = r.id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.trg_assign_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'invoices' THEN
    -- Numéro et date toujours imposés par le serveur : ordre chronologique garanti.
    NEW.issued_at := CURRENT_DATE;
    NEW.number := public.assign_document_ref('F', NEW.issued_at);
  ELSIF NEW.reference IS NULL THEN
    NEW.reference := public.assign_document_ref(
      CASE TG_TABLE_NAME WHEN 'quotes' THEN 'D' WHEN 'clients' THEN 'CLI' ELSE 'INT' END,
      CURRENT_DATE
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_assign_number ON public.invoices;
CREATE TRIGGER invoices_assign_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_assign_reference();

DROP TRIGGER IF EXISTS quotes_assign_reference ON public.quotes;
CREATE TRIGGER quotes_assign_reference
  BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.trg_assign_reference();

DROP TRIGGER IF EXISTS clients_assign_reference ON public.clients;
CREATE TRIGGER clients_assign_reference
  BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.trg_assign_reference();

DROP TRIGGER IF EXISTS interventions_assign_reference ON public.interventions;
CREATE TRIGGER interventions_assign_reference
  BEFORE INSERT ON public.interventions
  FOR EACH ROW EXECUTE FUNCTION public.trg_assign_reference();

-- ---------- 2. Totaux (miroir de calculateQuote) ----------
-- ligne HT = round(qté × PU, 2) ; remise HT plafonnée au sous-total ;
-- TVA = somme des round(ligne HT × ratio × taux, 2) ; TTC = HT remisé + TVA
CREATE OR REPLACE FUNCTION public.recompute_quote_totals(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub numeric(12, 2);
  v_disc numeric(12, 2);
  v_taxable numeric(12, 2);
  v_ratio numeric;
  v_vat numeric(12, 2);
BEGIN
  SELECT COALESCE(SUM(ROUND(quantity * unit_price_ht, 2)), 0)
  INTO v_sub
  FROM public.quote_items
  WHERE quote_id = p_quote_id;

  SELECT ROUND(LEAST(GREATEST(COALESCE(discount_ht, 0), 0), v_sub), 2)
  INTO v_disc
  FROM public.quotes
  WHERE id = p_quote_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_taxable := v_sub - v_disc;
  v_ratio := CASE WHEN v_sub > 0 THEN v_taxable / v_sub ELSE 1 END;

  SELECT COALESCE(SUM(ROUND(ROUND(quantity * unit_price_ht, 2) * v_ratio * vat_rate / 100, 2)), 0)
  INTO v_vat
  FROM public.quote_items
  WHERE quote_id = p_quote_id;

  UPDATE public.quotes
  SET
    subtotal_ht = v_sub,
    vat_amount = v_vat,
    total_ttc = v_taxable + v_vat,
    updated_at = now()
  WHERE id = p_quote_id
    AND (subtotal_ht, vat_amount, total_ttc) IS DISTINCT FROM (v_sub, v_vat, v_taxable + v_vat);
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_invoice_totals(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub numeric(12, 2);
  v_disc numeric(12, 2);
  v_taxable numeric(12, 2);
  v_ratio numeric;
  v_vat numeric(12, 2);
BEGIN
  SELECT COALESCE(SUM(ROUND(quantity * unit_price_ht, 2)), 0)
  INTO v_sub
  FROM public.invoice_items
  WHERE invoice_id = p_invoice_id;

  SELECT ROUND(LEAST(GREATEST(COALESCE(discount_ht, 0), 0), v_sub), 2)
  INTO v_disc
  FROM public.invoices
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_taxable := v_sub - v_disc;
  v_ratio := CASE WHEN v_sub > 0 THEN v_taxable / v_sub ELSE 1 END;

  SELECT COALESCE(SUM(ROUND(ROUND(quantity * unit_price_ht, 2) * v_ratio * vat_rate / 100, 2)), 0)
  INTO v_vat
  FROM public.invoice_items
  WHERE invoice_id = p_invoice_id;

  UPDATE public.invoices
  SET
    subtotal_ht = v_sub,
    vat_amount = v_vat,
    total_ttc = v_taxable + v_vat,
    updated_at = now()
  WHERE id = p_invoice_id
    AND (subtotal_ht, vat_amount, total_ttc) IS DISTINCT FROM (v_sub, v_vat, v_taxable + v_vat);

  PERFORM public.refresh_invoice_payment_status(p_invoice_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_quote_discount_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_quote_totals(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_discount_recompute ON public.quotes;
CREATE TRIGGER quotes_discount_recompute
  AFTER UPDATE OF discount_ht ON public.quotes
  FOR EACH ROW
  WHEN (OLD.discount_ht IS DISTINCT FROM NEW.discount_ht)
  EXECUTE FUNCTION public.trg_quote_discount_changed();

-- ---------- 3. Devis : transitions + verrouillage ----------
-- draft → sent | accepted | rejected ; sent → accepted | rejected | expired ; expired → sent
-- accepted et rejected sont définitifs. Hors brouillon, seuls statut / notes / validité bougent.
CREATE OR REPLACE FUNCTION public.trg_quotes_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_mutable text[] := ARRAY['status', 'notes', 'valid_until', 'converted_intervention_id', 'updated_at'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Le devis % n''est plus un brouillon : il ne peut pas être supprimé.', OLD.reference
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.reference IS NOT NULL AND NEW.reference IS DISTINCT FROM OLD.reference THEN
    RAISE EXCEPTION 'La référence d''un devis est définitive.' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'draft' AND NEW.status IN ('sent', 'accepted', 'rejected'))
    OR (OLD.status = 'sent' AND NEW.status IN ('accepted', 'rejected', 'expired'))
    OR (OLD.status = 'expired' AND NEW.status = 'sent')
  ) THEN
    RAISE EXCEPTION 'Changement de statut interdit pour le devis % : % → %.',
      OLD.reference, OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status <> 'draft'
     AND (to_jsonb(NEW) - v_mutable) IS DISTINCT FROM (to_jsonb(OLD) - v_mutable) THEN
    RAISE EXCEPTION 'Le devis % n''est plus un brouillon : son contenu est verrouillé. Créez un nouveau devis.',
      OLD.reference
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_guard ON public.quotes;
CREATE TRIGGER quotes_guard
  BEFORE UPDATE OR DELETE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.trg_quotes_guard();

CREATE OR REPLACE FUNCTION public.trg_quote_items_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.quote_status;
  v_ref text;
BEGIN
  SELECT status, reference INTO v_status, v_ref
  FROM public.quotes
  WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);

  -- Devis introuvable = suppression en cascade du devis brouillon : autorisé.
  IF FOUND AND v_status <> 'draft' THEN
    RAISE EXCEPTION 'Le devis % n''est plus un brouillon : ses lignes sont verrouillées.', v_ref
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS quote_items_guard ON public.quote_items;
CREATE TRIGGER quote_items_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_quote_items_guard();

-- ---------- 4. Factures : immuables ----------
-- Les lignes et montants ne bougent que pendant la construction par une RPC
-- (flag transactionnel saliscrm.invoice_build). L'annulation passe par cancel_invoice
-- (flag saliscrm.invoice_cancel). Le statut de paiement reste calculé par
-- refresh_invoice_payment_status.
CREATE OR REPLACE FUNCTION public.trg_invoices_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_building boolean := COALESCE(current_setting('saliscrm.invoice_build', true), '') = OLD.id::text;
  v_cancelling boolean := COALESCE(current_setting('saliscrm.invoice_cancel', true), '') = OLD.id::text;
  v_mutable text[] := ARRAY['status', 'notes', 'updated_at'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'La facture % ne peut pas être supprimée. Annulez-la par un avoir.', OLD.number
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.number IS DISTINCT FROM OLD.number THEN
    RAISE EXCEPTION 'Le numéro de facture % est définitif.', OLD.number USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'La facture % est annulée : plus aucune modification possible.', OLD.number
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'cancelled' AND NOT v_cancelling THEN
    RAISE EXCEPTION 'Une facture s''annule uniquement par un avoir (cancel_invoice).'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_building THEN
    v_mutable := v_mutable || ARRAY['subtotal_ht', 'vat_amount', 'total_ttc'];
  END IF;
  IF v_cancelling THEN
    v_mutable := v_mutable || ARRAY['cancelled_at', 'cancellation_reason'];
  END IF;

  IF (to_jsonb(NEW) - v_mutable) IS DISTINCT FROM (to_jsonb(OLD) - v_mutable) THEN
    RAISE EXCEPTION 'La facture % est émise : client, dates, montants et lignes ne sont plus modifiables.',
      OLD.number
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_guard ON public.invoices;
CREATE TRIGGER invoices_guard
  BEFORE UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_invoices_guard();

CREATE OR REPLACE FUNCTION public.trg_invoice_items_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('saliscrm.invoice_build', true), '')
     <> COALESCE(NEW.invoice_id, OLD.invoice_id)::text THEN
    RAISE EXCEPTION 'Les lignes d''une facture émise ne sont pas modifiables.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS invoice_items_guard ON public.invoice_items;
CREATE TRIGGER invoice_items_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_invoice_items_guard();

-- Une facture ou un paiement ne disparaît plus avec le client
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_client_id_fkey;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients (id) ON DELETE RESTRICT;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_client_id_fkey;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients (id) ON DELETE RESTRICT;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_invoice_id_fkey;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES public.invoices (id) ON DELETE RESTRICT;

-- ---------- Avoirs ----------
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  invoice_id uuid NOT NULL UNIQUE REFERENCES public.invoices (id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
  issued_at date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL,
  subtotal_ht numeric(12, 2) NOT NULL,
  discount_ht numeric(12, 2) NOT NULL DEFAULT 0,
  vat_amount numeric(12, 2) NOT NULL,
  total_ttc numeric(12, 2) NOT NULL,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_notes_client_id_idx ON public.credit_notes (client_id);

COMMENT ON TABLE public.credit_notes IS
  'Avoirs (annulation totale de facture). Immuables. Créés uniquement par cancel_invoice().';

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read credit notes" ON public.credit_notes;
CREATE POLICY "Staff read credit notes"
  ON public.credit_notes FOR SELECT TO authenticated
  USING (public.is_commercial_or_admin());

CREATE OR REPLACE FUNCTION public.trg_credit_notes_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Un avoir émis n''est ni modifiable ni supprimable.' USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS credit_notes_immutable ON public.credit_notes;
CREATE TRIGGER credit_notes_immutable
  BEFORE UPDATE OR DELETE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_credit_notes_immutable();

-- ---------- 6. Paiements ----------
CREATE OR REPLACE FUNCTION public.trg_payments_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client uuid;
  v_status public.invoice_status;
  v_total numeric(12, 2);
  v_number text;
  v_paid numeric(12, 2);
BEGIN
  SELECT client_id, status, total_ttc, number
  INTO v_client, v_status, v_total, v_number
  FROM public.invoices
  WHERE id = NEW.invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture introuvable.' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_status = 'cancelled' THEN
    RAISE EXCEPTION 'La facture % est annulée : aucun paiement possible.', v_number
      USING ERRCODE = 'check_violation';
  END IF;

  -- Le client du paiement est toujours celui de la facture
  NEW.client_id := v_client;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM public.payments
  WHERE invoice_id = NEW.invoice_id AND id <> NEW.id;

  IF v_paid + NEW.amount > v_total THEN
    RAISE EXCEPTION 'Le paiement (% €) dépasse le reste dû de la facture % (% €).',
      NEW.amount, v_number, v_total - v_paid
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_guard ON public.payments;
CREATE TRIGGER payments_guard
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_payments_guard();

-- ---------- 5. RPC transactionnelles ----------
CREATE OR REPLACE FUNCTION public._validate_lines(p_items jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  e jsonb;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Ajoutez au moins une ligne.' USING ERRCODE = 'check_violation';
  END IF;

  FOR e IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF COALESCE(trim(e->>'label'), '') = '' THEN
      RAISE EXCEPTION 'Chaque ligne doit avoir un libellé.' USING ERRCODE = 'check_violation';
    END IF;
    IF COALESCE((e->>'quantity')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'Quantité invalide pour « % ».', e->>'label' USING ERRCODE = 'check_violation';
    END IF;
    IF COALESCE((e->>'unit_price_ht')::numeric, -1) < 0 THEN
      RAISE EXCEPTION 'Prix unitaire invalide pour « % ».', e->>'label' USING ERRCODE = 'check_violation';
    END IF;
    IF COALESCE((e->>'vat_rate')::numeric, 20) NOT BETWEEN 0 AND 100 THEN
      RAISE EXCEPTION 'Taux de TVA invalide pour « % ».', e->>'label' USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public._insert_invoice(
  p_client_id uuid,
  p_items jsonb,
  p_due_at date,
  p_notes text,
  p_quote_id uuid,
  p_discount_ht numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_sub numeric(12, 2);
  v_disc numeric(12, 2) := ROUND(GREATEST(COALESCE(p_discount_ht, 0), 0), 2);
BEGIN
  PERFORM public._validate_lines(p_items);

  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id) THEN
    RAISE EXCEPTION 'Client introuvable.' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF p_due_at IS NOT NULL AND p_due_at < CURRENT_DATE THEN
    RAISE EXCEPTION 'L''échéance ne peut pas être antérieure à la date d''émission.'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.invoices (client_id, quote_id, due_at, status, notes, discount_ht, created_by)
  VALUES (
    p_client_id,
    p_quote_id,
    COALESCE(p_due_at, CURRENT_DATE + 30),
    'unpaid',
    NULLIF(trim(p_notes), ''),
    v_disc,
    auth.uid()
  )
  RETURNING id INTO v_id;

  PERFORM set_config('saliscrm.invoice_build', v_id::text, true);

  INSERT INTO public.invoice_items (invoice_id, label, description, quantity, unit_price_ht, vat_rate, position)
  SELECT
    v_id,
    trim(e.item->>'label'),
    NULLIF(trim(e.item->>'description'), ''),
    (e.item->>'quantity')::numeric,
    (e.item->>'unit_price_ht')::numeric,
    COALESCE((e.item->>'vat_rate')::numeric, 20),
    (e.ord - 1)::integer
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(item, ord);

  SELECT subtotal_ht INTO v_sub FROM public.invoices WHERE id = v_id;
  IF v_disc > v_sub THEN
    RAISE EXCEPTION 'La remise (% €) dépasse le sous-total HT (% €).', v_disc, v_sub
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('saliscrm.invoice_build', '', true);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_invoice(
  p_client_id uuid,
  p_items jsonb,
  p_due_at date DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_discount_ht numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_commercial_or_admin() THEN
    RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN public._insert_invoice(p_client_id, p_items, p_due_at, p_notes, NULL, p_discount_ht);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_invoice_from_quote(
  p_quote_id uuid,
  p_due_at date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q public.quotes%ROWTYPE;
  v_items jsonb;
  v_existing text;
  v_id uuid;
BEGIN
  IF NOT public.is_commercial_or_admin() THEN
    RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO q FROM public.quotes WHERE id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Devis introuvable.' USING ERRCODE = 'no_data_found';
  END IF;

  IF q.status IN ('rejected', 'expired') THEN
    RAISE EXCEPTION 'Le devis % est %, il ne peut pas être facturé.', q.reference,
      CASE q.status WHEN 'rejected' THEN 'refusé' ELSE 'expiré' END
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT number INTO v_existing
  FROM public.invoices
  WHERE quote_id = p_quote_id AND status <> 'cancelled'
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Le devis % est déjà facturé (%).', q.reference, v_existing
      USING ERRCODE = 'unique_violation';
  END IF;

  SELECT jsonb_agg(
           jsonb_build_object(
             'label', label,
             'description', description,
             'quantity', quantity,
             'unit_price_ht', unit_price_ht,
             'vat_rate', vat_rate
           )
           ORDER BY position
         )
  INTO v_items
  FROM public.quote_items
  WHERE quote_id = p_quote_id;

  IF v_items IS NULL THEN
    RAISE EXCEPTION 'Aucune ligne à facturer.' USING ERRCODE = 'check_violation';
  END IF;

  v_id := public._insert_invoice(q.client_id, v_items, p_due_at, q.notes, q.id, q.discount_ht);

  IF q.status <> 'accepted' THEN
    UPDATE public.quotes SET status = 'accepted' WHERE id = q.id;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_quote(
  p_client_id uuid,
  p_items jsonb,
  p_lead_id uuid DEFAULT NULL,
  p_installation_id uuid DEFAULT NULL,
  p_valid_until date DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_discount_ht numeric DEFAULT 0,
  p_deposit_amount numeric DEFAULT 0,
  p_payment_terms text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_sub numeric(12, 2);
  v_disc numeric(12, 2) := ROUND(GREATEST(COALESCE(p_discount_ht, 0), 0), 2);
BEGIN
  IF NOT public.is_commercial_or_admin() THEN
    RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM public._validate_lines(p_items);

  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id) THEN
    RAISE EXCEPTION 'Client introuvable.' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF p_valid_until IS NOT NULL AND p_valid_until < CURRENT_DATE THEN
    RAISE EXCEPTION 'La date de validité est déjà passée.' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.quotes (
    client_id, lead_id, installation_id, status, issued_at, valid_until, notes,
    discount_ht, deposit_amount, payment_terms, created_by
  )
  VALUES (
    p_client_id,
    p_lead_id,
    p_installation_id,
    'draft',
    CURRENT_DATE,
    COALESCE(p_valid_until, CURRENT_DATE + 30),
    NULLIF(trim(p_notes), ''),
    v_disc,
    ROUND(GREATEST(COALESCE(p_deposit_amount, 0), 0), 2),
    NULLIF(trim(p_payment_terms), ''),
    auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.quote_items (
    quote_id, service_catalog_id, label, description, quantity, unit_price_ht, vat_rate, position
  )
  SELECT
    v_id,
    NULLIF(e.item->>'service_catalog_id', '')::uuid,
    trim(e.item->>'label'),
    NULLIF(trim(e.item->>'description'), ''),
    (e.item->>'quantity')::numeric,
    (e.item->>'unit_price_ht')::numeric,
    COALESCE((e.item->>'vat_rate')::numeric, 20),
    (e.ord - 1)::integer
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(item, ord);

  SELECT subtotal_ht INTO v_sub FROM public.quotes WHERE id = v_id;
  IF v_disc > v_sub THEN
    RAISE EXCEPTION 'La remise (% €) dépasse le sous-total HT (% €).', v_disc, v_sub
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_invoice(p_invoice_id uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.invoices%ROWTYPE;
  v_lines jsonb;
  v_credit_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Seule la direction peut annuler une facture.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF COALESCE(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Le motif d''annulation est obligatoire.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture introuvable.' USING ERRCODE = 'no_data_found';
  END IF;

  IF inv.status = 'cancelled' THEN
    RAISE EXCEPTION 'La facture % est déjà annulée.', inv.number USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM public.payments WHERE invoice_id = p_invoice_id) THEN
    RAISE EXCEPTION 'La facture % a des paiements enregistrés : traitez le remboursement avant de l''annuler.',
      inv.number
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'label', label,
               'description', description,
               'quantity', quantity,
               'unit_price_ht', unit_price_ht,
               'vat_rate', vat_rate
             )
             ORDER BY position
           ),
           '[]'::jsonb
         )
  INTO v_lines
  FROM public.invoice_items
  WHERE invoice_id = p_invoice_id;

  INSERT INTO public.credit_notes (
    number, invoice_id, client_id, reason, subtotal_ht, discount_ht, vat_amount, total_ttc, lines, created_by
  )
  VALUES (
    public.assign_document_ref('AV', CURRENT_DATE),
    inv.id,
    inv.client_id,
    trim(p_reason),
    inv.subtotal_ht,
    inv.discount_ht,
    inv.vat_amount,
    inv.total_ttc,
    v_lines,
    auth.uid()
  )
  RETURNING id INTO v_credit_id;

  PERFORM set_config('saliscrm.invoice_cancel', inv.id::text, true);
  UPDATE public.invoices
  SET status = 'cancelled', cancelled_at = now(), cancellation_reason = trim(p_reason)
  WHERE id = inv.id;
  PERFORM set_config('saliscrm.invoice_cancel', '', true);

  RETURN v_credit_id;
END;
$$;

-- ---------- 7. Tâche quotidienne ----------
CREATE OR REPLACE FUNCTION public.run_daily_billing_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.invoices
    WHERE status IN ('unpaid', 'partially_paid') AND due_at < CURRENT_DATE
  LOOP
    PERFORM public.refresh_invoice_payment_status(r.id);
  END LOOP;

  UPDATE public.quotes
  SET status = 'expired'
  WHERE status = 'sent' AND valid_until IS NOT NULL AND valid_until < CURRENT_DATE;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'saliscrm-daily-billing',
      '15 2 * * *',
      'SELECT public.run_daily_billing_maintenance()'
    );
  ELSE
    RAISE NOTICE 'pg_cron absent : activez-le (Database > Extensions) puis planifiez public.run_daily_billing_maintenance().';
  END IF;
END $$;

-- ---------- Droits ----------
-- Factures, lignes et avoirs : écriture uniquement via les RPC ci-dessus.
REVOKE INSERT, UPDATE, DELETE ON public.invoices FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.invoice_items FROM authenticated, anon;
REVOKE ALL ON public.credit_notes FROM authenticated, anon;
GRANT SELECT ON public.credit_notes TO authenticated;
GRANT ALL ON public.credit_notes TO service_role;

DROP POLICY IF EXISTS "Commercial write invoices" ON public.invoices;
DROP POLICY IF EXISTS "Commercial update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admin delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Commercial write invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Commercial update invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Admin delete invoice items" ON public.invoice_items;

-- Fonctions internes : jamais appelables depuis l'API (Supabase donne EXECUTE à anon par défaut)
REVOKE EXECUTE ON FUNCTION public.assign_document_ref(text, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_document_ref(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_quote_totals(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_invoice_totals(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._validate_lines(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._insert_invoice(uuid, jsonb, date, text, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_daily_billing_maintenance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_invoice_payment_status(uuid) FROM PUBLIC, anon;

-- RPC publiques (contrôle de rôle à l'intérieur)
REVOKE EXECUTE ON FUNCTION public.create_invoice(uuid, jsonb, date, text, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_invoice_from_quote(uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_quote(uuid, jsonb, uuid, uuid, date, text, numeric, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_invoice(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_invoice(uuid, jsonb, date, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_from_quote(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_quote(uuid, jsonb, uuid, uuid, date, text, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_invoice(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_invoice_payment_status(uuid) TO authenticated;
