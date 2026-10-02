import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Gauge, Goal, Radio, Shield, Trophy } from "lucide-react";
import { useGameChannel, type Me } from "../useGameChannel";
import { footSpot, solve, tally, timeline, type Dive, type Kick, type Mode, type Shot } from "./sim";

const FutebolScene = lazy(() => import("./FutebolScene"));

type St = {
  mode: Mode | null;
  first: Me;
  kicks: Kick[];
  kickId: number;
  shot: Shot | null;
  seed: number;
  skins: Record<Me, "default" | "neymar">;
};
const init: St = { mode: null, first: "gu", kicks: [], kickId: 0, shot: null, seed: 1, skins: { gu: "default", li: "default" } };
const NAME: Record<Me, string> = { gu: "bb gu", li: "bb li" };
const MODEL: Record<Me, string> = { gu: "male-c", li: "female-a" };
const other = (w: Me): Me => (w === "gu" ? "li" : "gu");

const RESULT_TXT = { goal: "GOOOOL!", save: "DEFENDEU!", wall: "NA BARREIRA!", miss: "PRA FORA!", post: "NA TRAVE!" };

export function Futebol({ me }: { me: Me }) {
  const { state, setState, peerOnline, sendEvent, onEvent } = useGameChannel<St>("futebol3d", me, init);
  const kicker: Me = state.kickId % 2 === 0 ? state.first : other(state.first);
  const keeperWho = other(kicker);
  const iKick = kicker === me;
  const spot = useMemo(() => (state.mode === "falta" ? footSpot(state.seed, Math.floor(state.kickId / 2)) : { x: 0, z: 11 }), [state.mode, state.seed, state.kickId]);
  const t = tally(state.kicks, state.first);

  const [aim, setAim] = useState({ x: 2.2, y: 1.2 });
  const [curve, setCurve] = useState(0);
  const [power, setPower] = useState(0);
  const [charging, setCharging] = useState(false);\n  const powerRaf = useRef(0);\n  const powerRef = useRef(0);\n  const powerBarRef = useRef<HTMLDivElement>(null);
  const [waitingKeeper, setWaitingKeeper] = useState(false);
  const [myDive, setMyDive] = useState<Dive | null>(null);
  const [overlay, setOverlay] = useState<{ txt: string; good: boolean } | null>(null);
  const [replay, setReplay] = useState(false);
  const [mySkin, setMySkin] = useState<"default" | "neymar">(state.skins?.[me] ?? "default");
  const diveRef = useRef<{ id: number; d: Dive } | null>(null);
  const startRef = useRef(0);
  const shotKey = useRef("");

  // novo chute: zera tudo
  useEffect(() => {
    setMyDive(null);
    setPower(0);
    setCurve(0);
    setAim({ x: state.mode === "falta" ? (spot.x >= 0 ? -2.3 : 2.3) : 2.2, y: state.mode === "falta" ? 1.9 : 1.1 });
    setWaitingKeeper(false);
  }, [state.kickId, state.mode, spot.x]);

  useEffect(() => onEvent("dive", (d) => {
    const v = d as { id: number; d: Dive };
    diveRef.current = v;
  }), [onEvent]);

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
    if (iKick) {
      const id = state.kickId;
      timers.push(
        window.setTimeout(() => {
          setState((p) => (p.kickId !== id ? p : { ...p, kicks: [...p.kicks, { who: kicker, goal: sol.result === "goal" }], kickId: id + 1, shot: null }));
        }, tl.total * 1000),
      );
    }
    return () => {
      timers.forEach(clearTimeout);
      setReplay(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.shot]);

  // barra de força: animação visual fora do React para evitar re-render a cada frame.
  useEffect(() => {
    if (!charging) return;
    const t0 = performance.now();
    const loop = () => {
      const x = ((performance.now() - t0) / 1100) % 2;
      const value = x < 1 ? x : 2 - x;
      powerRef.current = value;
      setPower(value);
      if (powerBarRef.current) powerBarRef.current.style.width = (value * 100) + "%";
      powerRaf.current = requestAnimationFrame(loop);
    };
    powerRaf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(powerRaf.current);
  }, [charging]);

  const fire = async () => {
    if (!charging) return;
    setCharging(false);
    const pw = Math.max(0.12, powerRef.current || power);
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

  const selectSkin = (skin: "default" | "neymar") => {
    setMySkin(skin);
    setState((p) => ({ ...p, skins: { ...(p.skins ?? { gu: "default", li: "default" }), [me]: skin } }));
  };

  const start = (mode: Mode) => {
    if (!peerOnline) return;
    setState((p) => ({ ...p, mode, first: Math.random() < 0.5 ? "gu" : "li", kicks: [], kickId: 0, shot: null, seed: (Math.random() * 1e6) | 0 }));
  };

  /* ---------- menu ---------- */
  if (!state.mode) {
    const connected = peerOnline;
    return (
      <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-[#06120d] p-5 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,197,94,.24),transparent_34%),radial-gradient(circle_at_85%_75%,rgba(16,185,129,.12),transparent 30%)]" />
        <div className="relative z-10 w-full max-w-4xl">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.35em] text-emerald-300/70"><Radio className="h-4 w-4" strokeWidth={2.4} /> FUTEBOL 3D</div>
          <h3 className="mt-2 text-4xl font-black italic sm:text-6xl">DUELO DE CRAQUES</h3>
          <p className="mx-auto mt-2 max-w-xl text-xs text-white/50 sm:text-sm">Escolha a disputa e enfrente seu parceiro em uma série de cobranças.</p>
          <div className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.045] p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div><p className="text-xs font-black uppercase tracking-[0.22em] text-white/80">Sua skin</p><p className="mt-1 text-[10px] text-white/40">Escolha o visual antes da partida.</p></div>
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-amber-200">Fã edition</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["default", "neymar"] as const).map((skin) => (
                <button key={skin} onClick={() => selectSkin(skin)} className={mySkin === skin ? "rounded-2xl border border-amber-300/50 bg-amber-300/10 p-3 text-left ring-1 ring-amber-300/20" : "rounded-2xl border border-white/10 bg-black/20 p-3 text-left transition hover:bg-white/[0.06]"}>
                  <div className="flex items-center gap-3">
                    <div className={skin === "neymar" ? "relative h-16 w-14 shrink-0 overflow-hidden rounded-xl border border-yellow-300/30 bg-gradient-to-b from-yellow-300/30 to-green-900/60" : "relative h-16 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-slate-300/20 to-slate-950/60"}>
                      <div className={skin === "neymar" ? "absolute left-1/2 top-2 h-5 w-5 -translate-x-1/2 rounded-full bg-amber-700 ring-2 ring-black/20 after:absolute after:-inset-1 after:rounded-full after:bg-amber-950/80 after:-z-10" : "absolute left-1/2 top-2 h-5 w-5 -translate-x-1/2 rounded-full bg-amber-700"} />
                      <div className={skin === "neymar" ? "absolute left-1/2 top-7 h-6 w-8 -translate-x-1/2 rounded-t-lg bg-yellow-300" : "absolute left-1/2 top-7 h-6 w-8 -translate-x-1/2 rounded-t-lg bg-slate-100"} />
                      <div className={skin === "neymar" ? "absolute left-1/2 top-[3.1rem] h-4 w-7 -translate-x-1/2 rounded-b-md bg-green-900" : "absolute left-1/2 top-[3.1rem] h-4 w-7 -translate-x-1/2 rounded-b-md bg-slate-900"} />
                    </div>
                    <div><p className="text-xs font-black">{skin === "neymar" ? "Neymar — 10" : "Craque clássico"}</p><p className="mt-1 text-[9px] text-white/40">{skin === "neymar" ? "Visual inspirado no craque" : "Uniforme padrão"}</p></div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {[
              ["penalti","PÊNALTIS","goal","Escolha o canto e tente adivinhar o salto do goleiro.","5 cobranças por jogador"],
              ["falta","FALTAS","crosshair","Mire, controle a força e coloque efeito na bola.","Curva + potência + precisão"],
            ].map(([k,n,icon,d,tag]) => (
              <button key={k} onClick={() => start(k as Mode)} disabled={!connected} className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.055] p-5 text-left shadow-2xl backdrop-blur-xl transition hover:-translate-y-1 hover:border-emerald-300/30 disabled:opacity-35">
                <div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xl font-black text-white/80">{icon === "goal" ? <Goal className="h-5 w-5" /> : <Crosshair className="h-5 w-5" />}</span><span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[9px] font-black uppercase text-emerald-200">{tag}</span></div>
                <p className="mt-5 text-xl font-black">{n}</p><p className="mt-1 text-xs leading-relaxed text-white/50">{d}</p>
                <div className="mt-4 text-[10px] font-bold text-white/35">● 2 jogadores • online</div>
              </button>
            ))}
          </div>
          <div className="mx-auto mt-4 grid max-w-2xl grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-center"><p className="text-xs font-black">{NAME.gu}</p><p className="text-[9px] uppercase text-white/35">Jogador 1</p></div>
            <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-center"><p className="text-xs font-black">{NAME.li}</p><p className="text-[9px] uppercase text-white/35">Jogador 2</p></div>
            <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-center"><p className="text-xs font-black">5</p><p className="text-[9px] uppercase text-white/35">Rodadas</p></div>
          </div>
          <div className={connected ? "mx-auto mt-4 flex w-fit items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-[10px] font-bold text-emerald-200" : "mx-auto mt-4 flex w-fit items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-[10px] font-bold text-amber-200"}><span className={connected ? "h-2 w-2 rounded-full bg-emerald-400 animate-pulse" : "h-2 w-2 rounded-full bg-amber-400"} />{connected ? "Os dois jogadores estão conectados — partida liberada" : "Aguardando " + NAME[other(me)] + " entrar na sala…"}</div>
        </div>
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
          kickerSkin={state.skins?.[kicker] ?? "default"}
          keeperSkin={state.skins?.[keeperWho] ?? "default"}
          view={iKick ? "kicker" : state.mode === "penalti" ? "keeper" : "watch"}
          shot={state.shot}
          startRef={startRef}
          aim={aim}
          curve={curve}
          power={power}
          onAim={(x, y) => setAim({ x, y })}
        />
      </Suspense>

      {/* placar */}
      <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-4 py-2 backdrop-blur">
          {(["gu", "li"] as Me[]).map((w, i) => (
            <div key={w} className={`flex items-center gap-2 ${i ? "flex-row-reverse" : ""}`}>
              <span className={`text-sm font-bold ${kicker === w && !t.over ? "text-pink-300" : "text-white/80"}`}>{NAME[w]}</span>
              <div className="flex gap-1">
                {dots(w).map((k, j) => (
                  <span key={j} className={`h-2.5 w-2.5 rounded-full ${k === undefined ? "bg-white/20" : k.goal ? "bg-emerald-400" : "bg-red-500"}`} />
                ))}
              </div>
              <span className="w-5 text-center text-xl font-black tabular-nums">{t.score[w]}</span>
            </div>
          ))}
        </div>
      </div>
      {t.sudden && !t.over && <p className="pointer-events-none absolute inset-x-0 top-14 text-center text-xs font-bold uppercase tracking-widest text-amber-300">Alternadas</p>}

      {replay && (
        <div className="pointer-events-none absolute left-3 top-16 flex items-center gap-2 rounded-md bg-black/60 px-3 py-1 text-sm font-black tracking-widest">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" /> REPLAY
        </div>
      )}
      {overlay && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className={`animate-scale-in text-6xl font-black italic drop-shadow-[0_6px_20px_rgba(0,0,0,0.8)] ${overlay.good ? "text-emerald-300" : "text-white"}`}>{overlay.txt}</p>
        </div>
      )}

      {/* controles do batedor */}
      {aiming && iKick && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black/85 via-black/55 to-transparent p-3 pb-4">
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/50 px-4 py-2 text-center backdrop-blur">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">1 • MIRE</span>
            <span className="text-[10px] text-white/45">Arraste o alvo dentro do gol</span>
          </div>
          {state.mode === "falta" && (
            <div className="rounded-full border border-white/10 bg-black/45 px-4 py-2 text-center backdrop-blur">
              <span className="text-[10px] font-black uppercase tracking-widest text-pink-300">2 • EFEITO</span>
              <span className="ml-2 text-[10px] text-white/45">Arraste a mira para escolher onde a bola vai passar</span>
            </div>
          )}
          <div className="flex w-full max-w-md flex-col gap-2">
            <div className="flex items-center justify-between px-1 text-[10px] font-black uppercase tracking-wider">
              <span className="text-white/45">3 • POTÊNCIA</span>
              <span className={power > 0.88 ? "text-red-300" : power > 0.55 ? "text-yellow-200" : "text-emerald-300"}>{Math.round(power * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
                <div ref={powerBarRef} className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-yellow-300 to-red-500" style={{ width: `${power * 100}%` }} />
                <div className="absolute inset-y-0 left-[55%] w-px bg-white/50" />
                <div className="absolute inset-y-0 left-[85%] w-px bg-white/50" />
              </div>
              <button disabled={waitingKeeper} onPointerDown={() => setCharging(true)} onPointerUp={fire} onPointerLeave={fire} className="rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 px-7 py-3 text-xs font-black uppercase tracking-wide shadow-lg shadow-pink-950/40 transition active:scale-95 disabled:opacity-40">
                {charging ? "Solte!" : "Segure para chutar"}
              </button>
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-[10px] text-white/35"><Crosshair className="h-3 w-3" /> Arraste a mira dentro do gol para escolher altura e canto. <Gauge className="ml-1 h-3 w-3" /> Use a força para definir a velocidade.</p>
        </div>
      )}

      {/* goleiro humano */}
      {aiming && !iKick && state.mode === "penalti" && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black/80 to-transparent p-3 pb-4">
          <p className="flex items-center gap-2 text-xs text-white/80"><Shield className="h-4 w-4 text-emerald-300" />{myDive ? "Canto escolhido. Aguarde a cobrança." : `Você é o goleiro. Escolha onde pular antes de ${NAME[kicker]} chutar`}</p>
          <div className="grid grid-cols-3 gap-2">
            {[true, false].flatMap((high) =>
              // câmera do goleiro olha para o batedor: esquerda da tela = +x do mundo
              ([1, 0, -1] as const).map((x) => {
                const sel = myDive && myDive.x === x && myDive.high === high;
                return (
                  <button
                    key={`${x}${high}`}
                    disabled={!!myDive}
                    onClick={() => pickDive({ x, high })}
                    className={`h-12 w-20 rounded-xl border text-xs font-bold transition ${sel ? "border-pink-400 bg-pink-500/60" : "border-white/20 bg-white/10 hover:bg-white/20"} disabled:cursor-default`}
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
        <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm text-white/80">{NAME[kicker]} está ajeitando a bola…</p>
      )}

      {t.over && !state.shot && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.3em] text-white/60"><Trophy className="h-4 w-4" /> Fim de jogo</div>
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
