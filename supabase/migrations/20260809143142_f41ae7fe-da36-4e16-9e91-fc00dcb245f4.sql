ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS seen_at timestamptz;
CREATE INDEX IF NOT EXISTS messages_seen_idx ON public.messages (author, seen_at);