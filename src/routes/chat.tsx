import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Heart, Smile, X, Reply } from "lucide-react";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Chat" }, { name: "robots", content: "noindex" }] }),
  component: ChatPage,
});

type Reaction = string; // emoji
type Msg = {
  id: string;
  author: "gu" | "li";
  text: string;
  ts: number;
  reactions: Reaction[];
  replyTo?: string;
};

const STORAGE_KEY = "licegu-chat-v1";
const MAX_VISIBLE = 30;
const REACTIONS = ["❤️", "😂", "😍", "😢", "🔥", "👍"];

const AVATARS = {
  gu: { name: "bb gu", color: "from-sky-400 to-indigo-600", emoji: "🐻" },
  li: { name: "bb li", color: "from-pink-400 to-rose-600", emoji: "🐰" },
};

function loadMsgs(): Msg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveMsgs(msgs: Msg[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
}

function ChatPage() {
  const nav = useNavigate();
  const [me, setMe] = useState<"gu" | "li" | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
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
    setMsgs(loadMsgs());
  }, [nav]);

  useEffect(() => {
    if (me) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length, me]);

  const pickMe = (who: "gu" | "li") => {
    sessionStorage.setItem("chat-me", who);
    setMe(who);
  };

  const send = () => {
    if (!text.trim() || !me) return;
    const m: Msg = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      author: me,
      text: text.trim(),
      ts: Date.now(),
      reactions: [],
      replyTo: replyTo?.id,
    };
    const next = [...msgs, m];
    setMsgs(next);
    saveMsgs(next);
    setText("");
    setReplyTo(null);
  };

  const react = (id: string, emoji: string) => {
    const next = msgs.map((m) =>
      m.id === id ? { ...m, reactions: [...m.reactions, emoji] } : m
    );
    setMsgs(next);
    saveMsgs(next);
    setReactingId(null);
  };

  const onScroll = () => {
    if (!scrollRef.current) return;
    if (scrollRef.current.scrollTop < 40 && msgs.length > MAX_VISIBLE) {
      setShowAll(true);
    }
  };

  const visible = showAll ? msgs : msgs.slice(-MAX_VISIBLE);

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
              className={`bg-gradient-to-br ${AVATARS[k].color} rounded-3xl aspect-square flex flex-col items-center justify-center gap-2 font-bold text-lg shadow-xl active:scale-95 transition`}
            >
              <span className="text-5xl">{AVATARS[k].emoji}</span>
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
      {/* Header */}
      <header className="flex items-center gap-3 px-3 py-3 border-b border-white/10 bg-neutral-950">
        <button onClick={() => nav({ to: "/" })} className="p-1"><ArrowLeft size={22} /></button>
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${otherInfo.color} flex items-center justify-center text-xl`}>
          {otherInfo.emoji}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">{otherInfo.name}</p>
          <p className="text-[11px] text-emerald-400">online</p>
        </div>
        <button
          onClick={() => { sessionStorage.removeItem("chat-me"); setMe(null); }}
          className="text-[11px] text-white/40"
        >
          trocar
        </button>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-3 py-4 space-y-2"
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
        {visible.map((m) => {
          const mine = m.author === me;
          const rep = m.replyTo ? msgs.find((x) => x.id === m.replyTo) : null;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[78%] group">
                <div
                  onDoubleClick={() => setReactingId(m.id)}
                  className={`relative rounded-2xl px-3 py-2 ${
                    mine
                      ? "bg-gradient-to-br from-pink-500 to-rose-600 rounded-br-sm"
                      : "bg-white/10 rounded-bl-sm"
                  }`}
                >
                  {rep && (
                    <div className="mb-1 border-l-2 border-white/60 pl-2 text-[11px] opacity-80">
                      <p className="font-semibold">{AVATARS[rep.author].name}</p>
                      <p className="line-clamp-1">{rep.text}</p>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] opacity-60">
                      {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {m.reactions.length > 0 && (
                    <div className="absolute -bottom-2 right-2 bg-neutral-800 rounded-full px-1.5 py-0.5 text-xs shadow border border-white/10">
                      {[...new Set(m.reactions)].map((r) => (
                        <span key={r}>{r}</span>
                      ))}
                      {m.reactions.length > 1 && (
                        <span className="ml-1 text-[10px] opacity-70">{m.reactions.length}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className={`flex gap-3 mt-1.5 px-1 ${mine ? "justify-end" : "justify-start"}`}>
                  <button onClick={() => setReactingId(m.id)} className="text-white/40 hover:text-white/80">
                    <Smile size={14} />
                  </button>
                  <button onClick={() => setReplyTo(m)} className="text-white/40 hover:text-white/80">
                    <Reply size={14} />
                  </button>
                  <button onClick={() => react(m.id, "❤️")} className="text-white/40 hover:text-rose-400">
                    <Heart size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {msgs.length === 0 && (
          <div className="text-center text-white/40 text-sm py-16">
            comece a conversa 💌
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Reaction picker */}
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

      {/* Reply bar */}
      {replyTo && (
        <div className="px-3 py-2 border-t border-white/10 bg-neutral-900 flex items-center gap-2">
          <div className="w-1 h-8 bg-pink-500 rounded" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-pink-400 font-semibold">respondendo {AVATARS[replyTo.author].name}</p>
            <p className="text-xs text-white/60 truncate">{replyTo.text}</p>
          </div>
          <button onClick={() => setReplyTo(null)}><X size={16} /></button>
        </div>
      )}

      {/* Composer */}
      <div className="p-3 border-t border-white/10 flex items-end gap-2 bg-neutral-950">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          rows={1}
          placeholder="mensagem..."
          className="flex-1 bg-white/10 rounded-2xl px-4 py-2.5 text-sm outline-none resize-none max-h-32"
        />
        <button
          onClick={send}
          disabled={!text.trim()}
          className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
