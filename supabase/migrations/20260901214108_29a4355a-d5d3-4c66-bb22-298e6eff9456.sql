ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_path TEXT;

UPDATE public.messages
SET media_path = split_part(substring(media_url from '/chat-media/(.*)$'), '?', 1)
WHERE media_url LIKE '%/chat-media/%' AND media_path IS NULL;

CREATE TABLE IF NOT EXISTS public.chat_profiles (
  id TEXT PRIMARY KEY,
  avatar_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.chat_profiles TO service_role;

ALTER TABLE public.chat_profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER chat_profiles_touch BEFORE UPDATE ON public.chat_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_site_state();

INSERT INTO public.chat_profiles (id) VALUES ('gu'), ('li') ON CONFLICT (id) DO NOTHING;