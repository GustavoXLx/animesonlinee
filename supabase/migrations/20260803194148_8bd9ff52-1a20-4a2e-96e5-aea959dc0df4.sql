CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author TEXT NOT NULL CHECK (author IN ('gu','li')),
  text TEXT NOT NULL,
  reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  reactions TEXT[] NOT NULL DEFAULT '{}',
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX messages_created_at_idx ON public.messages (created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.messages TO anon;
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "anyone can insert messages" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone can update messages" ON public.messages FOR UPDATE USING (true) WITH CHECK (true);

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

CREATE TABLE public.site_state (
  id text PRIMARY KEY,
  chat_open boolean NOT NULL DEFAULT true,
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.site_state TO anon;
GRANT SELECT, UPDATE ON public.site_state TO authenticated;
GRANT ALL ON public.site_state TO service_role;

ALTER TABLE public.site_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read site state" ON public.site_state FOR SELECT USING (true);
CREATE POLICY "anyone can update site state" ON public.site_state FOR UPDATE USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_site_state() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER site_state_touch BEFORE UPDATE ON public.site_state
FOR EACH ROW EXECUTE FUNCTION public.touch_site_state();

ALTER TABLE public.site_state REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_state;

INSERT INTO public.site_state (id, chat_open, note) VALUES ('main', true, '');