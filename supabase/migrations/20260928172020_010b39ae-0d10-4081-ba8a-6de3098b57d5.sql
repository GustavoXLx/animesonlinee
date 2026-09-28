CREATE TABLE public.couple_home (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.couple_home TO service_role;
ALTER TABLE public.couple_home ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.home_presence (
  who text PRIMARY KEY,
  seen_at timestamptz NOT NULL DEFAULT now(),
  together_date text NOT NULL DEFAULT '',
  together_s integer NOT NULL DEFAULT 0,
  sit_id text,
  sit_at timestamptz
);
GRANT ALL ON public.home_presence TO service_role;
ALTER TABLE public.home_presence ENABLE ROW LEVEL SECURITY;