import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Timer } from "lucide-react";
import { useGameChannel, type Me } from "../useGameChannel";
import { LookEditor } from "@/components/avatar/LookEditor";
import { DEFAULT_LOOKS, describeLook, sanitizeLook, type Look } from "@/lib/look";
import { judgeFashion, type FashionVerdict } from "@/lib/chat.functions";
import { FASHION_THEMES } from "./themes";
import { FINAL_AT, INTRO, SHOW_LEN, SLOT } from "./DesfileScene";

const DesfileScene = lazy(() => import("./DesfileScene"));

type Phase = "lobby" | "dress" | "judging" | "show";
type St = {
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
const init: St = { phase: "lobby", round: 0, theme: "", endsAt: 0, subs: {}, order: ["gu", "li"], poses: { gu: 0, li: 1 }, verdict: null, showAt: 0, wins: { gu: 0, li: 0 }, used: [], error: "" };
const NAME: Record<Me, string> = { gu: "bb gu", li: "bb li" };
const DRESS_SECS = 150;
const other = (w: Me): Me => (w === "gu" ? "li" : "gu");

export function Desfile({ me }: { me: Me }) {
  const { state, setState, peerOnline, sendEvent, onEvent } = useGameChannel<St>("desfile", me, init);
  const host = me === "gu";
  const judge = useServerFn(judgeFashion);
  const [draft, setDraft] = useState<Look>(() => DEFAULT_LOOKS[me]);
  const [now, setNow] = useState(Date.now());
  const startRef = useRef(0);
  const judging = useRef(-1);

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
    }));
  };

  /* ---------- telas ---------- */
  if (state.phase === "lobby") {
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-6 overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#831843_0%,#1e1b4b_45%,#09090b_100%)] p-6 text-center">
        <div className="absolute inset-x-0 top-0 h-40 animate-pulse bg-[conic-gradient(from_180deg_at_50%_0%,transparent,rgba(255,255,255,0.12),transparent)]" />
        <p className="text-xs uppercase tracking-[0.4em] text-pink-200/80">Fashion Week do casal</p>
        <h3 className="text-4xl font-black italic">Desfile</h3>
        <p className="max-w-sm text-sm text-white/70">
          Um tema aparece, cada um monta o look em {DRESS_SECS / 60 > 2 ? "2min30" : `${DRESS_SECS}s`} e vocês desfilam na passarela. Os jurados de IA escolhem quem arrasou.
        </p>
        <p className="text-sm text-white/60">
          Placar: {NAME.gu} {state.wins.gu} x {state.wins.li} {NAME.li}
        </p>
        <button disabled={!peerOnline} onClick={newRound} className="rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 px-8 py-3 text-lg font-black shadow-xl shadow-pink-500/30 transition hover:scale-105 disabled:opacity-40">
          Sortear tema
        </button>
        {!peerOnline && <p className="text-sm text-amber-300">Esperando {NAME[other(me)]} entrar…</p>}
      </div>
    );
  }

  if (state.phase === "dress" || state.phase === "judging") {
    const partnerDone = !!state.subs[other(me)];
    return (
      <div className="flex h-full flex-col gap-2 bg-gradient-to-b from-fuchsia-950/60 to-neutral-950 p-3">
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
            <div className="min-h-0 flex-1">
              <LookEditor look={draft} onChange={(l) => !submitted && setDraft(l)} />
            </div>
            <div className="flex shrink-0 items-center gap-2">
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
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-scale-in space-y-3 rounded-3xl border border-white/10 bg-neutral-950/90 p-5">
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
