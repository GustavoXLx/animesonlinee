import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Timer } from "lucide-react";
import { useGameChannel, type Me } from "../useGameChannel";
import { LookEditor } from "@/components/avatar/LookEditor";
import { DEFAULT_LOOKS, describeLook, sanitizeLook, type Look } from "@/lib/look";
import { judgeFashion, type FashionVerdict } from "@/lib/chat.functions";
import { FASHION_THEMES } from "./themes";
import { LandscapeGate, enterLandscape } from "@/components/games/Landscape";
import { FINAL_AT, INTRO, SHOW_LEN, SLOT } from "./DesfileScene";

const DesfileScene = lazy(() => import("./DesfileScene"));

type Phase = "lobby" | "dress" | "judging" | "show";
type St = {
  ready: Record<Me, boolean>;
  phase: Phase;
  round: number;
  theme: string;
  endsAt: number;
  subs: Partial<Record<Me, Look>>;
  order: Me[];
  poses: Record<Me, number>;
  verdict: FashionVerdict | null;
  showAt: number;
  wins: Record<Me, number>;
  used: number[];
  error: string;
};
const init: St = { ready: { gu: false, li: false }, phase: "lobby", round: 0, theme: "", endsAt: 0, subs: {}, order: ["gu", "li"], poses: { gu: 0, li: 1 }, verdict: null, showAt: 0, wins: { gu: 0, li: 0 }, used: [], error: "" };
const NAME: Record<Me, string> = { gu: "bb gu", li: "bb li" };
const DRESS_SECS = 150;
const other = (w: Me): Me => (w === "gu" ? "li" : "gu");

export function Desfile({ me }: { me: Me }) {
  return (
    <LandscapeGate>
      <DesfileInner me={me} />
    </LandscapeGate>
  );
}

function DesfileInner({ me }: { me: Me }) {
  const { state, setState, peerOnline, sendEvent, onEvent } = useGameChannel<St>("desfile", me, init);
  const host = me === "gu";
  const judge = useServerFn(judgeFashion);
  const [draft, setDraft] = useState<Look>(() => DEFAULT_LOOKS[me]);
  const [now, setNow] = useState(Date.now());
  const startRef = useRef(0);
  const judging = useRef(-1);
  const starting = useRef(false);

  // rascunho salvo no aparelho
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`anistream-desfile-${me}`);
      if (raw) setDraft(sanitizeLook(JSON.parse(raw), me));
    } catch {}
  }, [me]);
  useEffect(() => {
    try {
      localStorage.setItem(`anistream-desfile-${me}`, JSON.stringify(draft));
    } catch {}
  }, [draft, me]);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  // anfitrião recebe o look da outra pessoa
  useEffect(
    () =>
      onEvent("submit", (d) => {
        if (!host) return;
        const v = d as { round: number; look: Look };
        setState((p) => (p.phase !== "dress" || p.round !== v.round ? p : { ...p, subs: { ...p.subs, li: sanitizeLook(v.look, "li") } }));
      }),
    [onEvent, host, setState],
  );

  const submitted = !!state.subs[me];
  const submit = () => {
    if (state.phase !== "dress" || submitted) return;
    if (host) setState((p) => ({ ...p, subs: { ...p.subs, gu: draft } }));
    else {
      sendEvent("submit", { round: state.round, look: draft });
      // reenvia até aparecer no estado (mensagens podem se perder)
      let n = 0;
      const iv = setInterval(() => {
        if (++n > 8) return clearInterval(iv);
        sendEvent("submit", { round: state.round, look: draft });
      }, 1500);
      setTimeout(() => clearInterval(iv), 13000);
    }
  };

  // tempo acabou: entrega automática
  const left = Math.max(0, Math.ceil((state.endsAt - now) / 1000));
  useEffect(() => {
    if (state.phase === "dress" && left === 0 && !submitted) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, state.phase]);

  // anfitrião: quando os dois entregaram, chama os jurados
  useEffect(() => {
    if (!host) return;
    if (state.phase === "dress" && state.subs.gu && state.subs.li) setState((p) => ({ ...p, phase: "judging", error: "" }));
  }, [host, state.phase, state.subs, setState]);

  const runJudge = async () => {
    const s = state;
    if (!s.subs.gu || !s.subs.li) return;
    judging.current = s.round;
    const r = await judge({ data: { theme: s.theme, gu: describeLook(s.subs.gu), li: describeLook(s.subs.li) } }).catch(() => ({ verdict: null, error: "Sem conexão com os jurados." }));
    if (!r.verdict) {
      setState((p) => ({ ...p, error: r.error ?? "Erro" }));
      return;
    }
    const v = r.verdict;
    setState((p) =>
      p.round !== s.round
        ? p
        : {
            ...p,
            phase: "show",
            verdict: v,
            showAt: Date.now() + 600,
            order: Math.random() < 0.5 ? ["gu", "li"] : ["li", "gu"],
            poses: { gu: (Math.random() * 4) | 0, li: (Math.random() * 4) | 0 },
            wins: { ...p.wins, [v.winner]: p.wins[v.winner] + 1 },
          },
    );
  };
  useEffect(() => {
    if (host && state.phase === "judging" && !state.error && judging.current !== state.round) void runJudge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, state.phase, state.round, state.error]);

  // relógio do desfile sincronizado pelo horário
  useEffect(() => {
    if (state.phase === "show") startRef.current = performance.now() - (Date.now() - state.showAt);
  }, [state.phase, state.showAt]);

  useEffect(() => {
    if (!host || state.phase !== "lobby" || !state.ready.gu || !state.ready.li || starting.current) return;
    starting.current = true;
    newRound();
  }, [host, state.phase, state.ready.gu, state.ready.li]);

  const toggleReady = () => {
    if (!peerOnline && me === "gu") return;
    setState((p) => ({ ...p, ready: { ...p.ready, [me]: !p.ready[me] } }));
  };

  const newRound = () => {
    const pool = FASHION_THEMES.map((_, i) => i).filter((i) => !state.used.includes(i));
    const list = pool.length ? pool : FASHION_THEMES.map((_, i) => i);
    const idx = list[(Math.random() * list.length) | 0];
    setState((p) => ({
      ...p,
      phase: "dress",
      round: p.round + 1,
      theme: FASHION_THEMES[idx],
      endsAt: Date.now() + DRESS_SECS * 1000,
      subs: {},
      verdict: null,
      error: "",
      used: pool.length ? [...p.used, idx] : [idx],
      ready: { gu: false, li: false },
    }));
  };

  /* ---------- telas ---------- */
  if (state.phase === "lobby") {
    return (
      <div className="fixed inset-0 flex min-h-0 flex-col items-center justify-start overflow-y-auto bg-[#09070d] p-4 text-center text-white sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(236,72,153,.28),transparent_35%),radial-gradient(circle_at_10%_80%,rgba(168,85,247,.18),transparent_30%)]" />
        <div className="relative z-10 my-auto w-full max-w-4xl py-4">
          <div className="mb-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.35em] text-pink-200/70"><Sparkles size={14} /> Fashion Week</div>
          <h3 className="text-4xl font-black italic sm:text-6xl">DESFILE</h3>
          <p className="mx-auto mt-2 max-w-lg text-xs text-white/50 sm:text-sm">Monte o look, encare o tema e leve sua criação para a passarela.</p>
          <div className="mt-6 grid gap-3 md:grid-cols-[1fr_1.35fr_1fr]">
            {(["gu","li"] as Me[]).map((w) => {
              const online = w === me || peerOnline;
              const done = !!state.subs[w];
              return (
                <div key={w} className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 text-left shadow-2xl backdrop-blur-xl">
                  <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">{w === me ? "Você" : "Parceiro"}</span><span className={online ? "h-2 w-2 rounded-full bg-emerald-400" : "h-2 w-2 rounded-full bg-white/20"} /></div>
                  <div className="mt-3 flex items-center gap-3"><div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-pink-400/10 text-xl">👗</div><div><p className="font-black">{NAME[w]}</p><p className="text-[10px] text-white/40">{online ? "Na sala" : "Aguardando"}</p></div></div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5"><div className={done ? "h-full w-full rounded-full bg-emerald-400" : online ? "h-full w-1/2 rounded-full bg-pink-400" : "h-full w-1/5 rounded-full bg-white/10"} /></div>
                </div>
              );
            })}
            <div className="order-first rounded-3xl border border-pink-300/20 bg-gradient-to-br from-pink-500/15 to-transparent p-5 shadow-2xl backdrop-blur-xl md:order-none">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] border border-pink-200/20 bg-pink-400/10"><Sparkles size={34} className="text-pink-200" /></div>
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.22em] text-pink-200/60">Próxima rodada</p><p className="mt-1 text-lg font-black">Tema surpresa</p><p className="mt-1 text-[10px] text-white/40">O tema é revelado quando vocês começarem.</p>
            </div>
          </div>
          <div className="mx-auto mt-4 grid max-w-2xl grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3"><p className="text-sm font-black">150s</p><p className="text-[9px] uppercase tracking-wider text-white/35">para criar</p></div>
            <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3"><p className="text-sm font-black">IA</p><p className="text-[9px] uppercase tracking-wider text-white/35">como jurada</p></div>
            <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3"><p className="text-sm font-black">{state.wins.gu + state.wins.li}</p><p className="text-[9px] uppercase tracking-wider text-white/35">vitórias na sala</p></div>
          </div>
          <button onClick={() => { void enterLandscape(); toggleReady(); }} disabled={!peerOnline && me === "gu"} className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 px-9 py-3.5 text-sm font-black shadow-xl transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"><Sparkles size={17} /> {state.ready[me] ? "Você está pronto!" : "Estou pronto(a)!"}</button>
          <p className="mt-3 text-xs font-medium text-amber-300">{peerOnline ? (state.ready.gu && state.ready.li ? "Os dois estão prontos. Iniciando…" : state.ready[other(me)] ? `${NAME[other(me)]} está pronto(a). Marque seu pronto!` : "Aguardando os dois jogadores ficarem prontos.") : "Aguardando bb li entrar na sala…"}</p>
        </div>
      </div>
    );
  }
  if (state.phase === "dress" || state.phase === "judging") {
    const partnerDone = !!state.subs[other(me)];
    return (
      <div className="fixed inset-0 flex min-h-0 flex-col gap-2 overflow-hidden bg-gradient-to-b from-fuchsia-950/60 to-neutral-950 p-3 text-white">
        <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-pink-200/70">Tema da rodada {state.round}</p>
            <p className="truncate text-xl font-black">{state.theme}</p>
          </div>
          {state.phase === "dress" ? (
            <div className={`flex items-center gap-1 rounded-full px-3 py-1 font-mono text-lg font-bold ${left <= 15 ? "animate-pulse bg-red-500/80" : "bg-white/10"}`}>
              <Timer size={16} /> {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
            </div>
          ) : null}
        </div>
        {state.phase === "judging" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <Sparkles className="animate-spin text-pink-300" size={42} style={{ animationDuration: "3s" }} />
            <p className="text-2xl font-black">Os jurados estão avaliando…</p>
            {state.error && (
              <>
                <p className="text-sm text-red-300">{state.error}</p>
                {host && (
                  <button onClick={() => setState((p) => ({ ...p, error: "" }))} className="rounded-full bg-pink-500 px-5 py-2 font-bold" onMouseUp={() => (judging.current = -1)}>
                    Tentar de novo
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl">
              <LookEditor landscape look={draft} onChange={(l) => !submitted && setDraft(l)} />
            </div>
            <div className="flex shrink-0 items-center gap-2 pb-[env(safe-area-inset-bottom)]">
              <p className="flex-1 text-xs text-white/60">{partnerDone ? `${NAME[other(me)]} já está pronto(a)!` : `${NAME[other(me)]} está se arrumando…`}</p>
              <button disabled={submitted} onClick={submit} className="rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 px-6 py-2.5 font-black disabled:opacity-50">
                {submitted ? "Look entregue" : "Estou pronto(a)!"}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // desfile
  const v = state.verdict!;
  const looks = { gu: state.subs.gu ?? DEFAULT_LOOKS.gu, li: state.subs.li ?? DEFAULT_LOOKS.li };
  const t = (now - state.showAt) / 1000;
  const slot = t >= INTRO && t < FINAL_AT ? Math.floor((t - INTRO) / SLOT) : -1;
  const walking = slot >= 0 ? state.order[slot] : null;
  const revealed = t > FINAL_AT + 2.5;
  const done = t > SHOW_LEN;
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-white/60">Montando a passarela…</div>}>
        <DesfileScene looks={looks} order={state.order} winner={v.winner} theme={state.theme} startRef={startRef} poses={state.poses} />
      </Suspense>
      {t < INTRO && t > 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="animate-fade-in text-xs uppercase tracking-[0.5em] text-pink-200">Agora na passarela</p>
          <p className="animate-scale-in text-5xl font-black italic drop-shadow-[0_4px_20px_rgba(236,72,153,0.7)]">{state.theme}</p>
        </div>
      )}
      {walking && (
        <div key={walking} className="pointer-events-none absolute bottom-8 left-4 animate-slide-in-right">
          <div className="border-l-4 border-pink-500 bg-black/70 px-4 py-2 backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.3em] text-pink-200">desfilando</p>
            <p className="text-2xl font-black">{NAME[walking]}</p>
          </div>
        </div>
      )}
      {revealed && !done && (
        <div className="pointer-events-none absolute inset-x-0 top-6 flex flex-col items-center">
          <p className="text-xs uppercase tracking-[0.4em] text-yellow-200">Vencedor(a) da noite</p>
          <p className="animate-scale-in text-5xl font-black text-yellow-300 drop-shadow-[0_4px_24px_rgba(250,204,21,0.6)]">{NAME[v.winner]}</p>
        </div>
      )}
      {done && (
        <div className="absolute inset-0 overflow-y-auto overscroll-contain bg-black/70 p-4 backdrop-blur-sm" style={{ touchAction: "pan-y" }}>
          <div className="mx-auto my-auto w-full max-w-md animate-scale-in space-y-3 rounded-3xl border border-white/10 bg-neutral-950/90 p-5">
            <p className="text-center text-xs uppercase tracking-[0.3em] text-white/50">{state.theme}</p>
            <p className="text-center text-3xl font-black text-yellow-300">{NAME[v.winner]} venceu!</p>
            {(["gu", "li"] as Me[]).map((w) => (
              <div key={w} className={`rounded-2xl p-3 ${w === v.winner ? "bg-yellow-400/10 ring-1 ring-yellow-300/50" : "bg-white/5"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold">{NAME[w]}</span>
                  <span className="text-2xl font-black tabular-nums">{v[w].score.toFixed(1)}</span>
                </div>
                <p className="mt-1 text-sm text-white/70">{v[w].comment}</p>
              </div>
            ))}
            {v.summary && <p className="text-center text-sm italic text-pink-200">{v.summary}</p>}
            <p className="text-center text-sm text-white/60">
              Placar: {NAME.gu} {state.wins.gu} x {state.wins.li} {NAME.li}
            </p>
            <div className="flex gap-2">
              <button onClick={newRound} className="flex-1 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 py-2.5 font-black">
                Próximo tema
              </button>
              <button onClick={() => (startRef.current = performance.now())} className="rounded-full bg-white/10 px-4 text-sm" onMouseDown={() => setState((p) => ({ ...p, showAt: Date.now() }))}>
                Rever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
