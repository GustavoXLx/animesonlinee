CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author TEXT NOT NULL CHECK (author IN ('gu','li')),
  text TEXT NOT NULL DEFAULT '',
  reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  reactions TEXT[] NOT NULL DEFAULT '{}',
  media_url TEXT,
  media_type TEXT,
  media_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ
);
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX messages_created_at_idx ON public.messages (created_at DESC);
CREATE INDEX messages_seen_idx ON public.messages (author, seen_at);
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

CREATE TABLE public.site_state (
  id TEXT PRIMARY KEY,
  chat_open BOOLEAN NOT NULL DEFAULT true,
  note TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.site_state TO service_role;
ALTER TABLE public.site_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_state REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_state;

CREATE OR REPLACE FUNCTION public.touch_site_state() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER site_state_touch BEFORE UPDATE ON public.site_state
FOR EACH ROW EXECUTE FUNCTION public.touch_site_state();
INSERT INTO public.site_state (id, chat_open, note) VALUES ('main', true, '');

CREATE TABLE public.chat_profiles (
  id TEXT PRIMARY KEY CHECK (id IN ('gu','li')),
  avatar_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.chat_profiles TO service_role;
ALTER TABLE public.chat_profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER chat_profiles_touch BEFORE UPDATE ON public.chat_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_site_state();
INSERT INTO public.chat_profiles (id) VALUES ('gu'), ('li');