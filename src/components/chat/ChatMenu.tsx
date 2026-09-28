import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  User,
  Image as ImageIcon,
  Gamepad2,
  Search,
  Music,
  ChevronLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Plus,
  Trash2,
  Loader2,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createUpload, listSongs, addSong, deleteSong } from "@/lib/chat.functions";

export const WALLPAPERS: { id: string; name: string; css: string }[] = [
  { id: "none", name: "Padrão", css: "none" },
  { id: "rosa", name: "Rosa noite", css: "linear-gradient(160deg,#2a0f24 0%,#120812 60%,#0a0a0a 100%)" },
  { id: "ceu", name: "Céu", css: "linear-gradient(180deg,#0f1c3d 0%,#1d1036 55%,#0a0a0a 100%)" },
  { id: "por", name: "Pôr do sol", css: "linear-gradient(170deg,#3b1320 0%,#40220f 50%,#0d0907 100%)" },
  { id: "mar", name: "Oceano", css: "linear-gradient(180deg,#062a33 0%,#07161f 60%,#050a0d 100%)" },
  { id: "mata", name: "Floresta", css: "linear-gradient(180deg,#0d2a1a 0%,#0a1a12 60%,#060a08 100%)" },
  {
    id: "coracoes",
    name: "Corações",
    css: "radial-gradient(circle at 20% 20%,rgba(236,72,153,.18) 0 6px,transparent 7px),radial-gradient(circle at 70% 60%,rgba(236,72,153,.12) 0 5px,transparent 6px),linear-gradient(#140a12,#140a12)",
  },
  {
    id: "estrelas",
    name: "Estrelas",
    css: "radial-gradient(1px 1px at 10% 20%,#fff9,transparent),radial-gradient(1px 1px at 60% 70%,#fff8,transparent),radial-gradient(1.5px 1.5px at 80% 30%,#fffa,transparent),radial-gradient(1px 1px at 35% 85%,#fff7,transparent),linear-gradient(180deg,#070b1a,#0a0a0a)",
  },
  {
    id: "listras",
    name: "Listras",
    css: "repeating-linear-gradient(135deg,#171717 0 14px,#1f1a20 14px 28px)",
  },
];

const WP_KEY = "chat-wallpaper";

export function useWallpaper() {
  const [wp, setWp] = useState<string>("none");
  useEffect(() => {
    setWp(localStorage.getItem(WP_KEY) || "none");
  }, []);
  const set = useCallback((v: string) => {
    try {
      localStorage.setItem(WP_KEY, v);
    } catch {
      /* muito grande */
    }
    setWp(v);
  }, []);
  const style: React.CSSProperties =
    wp === "none"
      ? {}
      : wp.startsWith("data:")
        ? { backgroundImage: `linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)),url(${wp})`, backgroundSize: "cover", backgroundPosition: "center" }
        : { background: WALLPAPERS.find((w) => w.id === wp)?.css, backgroundSize: wp === "coracoes" || wp === "estrelas" ? "120px 120px" : undefined };
  return { wp, setWp: set, style };
}

function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 1080;
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

type Song = { id: string; title: string; url: string | null; added_by: string };
type View = "root" | "profile" | "wallpaper" | "music";

export function ChatMenu({
  open,
  onClose,
  me,
  myAvatar,
  myName,
  myInitial,
  myColor,
  uploadingAvatar,
  onUploadAvatar,
  wp,
  setWp,
  onGames,
  onSearch,
}: {
  open: boolean;
  onClose: () => void;
  me: "gu" | "li";
  myAvatar: string | null;
  myName: string;
  myInitial: string;
  myColor: string;
  uploadingAvatar: boolean;
  onUploadAvatar: (f: File) => void;
  wp: string;
  setWp: (v: string) => void;
  onGames: () => void;
  onSearch: () => void;
}) {
  const [view, setView] = useState<View>("root");
  const [songs, setSongs] = useState<Song[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [uploadingSong, setUploadingSong] = useState(false);
  const [current, setCurrent] = useState<number>(-1);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!open) setView("root");
  }, [open]);

  const loadSongs = useCallback(async () => {
    setLoadingSongs(true);
    try {
      const res = await listSongs();
      setSongs(res.rows);
    } catch {
      /* noop */
    } finally {
      setLoadingSongs(false);
    }
  }, []);

  useEffect(() => {
    if (view === "music") void loadSongs();
  }, [view, loadSongs]);

  const playAt = (i: number) => {
    const s = songs[i];
    const a = audioRef.current;
    if (!s?.url || !a) return;
    if (current !== i) {
      a.src = s.url;
      setCurrent(i);
    }
    void a.play();
  };
  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (current < 0) return playAt(0);
    if (a.paused) void a.play();
    else a.pause();
  };
  const next = (d: number) => {
    if (!songs.length) return;
    playAt((current + d + songs.length) % songs.length);
  };

  const uploadSong = async (file: File) => {
    setUploadingSong(true);
    try {
      const ext = file.name.split(".").pop() || "mp3";
      const { path, token } = await createUpload({ data: { ext } });
      const { error } = await supabase.storage
        .from("chat-media")
        .uploadToSignedUrl(path, token, file, { contentType: file.type || "audio/mpeg" });
      if (error) throw error;
      await addSong({ data: { title: file.name.replace(/\.[^.]+$/, ""), path, who: me } });
      await loadSongs();
    } catch {
      /* noop */
    } finally {
      setUploadingSong(false);
    }
  };

  const Item = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-white/10 hover:bg-white/5 text-left">
      <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );

  const titles: Record<View, string> = { root: "Menu", profile: "Editar perfil", wallpaper: "Papel de parede", music: "Músicas" };
  const song = songs[current];

  return (
    <>
      <audio
        ref={audioRef}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => next(1)}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          setProgress(a.duration ? a.currentTime / a.duration : 0);
        }}
      />
      {open && <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[82%] max-w-xs bg-neutral-900 border-r border-white/10 flex flex-col transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center gap-2 px-3 py-3 border-b border-white/10">
          {view !== "root" && (
            <button onClick={() => setView("root")} className="p-1" aria-label="Voltar">
              <ChevronLeft size={20} />
            </button>
          )}
          <p className="flex-1 font-semibold text-sm px-1">{titles[view]}</p>
          <button onClick={onClose} className="p-1" aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {view === "root" && (
            <>
              <Item icon={<User size={16} />} label="Editar perfil" onClick={() => setView("profile")} />
              <Item icon={<ImageIcon size={16} />} label="Papel de parede" onClick={() => setView("wallpaper")} />
              <Item icon={<Gamepad2 size={16} />} label="Jogos" onClick={() => { onClose(); onGames(); }} />
              <Item icon={<Search size={16} />} label="Buscar mensagens" onClick={() => { onClose(); onSearch(); }} />
              <Item icon={<Music size={16} />} label="Músicas" onClick={() => setView("music")} />
            </>
          )}

          {view === "profile" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className={`w-28 h-28 rounded-full overflow-hidden bg-gradient-to-br ${myColor} flex items-center justify-center text-4xl font-black`}>
                {myAvatar ? <img src={myAvatar} alt="" className="w-full h-full object-cover" /> : myInitial}
              </div>
              <p className="font-semibold">{myName}</p>
              <label className="px-4 py-2 rounded-full bg-pink-600 text-sm font-medium cursor-pointer active:scale-95 transition">
                {uploadingAvatar ? "enviando..." : "Trocar foto de perfil"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) onUploadAvatar(f);
                  }}
                />
              </label>
            </div>
          )}

          {view === "wallpaper" && (
            <div className="p-2">
              <label className="flex items-center justify-center gap-2 w-full py-3 mb-3 rounded-xl bg-white/10 text-sm cursor-pointer active:bg-white/20">
                <Plus size={16} /> Escolher da galeria
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) setWp(await resizeToDataUrl(f));
                  }}
                />
              </label>
              <div className="grid grid-cols-3 gap-2">
                {wp.startsWith("data:") && (
                  <button className="relative aspect-[9/16] rounded-lg overflow-hidden ring-2 ring-pink-500">
                    <img src={wp} alt="" className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 inset-x-0 text-[10px]">Sua foto</span>
                  </button>
                )}
                {WALLPAPERS.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setWp(w.id)}
                    className={`relative aspect-[9/16] rounded-lg overflow-hidden border border-white/10 ${wp === w.id ? "ring-2 ring-pink-500" : ""}`}
                    style={{ background: w.css === "none" ? "#0a0a0a" : w.css, backgroundSize: w.id === "coracoes" || w.id === "estrelas" ? "60px 60px" : undefined }}
                  >
                    {wp === w.id && <Check size={14} className="absolute top-1 right-1" />}
                    <span className="absolute bottom-1 inset-x-0 text-[10px] text-white/80">{w.name}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-white/40 mt-3 text-center">vale só neste aparelho</p>
            </div>
          )}

          {view === "music" && (
            <div className="p-2 space-y-3">
              <div className="rounded-2xl bg-gradient-to-br from-pink-600/30 to-fuchsia-900/30 p-4">
                <p className="text-sm font-semibold truncate">{song ? song.title : "Nenhuma tocando"}</p>
                <div className="h-1 rounded bg-white/15 mt-3 overflow-hidden">
                  <div className="h-full bg-pink-400" style={{ width: `${progress * 100}%` }} />
                </div>
                <div className="flex items-center justify-center gap-6 mt-3">
                  <button onClick={() => next(-1)} aria-label="Anterior"><SkipBack size={20} /></button>
                  <button onClick={toggle} aria-label={playing ? "Pausar" : "Tocar"} className="w-11 h-11 rounded-full bg-white text-neutral-900 flex items-center justify-center">
                    {playing ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                  <button onClick={() => next(1)} aria-label="Próxima"><SkipForward size={20} /></button>
                </div>
              </div>

              <label className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white/10 text-sm cursor-pointer active:bg-white/20">
                {uploadingSong ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {uploadingSong ? "enviando..." : "Adicionar música"}
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  disabled={uploadingSong}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void uploadSong(f);
                  }}
                />
              </label>

              {loadingSongs && !songs.length && <p className="text-center text-xs text-white/40">carregando...</p>}
              {!loadingSongs && !songs.length && <p className="text-center text-xs text-white/40">playlist vazia</p>}
              <div className="space-y-1">
                {songs.map((s, i) => (
                  <div key={s.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${i === current ? "bg-pink-500/20" : "bg-white/5"}`}>
                    <button onClick={() => (i === current ? toggle() : playAt(i))} className="flex-1 flex items-center gap-2 text-left min-w-0">
                      {i === current && playing ? <Pause size={14} /> : <Play size={14} />}
                      <span className="text-sm truncate">{s.title}</span>
                    </button>
                    <span className="text-[10px] text-white/40">{s.added_by === "gu" ? "gu" : "li"}</span>
                    <button
                      aria-label="Remover música"
                      onClick={async () => {
                        if (!confirm(`Remover "${s.title}"?`)) return;
                        if (i === current) { audioRef.current?.pause(); setCurrent(-1); }
                        await deleteSong({ data: { id: s.id } });
                        await loadSongs();
                      }}
                      className="p-1 text-white/40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-white/40 text-center">a playlist é a mesma para os dois</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
