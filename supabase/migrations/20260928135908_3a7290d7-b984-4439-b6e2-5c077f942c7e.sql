ALTER TABLE public.chat_profiles ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
CREATE TABLE public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author TEXT NOT NULL CHECK (author IN ('gu','li')),
  media_path TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  liked_by TEXT[] NOT NULL DEFAULT '{}',
  seen_by TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE INDEX stories_created_idx ON public.stories (created_at DESC);