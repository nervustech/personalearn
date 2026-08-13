-- PSL-6: Storage bucket + RLS for class-scoped resource uploads (bucket: resources).

INSERT INTO storage.buckets (id, name, public)
VALUES ('resources', 'resources', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Teachers read own class resource files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resources'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.classes WHERE teacher_id = auth.uid()
  )
);

CREATE POLICY "Teachers upload own class resource files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resources'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.classes WHERE teacher_id = auth.uid()
  )
);

CREATE POLICY "Teachers update own class resource files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'resources'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.classes WHERE teacher_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'resources'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.classes WHERE teacher_id = auth.uid()
  )
);

CREATE POLICY "Teachers delete own class resource files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'resources'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.classes WHERE teacher_id = auth.uid()
  )
);
