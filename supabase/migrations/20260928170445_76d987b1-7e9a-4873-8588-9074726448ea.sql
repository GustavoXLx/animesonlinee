CREATE TABLE public.house_state (id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.house_state TO service_role;
ALTER TABLE public.house_state ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER house_state_touch BEFORE UPDATE ON public.house_state FOR EACH ROW EXECUTE FUNCTION public.touch_site_state();
INSERT INTO public.house_state (id) VALUES ('main') ON CONFLICT DO NOTHING;