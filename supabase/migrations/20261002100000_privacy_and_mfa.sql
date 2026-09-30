-- =============================================================================
-- SalisCRM — RGPD et double authentification
--   1. MFA appliquée PAR LA BASE : un compte qui a activé la double authentification
--      n'a plus aucun droit tant que sa session n'est pas au niveau aal2
--   2. export_client_data : export JSON des données d'un client (accès / portabilité)
--   3. anonymize_client : effacement des données personnelles, factures conservées
--      (obligation légale de 10 ans), valeurs personnelles retirées du journal d'audit
--   4. purge_expired_leads : suppression des demandes non converties au-delà d'une
--      durée de conservation (simulation par défaut)
-- Idempotent autant que possible.
-- =============================================================================

-- ---------- 1. MFA appliquée côté base ----------
-- Vrai si l'utilisateur n'a pas de facteur vérifié, ou si sa session est déjà aal2.
CREATE OR REPLACE FUNCTION public.mfa_satisfied()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      OR NOT EXISTS (
        SELECT 1 FROM auth.mfa_factors
        WHERE user_id = auth.uid() AND status::text = 'verified'
      );
$$;

-- Toutes les policies passent par ces helpers : un seul point d'application.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.mfa_satisfied() AND EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE user_id = auth.uid()
      AND role::text IN ('admin', 'commercial', 'prestataire')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.mfa_satisfied() AND EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE user_id = auth.uid() AND role::text = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_commercial_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.mfa_satisfied() AND EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE user_id = auth.uid()
      AND role::text IN ('admin', 'commercial')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS public.staff_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.staff_profiles
  WHERE user_id = auth.uid() AND public.mfa_satisfied()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_provider_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.providers p
  JOIN public.staff_profiles s ON s.user_id = p.user_id
  WHERE p.user_id = auth.uid()
    AND s.role::text = 'prestataire'
    AND p.status = 'active'
    AND public.mfa_satisfied()
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.mfa_satisfied() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_satisfied() TO authenticated;

-- ---------- Journal d'audit : purge ciblée des données personnelles ----------
-- L'audit garde les anciennes valeurs : sans ce nettoyage, anonymiser un client
-- laisserait son e-mail et son téléphone dans audit_log.
CREATE OR REPLACE FUNCTION public.trg_audit_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Seule exception : _scrub_audit() remplace la colonne `changes`, rien d'autre.
  IF TG_OP = 'UPDATE'
     AND COALESCE(current_setting('saliscrm.audit_scrub', true), '') = 'on'
     AND (to_jsonb(NEW) - 'changes') = (to_jsonb(OLD) - 'changes') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Le journal d''audit est en lecture seule.' USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE OR REPLACE FUNCTION public._scrub_audit(p_table text, p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  PERFORM set_config('saliscrm.audit_scrub', 'on', true);
  UPDATE public.audit_log
  SET changes = jsonb_build_object('anonymized', true)
  WHERE table_name = p_table AND record_id = ANY (p_ids);
  PERFORM set_config('saliscrm.audit_scrub', '', true);
END;
$$;

CREATE OR REPLACE FUNCTION public._audit_event(p_table text, p_record uuid, p_action text, p_details jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.audit_log (actor_id, actor_role, table_name, record_id, action, changes)
  VALUES (auth.uid(), public.current_staff_role()::text, p_table, p_record, p_action, COALESCE(p_details, '{}'::jsonb));
$$;

-- ---------- 2. Export des données d'un client ----------
CREATE OR REPLACE FUNCTION public.export_client_data(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.clients%ROWTYPE;
  v jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé à la direction.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO c FROM public.clients WHERE id = p_client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client introuvable.' USING ERRCODE = 'no_data_found';
  END IF;

  v := jsonb_build_object(
    'exported_at', now(),
    'client', to_jsonb(c),
    'installations', COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM public.client_installations i WHERE i.client_id = c.id), '[]'),
    'demandes', COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM public.leads l WHERE l.id = c.lead_id OR l.converted_client_id = c.id), '[]'),
    'devis', COALESCE((
      SELECT jsonb_agg(to_jsonb(q) || jsonb_build_object('lignes',
        COALESCE((SELECT jsonb_agg(to_jsonb(qi) ORDER BY qi.position) FROM public.quote_items qi WHERE qi.quote_id = q.id), '[]')))
      FROM public.quotes q WHERE q.client_id = c.id), '[]'),
    'factures', COALESCE((
      SELECT jsonb_agg(to_jsonb(inv) || jsonb_build_object(
        'lignes', COALESCE((SELECT jsonb_agg(to_jsonb(ii) ORDER BY ii.position) FROM public.invoice_items ii WHERE ii.invoice_id = inv.id), '[]'),
        'paiements', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM public.payments p WHERE p.invoice_id = inv.id), '[]')))
      FROM public.invoices inv WHERE inv.client_id = c.id), '[]'),
    'avoirs', COALESCE((SELECT jsonb_agg(to_jsonb(cn)) FROM public.credit_notes cn WHERE cn.client_id = c.id), '[]'),
    'interventions', COALESCE((
      SELECT jsonb_agg(to_jsonb(iv) || jsonb_build_object('rapport',
        (SELECT to_jsonb(r) FROM public.intervention_reports r WHERE r.intervention_id = iv.id)))
      FROM public.interventions iv WHERE iv.client_id = c.id), '[]'),
    'documents', COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM public.documents d WHERE d.client_id = c.id), '[]'),
    'historique', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at) FROM public.activities a WHERE a.client_id = c.id), '[]')
  );

  PERFORM public._audit_event('clients', c.id, 'EXPORT', jsonb_build_object('purpose', 'RGPD access/portability'));
  RETURN v;
END;
$$;

-- ---------- 3. Anonymisation d'un client ----------
CREATE OR REPLACE FUNCTION public.anonymize_client(
  p_client_id uuid,
  p_reason text,
  p_include_company boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.clients%ROWTYPE;
  v_lead_ids uuid[];
  v_install_ids uuid[];
  v_report_ids uuid[];
  v_docs jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé à la direction.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF COALESCE(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Le motif est obligatoire (demande de la personne, fin de relation…).' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO c FROM public.clients WHERE id = p_client_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client introuvable.' USING ERRCODE = 'no_data_found';
  END IF;

  -- Le nom du client est rendu sur chaque facture (conservation légale 10 ans)
  IF p_include_company AND EXISTS (SELECT 1 FROM public.invoices WHERE client_id = c.id) THEN
    RAISE EXCEPTION 'Ce client a des factures : son nom doit être conservé 10 ans. Anonymisez seulement les coordonnées.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(array_agg(id), '{}') INTO v_lead_ids
  FROM public.leads WHERE id = c.lead_id OR converted_client_id = c.id;
  SELECT COALESCE(array_agg(id), '{}') INTO v_install_ids FROM public.client_installations WHERE client_id = c.id;
  SELECT COALESCE(array_agg(r.id), '{}') INTO v_report_ids
  FROM public.intervention_reports r JOIN public.interventions i ON i.id = r.intervention_id WHERE i.client_id = c.id;

  UPDATE public.clients
  SET contact_name = NULL, phone = NULL, email = NULL, notes = NULL,
      next_action = NULL, next_action_date = NULL,
      company_name = CASE WHEN p_include_company THEN 'Client anonymisé' ELSE company_name END,
      status = 'archived'
  WHERE id = c.id;

  UPDATE public.client_installations SET remarks = NULL WHERE client_id = c.id;

  UPDATE public.leads
  SET contact_name = NULL, email = NULL, phone = NULL, message = NULL, notes = NULL, address = NULL,
      photos = '[]'::jsonb,
      company_name = CASE WHEN p_include_company THEN 'Anonymisé' ELSE company_name END
  WHERE id = ANY (v_lead_ids);

  UPDATE public.activities SET description = NULL WHERE client_id = c.id OR lead_id = ANY (v_lead_ids);

  UPDATE public.intervention_reports
  SET client_signature = CASE WHEN client_signature IS NULL THEN NULL ELSE 'Anonymisé' END
  WHERE id = ANY (v_report_ids);

  -- Les modifications ci-dessus ont elles-mêmes été journalisées avec les anciennes valeurs
  PERFORM public._scrub_audit('clients', ARRAY[c.id]);
  PERFORM public._scrub_audit('leads', v_lead_ids);
  PERFORM public._scrub_audit('client_installations', v_install_ids);
  PERFORM public._scrub_audit('intervention_reports', v_report_ids);

  -- Fichiers déposés : à vérifier à la main (suppression via l'API Storage)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'doc_type', doc_type)), '[]')
  INTO v_docs FROM public.documents WHERE client_id = c.id;

  PERFORM public._audit_event('clients', c.id, 'ANONYMIZE', jsonb_build_object('reason', trim(p_reason), 'company', p_include_company));

  RETURN jsonb_build_object('client_id', c.id, 'leads_anonymized', COALESCE(array_length(v_lead_ids, 1), 0), 'documents_to_review', v_docs);
END;
$$;

-- ---------- 4. Purge des demandes anciennes ----------
-- Demandes jamais converties, sans devis ni client : supprimées après p_months mois
-- (36 par défaut : durée usuelle de conservation d'un prospect). Simulation par défaut.
DROP POLICY IF EXISTS "Admin delete lead documents" ON storage.objects;
CREATE POLICY "Admin delete lead documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lead-documents' AND public.is_admin());

CREATE OR REPLACE FUNCTION public.purge_expired_leads(p_months integer DEFAULT 36, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
  v_paths text[];
  v_deleted integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé à la direction.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_months IS NULL OR p_months < 12 OR p_months > 120 THEN
    RAISE EXCEPTION 'La durée de conservation doit être comprise entre 12 et 120 mois.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(array_agg(l.id), '{}') INTO v_ids
  FROM public.leads l
  WHERE l.created_at < now() - make_interval(months => p_months)
    AND l.converted_client_id IS NULL
    AND l.status::text <> 'won'
    AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.lead_id = l.id)
    AND NOT EXISTS (SELECT 1 FROM public.quotes q WHERE q.lead_id = l.id);

  -- Photos déposées avec les demandes (chemins Storage, pas les URL externes)
  SELECT COALESCE(array_agg(DISTINCT path), '{}') INTO v_paths
  FROM (
    SELECT CASE
             WHEN jsonb_typeof(e) = 'string' THEN e #>> '{}'
             ELSE COALESCE(e ->> 'storage_path', e ->> 'path')
           END AS path
    FROM public.leads l, jsonb_array_elements(CASE WHEN jsonb_typeof(l.photos) = 'array' THEN l.photos ELSE '[]'::jsonb END) e
    WHERE l.id = ANY (v_ids)
  ) s
  WHERE path IS NOT NULL AND path !~* '^[a-z]+:';

  IF NOT p_dry_run THEN
    DELETE FROM public.leads WHERE id = ANY (v_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    PERFORM public._scrub_audit('leads', v_ids);
    PERFORM public._audit_event('leads', NULL, 'PURGE', jsonb_build_object('months', p_months, 'deleted', v_deleted));
  END IF;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'months', p_months,
    'candidates', COALESCE(array_length(v_ids, 1), 0),
    'deleted', v_deleted,
    'storage_paths', to_jsonb(v_paths)
  );
END;
$$;

-- ---------- Droits ----------
REVOKE EXECUTE ON FUNCTION public._scrub_audit(text, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._audit_event(text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.export_client_data(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.anonymize_client(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purge_expired_leads(integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_client_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_client(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_leads(integer, boolean) TO authenticated;
