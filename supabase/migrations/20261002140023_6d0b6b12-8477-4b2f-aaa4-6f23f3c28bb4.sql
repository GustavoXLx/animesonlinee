CREATE TABLE public.push_subs (
  endpoint text PRIMARY KEY,
  who text NOT NULL CHECK (who IN ('gu','li')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.push_subs TO service_role;
ALTER TABLE public.push_subs ENABLE ROW LEVEL SECURITY;