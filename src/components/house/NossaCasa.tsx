import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Gamepad2, Mail, BookOpen, Backpack, Store, ClipboardList, Home, Lock, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getHouse, houseAct } from "@/lib/chat.functions";
import {
  CATEGORIES,
  MISSIONS,
  SHOP,
  claimKey,
  countKey,
  itemById,
  normalize,
  secretUnlocked,
  today,
  type Category,
  type HouseData,
  type HouseOp,
  type Who,
} from "@/lib/house";
import { MusicPicker } from "@/components/chat/Notes";

const W = 20;
const H = 16;
const NAME = { gu: "bb gu", li: "bb li" } as const;

/** Cômodos — adicionar novos aqui. */
const ROOMS = [
  { id: "quarto", name: "Quarto", x: 0, y: 0, w: 7, h: 6, floor: "#3a2f45", night: "#2a2236" },
  { id: "gamer", name: "Cantinho gamer", x: 7, y: 0, w: 5, h: 6, floor: "#1f2b3d", night: "#172030" },
  { id: "cozinha", name: "Cozinha", x: 12, y: 0, w: 8, h: 6, floor: "#e8dcc4", night: "#8a7f6c" },
  { id: "sala", name: "Sala", x: 0, y: 6, w: 12, h: 5, floor: "#8b6a4a", night: "#5a4632" },
  { id: "entrada", name: "Entrada", x: 12, y: 6, w: 8, h: 5, floor: "#a89a86", night: "#6e6557" },
  { id: "jardim", name: "Jardim", x: 0, y: 11, w: 20, h: 5, floor: "#6f9a5b", night: "#2f4a34" },
];

type Obj = { id: string; icon: string; name: string; x: number; y: number; size?: number };
/** Objetos fixos interativos — adicionar novos aqui. */
const OBJECTS: Obj[] = [
  { id: "cama", icon: "🛏️", name: "Cama", x: 2.5, y: 2.2, size: 2.4 },
  { id: "abajur0", icon: "🪔", name: "Criado-mudo", x: 5.3, y: 1.3 },
  { id: "pc", icon: "🖥️", name: "Computador", x: 9.5, y: 1.6, size: 1.8 },
  { id: "cadeira", icon: "💺", name: "Cadeira gamer", x: 9.5, y: 3.4 },
  { id: "geladeira", icon: "🧊", name: "Geladeira", x: 18.6, y: 1.4, size: 1.8 },
  { id: "fogao", icon: "🍳", name: "Fogão", x: 15.5, y: 1.3, size: 1.5 },
  { id: "mesa", icon: "🍽️", name: "Mesa", x: 15.5, y: 4, size: 1.5 },
  { id: "tv", icon: "📺", name: "TV", x: 5, y: 6.9, size: 1.8 },
  { id: "sofa", icon: "🛋️", name: "Sofá", x: 5, y: 9.4, size: 2.2 },
  { id: "livro", icon: "📖", name: "Nossa História", x: 1, y: 7.2, size: 1.5 },
  { id: "quadro", icon: "📋", name: "Quadro de missões", x: 10.8, y: 6.9, size: 1.5 },
  { id: "loja", icon: "🛍️", name: "Loja", x: 14, y: 7.2, size: 1.5 },
  { id: "porta", icon: "🚪", name: "Porta misteriosa", x: 19.2, y: 8.5, size: 1.6 },
  { id: "correio", icon: "📮", name: "Caixa de cartas", x: 17.5, y: 12.2, size: 1.5 },
];

const INDOOR_SLOTS = [
  [1, 4.8], [4, 4.8], [6.2, 3.6], [8, 4.8], [11.2, 1.2], [11.2, 4.8], [13, 1.2], [13, 4.8], [19, 4.8],
  [0.8, 9.8], [2.5, 7], [8, 7], [8.5, 9.8], [11, 9.8], [13.2, 9.8], [16.5, 7], [18.5, 9.8], [3, 0.8],
];
const GARDEN_SLOTS = [
  [1.2, 12], [3, 12.3], [5, 12], [7, 12.4], [9, 12], [11, 12.4], [13, 12], [15, 12.3],
  [1.5, 14.6], [3.5, 14.3], [5.5, 14.7], [7.5, 14.3], [9.5, 14.7], [11.5, 14.3], [13.5, 14.7], [15.5, 14.3], [19, 14.5], [19, 12.3],
];

const EMOTES = [
  { id: "abraco", icon: "🤗", label: "Abraço" },
  { id: "beijo", icon: "😘", label: "Beijo" },
  { id: "juntinhos", icon: "🫶", label: "Juntinhos" },
  { id: "acenar", icon: "👋", label: "Acenar" },
  { id: "rir", icon: "😂", label: "Rir" },
  { id: "dormir", icon: "😴", label: "Dormir" },
];

const FRIDGE = [
  "Tem só um iogurte vencido e muita esperança.",
  "Alguém comeu o último pedaço de pizza... e não fui eu.",
  "Gelo, ketchup e amor. O básico.",
  "Um bilhete: 'não mexe no meu brigadeiro'.",
];

type Pos = { x: number; y: number; emote?: string | null; t?: number };
type Panel = null | "shop" | "inv" | "letters" | "history" | "missions" | "tv" | "secret";

export function NossaCasa({
  me,
  avatars,
  onClose,
  onGames,
}: {
  me: Who;
  avatars: Partial<Record<Who, string | null>>;
  onClose: () => void;
  onGames: () => void;
}) {
  const other: Who = me === "gu" ? "li" : "gu";
  const [house, setHouse] = useState<HouseData | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [pos, setPos] = useState<Record<Who, Pos>>({ gu: { x: 7, y: 8.5 }, li: { x: 8.5, y: 8.5 } });
  const [peerOnline, setPeerOnline] = useState(false);
  const [pet, setPet] = useState({ x: 6, y: 13, act: "" });
  const posRef = useRef(pos);
  posRef.current = pos;
  const keys = useRef<Record<string, boolean>>({});
  const target = useRef<{ x: number; y: number; then?: () => void } | null>(null);
  const chan = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [nowPlaying, setNowPlaying] = useState<string | null>(null);
  const hour = new Date().getHours();
  const night = hour >= 19 || hour < 6;

  const flash = useCallback((m: string) => {
    if (!m) return;
    setToast(m);
    window.setTimeout(() => setToast((t) => (t === m ? null : t)), 2600);
  }, []);

  const act = useCallback(
    async (action: HouseOp, quiet = false) => {
      try {
        const r = await houseAct({ data: { who: me, action } });
        setHouse(r.house);
        if (r.error) {
          if (!quiet) flash(r.error);
          return false;
        }
        if (r.msg && !quiet) flash(r.msg);
        else if (r.msg && action.op === "claim") flash(r.msg);
        return true;
      } catch {
        if (!quiet) flash("sem conexão");
        return false;
      }
    },
    [me, flash],
  );

  // carrega + login diário
  useEffect(() => {
    void getHouse().then((r) => setHouse(r.house));
    void act({ op: "claim", key: "daily" }, true);
    const iv = window.setInterval(() => void getHouse().then((r) => setHouse(normalize(r.house))), 15000);
    return () => window.clearInterval(iv);
  }, [act]);

  // canal de posição
  useEffect(() => {
    const c = supabase.channel("house-room", { config: { presence: { key: me }, broadcast: { self: false } } });
    c.on("broadcast", { event: "pos" }, ({ payload }) => {
      const p = payload as { who: Who } & Pos;
      if (p.who !== other) return;
      setPos((s) => ({ ...s, [other]: { x: p.x, y: p.y, emote: p.emote, t: p.t } }));
    })
      .on("broadcast", { event: "refresh" }, () => void getHouse().then((r) => setHouse(r.house)))
      .on("presence", { event: "sync" }, () => setPeerOnline(!!c.presenceState()[other]))
      .subscribe((s) => {
        if (s === "SUBSCRIBED") void c.track({ at: Date.now() });
      });
    chan.current = c;
    return () => {
      void supabase.removeChannel(c);
      chan.current = null;
    };
  }, [me, other]);

  const send = useCallback(
    (p: Pos) => void chan.current?.send({ type: "broadcast", event: "pos", payload: { who: me, ...p } }),
    [me],
  );

  // teclado
  useEffect(() => {
    const d = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
        keys.current[k] = true;
        target.current = null;
        e.preventDefault();
      }
    };
    const u = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", d);
    window.addEventListener("keyup", u);
    return () => {
      window.removeEventListener("keydown", d);
      window.removeEventListener("keyup", u);
    };
  }, []);

  // loop de movimento
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastSent = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const k = keys.current;
      let dx = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0);
      let dy = (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0);
      const cur = posRef.current[me];
      if (!dx && !dy && target.current) {
        const tx = target.current.x - cur.x;
        const ty = target.current.y - cur.y;
        const dist = Math.hypot(tx, ty);
        if (dist < 0.15) {
          const then = target.current.then;
          target.current = null;
          then?.();
        } else {
          dx = tx / dist;
          dy = ty / dist;
        }
      }
      if (dx || dy) {
        const len = Math.hypot(dx, dy) || 1;
        const sp = 4.2 * dt;
        const nx = Math.max(0.4, Math.min(W - 0.4, cur.x + (dx / len) * sp));
        const ny = Math.max(0.6, Math.min(H - 0.3, cur.y + (dy / len) * sp));
        const np = { ...cur, x: nx, y: ny, emote: cur.emote && Date.now() - (cur.t ?? 0) < 2500 ? cur.emote : null };
        setPos((s) => ({ ...s, [me]: np }));
        if (t - lastSent > 110) {
          lastSent = t;
          send(np);
        }
      }
      // pet segue quem estiver mais perto
      setPet((p) => {
        if (p.act) return p;
        const a = posRef.current[me];
        const tx = a.x - 0.9 - p.x;
        const ty = a.y + 0.3 - p.y;
        const d = Math.hypot(tx, ty);
        if (d < 0.8) return p;
        const s = Math.min(d, 3.6 * dt);
        return { ...p, x: p.x + (tx / d) * s, y: p.y + (ty / d) * s };
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [me, send]);

  const emote = (id: string) => {
    const cur = { ...posRef.current[me], emote: id, t: Date.now() };
    setPos((s) => ({ ...s, [me]: cur }));
    send(cur);
    void act({ op: "event", ev: "emote" }, true);
    const d = Math.hypot(posRef.current[other].x - cur.x, posRef.current[other].y - cur.y);
    if ((id === "abraco" || id === "beijo" || id === "juntinhos") && d < 1.6 && peerOnline) flash(`${NAME[me]} e ${NAME[other]} juntinhos ❤️`);
  };

  const interact = (o: Obj) => {
    void act({ op: "event", ev: "interact" }, true);
    void act({ op: "claim", key: "interact" }, true).then(() => {});
    switch (o.id) {
      case "tv":
        return setPanel("tv");
      case "sofa":
        return flash("Vocês estão juntinhos no sofá ❤️");
      case "cama":
        emote("dormir");
        return flash("Hora de descansar juntos 🌙");
      case "pc":
      case "cadeira":
        void act({ op: "claim", key: "game" }, true);
        void act({ op: "event", ev: "game" }, true);
        return onGames();
      case "geladeira":
        return flash(FRIDGE[Math.floor(Math.random() * FRIDGE.length)]);
      case "fogao":
        return flash("Cheirinho de comida caseira no ar 🍝");
      case "mesa":
        return flash("Jantar a dois servido 🕯️");
      case "abajur0":
        return flash("Luz baixinha, clima de conversa.");
      case "livro":
        return setPanel("history");
      case "quadro":
        return setPanel("missions");
      case "loja":
        return setPanel("shop");
      case "correio":
        return setPanel("letters");
      case "porta":
        return setPanel("secret");
    }
  };

  const goTo = (x: number, y: number, then?: () => void) => {
    const cur = posRef.current[me];
    if (Math.hypot(cur.x - x, cur.y - y) < 1.6) return then?.();
    target.current = { x, y: y + 0.9, then };
  };

  const tapMap = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    target.current = { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const placed = house?.placed ?? [];
  const decor = useMemo(() => {
    let gi = 0;
    let ii = 0;
    return placed.map((p) => {
      const it = itemById(p.item);
      const slot = it?.garden ? GARDEN_SLOTS[gi++ % GARDEN_SLOTS.length] : INDOOR_SLOTS[ii++ % INDOOR_SLOTS.length];
      return { p, it, x: slot[0], y: slot[1] };
    });
  }, [placed]);

  const hold = (k: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      target.current = null;
      keys.current[k] = true;
    },
    onPointerUp: () => (keys.current[k] = false),
    onPointerLeave: () => (keys.current[k] = false),
    onPointerCancel: () => (keys.current[k] = false),
  });

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;

  const Char = ({ who }: { who: Who }) => {
    const p = pos[who];
    const show = who === me || peerOnline;
    if (!show) return null;
    const em = p.emote && Date.now() - (p.t ?? 0) < 2600 ? EMOTES.find((x) => x.id === p.emote) : null;
    const col = who === "gu" ? "#5b8def" : "#e98fb4";
    return (
      <div
        className="absolute pointer-events-none"
        style={{ left: pct(p.x, W), top: pct(p.y, H), transform: "translate(-50%,-100%)", zIndex: Math.round(p.y * 10) + 5, transition: who === me ? undefined : "left .12s linear, top .12s linear" }}
      >
        {em && <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-xl animate-bounce">{em.icon}</div>}
        <div className="flex flex-col items-center">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full overflow-hidden border-2 shadow-md flex items-center justify-center text-xs font-bold" style={{ borderColor: col, background: col }}>
            {avatars[who] ? <img src={avatars[who]!} alt="" className="w-full h-full object-cover" /> : who === "gu" ? "G" : "L"}
          </div>
          <div className="w-5 h-3 sm:w-6 sm:h-4 -mt-0.5 rounded-b-lg rounded-t-sm" style={{ background: col }} />
          <div className="w-6 h-1.5 rounded-full bg-black/30 blur-[1px] -mt-0.5" />
          <span className="text-[9px] mt-0.5 px-1 rounded bg-black/50 text-white whitespace-nowrap">{NAME[who]}</span>
        </div>
      </div>
    );
  };

  const petIcon = house?.pet === "gato" ? "🐱" : house?.pet === "cachorro" ? "🐶" : null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col text-white select-none" style={{ background: night ? "#0b1022" : "#1c2a22" }}>
      <audio ref={audio} onEnded={() => setNowPlaying(null)} />
      {/* topo */}
      <div className="flex items-center gap-2 px-3 py-2 bg-black/40 backdrop-blur">
        <Home size={18} className="text-amber-200" />
        <p className="font-semibold text-sm flex-1">Nossa Casinha</p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${peerOnline ? "bg-emerald-500/30 text-emerald-200" : "bg-white/10 text-white/50"}`}>
          {NAME[other]} {peerOnline ? "em casa" : "fora"}
        </span>
        <span className="flex items-center gap-1 text-sm font-bold bg-rose-500/20 text-rose-200 rounded-full px-2.5 py-0.5">
          <Heart size={13} fill="currentColor" /> {house?.hearts ?? "…"}
        </span>
        <button onClick={onClose} aria-label="Fechar casa" className="p-1.5 rounded-full bg-white/10">
          <X size={18} />
        </button>
      </div>

      {/* mapa */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-2">
        <div
          className="relative w-full rounded-xl overflow-hidden shadow-2xl"
          style={{ maxWidth: "min(760px, calc((100dvh - 230px) * 1.25))", aspectRatio: `${W}/${H}` }}
          onPointerDown={tapMap}
        >
          {ROOMS.map((r) => (
            <div
              key={r.id}
              className="absolute"
              style={{
                left: pct(r.x, W),
                top: pct(r.y, H),
                width: pct(r.w, W),
                height: pct(r.h, H),
                background: r.id === "jardim" ? undefined : night ? r.night : r.floor,
                backgroundImage:
                  r.id === "jardim"
                    ? `radial-gradient(rgba(255,255,255,.07) 1px, transparent 1.5px), linear-gradient(${night ? r.night : r.floor}, ${night ? r.night : r.floor})`
                    : r.id === "sala" || r.id === "quarto"
                      ? "repeating-linear-gradient(90deg, rgba(0,0,0,.08) 0 1px, transparent 1px 22px)"
                      : r.id === "cozinha"
                        ? "conic-gradient(rgba(0,0,0,.06) 25%, transparent 0 50%, rgba(0,0,0,.06) 0 75%, transparent 0)"
                        : undefined,
                backgroundSize: r.id === "cozinha" ? "24px 24px" : r.id === "jardim" ? "14px 14px" : undefined,
                boxShadow: r.id === "jardim" ? undefined : "inset 0 0 0 3px #3d2e22, inset 0 6px 0 3px rgba(0,0,0,.25)",
              }}
            >
              <span className="absolute top-1 left-1.5 text-[9px] sm:text-[10px] uppercase tracking-wider text-white/50 font-semibold">{r.name}</span>
            </div>
          ))}
          {/* noite: estrelas no jardim e luz quente */}
          {night && (
            <>
              <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 30% 30%, rgba(255,190,110,.12), transparent 50%)" }} />
              {Array.from({ length: 14 }).map((_, i) => (
                <span key={i} className="absolute w-0.5 h-0.5 rounded-full bg-white/80 animate-pulse" style={{ left: `${(i * 37) % 100}%`, top: `${70 + ((i * 13) % 28)}%`, animationDelay: `${i * 0.3}s` }} />
              ))}
            </>
          )}
          {!night && <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,245,200,.08), transparent 60%)" }} />}

          {OBJECTS.map((o) => {
            const locked = o.id === "porta" && house && !secretUnlocked(house);
            return (
              <button
                key={o.id}
                title={o.name}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => goTo(o.x, o.y, () => interact(o))}
                className="absolute flex flex-col items-center hover:scale-110 active:scale-95 transition-transform"
                style={{ left: pct(o.x, W), top: pct(o.y, H), transform: "translate(-50%,-50%)", zIndex: Math.round(o.y * 10), fontSize: `clamp(14px, ${(o.size ?? 1.2) * 1.9}vw, ${(o.size ?? 1.2) * 20}px)`, filter: locked ? "grayscale(1) brightness(.6)" : undefined }}
              >
                <span className="drop-shadow-[0_3px_2px_rgba(0,0,0,.45)] leading-none">{o.icon}</span>
              </button>
            );
          })}

          {decor.map(({ p, it, x, y }) =>
            it ? (
              <button
                key={p.uid}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => flash(p.note ? `${it.icon} ${p.note} · ${p.date.split("-").reverse().join("/")}` : `${it.icon} ${it.name} · ${p.date.split("-").reverse().join("/")}`)}
                className="absolute leading-none drop-shadow-[0_3px_2px_rgba(0,0,0,.4)]"
                style={{ left: pct(x, W), top: pct(y, H), transform: "translate(-50%,-50%)", zIndex: Math.round(y * 10), fontSize: "clamp(14px, 2.6vw, 26px)" }}
              >
                {it.icon}
              </button>
            ) : null,
          )}

          {petIcon && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                const acts = ["dormindo 💤", "comendo 🦴", "brincando 🎾", "pedindo carinho 🥺"];
                const a = acts[Math.floor(Math.random() * acts.length)];
                setPet((p) => ({ ...p, act: a }));
                flash(`${house?.petName || (house?.pet === "gato" ? "O gatinho" : "O cachorrinho")} está ${a}`);
                window.setTimeout(() => setPet((p) => ({ ...p, act: "" })), 3500);
              }}
              className="absolute leading-none"
              style={{ left: pct(pet.x, W), top: pct(pet.y, H), transform: "translate(-50%,-50%)", zIndex: Math.round(pet.y * 10) + 4, fontSize: "clamp(16px, 2.4vw, 24px)" }}
            >
              <span className={pet.act ? "inline-block animate-bounce" : ""}>{petIcon}</span>
            </button>
          )}

          <Char who={other} />
          <Char who={me} />
          {toast && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[999] bg-black/75 backdrop-blur px-4 py-2 rounded-full text-xs sm:text-sm text-center max-w-[90%] pointer-events-none">
              {toast}
            </div>
          )}
        </div>
      </div>

      {/* controles */}
      <div className="flex items-end justify-between gap-2 px-3 pb-1">
        <div className="grid grid-cols-3 gap-1 w-[120px] shrink-0">
          <span />
          <button {...hold("w")} className="h-10 rounded-lg bg-white/10 active:bg-white/25 text-lg">▲</button>
          <span />
          <button {...hold("a")} className="h-10 rounded-lg bg-white/10 active:bg-white/25 text-lg">◀</button>
          <button {...hold("s")} className="h-10 rounded-lg bg-white/10 active:bg-white/25 text-lg">▼</button>
          <button {...hold("d")} className="h-10 rounded-lg bg-white/10 active:bg-white/25 text-lg">▶</button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {EMOTES.map((e) => (
            <button key={e.id} onClick={() => emote(e.id)} className="w-12 h-10 rounded-lg bg-white/10 active:bg-white/25 text-xl" title={e.label}>
              {e.icon}
            </button>
          ))}
        </div>
      </div>

      {/* navegação */}
      <div className="grid grid-cols-7 gap-1 px-2 py-2 bg-black/40 text-[10px]">
        {[
          { k: null, icon: <Home size={18} />, l: "Casa" },
          { k: "games", icon: <Gamepad2 size={18} />, l: "Jogos" },
          { k: "letters", icon: <Mail size={18} />, l: "Cartas" },
          { k: "history", icon: <BookOpen size={18} />, l: "História" },
          { k: "inv", icon: <Backpack size={18} />, l: "Inventário" },
          { k: "shop", icon: <Store size={18} />, l: "Loja" },
          { k: "missions", icon: <ClipboardList size={18} />, l: "Missões" },
        ].map((b) => (
          <button
            key={b.l}
            onClick={() => {
              if (b.k === "games") {
                void act({ op: "claim", key: "game" }, true);
                void act({ op: "event", ev: "game" }, true);
                return onGames();
              }
              setPanel(b.k as Panel);
            }}
            className={`flex flex-col items-center gap-0.5 py-1 rounded-lg ${panel === b.k ? "bg-white/15" : ""}`}
          >
            {b.icon}
            {b.l}
          </button>
        ))}
      </div>

      {panel && panel !== "tv" && house && (
        <Sheet onClose={() => setPanel(null)} title={TITLES[panel]}>
          {panel === "shop" && <ShopPanel house={house} act={act} />}
          {panel === "inv" && <InvPanel house={house} act={act} />}
          {panel === "letters" && <LettersPanel house={house} me={me} act={act} />}
          {panel === "history" && <HistoryPanel house={house} act={act} />}
          {panel === "missions" && <MissionsPanel house={house} me={me} act={act} />}
          {panel === "secret" && <SecretPanel house={house} />}
        </Sheet>
      )}
      {panel === "tv" && (
        <MusicPicker
          title={nowPlaying ? `Tocando: ${nowPlaying}` : "TV da sala — escolha uma música"}
          skipLabel={nowPlaying ? "parar música" : undefined}
          onClose={() => setPanel(null)}
          onPick={(m) => {
            setPanel(null);
            const a = audio.current;
            if (!a) return;
            if (!m) {
              a.pause();
              return setNowPlaying(null);
            }
            a.src = m.preview;
            void a.play();
            setNowPlaying(`${m.title} — ${m.artist}`);
            void act({ op: "event", ev: "music" }, true);
            flash(`🎵 ${m.title}`);
          }}
        />
      )}
    </div>
  );
}

const TITLES: Record<Exclude<Panel, null>, string> = {
  shop: "Loja da casa",
  inv: "Inventário",
  letters: "Caixa de cartas",
  history: "Nossa História",
  missions: "Quadro de missões",
  tv: "TV",
  secret: "Nosso Lugar Secreto",
};

type ActFn = (a: HouseOp, quiet?: boolean) => Promise<boolean>;

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md max-h-[82dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[#1d1a24] border border-white/10">
        <div className="flex items-center px-4 py-3 border-b border-white/10">
          <p className="flex-1 font-semibold">{title}</p>
          <button onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{children}</div>
      </div>
    </div>
  );
}

function ShopPanel({ house, act }: { house: HouseData; act: ActFn }) {
  const [cat, setCat] = useState<Category>("moveis");
  return (
    <>
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)} className={`shrink-0 text-xs px-3 py-1.5 rounded-full ${cat === c.id ? "bg-amber-300 text-neutral-900 font-semibold" : "bg-white/10"}`}>
            {c.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-1">
        {SHOP.filter((s) => s.cat === cat).map((s) => {
          const has = s.cat === "pets" && house.pet === s.id;
          return (
            <div key={s.id} className="rounded-xl bg-white/5 p-3 flex flex-col items-center gap-1">
              <span className="text-3xl">{s.icon}</span>
              <p className="text-xs font-medium text-center">{s.name}</p>
              <button
                disabled={has || house.hearts < s.price}
                onClick={() => void act({ op: "buy", item: s.id })}
                className="mt-1 text-xs px-3 py-1 rounded-full bg-rose-500/80 disabled:bg-white/10 disabled:text-white/40"
              >
                {has ? "adotado" : `${s.price} ❤️`}
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-white/40 text-center mt-3">Itens comprados vão para o inventário. Coloque-os na casa por lá.</p>
    </>
  );
}

function InvPanel({ house, act }: { house: HouseData; act: ActFn }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const counts = house.owned.reduce<Record<string, number>>((a, i) => ((a[i] = (a[i] ?? 0) + 1), a), {});
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-white/50 mb-2">Guardados</p>
        {!house.owned.length && <p className="text-xs text-white/40">Nada guardado. Compre itens na loja.</p>}
        <div className="space-y-2">
          {Object.entries(counts).map(([id, n]) => {
            const it = itemById(id)!;
            return (
              <div key={id} className="rounded-xl bg-white/5 p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{it.icon}</span>
                  <p className="text-sm flex-1">
                    {it.name} {n > 1 && <span className="text-white/40">×{n}</span>}
                  </p>
                  <button onClick={() => void act({ op: "place", item: id, note: notes[id] ?? "" })} className="text-xs px-3 py-1 rounded-full bg-emerald-600">
                    Colocar
                  </button>
                </div>
                <input
                  value={notes[id] ?? ""}
                  maxLength={80}
                  onChange={(e) => setNotes((x) => ({ ...x, [id]: e.target.value }))}
                  placeholder='descrição (ex: "Nossa primeira rosa")'
                  className="w-full rounded-lg bg-white/10 px-3 py-1.5 text-xs outline-none"
                />
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-xs text-white/50 mb-2">Na casa</p>
        {!house.placed.length && <p className="text-xs text-white/40">A casa ainda está simples.</p>}
        <div className="space-y-1.5">
          {house.placed.map((p) => {
            const it = itemById(p.item);
            return (
              <div key={p.uid} className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-2">
                <span className="text-xl">{it?.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">{p.note || it?.name}</p>
                  <p className="text-[10px] text-white/40">Colocado em {p.date.split("-").reverse().join("/")}</p>
                </div>
                <button onClick={() => void act({ op: "unplace", uid: p.uid })} className="text-[11px] text-white/50">
                  guardar
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LettersPanel({ house, me, act }: { house: HouseData; me: Who; act: ActFn }) {
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const t = today();
  const inbox = house.letters.filter((l) => l.from !== me);
  const sent = house.letters.filter((l) => l.from === me);
  const openL = house.letters.find((l) => l.id === open);
  if (openL)
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-[#f5ecd9] text-neutral-800 p-4 font-serif whitespace-pre-wrap text-sm leading-relaxed">{openL.text}</div>
        <p className="text-[11px] text-white/40">
          De {NAME[openL.from]} · {new Date(openL.created).toLocaleDateString("pt-BR")}
        </p>
        <button onClick={() => setOpen(null)} className="w-full rounded-full bg-white/10 py-2 text-sm">
          voltar
        </button>
      </div>
    );
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={3000} placeholder={`Escreva uma carta para ${NAME[me === "gu" ? "li" : "gu"]}...`} className="w-full rounded-xl bg-white/10 p-3 text-sm outline-none resize-none" />
        <label className="flex items-center gap-2 text-xs text-white/60">
          <Lock size={13} /> Só abrir em
          <input type="date" value={date} min={t} onChange={(e) => setDate(e.target.value)} className="bg-white/10 rounded px-2 py-1 text-white" />
        </label>
        <button
          onClick={async () => {
            if (await act({ op: "letter", text, openAt: date || null })) {
              setText("");
              setDate("");
            }
          }}
          className="w-full rounded-full bg-rose-500/80 py-2 text-sm font-medium"
        >
          Colocar na caixa de correio
        </button>
      </div>
      <div>
        <p className="text-xs text-white/50 mb-2">Recebidas</p>
        {!inbox.length && <p className="text-xs text-white/40">Nenhuma carta ainda.</p>}
        <div className="space-y-1.5">
          {inbox.map((l) => {
            const locked = !!l.openAt && l.openAt > t;
            return (
              <button
                key={l.id}
                disabled={locked}
                onClick={() => {
                  void act({ op: "openLetter", id: l.id }, true);
                  setOpen(l.id);
                }}
                className="w-full flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2.5 text-left disabled:opacity-60"
              >
                <span className="text-xl">{locked ? "🔒" : l.opened ? "📨" : "💌"}</span>
                <span className="text-xs flex-1">
                  {locked ? `Esta carta poderá ser aberta em ${l.openAt!.split("-").reverse().join("/")}.` : l.opened ? "Carta aberta" : "Carta nova!"}
                </span>
                <span className="text-[10px] text-white/40">{new Date(l.created).toLocaleDateString("pt-BR")}</span>
              </button>
            );
          })}
        </div>
      </div>
      {!!sent.length && (
        <div>
          <p className="text-xs text-white/50 mb-2">Enviadas</p>
          {sent.map((l) => (
            <button key={l.id} onClick={() => setOpen(l.id)} className="w-full text-left text-xs rounded-lg bg-white/5 px-3 py-2 mb-1.5 truncate">
              {l.opened ? "✓ lida" : "• não lida"}
              {l.openAt ? ` · abre ${l.openAt.split("-").reverse().join("/")}` : ""} — {l.text.slice(0, 40)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function shrinkPhoto(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 420 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

function HistoryPanel({ house, act }: { house: HouseData; act: ActFn }) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ title: "", desc: "", date: today(), photo: null as string | null });
  return (
    <div className="space-y-3">
      <div className="relative pl-5 space-y-4 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-0.5 before:bg-amber-200/30">
        {house.memories.map((m) => (
          <div key={m.id} className="relative">
            <span className="absolute -left-[18px] top-1 w-3 h-3 rounded-full bg-amber-300" />
            <p className="text-[10px] text-amber-200/70">{m.date.split("-").reverse().join("/")}</p>
            <p className="text-sm font-semibold">{m.title}</p>
            {m.desc && <p className="text-xs text-white/60 whitespace-pre-wrap">{m.desc}</p>}
            {m.photo && <img src={m.photo} alt="" className="mt-2 rounded-lg max-h-48 object-cover" />}
            {m.id !== "m0" && (
              <button onClick={() => confirm("Apagar esta memória?") && void act({ op: "delMemory", id: m.id }, true)} className="text-[10px] text-white/30 mt-1">
                apagar
              </button>
            )}
          </div>
        ))}
      </div>
      {adding ? (
        <div className="space-y-2 rounded-xl bg-white/5 p-3">
          <input value={f.title} maxLength={80} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Título (ex: Nosso primeiro encontro)" className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none" />
          <textarea value={f.desc} maxLength={600} rows={3} onChange={(e) => setF({ ...f, desc: e.target.value })} placeholder="Descrição" className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none resize-none" />
          <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm" />
          <label className="block text-center text-xs rounded-lg bg-white/10 py-2 cursor-pointer">
            {f.photo ? "foto escolhida ✓" : "adicionar foto (opcional)"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) setF((x) => ({ ...x, photo: null })), setF({ ...f, photo: await shrinkPhoto(file) });
              }}
            />
          </label>
          <button
            onClick={async () => {
              if (await act({ op: "memory", ...f })) {
                setAdding(false);
                setF({ title: "", desc: "", date: today(), photo: null });
              }
            }}
            className="w-full rounded-full bg-amber-300 text-neutral-900 py-2 text-sm font-semibold"
          >
            Guardar memória
          </button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full rounded-full bg-white/10 py-2 text-sm">
          + Nova memória
        </button>
      )}
    </div>
  );
}

function MissionsPanel({ house, me, act }: { house: HouseData; me: Who; act: ActFn }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-white/40">Missões diárias — renovam todo dia.</p>
      {MISSIONS.map((m) => {
        const done = house.claims.includes(claimKey(me, m.id));
        const prog = Math.min(m.need, house.counts[countKey(me, m.event)] ?? 0);
        const ready = prog >= m.need;
        return (
          <div key={m.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <div className="flex-1">
              <p className="text-sm">{m.title}</p>
              <p className="text-[11px] text-white/40">
                {prog}/{m.need} · +{m.reward} ❤️
              </p>
            </div>
            <button disabled={done || !ready} onClick={() => void act({ op: "mission", id: m.id })} className="text-xs px-3 py-1.5 rounded-full bg-emerald-600 disabled:bg-white/10 disabled:text-white/40">
              {done ? "feito ✓" : ready ? "resgatar" : "pendente"}
            </button>
          </div>
        );
      })}
      {!!house.log.length && (
        <div className="pt-3">
          <p className="text-xs text-white/50 mb-1.5">Acontecimentos recentes</p>
          {house.log.slice(0, 8).map((l, i) => (
            <p key={i} className="text-[11px] text-white/50">
              · {l.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function SecretPanel({ house }: { house: HouseData }) {
  if (!secretUnlocked(house))
    return (
      <div className="text-center space-y-3 py-4">
        <p className="text-4xl">🔒</p>
        <p className="text-sm">Uma porta misteriosa... ela ainda não abre.</p>
        <div className="text-xs text-white/60 space-y-1">
          <p>{house.memories.length >= 3 ? "✓" : "○"} 3 memórias na Nossa História ({house.memories.length}/3)</p>
          <p>{house.letters.length >= 2 ? "✓" : "○"} 2 cartas trocadas ({house.letters.length}/2)</p>
          <p>{house.placed.length >= 3 ? "✓" : "○"} 3 itens colocados na casa ({house.placed.length}/3)</p>
        </div>
      </div>
    );
  return (
    <div className="text-center space-y-3 py-6 rounded-xl" style={{ background: "radial-gradient(circle at 50% 30%, rgba(167,139,250,.25), transparent 70%)" }}>
      <p className="text-4xl">🌌</p>
      <p className="text-lg font-semibold">Nosso Lugar Secreto 💜</p>
      <p className="text-sm text-white/70 px-4">Vocês chegaram aqui juntos. {house.memories.length} memórias, {house.letters.length} cartas e uma casa inteira construída a dois.</p>
      <p className="text-xs text-white/40">Novidades vão aparecer aqui em breve.</p>
    </div>
  );
}
