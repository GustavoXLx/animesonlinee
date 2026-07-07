
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author TEXT NOT NULL CHECK (author IN ('gu','li')),
  text TEXT NOT NULL,
  reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  reactions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX messages_created_at_idx ON public.messages (created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.messages TO anon, authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "anyone can insert messages" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone can update messages" ON public.messages FOR UPDATE USING (true) WITH CHECK (true);

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
