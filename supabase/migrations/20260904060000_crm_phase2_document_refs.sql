-- Références séquentielles (clients / interventions / devis / factures)

CREATE TABLE IF NOT EXISTS public.document_counters (
  key text PRIMARY KEY,
  value bigint NOT NULL DEFAULT 0
);

ALTER TABLE public.document_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read counters" ON public.document_counters;
CREATE POLICY "Staff read counters"
  ON public.document_counters FOR SELECT TO authenticated
  USING (public.is_commercial_or_admin());

GRANT SELECT ON public.document_counters TO authenticated;
GRANT ALL ON public.document_counters TO service_role;

CREATE OR REPLACE FUNCTION public.next_document_ref(prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year_part text := to_char(now(), 'YYYY');
  seq_name text := format('doc_ref_%s_%s', lower(prefix), year_part);
  n bigint;
BEGIN
  INSERT INTO public.document_counters (key, value)
  VALUES (seq_name, 1)
  ON CONFLICT (key) DO UPDATE
    SET value = public.document_counters.value + 1
  RETURNING value INTO n;

  RETURN prefix || '-' || year_part || '-' || lpad(n::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_document_ref(text) TO authenticated;
