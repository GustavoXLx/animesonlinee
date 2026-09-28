import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, Music2, Plus, Search, Send, Trash2, X } from "lucide-react";
import {
  deleteNote,
  listNotes,
  postNote,
  reactNote,
  searchMusic,
  type Music,
  type NoteRow,
} from "@/lib/chat.functions";

type Who = "gu" | "li";
const NAME = { gu: "bb gu", li: "bb li" } as const;

/** Busca direto do navegador (iTunes libera CORS); cai para o servidor se falhar. */
async function findMusic(q: string): Promise<Music[]> {
  try {
    const r = await fetch(
      `https://itunes.apple.com/search?media=music&entity=song&limit=25&country=BR&term=${encodeURIComponent(q)}`,
    );
    if (r.ok) {
      const j = (await r.json()) as { results?: Record<string, string>[] };
      const rows = (j.results ?? [])
        .filter((x) => x.previewUrl)
        .map((x) => ({
          title: x.trackName ?? "",
          artist: x.artistName ?? "",
          cover: (x.artworkUrl100 ?? "").replace("100x100", "300x300"),
          preview: x.previewUrl,
        }));
      if (rows.length) return rows;
    }
  } catch {
    /* tenta servidor */
  }
  return (await searchMusic({ data: { q } })).rows;
}

/** Busca de músicas (iTunes) com prévia. */
export function MusicPicker({
  title,
  onPick,
  onClose,
  skipLabel,
}: {
  title: string;
  onPick: (m: Music | null) => void;
  onClose: () => void;
  skipLabel?: string;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Music[]>([]);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const t = q.trim();
    if (!t) return setRows([]);
    const h = setTimeout(async () => {
      setLoading(true);
      try {
        setRows(await findMusic(t));
      } catch {
        setRows([]);
      }
      setLoading(false);
    }, 350);
    return () => clearTimeout(h);
  }, [q]);
  useEffect(() => () => audio.current?.pause(), []);

  const toggle = (m: Music) => {
    if (!audio.current) audio.current = new Audio();
    const a = audio.current;
    if (playing === m.preview) {
      a.pause();
      setPlaying(null);
      return;
    }
    a.src = m.preview;
    void a.play().catch(() => {});
    a.onended = () => setPlaying(null);
    setPlaying(m.preview);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md h-[80vh] bg-neutral-900 text-white rounded-t-3xl sm:rounded-3xl p-4 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-semibold">{title}</p>
          <button onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
          <Search size={15} className="text-white/50" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="buscar música ou artista..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/40"
          />
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {loading && <p className="text-xs text-white/50 text-center py-4">buscando...</p>}
          {!loading && q.trim() && !rows.length && <p className="text-xs text-white/50 text-center py-4">nada encontrado</p>}
          {rows.map((m) => (
            <div key={m.preview} className="flex items-center gap-3 rounded-xl p-2 active:bg-white/10">
              <button onClick={() => toggle(m)} className="relative shrink-0" aria-label="Ouvir prévia">
                <img src={m.cover} alt="" className="w-12 h-12 rounded-lg" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg text-xs">
                  {playing === m.preview ? "❚❚" : "▶"}
                </span>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{m.title}</p>
                <p className="text-xs text-white/50 truncate">{m.artist}</p>
              </div>
              <button
                onClick={() => {
                  audio.current?.pause();
                  onPick(m);
                }}
                className="rounded-full bg-pink-500 px-3 py-1.5 text-xs font-medium"
              >
                usar
              </button>
            </div>
          ))}
        </div>
        {skipLabel && (
          <button onClick={() => onPick(null)} className="rounded-full bg-white/10 py-2.5 text-sm">
            {skipLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function MusicChip({ m }: { m: Music }) {
  return (
    <span className="flex items-center gap-1 text-[10px] text-white/80 max-w-[140px]">
      <Music2 size={10} className="shrink-0 animate-pulse" />
      <span className="truncate">{m.title} · {m.artist}</span>
    </span>
  );
}

export function useNotes() {
  const [notes, setNotes] = useState<{ gu: NoteRow | null; li: NoteRow | null }>({ gu: null, li: null });
  const reload = useCallback(async () => {
    try {
      setNotes(await listNotes());
    } catch {
      /* noop */
    }
  }, []);
  useEffect(() => {
    void reload();
    const t = setInterval(() => document.visibilityState === "visible" && void reload(), 15000);
    return () => clearInterval(t);
  }, [reload]);
  return { notes, reload };
}

/** Balãozinho pequeno sobre a foto de perfil (estilo Instagram). */
export function NoteBubble({ note, onClick }: { note: NoteRow; onClick: () => void }) {
  return (
    <span
      role="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="absolute -top-2.5 left-6 z-10 max-w-[92px] rounded-xl rounded-bl-sm bg-neutral-800 border border-white/15 px-1.5 py-0.5 text-[9px] leading-tight font-normal text-white shadow-lg text-left"
    >
      {note.text ? <span className="block truncate">{note.text}</span> : null}
      {note.music && (
        <span className="flex items-center gap-0.5 text-white/70 truncate">
          <Music2 size={8} className="shrink-0" />
          <span className="truncate">{note.music.title}</span>
        </span>
      )}
    </span>
  );
}

export function NoteEditor({ me, current, onClose, onDone }: { me: Who; current: NoteRow | null; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState(current?.text ?? "");
  const [music, setMusic] = useState<Music | null>(current?.music ?? null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[75] bg-black/80 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-sm bg-neutral-900 text-white rounded-t-3xl sm:rounded-3xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <p className="font-semibold">Nova nota</p>
        <input
          autoFocus
          value={text}
          maxLength={60}
          onChange={(e) => setText(e.target.value)}
          placeholder="compartilhe um pensamento..."
          className="w-full rounded-xl bg-white/10 px-3 py-2.5 text-sm outline-none"
        />
        <p className="text-[10px] text-white/40 text-right">{text.length}/60</p>
        {music ? (
          <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2">
            <img src={music.cover} alt="" className="w-10 h-10 rounded-md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{music.title}</p>
              <p className="text-xs text-white/50 truncate">{music.artist}</p>
            </div>
            <button onClick={() => setMusic(null)} aria-label="Remover música"><X size={16} /></button>
          </div>
        ) : (
          <button onClick={() => setPicking(true)} className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-sm">
            <Music2 size={15} /> adicionar música
          </button>
        )}
        <div className="flex gap-2">
          {current && (
            <button
              onClick={async () => {
                await deleteNote({ data: { who: me } });
                onDone();
              }}
              className="rounded-full bg-white/10 px-4 py-2.5 text-sm"
            >
              apagar
            </button>
          )}
          <button
            disabled={busy || (!text.trim() && !music)}
            onClick={async () => {
              setBusy(true);
              try {
                await postNote({ data: { who: me, text: text.trim(), music } });
                onDone();
              } finally {
                setBusy(false);
              }
            }}
            className="flex-1 rounded-full bg-pink-500 py-2.5 text-sm font-medium disabled:opacity-40"
          >
            {busy ? "postando..." : "compartilhar (24h)"}
          </button>
        </div>
      </div>
      {picking && (
        <MusicPicker
          title="Música da nota"
          onClose={() => setPicking(false)}
          onPick={(m) => {
            setMusic(m);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

export function NoteView({ note, me, onClose, onEdit, onChanged }: { note: NoteRow; me: Who; onClose: () => void; onEdit: () => void; onChanged: () => void }) {
  const mine = note.author === me;
  const [reply, setReply] = useState("");
  const [liked, setLiked] = useState(note.liked_by.includes(me));
  const [sent, setSent] = useState(false);
  return (
    <div className="fixed inset-0 z-[75] bg-black/80 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-sm bg-neutral-900 text-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        {note.music && <audio src={note.music.preview} autoPlay loop />}
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/60">nota de {NAME[note.author]}</p>
          <button onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>
        {note.text && <p className="text-lg text-center break-words">{note.text}</p>}
        {note.music && (
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2">
            <img src={note.music.cover} alt="" className="w-12 h-12 rounded-md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">♪ {note.music.title}</p>
              <p className="text-xs text-white/50 truncate">{note.music.artist}</p>
            </div>
            <Music2 size={16} className="text-pink-400 animate-pulse" />
          </div>
        )}
        {mine ? (
          <div className="flex gap-2">
            <p className="flex-1 text-xs text-white/50 self-center">{note.liked_by.length ? "curtida ♥" : "ninguém curtiu ainda"}</p>
            <button onClick={onEdit} className="rounded-full bg-white/10 px-4 py-2 text-sm">editar</button>
            <button
              onClick={async () => {
                await deleteNote({ data: { who: me } });
                onChanged();
                onClose();
              }}
              aria-label="Apagar nota"
              className="rounded-full bg-white/10 p-2"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={sent ? "resposta enviada" : `responder ${NAME[note.author]}...`}
              className="flex-1 rounded-full border border-white/20 bg-transparent px-4 py-2.5 text-sm outline-none"
            />
            {reply.trim() ? (
              <button
                aria-label="Enviar resposta"
                onClick={async () => {
                  const r = reply;
                  setReply("");
                  await reactNote({ data: { id: note.id, me, reply: r } });
                  setSent(true);
                }}
                className="p-2"
              >
                <Send size={20} />
              </button>
            ) : (
              <button
                aria-label="Curtir nota"
                disabled={liked}
                onClick={async () => {
                  setLiked(true);
                  await reactNote({ data: { id: note.id, me } });
                  onChanged();
                }}
                className="p-2"
              >
                <Heart size={24} className={liked ? "text-pink-500" : ""} fill={liked ? "currentColor" : "none"} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
