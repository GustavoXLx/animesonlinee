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

ALTER PUBLICATION supabase_realtime ADD TABLE public.site_state;
ALTER TABLE public.site_state REPLICA IDENTITY FULL;

INSERT INTO public.site_state (id, chat_open, note) VALUES ('main', true, '');