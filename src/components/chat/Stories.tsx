import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, X, Send, Trash2, Eye } from "lucide-react";
import {
  listStories,
  likeStory,
  seeStory,
  deleteStory,
  postStory,
  createUpload,
  sendMessage,
} from "@/lib/chat.functions";
import { supabase } from "@/integrations/supabase/client";

export type Story = {
  id: string;
  author: "gu" | "li";
  media_path: string;
  url: string | null;
  liked_by: string[];
  seen_by: string[];
  created_at: string;
};

const NAME = { gu: "bb gu", li: "bb li" } as const;

export function useStories() {
  const [stories, setStories] = useState<Story[]>([]);
  const reload = useCallback(async () => {
    try {
      const res = await listStories();
      setStories(res.rows as Story[]);
    } catch {
      /* noop */
    }
  }, []);
  useEffect(() => {
    void reload();
    const t = setInterval(() => document.visibilityState === "visible" && void reload(), 20000);
    return () => clearInterval(t);
  }, [reload]);
  return { stories, reload };
}

export async function uploadStory(who: "gu" | "li", file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const { path, token } = await createUpload({ data: { ext } });
  const { error } = await supabase.storage
    .from("chat-media")
    .uploadToSignedUrl(path, token, file, { contentType: file.type });
  if (error) throw error;
  await postStory({ data: { who, path, type: "image" } });
}

/** Borda colorida em volta da foto quando há story. */
export function storyRing(list: Story[], viewer: "gu" | "li") {
  if (!list.length) return "";
  const unseen = list.some((s) => !s.seen_by.includes(viewer) && s.author !== viewer);
  return unseen
    ? "ring-2 ring-offset-2 ring-offset-neutral-950 ring-pink-500"
    : "ring-2 ring-offset-2 ring-offset-neutral-950 ring-white/30";
}

function ago(iso: string) {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m} min` : `${Math.round(m / 60)} h`;
}

export function StoryViewer({
  list,
  me,
  onClose,
  onChanged,
}: {
  list: Story[];
  me: "gu" | "li";
  onClose: () => void;
  onChanged: () => void;
}) {
  const [i, setI] = useState(0);
  const [reply, setReply] = useState("");
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState(false);
  const s = list[i];
  const mineStory = s?.author === me;
  const startRef = useRef(Date.now());
  const DURATION = 6000;

  useEffect(() => {
    if (!s) return;
    startRef.current = Date.now();
    setProgress(0);
    if (!mineStory) void seeStory({ data: { id: s.id, me } });
  }, [s, mineStory, me]);

  useEffect(() => {
    if (paused || !s) return;
    const base = Date.now() - progress * DURATION;
    const t = setInterval(() => {
      const p = (Date.now() - base) / DURATION;
      if (p >= 1) {
        clearInterval(t);
        if (i < list.length - 1) setI(i + 1);
        else onClose();
      } else setProgress(p);
    }, 50);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, i, s]);

  if (!s) return null;
  const isLiked = liked[s.id] ?? s.liked_by.includes(me);

  const sendReply = async () => {
    const text = reply.trim();
    if (!text) return;
    setReply("");
    setPaused(false);
    await sendMessage({
      data: { author: me, text, mediaPath: s.media_path, mediaType: "story_reply" },
    });
    setSent(true);
    setTimeout(() => setSent(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black text-white flex flex-col">
      <div className="absolute top-0 inset-x-0 z-10 p-3 space-y-2 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex gap-1">
          {list.map((x, k) => (
            <div key={x.id} className="h-0.5 flex-1 rounded bg-white/30 overflow-hidden">
              <div className="h-full bg-white" style={{ width: `${k < i ? 100 : k === i ? progress * 100 : 0}%` }} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{NAME[s.author]}</p>
          <p className="text-xs text-white/60">{ago(s.created_at)}</p>
          <div className="flex-1" />
          {mineStory && (
            <button
              aria-label="Apagar story"
              onClick={async () => {
                if (!confirm("Apagar este story?")) return;
                await deleteStory({ data: { id: s.id } });
                onChanged();
                onClose();
              }}
              className="p-1"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button onClick={onClose} aria-label="Fechar" className="p-1">
            <X size={22} />
          </button>
        </div>
      </div>

      <div
        className="flex-1 relative flex items-center justify-center"
        onPointerDown={() => setPaused(true)}
        onPointerUp={(e) => {
          setPaused(false);
          const x = e.clientX / window.innerWidth;
          if (x < 0.3) setI((v) => Math.max(0, v - 1));
          else if (x > 0.7) {
            if (i < list.length - 1) setI(i + 1);
            else onClose();
          }
        }}
      >
        {s.url && <img src={s.url} alt="" className="max-h-full max-w-full object-contain select-none" draggable={false} />}
        {sent && (
          <div className="absolute bottom-6 bg-white/15 backdrop-blur rounded-full px-4 py-2 text-xs">resposta enviada</div>
        )}
      </div>

      <div className="p-3 pb-5">
        {mineStory ? (
          <div className="flex items-center justify-center gap-4 text-xs text-white/70">
            <span className="flex items-center gap-1">
              <Eye size={14} /> {s.seen_by.length ? "visto" : "ainda não visto"}
            </span>
            {s.liked_by.length > 0 && (
              <span className="flex items-center gap-1 text-pink-400">
                <Heart size={14} fill="currentColor" /> curtido
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={reply}
              onFocus={() => setPaused(true)}
              onBlur={() => !reply && setPaused(false)}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void sendReply()}
              placeholder={`responder ${NAME[s.author]}...`}
              className="flex-1 rounded-full border border-white/30 bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-white/50"
            />
            {reply.trim() ? (
              <button onClick={() => void sendReply()} aria-label="Enviar resposta" className="p-2">
                <Send size={22} />
              </button>
            ) : (
              <button
                aria-label="Curtir story"
                onClick={async () => {
                  setLiked((l) => ({ ...l, [s.id]: !isLiked }));
                  await likeStory({ data: { id: s.id, me } });
                  onChanged();
                }}
                className="p-2"
              >
                <Heart size={26} className={isLiked ? "text-pink-500" : ""} fill={isLiked ? "currentColor" : "none"} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
