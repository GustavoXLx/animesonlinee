import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { ArrowLeft, Send, Heart, Smile, X, Reply, Paperclip, Loader2, Sticker, ArrowDown, Gamepad2, Images, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GamesPanel } from "@/components/games/GamesPanel";

import sticker1 from "@/assets/stickers/sticker_110629.jpg.asset.json";
import sticker2 from "@/assets/stickers/sticker_110652.jpg.asset.json";
import sticker3 from "@/assets/stickers/sticker_110704.jpg.asset.json";
import sticker4 from "@/assets/stickers/sticker_110722.jpg.asset.json";
import sticker5 from "@/assets/stickers/sticker_110758.jpg.asset.json";
import sticker6 from "@/assets/stickers/sticker_110825.jpg.asset.json";

const STICKERS = [sticker1, sticker2, sticker3, sticker4, sticker5, sticker6].map((s) => s.url);
const CLEAR_KEY = (me: string) => `chat-clear-cutoff-${me}`;

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Chat" }, { name: "robots", content: "noindex" }] }),
  component: ChatPage,
});

type Msg = {
  id: string;
  author: "gu" | "li";
  text: string;
  ts: number;
  reactions: string[];
  replyTo?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
};

type Row = {
  id: string;
  author: "gu" | "li";
  text: string;
  reactions: string[] | null;
  reply_to: string | null;
  created_at: string;
  media_url: string | null;
  media_type: string | null;
};

const MAX_VISIBLE = 30;
const FETCH_LIMIT = 250;
const REACTIONS = ["❤️", "😂", "😍", "😢", "🔥", "👍"];
const SIGNED_URL_TTL = 60 * 60 * 24 * 365;

const AVATARS = {
  gu: { name: "bb gu", color: "from-sky-400 to-indigo-600", initial: "G" },
  li: { name: "bb li", color: "from-pink-400 to-rose-600", initial: "L" },
} as const;

function rowToMsg(r: Row): Msg {
  return {
    id: r.id,
    author: r.author,
    text: r.text,
    ts: new Date(r.created_at).getTime(),
    reactions: r.reactions ?? [],
    replyTo: r.reply_to,
    mediaUrl: r.media_url,
    mediaType: r.media_type,
  };
}

function ChatPage() {
  const nav = useNavigate();
  const [me, setMe] = useState<"gu" | "li" | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [clearCutoff, setClearCutoff] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const atBottomRef = useRef(true);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("chat-unlocked") !== "1") {
      nav({ to: "/unlock" });
      return;
    }
    const saved = sessionStorage.getItem("chat-me") as "gu" | "li" | null;
    if (saved) {
      setMe(saved);
      const raw = localStorage.getItem(CLEAR_KEY(saved));
      setClearCutoff(raw ? Number(raw) || 0 : 0);
    }
  }, [nav]);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    const other = me === "gu" ? "li" : "gu";

    const refetch = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(FETCH_LIMIT);
      if (cancelled || !data) return;
      const rows = (data as Row[]).reverse().map(rowToMsg);
      setMsgs((prev) => {
        const tmp = prev.filter((x) => x.id.startsWith("tmp_"));
        return [...rows, ...tmp];
      });
    };

    refetch();

    const clearOtherTyping = () => {
      setOtherTyping(false);
    };
    let otherTypingTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel("chat-room-shared", { config: { presence: { key: me }, broadcast: { self: false } } })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = rowToMsg(payload.new as Row);
        setMsgs((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev;
          if (m.author !== me && !atBottomRef.current) {
            setNewCount((c) => c + 1);
          }
          return [...prev, m];
        });
        if (m.author !== me) {
          setOtherTyping(false);
          if (otherTypingTimer) clearTimeout(otherTypingTimer);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const m = rowToMsg(payload.new as Row);
        setMsgs((prev) => prev.map((x) => (x.id === m.id ? m : x)));
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOtherOnline(Boolean(state[other]?.length));
      })
      .on("broadcast", { event: "typing" }, (payload) => {
        if ((payload.payload as { from?: string })?.from === other) {
          setOtherTyping(true);
          if (otherTypingTimer) clearTimeout(otherTypingTimer);
          otherTypingTimer = setTimeout(clearOtherTyping, 3500);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ at: Date.now() });
          refetch();
        }
      });

    channelRef.current = channel;

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") refetch();
    }, 4000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refetch();
        channel.track({ at: Date.now() });
      } else {
        channel.untrack();
      }
    };
    const onFocus = () => refetch();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);

    return () => {
      cancelled = true;
      clearInterval(poll);
      if (otherTypingTimer) clearTimeout(otherTypingTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [me]);

  // Track scroll position to decide auto-scroll vs "new messages" badge
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 40) setShowAll((v) => v || true);
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottomRef.current = near;
    setAtBottom(near);
    if (near) setNewCount(0);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    setNewCount(0);
  }, []);

  const lastCount = useRef(0);
  useEffect(() => {
    if (msgs.length !== lastCount.current) {
      const prev = lastCount.current;
      lastCount.current = msgs.length;
      if (!me) return;
      // Only autoscroll if user is near bottom, or if the newest is mine
      const newest = msgs[msgs.length - 1];
      if (prev === 0 || atBottomRef.current || newest?.author === me) {
        endRef.current?.scrollIntoView({ behavior: "auto" });
      }
    }
  }, [msgs, me]);

  const pickMe = useCallback((who: "gu" | "li") => {
    sessionStorage.setItem("chat-me", who);
    const raw = localStorage.getItem(CLEAR_KEY(who));
    setClearCutoff(raw ? Number(raw) || 0 : 0);
    setMe(who);
  }, []);

  const emitTyping = useCallback(() => {
    if (!me || !channelRef.current) return;
    channelRef.current.send({ type: "broadcast", event: "typing", payload: { from: me } });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {}, 2000);
  }, [me]);

  const clearLocalHistory = useCallback(() => {
    if (!me) return;
    const ts = Date.now();
    localStorage.setItem(CLEAR_KEY(me), String(ts));
    setClearCutoff(ts);
    setReplyTo(null);
  }, [me]);

  const sendMessage = useCallback(
    async (opts: { text?: string; file?: File; stickerUrl?: string }) => {
      if (!me) return;
      const text = (opts.text ?? "").trim();
      // Slash commands (local, not sent)
      if (text && !opts.file && !opts.stickerUrl) {
        const cmd = text.toLowerCase();
        if (cmd === "/fotos" || cmd === "/galeria") { setShowGallery(true); return; }
        if (cmd === "/limpar" || cmd === "/clear") { clearLocalHistory(); return; }
      }
      if (!text && !opts.file && !opts.stickerUrl) return;
      const replyId = replyTo?.id ?? null;
      setReplyTo(null);

      let mediaUrl: string | null = opts.stickerUrl ?? null;
      let mediaType: string | null = opts.stickerUrl ? "sticker" : null;

      const tempId = "tmp_" + Date.now() + Math.random().toString(36).slice(2, 6);
      const localPreview = opts.file ? URL.createObjectURL(opts.file) : null;
      const optimistic: Msg = {
        id: tempId,
        author: me,
        text,
        ts: Date.now(),
        reactions: [],
        replyTo: replyId,
        mediaUrl: localPreview ?? mediaUrl,
        mediaType: opts.file ? (opts.file.type.startsWith("video") ? "video" : "image") : mediaType,
      };
      setMsgs((p) => [...p, optimistic]);

      if (opts.file) {
        const ext = opts.file.name.split(".").pop() || "bin";
        const path = `${me}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("chat-media")
          .upload(path, opts.file, { contentType: opts.file.type });
        if (upErr) {
          setMsgs((p) => p.filter((x) => x.id !== tempId));
          return;
        }
        const { data: signed } = await supabase.storage
          .from("chat-media")
          .createSignedUrl(path, SIGNED_URL_TTL);
        mediaUrl = signed?.signedUrl ?? null;
        mediaType = opts.file.type.startsWith("video") ? "video" : "image";
      }

      const { data, error } = await supabase
        .from("messages")
        .insert({
          author: me,
          text,
          reply_to: replyId,
          media_url: mediaUrl,
          media_type: mediaType,
        })
        .select()
        .single();

      if (localPreview) URL.revokeObjectURL(localPreview);
      if (error) {
        setMsgs((p) => p.filter((x) => x.id !== tempId));
        return;
      }
      const real = rowToMsg(data as Row);
      setMsgs((p) => {
        if (p.some((x) => x.id === real.id)) return p.filter((x) => x.id !== tempId);
        return p.map((x) => (x.id === tempId ? real : x));
      });
    },
    [me, replyTo, clearLocalHistory]
  );

  const react = useCallback(
    async (id: string, emoji: string) => {
      setReactingId(null);
      if (id.startsWith("tmp_")) return;
      const current = msgs.find((m) => m.id === id);
      const next = [...(current?.reactions ?? []), emoji];
      setMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, reactions: next } : m)));
      await supabase.from("messages").update({ reactions: next }).eq("id", id);
    },
    [msgs]
  );

  const filteredMsgs = useMemo(
    () => (clearCutoff ? msgs.filter((m) => m.ts > clearCutoff) : msgs),
    [msgs, clearCutoff]
  );
  const visible = useMemo(
    () => (showAll ? filteredMsgs : filteredMsgs.slice(-MAX_VISIBLE)),
    [filteredMsgs, showAll]
  );
  const mediaMsgs = useMemo(
    () => filteredMsgs.filter((m) => m.mediaUrl && (m.mediaType === "image" || m.mediaType === "video")),
    [filteredMsgs]
  );
  const msgById = useMemo(() => {
    const m = new Map<string, Msg>();
    for (const x of msgs) m.set(x.id, x);
    return m;
  }, [msgs]);

  if (!me) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center px-6">
        <h1 className="text-2xl font-bold">Quem é você? 💕</h1>
        <p className="text-white/50 text-sm mt-2 mb-8">escolhe seu perfil</p>
        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
          {(["li", "gu"] as const).map((k) => (
            <button
              key={k}
              onClick={() => pickMe(k)}
              className={`bg-gradient-to-br ${AVATARS[k].color} rounded-3xl aspect-square flex flex-col items-center justify-center gap-3 font-bold text-lg shadow-xl active:scale-95 transition`}
            >
              <span className="w-16 h-16 rounded-full bg-white/25 flex items-center justify-center text-3xl font-black backdrop-blur">
                {AVATARS[k].initial}
              </span>
              {AVATARS[k].name}
            </button>
          ))}
        </div>
        <button onClick={() => nav({ to: "/" })} className="mt-10 text-xs text-white/40">voltar</button>
      </div>
    );
  }

  const other = me === "gu" ? "li" : "gu";
  const otherInfo = AVATARS[other];

  return (
    <div className="fixed inset-0 bg-neutral-950 text-white flex flex-col">
      <header className="flex items-center gap-3 px-3 py-3 border-b border-white/10 bg-neutral-950">
        <button onClick={() => nav({ to: "/" })} className="p-1"><ArrowLeft size={22} /></button>
        <button
          onClick={() => setShowGames(true)}
          className="p-1.5 rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-600"
          aria-label="Jogos"
        >
          <Gamepad2 size={16} />
        </button>
        <button
          onClick={() => setShowGallery(true)}
          className="p-1.5 rounded-full bg-gradient-to-br from-amber-500 to-pink-600"
          aria-label="Galeria"
        >
          <Images size={16} />
        </button>
        <div className={`relative w-10 h-10 rounded-full bg-gradient-to-br ${otherInfo.color} flex items-center justify-center font-black`}>
          {otherInfo.initial}
          {otherOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-neutral-950" />
          )}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">{otherInfo.name}</p>
          <p className={`text-[11px] ${otherTyping ? "text-pink-400" : otherOnline ? "text-emerald-400" : "text-white/40"}`}>
            {otherTyping ? "digitando..." : otherOnline ? "online" : "offline"}
          </p>
        </div>
        <button
          onClick={() => { sessionStorage.removeItem("chat-me"); setMe(null); }}
          className="text-[11px] text-white/40"
        >
          trocar
        </button>
      </header>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-2"
        style={{ contain: "strict" as never, willChange: "transform" }}
      >
        {!showAll && filteredMsgs.length > MAX_VISIBLE && (
          <div className="text-center">
            <button onClick={() => setShowAll(true)} className="text-[11px] text-white/40 py-2">
              puxe pra cima ou toque pra ver mais ({filteredMsgs.length - MAX_VISIBLE})
            </button>
          </div>
        )}
        {showAll && (
          <div className="text-center text-[11px] text-white/30">início da conversa</div>
        )}
        {clearCutoff > 0 && (
          <div className="text-center text-[10px] text-white/30 py-1">
            histórico local limpo · digite /limpar pra limpar de novo · /fotos pra galeria
          </div>
        )}
        {visible.map((m) => (
          <MessageRow
            key={m.id}
            m={m}
            mine={m.author === me}
            reply={m.replyTo ? msgById.get(m.replyTo) : undefined}
            onReact={() => setReactingId(m.id)}
            onReply={() => setReplyTo(m)}
            onQuickHeart={() => react(m.id, "❤️")}
          />
        ))}
        {otherTyping && (
          <div className="flex justify-start">
            <div className="bg-white/10 rounded-2xl rounded-bl-sm px-3 py-2.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        {filteredMsgs.length === 0 && (
          <div className="text-center text-white/40 text-sm py-16">
            {clearCutoff > 0 ? "seu histórico local está vazio ✨" : "comece a conversa 💌"}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {!atBottom && newCount > 0 && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute left-1/2 -translate-x-1/2 bottom-24 z-30 bg-gradient-to-r from-pink-500 to-rose-600 rounded-full px-4 py-2 text-xs font-semibold shadow-xl flex items-center gap-2 animate-fade-in"
        >
          <ArrowDown size={14} />
          {newCount === 1 ? "1 nova mensagem" : `${newCount} novas mensagens`}
        </button>
      )}

      {reactingId && (
        <div
          className="absolute inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center"
          onClick={() => setReactingId(null)}
        >
          <div
            className="bg-neutral-900 border border-white/10 rounded-full px-3 py-2 flex gap-1 mb-24 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {REACTIONS.map((r) => (
              <button
                key={r}
                onClick={() => react(reactingId, r)}
                className="text-2xl p-1 active:scale-125 transition"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {showStickers && (
        <div
          className="absolute inset-0 z-40 bg-black/50 flex items-end"
          onClick={() => setShowStickers(false)}
        >
          <div
            className="w-full bg-neutral-900 border-t border-white/10 rounded-t-3xl p-4 pb-6 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Figurinhas</p>
              <button onClick={() => setShowStickers(false)}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-3 gap-3 max-h-72 overflow-y-auto">
              {STICKERS.map((url) => (
                <button
                  key={url}
                  onClick={() => {
                    setShowStickers(false);
                    sendMessage({ stickerUrl: url });
                  }}
                  className="aspect-square rounded-2xl overflow-hidden bg-white/5 active:scale-95 transition"
                >
                  <img src={url} alt="figurinha" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {replyTo && (
        <div className="px-3 py-2 border-t border-white/10 bg-neutral-900 flex items-center gap-2">
          <div className="w-1 h-8 bg-pink-500 rounded" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-pink-400 font-semibold">respondendo {AVATARS[replyTo.author].name}</p>
            <p className="text-xs text-white/60 truncate">{replyTo.text || (replyTo.mediaType ? "mídia" : "")}</p>
          </div>
          <button onClick={() => setReplyTo(null)}><X size={16} /></button>
        </div>
      )}

      <Composer
        onSend={sendMessage}
        onTyping={emitTyping}
        onOpenStickers={() => setShowStickers(true)}
      />

      <GamesPanel me={me} open={showGames} onClose={() => setShowGames(false)} />
      {showGallery && <GalleryModal items={mediaMsgs} onClose={() => setShowGallery(false)} />}
    </div>
  );
}

function GalleryModal({ cutoff, onClose }: { cutoff: number; onClose: () => void }) {
  const [viewing, setViewing] = useState<Msg | null>(null);
  const [items, setItems] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .not("media_url", "is", null)
        .in("media_type", ["image", "video"])
        .order("created_at", { ascending: true });
      if (cancelled) return;
      const all = ((data ?? []) as Row[]).map(rowToMsg).filter((m) => m.ts > cutoff);
      setItems(all);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [cutoff]);

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950 text-white flex flex-col animate-fade-in">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <button onClick={onClose} className="p-1"><ArrowLeft size={22} /></button>
        <div className="flex-1">
          <p className="font-bold">Galeria</p>
          <p className="text-[11px] text-white/50">{items.length} {items.length === 1 ? "item" : "itens"} · fotos e vídeos</p>
        </div>
        <button onClick={onClose} className="p-1"><X size={22} /></button>
      </header>
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="h-full flex items-center justify-center text-white/40">
            <Loader2 className="animate-spin" />
          </div>
        ) : items.length === 0 ? (

          <div className="h-full flex flex-col items-center justify-center text-white/40 text-sm p-8 text-center">
            <Images size={48} className="mb-3 opacity-40" />
            nenhuma foto ou vídeo por aqui ainda 💫
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {[...items].reverse().map((m) => (
              <button
                key={m.id}
                onClick={() => setViewing(m)}
                className="relative aspect-square rounded-lg overflow-hidden bg-white/5 active:scale-95 transition"
              >
                {m.mediaType === "video" ? (
                  <>
                    <video src={m.mediaUrl!} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Play size={22} className="drop-shadow-lg" fill="white" />
                    </div>
                  </>
                ) : (
                  <img src={m.mediaUrl!} alt="" loading="lazy" className="w-full h-full object-cover" />
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 text-[9px] text-white/80">
                  {AVATARS[m.author].name} · {new Date(m.ts).toLocaleDateString([], { day: "2-digit", month: "2-digit" })}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {viewing && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <button onClick={() => setViewing(null)} className="absolute top-4 right-4 p-2"><X size={24} /></button>
          {viewing.mediaType === "video" ? (
            <video src={viewing.mediaUrl!} controls autoPlay playsInline className="max-w-full max-h-full rounded-xl" onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={viewing.mediaUrl!} alt="" className="max-w-full max-h-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
    </div>
  );
}

const Composer = memo(function Composer({
  onSend,
  onTyping,
  onOpenStickers,
}: {
  onSend: (opts: { text?: string; file?: File }) => Promise<void>;
  onTyping: () => void;
  onOpenStickers: () => void;
}) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastTypingRef = useRef(0);

  const submit = () => {
    if (!text.trim()) return;
    onSend({ text });
    setText("");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try { await onSend({ file }); } finally { setUploading(false); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const now = Date.now();
    if (now - lastTypingRef.current > 1500) {
      lastTypingRef.current = now;
      onTyping();
    }
  };

  return (
    <div className="p-3 border-t border-white/10 flex items-end gap-2 bg-neutral-950">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={handleFile}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-10 h-10 shrink-0 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-40"
      >
        {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
      </button>
      <button
        onClick={onOpenStickers}
        className="w-10 h-10 shrink-0 rounded-full bg-white/10 flex items-center justify-center"
      >
        <Sticker size={16} />
      </button>
      <textarea
        value={text}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
        }}
        rows={1}
        placeholder="mensagem... (/fotos /limpar)"
        className="flex-1 bg-white/10 rounded-2xl px-4 py-2.5 text-sm outline-none resize-none max-h-32"
      />
      <button
        onClick={submit}
        disabled={!text.trim()}
        className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center disabled:opacity-40"
      >
        <Send size={16} />
      </button>
    </div>
  );
});

type RowProps = {
  m: Msg;
  mine: boolean;
  reply: Msg | undefined;
  onReact: () => void;
  onReply: () => void;
  onQuickHeart: () => void;
  onJump: (id: string) => void;
};

const MessageRow = memo(function MessageRow({ m, mine, reply, onReact, onReply, onQuickHeart, onJump }: RowProps) {
  const uniqReactions = useMemo(() => [...new Set(m.reactions)], [m.reactions]);
  const isSticker = m.mediaType === "sticker";
  const [dx, setDx] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const active = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    active.current = true;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!active.current) return;
    const d = e.touches[0].clientX - startX.current;
    const dy = Math.abs(e.touches[0].clientY - startY.current);
    if (dy > 20) { active.current = false; setDx(0); return; }
    if (d > 4) setDx(Math.min(d * 0.6, 64));
  };
  const onTouchEnd = () => {
    if (active.current && dx > 40) onReply();
    active.current = false;
    setDx(0);
  };

  const quote = reply ? (
    <button
      onClick={() => onJump(reply.id)}
      className="block w-full text-left mb-1 border-l-2 border-white/60 pl-2 text-[11px] opacity-80"
    >
      <span className="font-semibold block">{AVATARS[reply.author].name}</span>
      <span className="line-clamp-1">{reply.text || (reply.mediaType ? "mídia" : "")}</span>
    </button>
  ) : null;

  const swipe = {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    style: { transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? "none" : "transform 150ms" },
  };

  if (isSticker && m.mediaUrl) {
    return (
      <div id={`msg-${m.id}`} className={`flex ${mine ? "justify-end" : "justify-start"} rounded-2xl`}>
        <div className="max-w-[60%]" {...swipe}>
          <div className="relative" onDoubleClick={onReact}>
            {quote}
            <img src={m.mediaUrl} alt="figurinha" className="w-24 h-24 object-contain rounded-2xl" loading="lazy" />
            {m.reactions.length > 0 && (
              <div className="absolute -bottom-2 right-2 bg-neutral-800 rounded-full px-1.5 py-0.5 text-xs shadow border border-white/10 flex items-center">
                {uniqReactions.map((r) => (<span key={r}>{r}</span>))}
                {m.reactions.length > 1 && (
                  <span className="ml-1 text-[10px] opacity-70">{m.reactions.length}</span>
                )}
              </div>
            )}
          </div>
          <div className={`flex gap-3 mt-1.5 px-1 ${mine ? "justify-end" : "justify-start"}`}>
            <span className="text-[10px] opacity-50">
              {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            <button onClick={onReact} className="text-white/40"><Smile size={14} /></button>
            <button onClick={onReply} className="text-white/40"><Reply size={14} /></button>
            <button onClick={onQuickHeart} className="text-white/40"><Heart size={14} /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id={`msg-${m.id}`} className={`flex ${mine ? "justify-end" : "justify-start"} rounded-2xl`}>
      <div className="max-w-[78%]" {...swipe}>
        <div
          onDoubleClick={onReact}
          className={`relative rounded-2xl px-3 py-2 ${
            mine
              ? "bg-gradient-to-br from-pink-500 to-rose-600 rounded-br-sm"
              : "bg-white/10 rounded-bl-sm"
          }`}
        >
          {quote}
          {m.mediaUrl && m.mediaType === "image" && (
            <img
              src={m.mediaUrl}
              alt=""
              className="rounded-xl max-h-72 mb-1 object-cover"
              loading="lazy"
            />
          )}
          {m.mediaUrl && m.mediaType === "video" && (
            <video src={m.mediaUrl} controls playsInline className="rounded-xl max-h-72 mb-1" />
          )}
          {m.text && (
            <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
          )}
          <span className="block text-[10px] opacity-60 mt-1">
            {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {m.reactions.length > 0 && (
            <div className="absolute -bottom-2 right-2 bg-neutral-800 rounded-full px-1.5 py-0.5 text-xs shadow border border-white/10 flex items-center">
              {uniqReactions.map((r) => (<span key={r}>{r}</span>))}
              {m.reactions.length > 1 && (
                <span className="ml-1 text-[10px] opacity-70">{m.reactions.length}</span>
              )}
            </div>
          )}
        </div>
        <div className={`flex gap-3 mt-1.5 px-1 ${mine ? "justify-end" : "justify-start"}`}>
          <button onClick={onReact} className="text-white/40"><Smile size={14} /></button>
          <button onClick={onReply} className="text-white/40"><Reply size={14} /></button>
          <button onClick={onQuickHeart} className="text-white/40"><Heart size={14} /></button>
        </div>
      </div>
    </div>
  );
});

