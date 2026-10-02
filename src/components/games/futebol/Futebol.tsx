import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useGameChannel, type Me } from "../useGameChannel";
import { footSpot, solve, tally, timeline, type Dive, type Foot, type Kick, type Mode, type Shot } from "./sim";
import { LandscapeGate, enterLandscape } from "@/components/games/Landscape";
import { LookEditor } from "@/components/avatar/LookEditor";
import { DEFAULT_LOOKS, sanitizeLook, type Look } from "@/lib/look";

const FutebolScene = lazy(() => import("./FutebolScene"));

type St = {
  mode: Mode | null;
  first: Me;
  kicks: Kick[];
  kickId: number;
  shot: Shot | null;
  seed: number;
};
const init: St = { mode: null, first: "gu", kicks: [], kickId: 0, shot: null, seed: 1 };
const NAME: Record<Me, string> = { gu: "bb gu", li: "bb li" };
const MODEL: Record<Me, string> = { gu: "male-c", li: "female-a" };
const other = (w: Me): Me => (w === "gu" ? "li" : "gu");

const RESULT_TXT = { goal: "GOOOOL!", save: "DEFENDEU!", wall: "NA BARREIRA!", miss: "PRA FORA!", post: "NA TRAVE!" };
const MAX_YAW = (Math.PI / 180) * 60;

export function Futebol({ me }: { me: Me }) {
  return (
    <LandscapeGate>
      <FutebolInner me={me} />
    </LandscapeGate>
  );
}

function FutebolInner({ me }: { me: Me }) {
  const { state, setState, peerOnline, sendEvent, onEvent } = useGameChannel<St>("futebol3d", me, init);
  const kicker: Me = state.kickId % 2 === 0 ? state.first : other(state.first);
  const keeperWho = other(kicker);
  const iKick = kicker === me;
  const spot = useMemo(() => (state.mode === "falta" ? footSpot(state.seed, Math.floor(state.kickId / 2)) : { x: 0, z: 11 }), [state.mode, state.seed, state.kickId]);
  const t = tally(state.kicks, state.first);

  const [aim, setAim] = useState({ x: 2.2, y: 1.2 });
  const [curve, setCurve] = useState(0);
  const [foot, setFoot] = useState<Foot>("direita");
  const [power, setPower] = useState(0);
  const [charging, setCharging] = useState(false);
  const [waitingKeeper, setWaitingKeeper] = useState(false);
  const [myDive, setMyDive] = useState<Dive | null>(null);
  const [overlay, setOverlay] = useState<{ txt: string; good: boolean } | null>(null);
  const [replay, setReplay] = useState(false);
  const [orbitMode, setOrbitMode] = useState(false);
  const [camYaw, setCamYaw] = useState(0);
  const [showLook, setShowLook] = useState(false);
  const diveRef = useRef<{ id: number; d: Dive } | null>(null);
  const startRef = useRef(0);
  const shotKey = useRef("");
  const timersRef = useRef<number[]>([]);
  const finishRef = useRef<(() => void) | null>(null);

  /* ---------- visual (looks compartilhados) ---------- */
  const [looks, setLooks] = useState<Record<Me, Look>>({ gu: DEFAULT_LOOKS.gu, li: DEFAULT_LOOKS.li });
  const [draftLook, setDraftLook] = useState<Look>(() => DEFAULT_LOOKS[me]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`anistream-futebol-look-${me}`);
      const l = sanitizeLook(raw ? JSON.parse(raw) : null, me);
      setDraftLook(l);
      setLooks((p) => ({ ...p, [me]: l }));
    } catch {}
  }, [me]);
  useEffect(() => onEvent("look", (d) => {
    const v = d as { who: Me; look: Look };
    setLooks((p) => ({ ...p, [v.who]: sanitizeLook(v.look, v.who) }));
  }), [onEvent]);
  const saveLook = (l: Look) => {
    setDraftLook(l);
    setLooks((p) => ({ ...p, [me]: l }));
    try { localStorage.setItem(`anistream-futebol-look-${me}`, JSON.stringify(l)); } catch {}
    sendEvent("look", { who: me, look: l });
  };

  // novo chute: zera tudo
  useEffect(() => {
    setMyDive(null);
    setPower(0);
    setFoot("direita");
    setCurve(-0.35);
    setAim({ x: state.mode === "falta" ? (spot.x >= 0 ? -2.3 : 2.3) : 2.2, y: state.mode === "falta" ? 1.9 : 1.1 });
    setWaitingKeeper(false);
    setOrbitMode(false);
    setCamYaw(0);
  }, [state.kickId, state.mode, spot.x]);

  const toggleFoot = (f: Foot) => {
    setFoot(f);
    // curva natural segue o pé: destro curva da direita p/ esquerda, canhoto o contrário
    setCurve(f === "direita" ? -0.35 : 0.35);
  };

  useEffect(() => onEvent("dive", (d) => {
    const v = d as { id: number; d: Dive };
    diveRef.current = v;
  }), [onEvent]);

  const skipReplay = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setOverlay(null);
    setReplay(false);
    finishRef.current?.();
    finishRef.current = null;
  };

  // chute recebido: inicia relógio, avisos e avanço
  useEffect(() => {
    const s = state.shot;
    if (!s) return;
    const key = `${state.kickId}:${s.seed}`;
    if (shotKey.current === key) return;
    shotKey.current = key;
    startRef.current = performance.now();
    const sol = solve(s);
    const tl = timeline(sol);
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setOverlay({ txt: RESULT_TXT[sol.result], good: sol.result === "goal" }), (0.95 + sol.flight + 0.15) * 1000));
    timers.push(window.setTimeout(() => setOverlay(null), (tl.live + 0.5) * 1000));
    if (tl.reps) {
      timers.push(window.setTimeout(() => setReplay(true), (tl.live + 0.6) * 1000));
      timers.push(window.setTimeout(() => setReplay(false), (tl.total - 0.5) * 1000));
    }
    const id = state.kickId;
    const finish = () => {
      if (!iKick) return;
      setState((p) => (p.kickId !== id ? p : { ...p, kicks: [...p.kicks, { who: kicker, goal: sol.result === "goal" }], kickId: id + 1, shot: null }));
    };
    finishRef.current = finish;
    if (iKick) timers.push(window.setTimeout(finish, tl.total * 1000));
    timersRef.current = timers;
    return () => {
      timers.forEach(clearTimeout);
      setReplay(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.shot]);

  // barra de força
  useEffect(() => {
    if (!charging) return;
    const t0 = performance.now();
    let raf = 0;
    const loop = () => {
      const x = ((performance.now() - t0) / 1100) % 2;
      setPower(x < 1 ? x : 2 - x);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [charging]);

  const fire = async () => {
    if (!charging) return;
    setCharging(false);
    const pw = Math.max(0.12, power);
    let dive: Dive | null = null;
    if (state.mode === "penalti") {
      setWaitingKeeper(true);
      const until = Date.now() + 6000;
      while (Date.now() < until && diveRef.current?.id !== state.kickId) await new Promise((r) => setTimeout(r, 120));
      setWaitingKeeper(false);
      dive = diveRef.current?.id === state.kickId ? diveRef.current.d : { x: 0, high: false };
    }
    const shot: Shot = {
      mode: state.mode!,
      sx: spot.x,
      sz: spot.z,
      tx: aim.x,
      ty: aim.y,
      power: +pw.toFixed(3),
      curve: state.mode === "falta" ? curve : 0,
      foot,
      seed: (Math.random() * 1e9) | 0,
      dive,
    };
    setState((p) => (p.shot ? p : { ...p, shot }));
  };

  const pickDive = (d: Dive) => {
    if (myDive || state.shot) return;
    setMyDive(d);
    sendEvent("dive", { id: state.kickId, d });
  };

  const start = (mode: Mode) => {
    void enterLandscape();
    setState({ mode, first: Math.random() < 0.5 ? "gu" : "li", kicks: [], kickId: 0, shot: null, seed: (Math.random() * 1e6) | 0 });
  };

  /* ---------- menu ---------- */
  if (!state.mode) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 bg-gradient-to-b from-emerald-950 to-neutral-950 p-6 text-center">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">Futebol 3D</p>
          <h3 className="mt-1 text-3xl font-black">Escolha a disputa</h3>
          <p className="mt-2 text-sm text-white/60">5 cobranças para cada. Empatou? Vai para as alternadas.</p>
        </div>
        <div className="grid w-full max-w-md gap-3">
          {(
            [
              ["penalti", "Pênaltis", "Quem não bate vira goleiro e escolhe o canto."],
              ["falta", "Faltas", "Barreira, mira, força e efeito na bola."],
            ] as const
          ).map(([k, n, d]) => (
            <button
              key={k}
              disabled={!peerOnline}
              onClick={() => start(k)}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition hover:scale-[1.02] hover:bg-white/10 disabled:opacity-40"
            >
              <p className="text-xl font-bold">{n}</p>
              <p className="text-sm text-white/60">{d}</p>
            </button>
          ))}
        </div>
        <button onClick={() => setShowLook(true)} className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-bold hover:bg-white/20">
          Visual
        </button>
        {!peerOnline && <p className="text-sm text-amber-300">Esperando {NAME[other(me)]} entrar no jogo…</p>}
        {showLook && (
          <div className="fixed inset-0 z-[80] flex flex-col bg-neutral-950/95 p-3">
            <div className="flex shrink-0 items-center justify-between pb-2">
              <p className="text-sm font-bold text-white/80">Seu visual em campo</p>
              <button onClick={() => setShowLook(false)} className="rounded-full bg-pink-500 px-4 py-1.5 text-sm font-black">
                Salvar e fechar
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <LookEditor look={draftLook} onChange={saveLook} />
            </div>
          </div>
        )}
      </div>
    );
  }

  const dots = (w: Me) => {
    const mine = state.kicks.filter((k) => k.who === w);
    const n = Math.max(5, Math.ceil(state.kicks.length / 2) + 1);
    return Array.from({ length: t.sudden ? mine.length + (t.over ? 0 : 1) : n }, (_, i) => mine[i]).slice(t.sudden ? -6 : 0);
  };

  const aiming = !state.shot && !t.over;
  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-neutral-950">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-white/60">Carregando estádio…</div>}>
        <FutebolScene
          mode={state.mode}
          spot={spot}
          kickerModel={MODEL[kicker]}
          keeperModel={state.mode === "penalti" ? MODEL[keeperWho] : "male-a"}
          kickerLook={looks[kicker]}
          keeperLook={state.mode === "penalti" ? looks[keeperWho] : undefined}
          view={iKick ? "kicker" : state.mode === "penalti" ? "keeper" : "watch"}
          shot={state.shot}
          startRef={startRef}
          aim={aim}
          curve={curve}
          foot={foot}
          camYaw={camYaw}
          orbitMode={orbitMode}
          onOrbit={setCamYaw}
          onAim={(x, y) => setAim({ x, y })}
        />
      </Suspense>

      {/* placar compacto */}
      <div className="pointer-events-none absolute inset-x-0 top-1 flex justify-center">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-3 py-1 backdrop-blur">
          {(["gu", "li"] as Me[]).map((w, i) => (
            <div key={w} className={`flex items-center gap-1.5 ${i ? "flex-row-reverse" : ""}`}>
              <span className={`text-xs font-bold ${kicker === w && !t.over ? "text-pink-300" : "text-white/80"}`}>{NAME[w]}</span>
              <div className="flex gap-0.5">
                {dots(w).map((k, j) => (
                  <span key={j} className={`h-2 w-2 rounded-full ${k === undefined ? "bg-white/20" : k.goal ? "bg-emerald-400" : "bg-red-500"}`} />
                ))}
              </div>
              <span className="w-4 text-center text-base font-black tabular-nums">{t.score[w]}</span>
            </div>
          ))}
        </div>
      </div>
      {t.sudden && !t.over && <p className="pointer-events-none absolute inset-x-0 top-8 text-center text-[10px] font-bold uppercase tracking-widest text-amber-300">Alternadas</p>}

      {replay && (
        <>
          <div className="pointer-events-none absolute left-2 top-10 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-0.5 text-xs font-black tracking-widest">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> REPLAY
          </div>
          <button onClick={skipReplay} className="absolute right-2 top-10 rounded-md bg-black/70 px-3 py-1 text-xs font-bold text-white/90 hover:bg-black/90">
            Pular ▶
          </button>
        </>
      )}
      {overlay && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className={`animate-scale-in text-5xl font-black italic drop-shadow-[0_6px_20px_rgba(0,0,0,0.8)] ${overlay.good ? "text-emerald-300" : "text-white"}`}>{overlay.txt}</p>
        </div>
      )}

      {/* controles do batedor: pé e câmera na borda esquerda, força na direita */}
      {aiming && iKick && (
        <>
          <div className="absolute inset-y-0 left-1 flex flex-col justify-center gap-2">
            {state.mode === "falta" && (
              <div className="flex flex-col gap-1 rounded-xl bg-black/50 p-1.5">
                <span className="text-center text-[9px] text-white/60">Perna</span>
                <button onClick={() => toggleFoot("esquerda")} className={`rounded-lg px-2 py-1 text-[10px] font-bold ${foot === "esquerda" ? "bg-pink-500" : "bg-white/10"}`}>
                  Esquerda
                </button>
                <button onClick={() => toggleFoot("direita")} className={`rounded-lg px-2 py-1 text-[10px] font-bold ${foot === "direita" ? "bg-pink-500" : "bg-white/10"}`}>
                  Direita
                </button>
              </div>
            )}
            {state.mode === "falta" && (
              <button
                onClick={() => setOrbitMode((v) => !v)}
                className={`rounded-xl px-2 py-1.5 text-[10px] font-bold ${orbitMode ? "bg-emerald-500" : "bg-white/10"}`}
              >
                {orbitMode ? "Câmera" : "Mirar"}
              </button>
            )}
          </div>
          {state.mode === "falta" && (
            <div className="absolute left-1/2 top-1 -translate-x-1/2 flex items-center gap-1.5 rounded-xl bg-black/50 px-2 py-1 text-[10px]">
              <span className="text-white/60">Efeito</span>
              <input type="range" min={-1} max={1} step={0.05} value={curve} onChange={(e) => setCurve(+e.target.value)} className="w-24 accent-pink-500" />
              <span className="w-8 tabular-nums">{curve > 0.05 ? "→" : curve < -0.05 ? "←" : "reto"}</span>
            </div>
          )}
          <div className="absolute inset-y-0 right-1 flex flex-col items-center justify-center gap-2">
            <p className="max-w-[90px] text-center text-[9px] text-white/70">{waitingKeeper ? `Esperando ${NAME[keeperWho]}…` : orbitMode ? "Arraste p/ girar câmera" : "Arraste no gol p/ mirar"}</p>
            <div className="relative h-28 w-4 overflow-hidden rounded-full bg-white/10">
              <div className="absolute bottom-0 w-full rounded-full bg-gradient-to-t from-emerald-400 via-yellow-300 to-red-500" style={{ height: `${power * 100}%` }} />
            </div>
            <button
              disabled={waitingKeeper}
              onPointerDown={() => setCharging(true)}
              onPointerUp={fire}
              onPointerLeave={fire}
              className="rounded-full bg-pink-500 px-4 py-2.5 text-[11px] font-black uppercase tracking-wide shadow-lg shadow-pink-500/30 active:scale-95 disabled:opacity-50"
            >
              Chutar
            </button>
          </div>
        </>
      )}

      {/* goleiro humano */}
      {aiming && !iKick && state.mode === "penalti" && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black/80 to-transparent p-2 pb-3">
          <p className="text-[11px] text-white/80">{myDive ? "Canto escolhido. Agora reza!" : `Você é o goleiro. Escolha onde pular antes de ${NAME[kicker]} chutar`}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {[true, false].flatMap((high) =>
              // câmera do goleiro olha para o batedor: esquerda da tela = +x do mundo
              ([1, 0, -1] as const).map((x) => {
                const sel = myDive && myDive.x === x && myDive.high === high;
                return (
                  <button
                    key={`${x}${high}`}
                    disabled={!!myDive}
                    onClick={() => pickDive({ x, high })}
                    className={`h-10 w-16 rounded-lg border text-[10px] font-bold transition ${sel ? "border-pink-400 bg-pink-500/60" : "border-white/20 bg-white/10 hover:bg-white/20"} disabled:cursor-default`}
                  >
                    {x === 0 ? "Meio" : x === 1 ? "Esquerda" : "Direita"} {high ? "alto" : "baixo"}
                  </button>
                );
              }),
            )}
          </div>
        </div>
      )}
      {aiming && !iKick && state.mode === "falta" && (
        <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs text-white/80">{NAME[kicker]} está ajeitando a bola…</p>
      )}

      {t.over && !state.shot && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-white/60">Fim de jogo</p>
          <p className="animate-scale-in text-5xl font-black text-pink-300">{NAME[t.winner!]} venceu!</p>
          <p className="text-2xl font-bold tabular-nums">
            {t.score.gu} x {t.score.li}
          </p>
          <div className="flex gap-2">
            <button onClick={() => start(state.mode!)} className="rounded-full bg-pink-500 px-5 py-2 font-bold">
              Revanche
            </button>
            <button onClick={() => setState(init)} className="rounded-full bg-white/10 px-5 py-2 font-bold">
              Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
