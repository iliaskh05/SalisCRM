-- =============================================================================
-- SalisCRM — Opérations métier transactionnelles
--   1. convert_lead_to_client : une seule règle de conversion (page prospect ET
--      création de devis), recherche de doublon exacte (plus de ilike joker)
--   2. create_intervention_from_quote : prix = HT remisé, pas de doublon,
--      devis lié et accepté dans la même transaction
--   3. save_intervention_report : rapport dans intervention_reports (plus
--      d'écrasement des notes), validation = clôture de l'intervention
-- =============================================================================

-- ---------- 1. Lead → client ----------
CREATE OR REPLACE FUNCTION public.convert_lead_to_client(
  p_lead_id uuid,
  p_mark_won boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l public.leads%ROWTYPE;
  v_client_id uuid;
  v_installation_id uuid;
  v_created boolean := false;
BEGIN
  IF NOT public.is_commercial_or_admin() THEN
    RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO l FROM public.leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable.' USING ERRCODE = 'no_data_found';
  END IF;

  -- Client déjà lié, sinon doublon exact (casse et espaces ignorés), sinon création
  SELECT id INTO v_client_id FROM public.clients WHERE id = l.converted_client_id;

  IF v_client_id IS NULL AND NULLIF(trim(l.email), '') IS NOT NULL THEN
    SELECT id INTO v_client_id FROM public.clients
    WHERE lower(trim(email)) = lower(trim(l.email))
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_client_id IS NULL AND NULLIF(trim(l.company_name), '') IS NOT NULL THEN
    SELECT id INTO v_client_id FROM public.clients
    WHERE lower(trim(company_name)) = lower(trim(l.company_name))
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (
      company_name, contact_name, phone, email, address, city, postal_code,
      business_type, lead_id, notes, status, created_by
    )
    VALUES (
      COALESCE(NULLIF(trim(l.company_name), ''), NULLIF(trim(l.contact_name), ''), 'Client sans nom'),
      l.contact_name, l.phone, l.email, l.address, l.city, l.postal_code,
      l.business_type, l.id, COALESCE(l.notes, l.message), 'active', auth.uid()
    )
    RETURNING id INTO v_client_id;
    v_created := true;

    INSERT INTO public.activities (client_id, lead_id, activity_type, title, created_by)
    VALUES (v_client_id, l.id, 'CLIENT_CREATED', 'Client créé depuis une demande', auth.uid());
  END IF;

  SELECT id INTO v_installation_id FROM public.client_installations
  WHERE client_id = v_client_id
  ORDER BY created_at
  LIMIT 1;

  IF v_installation_id IS NULL THEN
    INSERT INTO public.client_installations (
      client_id, label, hood_length, hood_type, filter_count, filter_type,
      duct_present, duct_length, duct_accessibility, motor_present, motor_type,
      night_intervention, schedule_preference, soil_level, remarks
    )
    VALUES (
      v_client_id, 'Installation principale', l.hood_length, l.hood_type, l.filter_count, l.filter_type,
      COALESCE(l.duct_present, false), l.duct_length, l.accessibility, COALESCE(l.motor_present, false), l.motor_type,
      COALESCE(l.night_intervention, false), l.schedule_preference, l.soil_level, l.message
    )
    RETURNING id INTO v_installation_id;
  END IF;

  UPDATE public.leads
  SET converted_client_id = v_client_id,
      status = CASE WHEN p_mark_won THEN 'won' ELSE status END,
      updated_at = now()
  WHERE id = l.id;

  IF p_mark_won AND l.status::text IS DISTINCT FROM 'won' THEN
    INSERT INTO public.activities (client_id, lead_id, activity_type, title, created_by, metadata)
    VALUES (v_client_id, l.id, 'LEAD_CONVERTED', 'Prospect converti en client', auth.uid(),
            jsonb_build_object('client_id', v_client_id));
  END IF;

  RETURN jsonb_build_object(
    'client_id', v_client_id,
    'installation_id', v_installation_id,
    'created', v_created
  );
END;
$$;

-- ---------- 2. Devis → intervention ----------
CREATE OR REPLACE FUNCTION public.create_intervention_from_quote(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q public.quotes%ROWTYPE;
  v_existing text;
  v_first_label text;
  v_labels text;
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
    RAISE EXCEPTION 'Le devis % est %, aucune intervention ne peut en être créée.', q.reference,
      CASE q.status WHEN 'rejected' THEN 'refusé' ELSE 'expiré' END
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT reference INTO v_existing
  FROM public.interventions
  WHERE quote_id = p_quote_id AND status <> 'cancelled'
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Une intervention existe déjà pour le devis % (%).', q.reference, v_existing
      USING ERRCODE = 'unique_violation';
  END IF;

  SELECT
    (array_agg(label ORDER BY position))[1],
    string_agg(label, ' · ' ORDER BY position)
  INTO v_first_label, v_labels
  FROM public.quote_items
  WHERE quote_id = p_quote_id;

  IF v_first_label IS NULL THEN
    RAISE EXCEPTION 'Le devis % n''a aucune ligne.', q.reference USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.interventions (
    client_id, installation_id, quote_id, status, service_type, description,
    price_ht, address, notes, created_by
  )
  SELECT
    q.client_id,
    q.installation_id,
    q.id,
    'to_plan',
    v_first_label,
    v_labels,
    q.subtotal_ht - LEAST(q.discount_ht, q.subtotal_ht),
    NULLIF(concat_ws(', ', c.address, NULLIF(concat_ws(' ', c.postal_code, c.city), '')), ''),
    concat_ws(E'\n\n', NULLIF(q.notes, ''), 'Créée depuis ' || q.reference),
    auth.uid()
  FROM public.clients c
  WHERE c.id = q.client_id
  RETURNING id INTO v_id;

  UPDATE public.quotes
  SET status = CASE WHEN status = 'accepted' THEN status ELSE 'accepted' END,
      converted_intervention_id = v_id
  WHERE id = q.id;

  INSERT INTO public.activities (client_id, activity_type, title, created_by, metadata)
  VALUES (q.client_id, 'INTERVENTION_CREATED', 'Intervention créée depuis ' || q.reference, auth.uid(),
          jsonb_build_object('intervention_id', v_id, 'quote_id', q.id));

  RETURN v_id;
END;
$$;

-- ---------- 3. Rapport d'intervention ----------
DROP TRIGGER IF EXISTS intervention_reports_set_updated_at ON public.intervention_reports;
CREATE TRIGGER intervention_reports_set_updated_at
  BEFORE UPDATE ON public.intervention_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.save_intervention_report(
  p_intervention_id uuid,
  p_work_completed text,
  p_observations text DEFAULT NULL,
  p_difficulties text DEFAULT NULL,
  p_recommendations text DEFAULT NULL,
  p_provider_signature text DEFAULT NULL,
  p_client_signature text DEFAULT NULL,
  p_validate boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i public.interventions%ROWTYPE;
  v_validated timestamptz;
  v_report_id uuid;
BEGIN
  IF NOT (public.is_commercial_or_admin() OR public.is_provider_of_intervention(p_intervention_id)) THEN
    RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO i FROM public.interventions WHERE id = p_intervention_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intervention introuvable.' USING ERRCODE = 'no_data_found';
  END IF;
  IF i.status = 'cancelled' THEN
    RAISE EXCEPTION 'L''intervention % est annulée.', i.reference USING ERRCODE = 'check_violation';
  END IF;

  SELECT validated_at INTO v_validated FROM public.intervention_reports WHERE intervention_id = i.id;
  IF v_validated IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Le rapport de % est validé : seule la direction peut le modifier.', i.reference
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_validate AND (
    NULLIF(trim(p_work_completed), '') IS NULL
    OR NULLIF(trim(p_provider_signature), '') IS NULL
    OR NULLIF(trim(p_client_signature), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Pour valider : travail réalisé, signature prestataire et signature client sont obligatoires.'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.intervention_reports (
    intervention_id, work_completed, observations, difficulties, recommendations,
    provider_signature, client_signature, validated_at
  )
  VALUES (
    i.id,
    NULLIF(trim(p_work_completed), ''),
    NULLIF(trim(p_observations), ''),
    NULLIF(trim(p_difficulties), ''),
    NULLIF(trim(p_recommendations), ''),
    NULLIF(trim(p_provider_signature), ''),
    NULLIF(trim(p_client_signature), ''),
    CASE WHEN p_validate THEN now() END
  )
  ON CONFLICT (intervention_id) DO UPDATE SET
    work_completed = EXCLUDED.work_completed,
    observations = EXCLUDED.observations,
    difficulties = EXCLUDED.difficulties,
    recommendations = EXCLUDED.recommendations,
    provider_signature = EXCLUDED.provider_signature,
    client_signature = EXCLUDED.client_signature,
    validated_at = COALESCE(EXCLUDED.validated_at, public.intervention_reports.validated_at)
  RETURNING id INTO v_report_id;

  -- Rapport validé = intervention terminée (le trigger prestataire autorise cette transition)
  IF p_validate AND i.status <> 'completed' THEN
    UPDATE public.interventions
    SET status = 'completed', completed_at = COALESCE(completed_at, now())
    WHERE id = i.id;

    INSERT INTO public.activities (client_id, activity_type, title, created_by, metadata)
    VALUES (i.client_id, 'INTERVENTION_COMPLETED', 'Rapport validé — ' || i.reference, auth.uid(),
            jsonb_build_object('intervention_id', i.id, 'report_id', v_report_id));
  END IF;

  RETURN v_report_id;
END;
$$;

-- ---------- Droits ----------
REVOKE EXECUTE ON FUNCTION public.convert_lead_to_client(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_intervention_from_quote(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_intervention_report(uuid, text, text, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_lead_to_client(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_intervention_from_quote(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_intervention_report(uuid, text, text, text, text, text, text, boolean) TO authenticated;
