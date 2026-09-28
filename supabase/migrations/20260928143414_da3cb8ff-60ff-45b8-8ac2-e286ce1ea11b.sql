ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS music jsonb;
CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author text NOT NULL CHECK (author IN ('gu','li')),
  text text NOT NULL DEFAULT '',
  music jsonb,
  liked_by text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX notes_created_idx ON public.notes (created_at DESC);