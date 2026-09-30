-- =============================================================================
-- SalisCRM — Prix cachés au prestataire + politique MFA de la direction
--   1. Le prestataire ne lit plus la table interventions (donc plus le prix HT) :
--      il passe par la vue provider_interventions et la fonction
--      provider_update_intervention
--   2. Interrupteur « double authentification obligatoire pour la direction »
--      (désactivé par défaut) ; impossible de l'activer sans l'avoir soi-même
-- Idempotent autant que possible.
-- =============================================================================

-- ---------- 1. Interventions côté prestataire ----------
-- Un prestataire lisait la ligne complète de ses interventions, prix HT compris
-- (l'interface le masquait, pas l'API). On retire son accès direct à la table.
DROP POLICY IF EXISTS "Provider read own interventions" ON public.interventions;
DROP POLICY IF EXISTS "Provider update own interventions" ON public.interventions;

-- Vue en droits du propriétaire (pas security_invoker) : le filtre ci-dessous est la
-- seule barrière, et elle ne laisse passer que les interventions du prestataire connecté.
-- Colonnes volontairement limitées : ni prix, ni devis lié, ni auteur.
CREATE OR REPLACE VIEW public.provider_interventions AS
SELECT
  i.id, i.reference, i.client_id, i.installation_id, i.provider_id,
  i.scheduled_date, i.time_slot, i.start_time, i.end_time, i.service_type,
  i.status, i.description, i.notes, i.address, i.completed_at,
  i.created_at, i.updated_at
FROM public.interventions i
WHERE i.provider_id IS NOT NULL
  AND i.provider_id = public.current_provider_id();

COMMENT ON VIEW public.provider_interventions IS
  'Interventions du prestataire connecté, sans données financières. Vue volontairement SECURITY DEFINER : filtrée par current_provider_id().';

REVOKE ALL ON public.provider_interventions FROM PUBLIC, anon;
GRANT SELECT ON public.provider_interventions TO authenticated;
GRANT ALL ON public.provider_interventions TO service_role;

-- Avancement d'une intervention par son prestataire : statut + notes uniquement.
-- Les transitions autorisées et le verrouillage des interventions closes restent
-- contrôlés par trg_interventions_provider_guard (auth.uid() est celui du prestataire).
CREATE OR REPLACE FUNCTION public.provider_update_intervention(
  p_intervention_id uuid,
  p_status public.intervention_status,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i public.interventions%ROWTYPE;
BEGIN
  IF NOT public.is_provider_of_intervention(p_intervention_id) THEN
    RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO i FROM public.interventions WHERE id = p_intervention_id FOR UPDATE;

  UPDATE public.interventions
  SET status = p_status,
      notes = NULLIF(trim(p_notes), ''),
      completed_at = CASE WHEN p_status = 'completed' AND completed_at IS NULL THEN now() ELSE completed_at END
  WHERE id = p_intervention_id;

  IF p_status = 'completed' AND i.status <> 'completed' THEN
    INSERT INTO public.activities (client_id, activity_type, title, created_by, metadata)
    VALUES (i.client_id, 'INTERVENTION_COMPLETED', 'Intervention terminée — ' || COALESCE(i.reference, ''), auth.uid(),
            jsonb_build_object('intervention_id', i.id));
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.provider_update_intervention(uuid, public.intervention_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_update_intervention(uuid, public.intervention_status, text) TO authenticated;

-- ---------- 2. Politique MFA de la direction ----------
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read settings" ON public.app_settings;
CREATE POLICY "Admin read settings"
  ON public.app_settings FOR SELECT TO authenticated
  USING (public.is_admin());

-- Écritures uniquement par les fonctions ci-dessous
REVOKE ALL ON public.app_settings FROM anon, authenticated;
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

CREATE OR REPLACE FUNCTION public._require_admin_mfa()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT value = 'true'::jsonb FROM public.app_settings WHERE key = 'require_admin_mfa'), false);
$$;

-- Lisible même par un administrateur encore sans MFA : l'écran doit savoir s'il
-- faut l'envoyer activer la double authentification.
CREATE OR REPLACE FUNCTION public.security_policy()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('require_admin_mfa', public._require_admin_mfa());
$$;

-- Session protégée : facteur vérifié → il faut le niveau aal2. Sans facteur : accès
-- normal, sauf un administrateur quand la direction a rendu la MFA obligatoire.
CREATE OR REPLACE FUNCTION public.mfa_satisfied()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM auth.mfa_factors
      WHERE user_id = auth.uid() AND status::text = 'verified'
    ) THEN COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    WHEN public._require_admin_mfa() AND EXISTS (
      SELECT 1 FROM public.staff_profiles
      WHERE user_id = auth.uid() AND role::text = 'admin'
    ) THEN false
    ELSE true
  END;
$$;

CREATE OR REPLACE FUNCTION public.set_require_admin_mfa(p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé à la direction.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Garde-fou : on ne s'enferme pas dehors. (is_admin() garantit déjà une session aal2
  -- si un facteur existe ; ici on exige qu'il en existe un.)
  IF p_enabled AND NOT EXISTS (
    SELECT 1 FROM auth.mfa_factors WHERE user_id = auth.uid() AND status::text = 'verified'
  ) THEN
    RAISE EXCEPTION 'Activez d''abord la double authentification sur votre propre compte (Sécurité du compte).'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.app_settings (key, value, updated_by)
  VALUES ('require_admin_mfa', to_jsonb(p_enabled), auth.uid())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by;

  PERFORM public._audit_event('app_settings', NULL, 'SETTING', jsonb_build_object('require_admin_mfa', p_enabled));
END;
$$;

-- La direction voit qui a activé la MFA avant de la rendre obligatoire
DROP FUNCTION IF EXISTS public.list_staff_users();
CREATE FUNCTION public.list_staff_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  role public.staff_role,
  last_sign_in_at timestamptz,
  provider_id uuid,
  provider_name text,
  mfa_enabled boolean
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
  SELECT s.user_id, u.email::text, s.display_name, s.role, u.last_sign_in_at, p.id, p.name,
         EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = s.user_id AND f.status::text = 'verified')
  FROM public.staff_profiles s
  JOIN auth.users u ON u.id = s.user_id
  LEFT JOIN public.providers p ON p.user_id = s.user_id
  ORDER BY s.role, s.display_name, u.email;
END;
$$;

-- ---------- Droits ----------
REVOKE EXECUTE ON FUNCTION public._require_admin_mfa() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.security_policy() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_require_admin_mfa(boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_staff_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.security_policy() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_require_admin_mfa(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_staff_users() TO authenticated;
