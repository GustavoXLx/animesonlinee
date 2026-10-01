import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Me } from "./useGameChannel";

type Line = { id: string; from: Me; text: string };

/** Chat de texto rápido dentro dos jogos (efêmero, via broadcast — não vai pro banco). */
export function GameChat({ gameKey, me }: { gameKey: string; me: Me }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const openRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    openRef.current = open;
    if (open) setUnread(0);
  }, [open]);

  useEffect(() => {
    const ch = supabase.channel(`gamechat-${gameKey}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "line" }, (p) => {
      const d = p.payload as Line;
      if (!d?.text) return;
      setLines((prev) => [...prev.slice(-40), d]);
      if (!openRef.current) setUnread((u) => u + 1);
    }).subscribe();
    chanRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      chanRef.current = null;
    };
  }, [gameKey]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [lines, open]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    const line: Line = { id: Math.random().toString(36).slice(2), from: me, text: t.slice(0, 200) };
    setLines((prev) => [...prev.slice(-40), line]);
    chanRef.current?.send({ type: "broadcast", event: "line", payload: line });
    setText("");
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Chat do jogo"
        className="fixed bottom-4 right-4 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-600 shadow-xl"
      >
        <MessageCircle size={20} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-black">
            {unread}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="relative z-[60] flex h-56 w-full shrink-0 flex-col overflow-hidden rounded-t-3xl border-t border-white/15 bg-neutral-900 shadow-2xl">
      <header className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <MessageCircle size={14} className="text-pink-400" />
        <p className="flex-1 text-xs font-semibold">chat do jogo</p>
        <button onClick={() => setOpen(false)} aria-label="Fechar chat">
          <X size={16} />
        </button>
      </header>
      <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
        {lines.length === 0 && (
          <p className="pt-8 text-center text-[11px] text-white/35">
            converse aqui enquanto joga 💬
          </p>
        )}
        {lines.map((l) => (
          <div key={l.id} className={`flex ${l.from === me ? "justify-end" : "justify-start"}`}>
            <span
              className={`max-w-[80%] rounded-2xl px-2.5 py-1.5 text-xs ${
                l.from === me ? "bg-gradient-to-br from-pink-500 to-rose-600" : "bg-white/10"
              }`}
            >
              {l.text}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex items-center gap-1.5 border-t border-white/10 p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="mensagem..."
          className="flex-1 rounded-full bg-white/10 px-3 py-2 text-xs outline-none placeholder:text-white/30"
        />
        <button
          onClick={send}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-600"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}
