import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { ArrowLeft, Send, Heart, Smile, X, Reply, Paperclip, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
const REACTIONS = ["❤️", "😂", "😍", "😢", "🔥", "👍"];
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 year

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("chat-unlocked") !== "1") {
      nav({ to: "/unlock" });
      return;
    }
    const saved = sessionStorage.getItem("chat-me") as "gu" | "li" | null;
    if (saved) setMe(saved);
  }, [nav]);

  // Data + realtime + presence
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });
      if (!cancelled && data) setMsgs((data as Row[]).map(rowToMsg));
    })();

    const other = me === "gu" ? "li" : "gu";

    const channel = supabase
      .channel("chat-room", { config: { presence: { key: me } } })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = rowToMsg(payload.new as Row);
        setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const m = rowToMsg(payload.new as Row);
        setMsgs((prev) => prev.map((x) => (x.id === m.id ? m : x)));
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOtherOnline(Boolean(state[other]?.length));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ at: Date.now() });
        }
      });

    const onVisibility = () => {
      if (document.visibilityState === "visible") channel.track({ at: Date.now() });
      else channel.untrack();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [me]);

  const lastCount = useRef(0);
  useEffect(() => {
    if (msgs.length !== lastCount.current) {
      lastCount.current = msgs.length;
      if (me) endRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [msgs.length, me]);

  const pickMe = useCallback((who: "gu" | "li") => {
    sessionStorage.setItem("chat-me", who);
    setMe(who);
  }, []);

  const sendMessage = useCallback(
    async (opts: { text?: string; file?: File }) => {
      if (!me) return;
      const text = (opts.text ?? "").trim();
      if (!text && !opts.file) return;
      const replyId = replyTo?.id ?? null;
      setReplyTo(null);

      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      const tempId = "tmp_" + Date.now() + Math.random().toString(36).slice(2, 6);
      const localPreview = opts.file ? URL.createObjectURL(opts.file) : null;
      const optimistic: Msg = {
        id: tempId,
        author: me,
        text,
        ts: Date.now(),
        reactions: [],
        replyTo: replyId,
        mediaUrl: localPreview,
        mediaType: opts.file?.type.startsWith("video") ? "video" : opts.file ? "image" : null,
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
    [me, replyTo]
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

  const onScroll = useCallback(() => {
    if (!scrollRef.current) return;
    if (scrollRef.current.scrollTop < 40) setShowAll((v) => v || true);
  }, []);

  const visible = useMemo(
    () => (showAll ? msgs : msgs.slice(-MAX_VISIBLE)),
    [msgs, showAll]
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
        <div className={`relative w-10 h-10 rounded-full bg-gradient-to-br ${otherInfo.color} flex items-center justify-center font-black`}>
          {otherInfo.initial}
          {otherOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-neutral-950" />
          )}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">{otherInfo.name}</p>
          <p className={`text-[11px] ${otherOnline ? "text-emerald-400" : "text-white/40"}`}>
            {otherOnline ? "online" : "offline"}
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
        {!showAll && msgs.length > MAX_VISIBLE && (
          <div className="text-center">
            <button onClick={() => setShowAll(true)} className="text-[11px] text-white/40 py-2">
              puxe pra cima ou toque pra ver mais ({msgs.length - MAX_VISIBLE})
            </button>
          </div>
        )}
        {showAll && (
          <div className="text-center text-[11px] text-white/30">início da conversa</div>
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
        {msgs.length === 0 && (
          <div className="text-center text-white/40 text-sm py-16">
            comece a conversa 💌
          </div>
        )}
        <div ref={endRef} />
      </div>

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

      <Composer onSend={sendMessage} />
    </div>
  );
}

const Composer = memo(function Composer({
  onSend,
}: {
  onSend: (opts: { text?: string; file?: File }) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
        }}
        rows={1}
        placeholder="mensagem..."
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
};

const MessageRow = memo(function MessageRow({ m, mine, reply, onReact, onReply, onQuickHeart }: RowProps) {
  const uniqReactions = useMemo(() => [...new Set(m.reactions)], [m.reactions]);
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[78%]">
        <div
          onDoubleClick={onReact}
          className={`relative rounded-2xl px-3 py-2 ${
            mine
              ? "bg-gradient-to-br from-pink-500 to-rose-600 rounded-br-sm"
              : "bg-white/10 rounded-bl-sm"
          }`}
        >
          {reply && (
            <div className="mb-1 border-l-2 border-white/60 pl-2 text-[11px] opacity-80">
              <p className="font-semibold">{AVATARS[reply.author].name}</p>
              <p className="line-clamp-1">{reply.text || (reply.mediaType ? "mídia" : "")}</p>
            </div>
          )}
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
