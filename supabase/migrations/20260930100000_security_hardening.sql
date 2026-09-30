-- =============================================================================
-- SalisCRM — Durcissement sécurité
--   1. Rôle prestataire : compte lié à une fiche prestataire, accès limité à SES
--      interventions (lecture, avancement, photos, rapport) et aux clients concernés
--   2. Gestion des accès staff par RPC (invitation, approbation, retrait), sans
--      jamais perdre le dernier admin
--   3. Formulaire public des leads : validation, anti-spam, pas d'URL arbitraire
--   4. Journal d'audit alimenté par triggers (non falsifiable depuis le navigateur)
-- Idempotent autant que possible. À tester sur un projet de staging avant prod.
-- =============================================================================

-- ---------- 1. Prestataires ----------
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS providers_user_id_key
  ON public.providers (user_id) WHERE user_id IS NOT NULL;

COMMENT ON COLUMN public.providers.user_id IS
  'Compte de connexion du prestataire (rôle staff prestataire). Géré par grant_staff_access().';

-- Fiche prestataire du compte connecté (NULL si pas prestataire ou fiche inactive)
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
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_provider_of_intervention(p_intervention_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.interventions
    WHERE id = p_intervention_id
      AND provider_id IS NOT NULL
      AND provider_id = public.current_provider_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_provider_of_client(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.interventions
    WHERE client_id = p_client_id
      AND provider_id IS NOT NULL
      AND provider_id = public.current_provider_id()
  );
$$;

-- Chemins Storage des photos : <client_id>/<intervention_id>/<fichier>
CREATE OR REPLACE FUNCTION public.storage_path_is_own_intervention(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parts text[] := string_to_array(p_name, '/');
  v_id uuid;
BEGIN
  IF COALESCE(array_length(v_parts, 1), 0) < 3 THEN
    RETURN false;
  END IF;
  BEGIN
    v_id := v_parts[2]::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;
  RETURN public.is_provider_of_intervention(v_id);
END;
$$;

-- Interventions : le prestataire voit / fait avancer uniquement les siennes
DROP POLICY IF EXISTS "Provider read own interventions" ON public.interventions;
CREATE POLICY "Provider read own interventions"
  ON public.interventions FOR SELECT TO authenticated
  USING (provider_id IS NOT NULL AND provider_id = public.current_provider_id());

DROP POLICY IF EXISTS "Provider update own interventions" ON public.interventions;
CREATE POLICY "Provider update own interventions"
  ON public.interventions FOR UPDATE TO authenticated
  USING (provider_id IS NOT NULL AND provider_id = public.current_provider_id())
  WITH CHECK (provider_id IS NOT NULL AND provider_id = public.current_provider_id());

-- Un prestataire ne touche ni au prix, ni au planning, ni à l'affectation :
-- seulement l'avancement (statut), les notes et les horaires réels.
CREATE OR REPLACE FUNCTION public.trg_interventions_provider_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_mutable text[] := ARRAY['status', 'notes', 'completed_at', 'start_time', 'end_time', 'updated_at'];
BEGIN
  IF COALESCE(public.current_staff_role()::text, '') <> 'prestataire' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Intervention % clôturée : contactez la direction pour toute modification.', OLD.reference
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status IN ('to_plan', 'planned') AND NEW.status IN ('in_progress', 'completed'))
    OR (OLD.status = 'in_progress' AND NEW.status = 'completed')
  ) THEN
    RAISE EXCEPTION 'Un prestataire ne peut que démarrer ou terminer une intervention.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF (to_jsonb(NEW) - v_mutable) IS DISTINCT FROM (to_jsonb(OLD) - v_mutable) THEN
    RAISE EXCEPTION 'Un prestataire ne peut modifier que le statut, les notes et les horaires.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS interventions_provider_guard ON public.interventions;
CREATE TRIGGER interventions_provider_guard
  BEFORE UPDATE ON public.interventions
  FOR EACH ROW EXECUTE FUNCTION public.trg_interventions_provider_guard();

-- Clients / installations : lecture des seuls clients de ses interventions
DROP POLICY IF EXISTS "Provider read own clients" ON public.clients;
CREATE POLICY "Provider read own clients"
  ON public.clients FOR SELECT TO authenticated
  USING (public.is_provider_of_client(id));

DROP POLICY IF EXISTS "Provider read own installations" ON public.client_installations;
CREATE POLICY "Provider read own installations"
  ON public.client_installations FOR SELECT TO authenticated
  USING (public.is_provider_of_client(client_id));

-- Sa propre fiche prestataire
DROP POLICY IF EXISTS "Provider read own provider row" ON public.providers;
CREATE POLICY "Provider read own provider row"
  ON public.providers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Photos : lecture + ajout sur ses interventions (suppression réservée à l'admin)
DROP POLICY IF EXISTS "Provider read own photos" ON public.intervention_photos;
CREATE POLICY "Provider read own photos"
  ON public.intervention_photos FOR SELECT TO authenticated
  USING (public.is_provider_of_intervention(intervention_id));

DROP POLICY IF EXISTS "Provider add own photos" ON public.intervention_photos;
CREATE POLICY "Provider add own photos"
  ON public.intervention_photos FOR INSERT TO authenticated
  WITH CHECK (public.is_provider_of_intervention(intervention_id) AND uploaded_by = auth.uid());

-- Le client d'une photo est toujours celui de l'intervention
CREATE OR REPLACE FUNCTION public.trg_intervention_photos_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT client_id INTO NEW.client_id FROM public.interventions WHERE id = NEW.intervention_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS intervention_photos_client ON public.intervention_photos;
CREATE TRIGGER intervention_photos_client
  BEFORE INSERT OR UPDATE OF intervention_id, client_id ON public.intervention_photos
  FOR EACH ROW EXECUTE FUNCTION public.trg_intervention_photos_client();

-- Produits / rapports : remplacent la policy is_staff() FOR ALL (qui laissait un
-- prestataire modifier ou supprimer les données de TOUTES les interventions)
DROP POLICY IF EXISTS intervention_products_staff ON public.intervention_products;
DROP POLICY IF EXISTS "Staff manage intervention products" ON public.intervention_products;
DROP POLICY IF EXISTS "Provider read own intervention products" ON public.intervention_products;
DROP POLICY IF EXISTS "Provider add own intervention products" ON public.intervention_products;
DROP POLICY IF EXISTS "Provider update own intervention products" ON public.intervention_products;

CREATE POLICY "Staff manage intervention products"
  ON public.intervention_products FOR ALL TO authenticated
  USING (public.is_commercial_or_admin())
  WITH CHECK (public.is_commercial_or_admin());
CREATE POLICY "Provider read own intervention products"
  ON public.intervention_products FOR SELECT TO authenticated
  USING (public.is_provider_of_intervention(intervention_id));
CREATE POLICY "Provider add own intervention products"
  ON public.intervention_products FOR INSERT TO authenticated
  WITH CHECK (public.is_provider_of_intervention(intervention_id));
CREATE POLICY "Provider update own intervention products"
  ON public.intervention_products FOR UPDATE TO authenticated
  USING (public.is_provider_of_intervention(intervention_id))
  WITH CHECK (public.is_provider_of_intervention(intervention_id));

DROP POLICY IF EXISTS intervention_reports_staff ON public.intervention_reports;
DROP POLICY IF EXISTS "Staff manage intervention reports" ON public.intervention_reports;
DROP POLICY IF EXISTS "Provider read own intervention reports" ON public.intervention_reports;
DROP POLICY IF EXISTS "Provider add own intervention reports" ON public.intervention_reports;
DROP POLICY IF EXISTS "Provider update own intervention reports" ON public.intervention_reports;

CREATE POLICY "Staff manage intervention reports"
  ON public.intervention_reports FOR ALL TO authenticated
  USING (public.is_commercial_or_admin())
  WITH CHECK (public.is_commercial_or_admin());
CREATE POLICY "Provider read own intervention reports"
  ON public.intervention_reports FOR SELECT TO authenticated
  USING (public.is_provider_of_intervention(intervention_id));
CREATE POLICY "Provider add own intervention reports"
  ON public.intervention_reports FOR INSERT TO authenticated
  WITH CHECK (public.is_provider_of_intervention(intervention_id));
CREATE POLICY "Provider update own intervention reports"
  ON public.intervention_reports FOR UPDATE TO authenticated
  USING (public.is_provider_of_intervention(intervention_id) AND validated_at IS NULL)
  WITH CHECK (public.is_provider_of_intervention(intervention_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intervention_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intervention_reports TO authenticated;

-- Storage : photos de ses interventions uniquement
DROP POLICY IF EXISTS "Provider read own intervention photos" ON storage.objects;
CREATE POLICY "Provider read own intervention photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'intervention-photos' AND public.storage_path_is_own_intervention(name));

DROP POLICY IF EXISTS "Provider upload own intervention photos" ON storage.objects;
CREATE POLICY "Provider upload own intervention photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'intervention-photos' AND public.storage_path_is_own_intervention(name));

-- ---------- 2. Gestion des accès ----------
-- On ne peut jamais retirer ou rétrograder le dernier admin
CREATE OR REPLACE FUNCTION public.trg_staff_profiles_keep_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role::text = 'admin'
     AND (TG_OP = 'DELETE' OR NEW.role::text <> 'admin')
     AND NOT EXISTS (
       SELECT 1 FROM public.staff_profiles
       WHERE role::text = 'admin' AND user_id <> OLD.user_id
     ) THEN
    RAISE EXCEPTION 'Impossible de retirer le dernier compte direction.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS staff_profiles_keep_admin ON public.staff_profiles;
CREATE TRIGGER staff_profiles_keep_admin
  BEFORE UPDATE OR DELETE ON public.staff_profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_staff_profiles_keep_admin();

CREATE OR REPLACE FUNCTION public.list_staff_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  role public.staff_role,
  last_sign_in_at timestamptz,
  provider_id uuid,
  provider_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé à la direction.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT s.user_id, u.email::text, s.display_name, s.role, u.last_sign_in_at, p.id, p.name
  FROM public.staff_profiles s
  JOIN auth.users u ON u.id = s.user_id
  LEFT JOIN public.providers p ON p.user_id = s.user_id
  ORDER BY s.role, s.display_name, u.email;
END;
$$;

-- Comptes créés via l'ancienne inscription publique, sans profil staff
CREATE OR REPLACE FUNCTION public.list_access_requests()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  requested_role text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé à la direction.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::text,
         u.raw_user_meta_data->>'display_name',
         u.raw_user_meta_data->>'requested_role',
         u.created_at
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.staff_profiles s WHERE s.user_id = u.id)
  ORDER BY u.created_at DESC;
END;
$$;

-- Donne (ou modifie) l'accès d'un compte existant. Un prestataire doit être lié à sa fiche.
CREATE OR REPLACE FUNCTION public.grant_staff_access(
  p_user_id uuid,
  p_role public.staff_role,
  p_display_name text DEFAULT NULL,
  p_provider_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé à la direction.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Compte introuvable.' USING ERRCODE = 'no_data_found';
  END IF;

  IF p_role::text = 'prestataire' AND p_provider_id IS NULL THEN
    RAISE EXCEPTION 'Un compte prestataire doit être associé à une fiche prestataire.'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.staff_profiles
  SET role = p_role,
      display_name = COALESCE(NULLIF(trim(p_display_name), ''), display_name)
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.staff_profiles (user_id, role, display_name)
    VALUES (p_user_id, p_role, NULLIF(trim(p_display_name), ''));
  END IF;

  -- Une seule fiche prestataire par compte, et seulement pour le rôle prestataire
  UPDATE public.providers
  SET user_id = NULL
  WHERE user_id = p_user_id
    AND (p_role::text <> 'prestataire' OR id IS DISTINCT FROM p_provider_id);

  IF p_role::text = 'prestataire' THEN
    UPDATE public.providers
    SET user_id = p_user_id
    WHERE id = p_provider_id AND (user_id IS NULL OR user_id = p_user_id);

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Fiche prestataire introuvable ou déjà liée à un autre compte.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_staff_access(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé à la direction.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.providers SET user_id = NULL WHERE user_id = p_user_id;
  DELETE FROM public.staff_profiles WHERE user_id = p_user_id;
END;
$$;

-- Pour l'Edge Function invite-staff uniquement (clé service_role)
CREATE OR REPLACE FUNCTION public.admin_find_user_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
$$;

-- ---------- 3. Formulaire public des leads ----------
CREATE OR REPLACE FUNCTION public._public_lead_is_throttled(p_email text, p_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.leads
      WHERE created_at > now() - interval '10 minutes'
        AND (
          (p_email IS NOT NULL AND lower(email) = lower(p_email))
          OR (p_phone IS NOT NULL AND regexp_replace(phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g'))
        )
    )
    OR (
      SELECT count(*) FROM public.leads WHERE created_at > now() - interval '10 minutes'
    ) >= 30;
$$;

-- Ne s'applique qu'aux insertions anonymes (site public). Le staff et le service_role
-- ne sont pas concernés.
CREATE OR REPLACE FUNCTION public.trg_leads_public_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_url text;
BEGIN
  IF current_user <> 'anon' THEN
    RETURN NEW;
  END IF;

  -- Champs internes : jamais fixés par le public
  NEW.status := 'new';
  NEW.assigned_user := NULL;
  NEW.converted_client_id := NULL;
  NEW.notes := NULL;
  NEW.next_action := NULL;
  NEW.next_action_date := NULL;

  NEW.email := NULLIF(lower(trim(NEW.email)), '');
  NEW.phone := NULLIF(trim(NEW.phone), '');

  IF NEW.email IS NULL AND NEW.phone IS NULL THEN
    RAISE EXCEPTION 'Merci d''indiquer un e-mail ou un téléphone.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.email IS NOT NULL AND (length(NEW.email) > 254 OR NEW.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN
    RAISE EXCEPTION 'Adresse e-mail invalide.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.phone IS NOT NULL AND (length(NEW.phone) > 30 OR NEW.phone !~ '^[0-9 +().-]{6,}$') THEN
    RAISE EXCEPTION 'Numéro de téléphone invalide.' USING ERRCODE = 'check_violation';
  END IF;
  IF length(COALESCE(NEW.message, '')) > 5000
     OR length(COALESCE(NEW.company_name, '')) > 200
     OR length(COALESCE(NEW.contact_name, '')) > 200
     OR length(COALESCE(NEW.address, '')) > 300
     OR length(COALESCE(NEW.city, '')) > 120 THEN
    RAISE EXCEPTION 'Un des champs du formulaire est trop long.' USING ERRCODE = 'check_violation';
  END IF;

  -- Photos : chemins Storage ou URL Supabase uniquement (pas de data:, javascript:,
  -- ni d'image hébergée ailleurs qui servirait de pixel de suivi)
  IF NEW.photos IS NOT NULL AND NEW.photos <> 'null'::jsonb THEN
    IF jsonb_typeof(NEW.photos) = 'array' AND jsonb_array_length(NEW.photos) > 10 THEN
      RAISE EXCEPTION '10 photos maximum.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.photos::text ~* '(data|javascript|vbscript|file):' THEN
      RAISE EXCEPTION 'Format de photo non autorisé.' USING ERRCODE = 'check_violation';
    END IF;
    FOR v_url IN SELECT m[1] FROM regexp_matches(NEW.photos::text, '([a-z]+://[^"\s]*)', 'gi') AS m
    LOOP
      IF v_url !~* '^https://[a-z0-9-]+\.supabase\.co/' THEN
        RAISE EXCEPTION 'Les photos doivent être envoyées via le formulaire.' USING ERRCODE = 'check_violation';
      END IF;
    END LOOP;
  END IF;

  IF public._public_lead_is_throttled(NEW.email, NEW.phone) THEN
    RAISE EXCEPTION 'Votre demande a déjà été reçue. Nous revenons vers vous rapidement.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_public_guard ON public.leads;
CREATE TRIGGER leads_public_guard
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_leads_public_guard();

-- ---------- 4. Journal d'audit ----------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  actor_role text,
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS audit_log_record_idx ON public.audit_log (table_name, record_id);
CREATE INDEX IF NOT EXISTS audit_log_occurred_at_idx ON public.audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON public.audit_log (actor_id);

COMMENT ON TABLE public.audit_log IS
  'Historique des écritures (triggers). Lecture direction uniquement. Immuable.';

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read audit log" ON public.audit_log;
CREATE POLICY "Admin read audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE ALL ON public.audit_log FROM anon, authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

CREATE OR REPLACE FUNCTION public.trg_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb := to_jsonb(COALESCE(NEW, OLD));
  v_changes jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value)), '{}'::jsonb)
    INTO v_changes
    FROM jsonb_each(to_jsonb(NEW)) n
    JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
    WHERE n.value IS DISTINCT FROM o.value
      AND n.key <> 'updated_at';

    IF v_changes = '{}'::jsonb THEN
      RETURN NULL;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    v_changes := to_jsonb(NEW);
  ELSE
    v_changes := to_jsonb(OLD);
  END IF;

  INSERT INTO public.audit_log (actor_id, actor_role, table_name, record_id, action, changes)
  VALUES (
    auth.uid(),
    COALESCE(public.current_staff_role()::text, current_setting('role', true), session_user::text),
    TG_TABLE_NAME,
    COALESCE(v_row->>'id', v_row->>'user_id')::uuid,
    TG_OP,
    v_changes
  );
  RETURN NULL;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'leads', 'clients', 'client_installations', 'providers', 'service_catalog',
    'interventions', 'intervention_reports', 'intervention_photos',
    'quotes', 'quote_items', 'invoices', 'invoice_items', 'payments', 'credit_notes',
    'documents', 'staff_profiles'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_audit ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.trg_audit()',
      t, t
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.trg_audit_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Le journal d''audit est en lecture seule.' USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_immutable ON public.audit_log;
CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_log_immutable();

-- ---------- Droits des fonctions ----------
REVOKE EXECUTE ON FUNCTION public.current_provider_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_provider_of_intervention(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_provider_of_client(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.storage_path_is_own_intervention(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_provider_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_provider_of_intervention(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_provider_of_client(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_path_is_own_intervention(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.list_staff_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_access_requests() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.grant_staff_access(uuid, public.staff_role, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_staff_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_staff_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_access_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_staff_access(uuid, public.staff_role, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_staff_access(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_find_user_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_find_user_by_email(text) TO service_role;

-- Appelée par le trigger des leads, exécuté avec le rôle anon
REVOKE EXECUTE ON FUNCTION public._public_lead_is_throttled(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._public_lead_is_throttled(text, text) TO anon, authenticated;

