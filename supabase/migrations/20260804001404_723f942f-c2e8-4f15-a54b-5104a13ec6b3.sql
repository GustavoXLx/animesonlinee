-- Lock down all direct public API access: only trusted server code can read/write.
DROP POLICY IF EXISTS "anyone can read messages" ON public.messages;
DROP POLICY IF EXISTS "anyone can insert messages" ON public.messages;
DROP POLICY IF EXISTS "anyone can update messages" ON public.messages;
DROP POLICY IF EXISTS "anyone can read site state" ON public.site_state;
DROP POLICY IF EXISTS "anyone can update site state" ON public.site_state;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.messages FROM anon, authenticated;
REVOKE ALL ON public.site_state FROM anon, authenticated;
GRANT ALL ON public.messages TO service_role;
GRANT ALL ON public.site_state TO service_role;

-- Storage: uploads allowed, but no direct reads/listing without a signed link from the server.
DROP POLICY IF EXISTS "chat media read" ON storage.objects;