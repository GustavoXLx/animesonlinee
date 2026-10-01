import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Target, ArrowRightLeft, Eye, EyeOff } from "lucide-react";
import { useGameChannel, type Me } from "./useGameChannel";
import { FACE_NAMES, THEMES } from "./quemSouEuData";

type Card = { name: string; wiki?: string; face?: number };
type QState = {
  phase: "setup" | "play" | "end";
  theme: string;
  cards: Card[];
  secret: Record<Me, number>;
  down: Record<Me, number[]>;
  turn: Me;
  winner: Me | null;
  lastGuess: { by: Me; idx: number; ok: boolean } | null;
  score: Record<Me, number>;
  used: Record<string, string[]>;
  round: number;
};

const N = 24;
const initial: QState = {
  phase: "setup",
  theme: "rostos",
  cards: [],
  secret: { gu: 0, li: 0 },
  down: { gu: [], li: [] },
  turn: "gu",
  winner: null,
  lastGuess: null,
  score: { gu: 0, li: 0 },
  used: {},
  round: 0,
};

const USED_KEY = "anistream-qse-used";
const loadUsed = (): Record<string, string[]> => {
  try {
    return JSON.parse(localStorage.getItem(USED_KEY) || "{}");
  } catch {
    return {};
  }
};
const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

/** sorteia 24 cartas que ainda não saíram; quando acaba o tema, recomeça sem repetir a rodada anterior */
function drawCards(theme: string, used: Record<string, string[]>) {
  const t = THEMES.find((x) => x.id === theme)!;
  const seen = new Set(used[theme] ?? []);
  let cards: Card[];
  let keys: string[];
  if (!t.pool) {
    let free = FACE_NAMES.filter((n) => !seen.has(n));
    let base = used[theme] ?? [];
    if (free.length < N) {
      const last = new Set(base.slice(-N));
      free = FACE_NAMES.filter((n) => !last.has(n));
      base = [...last];
    }
    const names = shuffle(free).slice(0, N);
    const usedSeeds = new Set<number>();
    cards = names.map((name) => {
      let s = 0;
      do s = Math.floor(Math.random() * 2 ** 31);
      while (usedSeeds.has(s));
      usedSeeds.add(s);
      return { name, face: s };
    });
    keys = [...base, ...names];
  } else {
    let free = t.pool.filter((p) => !seen.has(p));
    let base = used[theme] ?? [];
    if (free.length < N) {
      const last = new Set(base.slice(-N));
      free = t.pool.filter((p) => !last.has(p));
      base = [...last];
    }
    const pick = shuffle(free).slice(0, N);
    cards = pick.map((p) => {
      const [name, wiki] = p.split("|");
      return { name, wiki: wiki || name };
    });
    keys = [...base, ...pick];
  }
  return { cards, used: { ...used, [theme]: keys } };
}

// ---------- imagens da Wikipédia ----------
const imgCache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();
function wikiImg(title: string) {
  if (imgCache.has(title)) return Promise.resolve(imgCache.get(title)!);
  let p = inflight.get(title);
  if (!p) {
    p = fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.thumbnail?.source as string | undefined) ?? null)
      .catch(() => null)
      .then((u) => {
        imgCache.set(title, u);
        return u;
      });
    inflight.set(title, p);
  }
  return p;
}
function useWikiImg(title?: string) {
  const [url, setUrl] = useState<string | null | undefined>(title ? imgCache.get(title) : null);
  useEffect(() => {
    if (!title) return;
    let alive = true;
    wikiImg(title).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [title]);
  return url;
}

// ---------- rosto desenhado a partir de uma semente ----------
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}
const SKIN = ["#f6d7c3", "#eac0a0", "#d49b74", "#a86f4c", "#7a4b2f", "#5a3622"];
const HAIR = ["#1d1512", "#4a2c1a", "#8a5a2b", "#e3c06b", "#c2552b", "#bdbdbd", "#e58fb6"];
const SHIRT = ["#2563eb", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2", "#db2777", "#475569"];
const EYES = ["#3b2a1f", "#2f6db5", "#3f8f4f"];

function Face({ seed }: { seed: number }) {
  const r = rng(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const skin = pick(SKIN);
  const hairC = r() < 0.12 ? HAIR[5] : pick(HAIR);
  const style = pick(["bald", "short", "short", "long", "long", "curly", "bun", "mohawk", "side"]);
  const shirt = pick(SHIRT);
  const eye = pick(EYES);
  const glasses = r() < 0.3;
  const beard = r() < 0.25;
  const mustache = !beard && r() < 0.15;
  const hat = r() < 0.18 ? pick(["cap", "beanie"]) : null;
  const earrings = r() < 0.22;
  const blush = r() < 0.4;
  const mouth = pick(["smile", "grin", "open"]);
  const hatC = pick(SHIRT);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <rect width="100" height="100" fill="#eef4ff" />
      {style === "long" && <path d={`M22 48 Q20 92 30 96 L70 96 Q80 92 78 48 Z`} fill={hairC} />}
      <path d="M18 100 Q20 76 50 74 Q80 76 82 100 Z" fill={shirt} />
      <rect x="43" y="62" width="14" height="14" fill={skin} />
      <ellipse cx="50" cy="48" rx="23" ry="26" fill={skin} />
      <ellipse cx="27" cy="50" rx="4" ry="6" fill={skin} />
      <ellipse cx="73" cy="50" rx="4" ry="6" fill={skin} />
      {earrings && (
        <>
          <circle cx="27" cy="58" r="2" fill="#facc15" />
          <circle cx="73" cy="58" r="2" fill="#facc15" />
        </>
      )}
      {style === "short" && <path d="M27 42 Q28 18 50 18 Q72 18 73 42 Q66 30 50 30 Q34 30 27 42 Z" fill={hairC} />}
      {style === "side" && <path d="M27 44 Q26 16 52 18 Q74 20 73 40 Q60 26 40 34 Q32 36 27 44 Z" fill={hairC} />}
      {style === "long" && <path d="M25 50 Q22 16 50 17 Q78 16 75 50 Q72 30 50 28 Q30 28 25 50 Z" fill={hairC} />}
      {style === "curly" &&
        [24, 32, 41, 50, 59, 68, 76].map((x, i) => <circle key={i} cx={x} cy={i % 2 ? 22 : 28} r="9" fill={hairC} />)}
      {style === "bun" && (
        <>
          <circle cx="50" cy="14" r="9" fill={hairC} />
          <path d="M27 42 Q28 18 50 19 Q72 18 73 42 Q66 28 50 28 Q34 28 27 42 Z" fill={hairC} />
        </>
      )}
      {style === "mohawk" && <path d="M44 32 Q46 10 50 8 Q54 10 56 32 Z" fill={hairC} />}
      {hat === "cap" && (
        <>
          <path d="M26 36 Q28 14 50 14 Q72 14 74 36 Z" fill={hatC} />
          <path d="M50 34 L84 36 Q84 40 74 40 L50 38 Z" fill={hatC} opacity="0.85" />
        </>
      )}
      {hat === "beanie" && (
        <>
          <path d="M26 38 Q26 10 50 10 Q74 10 74 38 Z" fill={hatC} />
          <rect x="25" y="33" width="50" height="7" rx="3" fill="#fff" opacity="0.8" />
        </>
      )}
      <circle cx="41" cy="48" r="2.8" fill={eye} />
      <circle cx="59" cy="48" r="2.8" fill={eye} />
      <path d="M36 42 Q41 39 45 42" stroke="#3a2a20" strokeWidth="1.6" fill="none" />
      <path d="M55 42 Q59 39 64 42" stroke="#3a2a20" strokeWidth="1.6" fill="none" />
      {glasses && (
        <g stroke="#1f1f1f" strokeWidth="1.8" fill="none">
          <circle cx="41" cy="48" r="7" />
          <circle cx="59" cy="48" r="7" />
          <path d="M48 48 L52 48" />
        </g>
      )}
      {blush && (
        <>
          <circle cx="35" cy="57" r="3.5" fill="#f472b6" opacity="0.35" />
          <circle cx="65" cy="57" r="3.5" fill="#f472b6" opacity="0.35" />
        </>
      )}
      {beard && <path d="M28 52 Q30 78 50 80 Q70 78 72 52 Q66 66 50 66 Q34 66 28 52 Z" fill={hairC} />}
      {mustache && <path d="M41 60 Q50 56 59 60 Q50 63 41 60 Z" fill={hairC} />}
      {mouth === "smile" && <path d="M43 63 Q50 68 57 63" stroke="#7a2e2e" strokeWidth="2" fill="none" strokeLinecap="round" />}
      {mouth === "grin" && <path d="M42 62 Q50 70 58 62 Z" fill="#fff" stroke="#7a2e2e" strokeWidth="1.5" />}
      {mouth === "open" && <ellipse cx="50" cy="64" rx="4" ry="3" fill="#7a2e2e" />}
    </svg>
  );
}

function CardArt({ card }: { card: Card }) {
  const url = useWikiImg(card.wiki);
  if (card.face !== undefined) return <Face seed={card.face} />;
  if (url) return <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />;
  const initials = card.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-200 to-indigo-200 text-xl font-black text-indigo-900/70">
      {url === undefined ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400/40 border-t-indigo-500" /> : initials}
    </div>
  );
}

function GameCard({ card, down, color, onClick, highlight }: { card: Card; down?: boolean; color: string; onClick?: () => void; highlight?: boolean }) {
  return (
    <button onClick={onClick} className="relative aspect-[3/4] w-full [perspective:600px]" disabled={!onClick}>
      <div
        className="absolute inset-0 transition-transform duration-300 [transform-style:preserve-3d]"
        style={{ transform: down ? "rotateX(-80deg)" : "none", transformOrigin: "bottom" }}
      >
        <div className={`absolute inset-0 overflow-hidden rounded-md border-[3px] bg-white shadow ${highlight ? "ring-2 ring-yellow-300" : ""}`} style={{ borderColor: color }}>
          <div className="h-[78%] w-full overflow-hidden">
            <CardArt card={card} />
          </div>
          <div className="flex h-[22%] items-center justify-center px-0.5" style={{ background: color }}>
            <span className="line-clamp-2 text-center text-[8.5px] font-black uppercase leading-[1.05] tracking-tight text-white">{card.name}</span>
          </div>
        </div>
      </div>
      {down && <div className="absolute inset-x-0 bottom-0 h-2 rounded-sm" style={{ background: color }} />}
    </button>
  );
}

export function QuemSouEu({ me }: { me: Me }) {
  const { state, setState, peerOnline } = useGameChannel<QState>("quemsoueu", me, initial);
  const other: Me = me === "gu" ? "li" : "gu";
  const [guessing, setGuessing] = useState(false);
  const [showSecret, setShowSecret] = useState(true);
  const color = me === "gu" ? "#2563eb" : "#e11d48";

  // guarda no aparelho quais cartas já saíram (vale pros dois)
  useEffect(() => {
    if (!state.used || !Object.keys(state.used).length) return;
    const mine = loadUsed();
    const merged = { ...mine };
    for (const [k, v] of Object.entries(state.used)) merged[k] = Array.from(new Set([...(mine[k] ?? []), ...v])).slice(-400);
    localStorage.setItem(USED_KEY, JSON.stringify(merged));
  }, [state.used]);

  useEffect(() => setGuessing(false), [state.round, state.phase]);

  // animação mostrando a sua carta no começo da rodada
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    if (state.phase !== "play" || !state.round) return;
    setReveal(true);
    const t = window.setTimeout(() => setReveal(false), 3200);
    return () => window.clearTimeout(t);
  }, [state.round, state.phase === "play"]); // eslint-disable-line react-hooks/exhaustive-deps

  // aviso de troca de vez
  const [turnFlash, setTurnFlash] = useState(0);
  useEffect(() => {
    if (state.phase !== "play") return;
    setTurnFlash(Date.now());
    const t = window.setTimeout(() => setTurnFlash(0), 1500);
    return () => window.clearTimeout(t);
  }, [state.turn]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = (theme: string) => {
    if (!peerOnline) return;
    const local = loadUsed();
    const used: Record<string, string[]> = { ...local };
    for (const [k, v] of Object.entries(state.used ?? {})) used[k] = Array.from(new Set([...(local[k] ?? []), ...v]));
    const { cards, used: nu } = drawCards(theme, used);
    const a = Math.floor(Math.random() * N);
    let b = Math.floor(Math.random() * N);
    while (b === a) b = Math.floor(Math.random() * N);
    setState({
      ...state,
      phase: "play",
      theme,
      cards,
      secret: { gu: a, li: b },
      down: { gu: [], li: [] },
      turn: Math.random() < 0.5 ? "gu" : "li",
      winner: null,
      lastGuess: null,
      used: nu,
      round: state.round + 1,
    });
  };

  const toggle = (i: number) => {
    if (guessing) {
      const ok = i === state.secret[other];
      setState((p) => ({
        ...p,
        phase: "end",
        winner: ok ? me : other,
        lastGuess: { by: me, idx: i, ok },
        score: { ...p.score, [ok ? me : other]: p.score[ok ? me : other] + 1 },
      }));
      return;
    }
    setState((p) => {
      const cur = p.down[me];
      const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i];
      return { ...p, down: { ...p.down, [me]: next } };
    });
  };

  const left = useMemo(() => N - (state.down[other]?.length ?? 0), [state.down, other]);
  const myLeft = N - (state.down[me]?.length ?? 0);
  const theme = THEMES.find((t) => t.id === state.theme);

  if (state.phase === "setup") {
    return (
      <div className="h-full overflow-y-auto p-4 pb-24">
        <div className="mb-4 text-center">
          <p className="text-lg font-bold">Quem sou eu?</p>
          <p className="text-xs text-white/60">
            Cada um recebe um personagem secreto. Façam perguntas de sim ou não no chat e abaixem as cartas até descobrir.
          </p>
          <p className="mt-1 text-[11px] text-white/40">As cartas nunca se repetem até acabar o tema.</p>
          {peerOnline ? (
            <p className="mt-2 text-[11px] text-emerald-300">{other === "gu" ? "bb gu" : "bb li"} está aqui! Escolham um tema.</p>
          ) : (
            <p className="mt-2 flex items-center justify-center gap-2 text-[11px] text-amber-300">
              <span className="h-2 w-2 animate-ping rounded-full bg-amber-300" />
              Esperando {other === "gu" ? "bb gu" : "bb li"} entrar no jogo pra começar
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              disabled={!peerOnline}
              onClick={() => start(t.id)}
              className="qse-pop rounded-2xl bg-gradient-to-br from-sky-600/80 to-rose-600/80 p-3 text-left shadow-lg transition active:scale-95 disabled:opacity-35 disabled:grayscale"
            >
              <p className="text-sm font-bold">{t.name}</p>
              <p className="text-[11px] text-white/70">{t.desc}</p>
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-white/50">
          Placar: bb gu {state.score.gu} x {state.score.li} bb li
        </p>
      </div>
    );
  }

  const secret = state.cards[state.secret[me]];
  const myTurn = state.turn === me;

  return (
    <div className="relative flex h-full flex-col">
      {reveal && secret && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-neutral-950/90 backdrop-blur-sm" onClick={() => setReveal(false)}>
          <p className="qse-pop mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-white/70">Seu personagem é</p>
          <div className="qse-reveal w-40 rounded-xl [perspective:800px]">
            <GameCard card={secret} color="#f59e0b" />
          </div>
          <p className="qse-pop mt-5 text-2xl font-black" style={{ animationDelay: ".8s" }}>{secret.name}</p>
          <p className="qse-pop mt-2 text-xs text-white/50" style={{ animationDelay: "1.1s" }}>Não deixa {other === "gu" ? "ele" : "ela"} ver!</p>
        </div>
      )}
      {!reveal && turnFlash > 0 && state.phase === "play" && (
        <div key={turnFlash} className="qse-pop pointer-events-none absolute inset-x-0 top-1/3 z-10 mx-auto w-fit rounded-2xl bg-black/80 px-5 py-3 text-lg font-black shadow-2xl">
          {myTurn ? "Sua vez!" : `Vez de ${state.turn === "gu" ? "bb gu" : "bb li"}`}
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-2 text-xs">
        <span className="rounded-full bg-white/10 px-2 py-0.5">{theme?.name}</span>
        <span className="text-white/60">
          bb gu {state.score.gu} x {state.score.li} bb li
        </span>
        <span className="ml-auto text-white/60">{other === "gu" ? "Ele" : "Ela"} tem {left} em pé</span>
      </div>

      {state.phase === "play" && (
        <div className={`mx-3 mb-2 rounded-xl px-3 py-2 text-center text-xs font-semibold ${guessing ? "bg-yellow-400 text-neutral-900" : myTurn ? "bg-emerald-500/25 text-emerald-200" : "bg-white/5 text-white/60"}`}>
          {guessing
            ? "Toque na carta que você acha que é a dele(a)"
            : myTurn
              ? "Sua vez: pergunte no chat e abaixe as cartas"
              : `Vez de ${state.turn === "gu" ? "bb gu" : "bb li"} perguntar`}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        <div
          className="grid grid-cols-6 gap-1.5 rounded-2xl p-2 sm:gap-2"
          style={{ background: `linear-gradient(180deg, ${color}33, ${color}66)`, boxShadow: `inset 0 -6px 0 ${color}` }}
        >
          {state.cards.map((c, i) => (
            <div key={state.round + "-" + i} className="qse-deal" style={{ animationDelay: `${i * 35}ms` }}>
            <GameCard
              key={state.round + "-" + i}
              card={c}
              color={color}
              down={state.down[me].includes(i) && state.phase === "play"}
              highlight={state.phase === "end" && i === state.secret[other]}
              onClick={state.phase === "play" ? () => toggle(i) : undefined}
            />
            </div>
          ))}
        </div>
      </div>

      {state.phase === "end" ? (
        <div className="border-t border-white/10 p-3 pb-6">
          <p className="text-center text-base font-bold">
            {state.winner === me ? "Você acertou!" : state.lastGuess?.by === me ? "Errou o chute..." : `${other === "gu" ? "bb gu" : "bb li"} ${state.lastGuess?.ok ? "acertou" : "errou"}!`}
          </p>
          <div className="mx-auto mt-2 flex max-w-xs justify-center gap-4">
            {(["gu", "li"] as Me[]).map((w) => (
              <div key={w} className="w-24 text-center">
                <GameCard card={state.cards[state.secret[w]]} color={w === "gu" ? "#2563eb" : "#e11d48"} />
                <p className="mt-1 text-[10px] text-white/60">de {w === "gu" ? "bb gu" : "bb li"}</p>
              </div>
            ))}
          </div>
          <button onClick={() => setState({ ...state, phase: "setup" })} className="mx-auto mt-3 flex items-center gap-2 rounded-full bg-pink-500 px-5 py-2 text-sm font-semibold">
            <RotateCcw size={15} /> Nova rodada
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-t border-white/10 p-2 pr-16">
          <div className="w-14 shrink-0">
            {showSecret ? (
              <GameCard card={secret} color="#f59e0b" />
            ) : (
              <div className="aspect-[3/4] w-full rounded-md bg-amber-500/30" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <button onClick={() => setShowSecret(!showSecret)} className="flex items-center gap-1 text-left text-[11px] text-white/60">
              {showSecret ? <EyeOff size={12} /> : <Eye size={12} />} Seu personagem {showSecret ? `(${secret?.name})` : "(escondido)"}
            </button>
            <p className="text-[10px] text-white/40">Você tem {myLeft} cartas em pé</p>
            <div className="flex gap-1.5">
              <button
                disabled={!myTurn}
                onClick={() => setState((p) => ({ ...p, turn: other }))}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-white/10 py-2 text-xs font-semibold disabled:opacity-40"
              >
                <ArrowRightLeft size={13} /> Passar a vez
              </button>
              <button
                disabled={!myTurn}
                onClick={() => setGuessing(!guessing)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold disabled:opacity-40 ${guessing ? "bg-yellow-400 text-neutral-900" : "bg-pink-500"}`}
              >
                <Target size={13} /> {guessing ? "Cancelar" : "Chutar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
