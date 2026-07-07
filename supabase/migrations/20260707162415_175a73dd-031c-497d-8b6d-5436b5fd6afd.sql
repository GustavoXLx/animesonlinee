
ALTER TABLE public.messages
  ADD COLUMN media_url TEXT,
  ADD COLUMN media_type TEXT;

CREATE POLICY "chat media read" ON storage.objects FOR SELECT USING (bucket_id = 'chat-media');
CREATE POLICY "chat media insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-media');
