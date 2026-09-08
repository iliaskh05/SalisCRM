-- =============================================================================
-- SalisCRM PHASE 2 — RLS policies
-- admin / commercial : accès métier CRM
-- prestataire : lecture limitée (préparé, pas d'écriture métier pour l'instant)
-- Suppression destructive : admin uniquement
-- =============================================================================

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.clients TO authenticated;
GRANT DELETE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_installations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.providers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_catalog TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interventions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intervention_photos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT SELECT ON public.invoice_balances TO authenticated;
GRANT SELECT ON public.client_financial_summary TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervention_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Helper macro-like: drop + recreate policies safely
-- ---------- clients ----------
DROP POLICY IF EXISTS "Staff read clients" ON public.clients;
DROP POLICY IF EXISTS "Commercial write clients" ON public.clients;
DROP POLICY IF EXISTS "Commercial update clients" ON public.clients;
DROP POLICY IF EXISTS "Admin delete clients" ON public.clients;

CREATE POLICY "Staff read clients"
  ON public.clients FOR SELECT TO authenticated
  USING (public.is_commercial_or_admin());

CREATE POLICY "Commercial write clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Commercial update clients"
  ON public.clients FOR UPDATE TO authenticated
  USING (public.is_commercial_or_admin())
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Admin delete clients"
  ON public.clients FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------- client_installations ----------
DROP POLICY IF EXISTS "Staff read installations" ON public.client_installations;
DROP POLICY IF EXISTS "Commercial write installations" ON public.client_installations;
DROP POLICY IF EXISTS "Commercial update installations" ON public.client_installations;
DROP POLICY IF EXISTS "Admin delete installations" ON public.client_installations;

CREATE POLICY "Staff read installations"
  ON public.client_installations FOR SELECT TO authenticated
  USING (public.is_commercial_or_admin());

CREATE POLICY "Commercial write installations"
  ON public.client_installations FOR INSERT TO authenticated
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Commercial update installations"
  ON public.client_installations FOR UPDATE TO authenticated
  USING (public.is_commercial_or_admin())
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Admin delete installations"
  ON public.client_installations FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------- providers ----------
DROP POLICY IF EXISTS "Staff read providers" ON public.providers;
DROP POLICY IF EXISTS "Admin manage providers insert" ON public.providers;
DROP POLICY IF EXISTS "Admin manage providers update" ON public.providers;
DROP POLICY IF EXISTS "Admin manage providers delete" ON public.providers;

CREATE POLICY "Staff read providers"
  ON public.providers FOR SELECT TO authenticated
  USING (public.is_commercial_or_admin());

CREATE POLICY "Admin manage providers insert"
  ON public.providers FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin manage providers update"
  ON public.providers FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin manage providers delete"
  ON public.providers FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------- service_catalog ----------
DROP POLICY IF EXISTS "Staff read catalog" ON public.service_catalog;
DROP POLICY IF EXISTS "Admin write catalog" ON public.service_catalog;
DROP POLICY IF EXISTS "Admin update catalog" ON public.service_catalog;
DROP POLICY IF EXISTS "Admin delete catalog" ON public.service_catalog;

CREATE POLICY "Staff read catalog"
  ON public.service_catalog FOR SELECT TO authenticated
  USING (public.is_commercial_or_admin());

CREATE POLICY "Admin write catalog"
  ON public.service_catalog FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin update catalog"
  ON public.service_catalog FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin delete catalog"
  ON public.service_catalog FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------- interventions ----------
DROP POLICY IF EXISTS "Staff read interventions" ON public.interventions;
DROP POLICY IF EXISTS "Commercial write interventions" ON public.interventions;
DROP POLICY IF EXISTS "Commercial update interventions" ON public.interventions;
DROP POLICY IF EXISTS "Admin delete interventions" ON public.interventions;

CREATE POLICY "Staff read interventions"
  ON public.interventions FOR SELECT TO authenticated
  USING (public.is_commercial_or_admin());

CREATE POLICY "Commercial write interventions"
  ON public.interventions FOR INSERT TO authenticated
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Commercial update interventions"
  ON public.interventions FOR UPDATE TO authenticated
  USING (public.is_commercial_or_admin())
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Admin delete interventions"
  ON public.interventions FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------- intervention_photos ----------
DROP POLICY IF EXISTS "Staff read photos" ON public.intervention_photos;
DROP POLICY IF EXISTS "Commercial write photos" ON public.intervention_photos;
DROP POLICY IF EXISTS "Commercial update photos" ON public.intervention_photos;
DROP POLICY IF EXISTS "Admin delete photos" ON public.intervention_photos;

CREATE POLICY "Staff read photos"
  ON public.intervention_photos FOR SELECT TO authenticated
  USING (public.is_commercial_or_admin());

CREATE POLICY "Commercial write photos"
  ON public.intervention_photos FOR INSERT TO authenticated
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Commercial update photos"
  ON public.intervention_photos FOR UPDATE TO authenticated
  USING (public.is_commercial_or_admin())
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Admin delete photos"
  ON public.intervention_photos FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------- quotes / quote_items ----------
DROP POLICY IF EXISTS "Staff read quotes" ON public.quotes;
DROP POLICY IF EXISTS "Commercial write quotes" ON public.quotes;
DROP POLICY IF EXISTS "Commercial update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admin delete quotes" ON public.quotes;

CREATE POLICY "Staff read quotes"
  ON public.quotes FOR SELECT TO authenticated
  USING (public.is_commercial_or_admin());

CREATE POLICY "Commercial write quotes"
  ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Commercial update quotes"
  ON public.quotes FOR UPDATE TO authenticated
  USING (public.is_commercial_or_admin())
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Admin delete quotes"
  ON public.quotes FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Staff read quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Commercial write quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Commercial update quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Admin delete quote items" ON public.quote_items;

CREATE POLICY "Staff read quote items"
  ON public.quote_items FOR SELECT TO authenticated
  USING (public.is_commercial_or_admin());

CREATE POLICY "Commercial write quote items"
  ON public.quote_items FOR INSERT TO authenticated
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Commercial update quote items"
  ON public.quote_items FOR UPDATE TO authenticated
  USING (public.is_commercial_or_admin())
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Admin delete quote items"
  ON public.quote_items FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------- invoices / invoice_items / payments (finances) ----------
DROP POLICY IF EXISTS "Staff read invoices" ON public.invoices;
DROP POLICY IF EXISTS "Commercial write invoices" ON public.invoices;
DROP POLICY IF EXISTS "Commercial update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admin delete invoices" ON public.invoices;

CREATE POLICY "Staff read invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (public.is_commercial_or_admin());

CREATE POLICY "Commercial write invoices"
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Commercial update invoices"
  ON public.invoices FOR UPDATE TO authenticated
  USING (public.is_commercial_or_admin())
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Admin delete invoices"
  ON public.invoices FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Staff read invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Commercial write invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Commercial update invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Admin delete invoice items" ON public.invoice_items;

CREATE POLICY "Staff read invoice items"
  ON public.invoice_items FOR SELECT TO authenticated
  USING (public.is_commercial_or_admin());

CREATE POLICY "Commercial write invoice items"
  ON public.invoice_items FOR INSERT TO authenticated
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Commercial update invoice items"
  ON public.invoice_items FOR UPDATE TO authenticated
  USING (public.is_commercial_or_admin())
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Admin delete invoice items"
  ON public.invoice_items FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Staff read payments" ON public.payments;
DROP POLICY IF EXISTS "Commercial write payments" ON public.payments;
DROP POLICY IF EXISTS "Commercial update payments" ON public.payments;
DROP POLICY IF EXISTS "Admin delete payments" ON public.payments;

CREATE POLICY "Staff read payments"
  ON public.payments FOR SELECT TO authenticated
  USING (public.is_commercial_or_admin());

CREATE POLICY "Commercial write payments"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Commercial update payments"
  ON public.payments FOR UPDATE TO authenticated
  USING (public.is_commercial_or_admin())
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Admin delete payments"
  ON public.payments FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------- documents ----------
DROP POLICY IF EXISTS "Staff read documents" ON public.documents;
DROP POLICY IF EXISTS "Commercial write documents" ON public.documents;
DROP POLICY IF EXISTS "Commercial update documents" ON public.documents;
DROP POLICY IF EXISTS "Admin delete documents" ON public.documents;

CREATE POLICY "Staff read documents"
  ON public.documents FOR SELECT TO authenticated
  USING (public.is_commercial_or_admin());

CREATE POLICY "Commercial write documents"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Commercial update documents"
  ON public.documents FOR UPDATE TO authenticated
  USING (public.is_commercial_or_admin())
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Admin delete documents"
  ON public.documents FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------- activities ----------
DROP POLICY IF EXISTS "Staff read activities" ON public.activities;
DROP POLICY IF EXISTS "Commercial write activities" ON public.activities;
DROP POLICY IF EXISTS "Admin delete activities" ON public.activities;

CREATE POLICY "Staff read activities"
  ON public.activities FOR SELECT TO authenticated
  USING (public.is_commercial_or_admin());

CREATE POLICY "Commercial write activities"
  ON public.activities FOR INSERT TO authenticated
  WITH CHECK (public.is_commercial_or_admin());

CREATE POLICY "Admin delete activities"
  ON public.activities FOR DELETE TO authenticated
  USING (public.is_admin());

-- Aligner policies leads existantes (prestataire lecture possible plus tard)
-- Conservées telles quelles depuis pro-extract-hub :
--   INSERT public (anon) | SELECT/UPDATE is_staff | DELETE is_admin
