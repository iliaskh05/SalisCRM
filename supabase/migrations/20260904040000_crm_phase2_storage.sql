-- =============================================================================
-- SalisCRM PHASE 2 — Storage privé (photos + documents clients)
-- Fichiers hors PostgreSQL. Accès via RLS storage + staff authentifié.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'intervention-photos',
    'intervention-photos',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  ),
  (
    'client-documents',
    'client-documents',
    false,
    26214400,
    ARRAY[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  )
ON CONFLICT (id) DO NOTHING;

-- Photos interventions
DROP POLICY IF EXISTS "Staff read intervention photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff upload intervention photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff update intervention photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete intervention photos" ON storage.objects;

CREATE POLICY "Staff read intervention photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'intervention-photos' AND public.is_commercial_or_admin());

CREATE POLICY "Staff upload intervention photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'intervention-photos' AND public.is_commercial_or_admin());

CREATE POLICY "Staff update intervention photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'intervention-photos' AND public.is_commercial_or_admin())
  WITH CHECK (bucket_id = 'intervention-photos' AND public.is_commercial_or_admin());

CREATE POLICY "Admin delete intervention photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'intervention-photos' AND public.is_admin());

-- Documents clients
DROP POLICY IF EXISTS "Staff read client documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff upload client documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff update client documents" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete client documents" ON storage.objects;

CREATE POLICY "Staff read client documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-documents' AND public.is_commercial_or_admin());

CREATE POLICY "Staff upload client documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-documents' AND public.is_commercial_or_admin());

CREATE POLICY "Staff update client documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'client-documents' AND public.is_commercial_or_admin())
  WITH CHECK (bucket_id = 'client-documents' AND public.is_commercial_or_admin());

CREATE POLICY "Admin delete client documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-documents' AND public.is_admin());
