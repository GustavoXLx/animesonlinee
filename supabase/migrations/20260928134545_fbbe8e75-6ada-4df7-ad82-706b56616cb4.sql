CREATE TABLE public.playlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  media_path TEXT NOT NULL,
  added_by TEXT NOT NULL CHECK (added_by IN ('gu','li')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.playlist TO service_role;
ALTER TABLE public.playlist ENABLE ROW LEVEL SECURITY;