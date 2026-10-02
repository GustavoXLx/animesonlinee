import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CookingPot, Gauge, Pause, Play, RotateCcw, X } from "lucide-react";
import { useGameChannel, type Me } from "../useGameChannel";
import { LandscapeGate, enterLandscape } from "../Landscape";
import { applyAction, initialWorld } from "./recipes";
import { tickProcesses, maybeSpawnOrder, expireOrders } from "./recipes";
import type { EngineHandle, EngineHooks } from "./engine";
import type { ActMsg, HeldItem, PlayerMeta, PosMsg, SharedState, Stage, WorldSnapshot } from "./types";

const NAME: Record<Me, string> = { gu: "bb gu", li: "bb li" };
const other = (m: Me): Me => (m === "gu" ? "li" : "gu");
const DURATION = 180000;

const OUTFIT_COLORS = ["0xf59ac2", "0x7dd0e8", "0xffd36e", "0x9ed6a3", "0xc3a6f2", "0xff9e80"];
const HAIR_COLORS = ["0x3b2318", "0x6b4423", "0xd4a24e", "0x1a1a1a", "0xe0749b", "0x9e9e9e"];

const QUICK_MESSAGES = ["Me ajuda!", "Pega o queijo!", "Pedido pronto!", "Cuidado!"];

const END_MESSAGES = [
  "Vocês formaram uma dupla perfeita!",
  "Que cozinha sincronizada. Parabéns, time!",
  "Serviço encerrado com muita habilidade.",
  "Juntos vocês dominam qualquer receita.",
];

function loadMeta(me: Me): { outfit: string; hair: string } {
  try {
    const raw = localStorage.getItem(`cozinha-meta-${me}`);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { outfit: OUTFIT_COLORS[me === "gu" ? 1 : 0], hair: HAIR_COLORS[0] };
}
function saveMeta(me: Me, meta: { outfit: string; hair: string }) {
  try {
    localStorage.setItem(`cozinha-meta-${me}`, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

function initialShared(): SharedState {
  return {
    stage: "espera",
    seed: 1,
    startAt: null,
    duration: DURATION,
    pausedBy: null,
    players: {
      gu: { outfit: OUTFIT_COLORS[1], hair: HAIR_COLORS[0], ready: false },
      li: { outfit: OUTFIT_COLORS[0], hair: HAIR_COLORS[0], ready: false },
    },
    world: initialWorld(1),
  };
}

export function Cozinha({ me, onExit }: { me: Me; onExit: () => void }) {
  const { state, setState, peerOnline, sendEvent, onEvent } = useGameChannel<SharedState>(
    "cozinha",
    me,
    initialShared(),
  );
  const isHost = me === "gu";
  const [meta, setMeta] = useState(() => loadMeta(me));
  const [localReady, setLocalReady] = useState(false);
  const [world, setWorld] = useState<WorldSnapshot>(state.world);
  const [showFps, setShowFps] = useState(false);
  const [held, setHeld] = useState<HeldItem>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<{ who: Me; text: string; id: number }[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const worldRef = useRef<WorldSnapshot>(state.world);
  const lastTickRef = useRef(0);
  const joyTouchId = useRef<number | null>(null);
  const actTouchId = useRef<number | null>(null);
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyKnobRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    saveMeta(me, meta);
    sendEvent("meta", meta);
  }, [meta, me, sendEvent]);

  useEffect(
    () =>
      onEvent("meta", (data, from) => {
        const m = data as { outfit: string; hair: string };
        setState((p) => ({ ...p, players: { ...p.players, [from]: { ...p.players[from], ...m } } }));
      }),
    [onEvent, setState],
  );

  const broadcastWorld = (w: WorldSnapshot) => {
    worldRef.current = w;
    setWorld(w);
    sendEvent("world", w);
  };

  useEffect(
    () =>
      onEvent("world", (data) => {
        const w = data as WorldSnapshot;
        if (w.version <= worldRef.current.version) return;
        worldRef.current = w;
        setWorld(w);
      }),
    [onEvent],
  );

  // host loop: avança processos, gera/expira pedidos, decrementa tempo, transmite ~15Hz
  useEffect(() => {
    if (!isHost) return;
    if (state.stage !== "jogando") return;
    lastTickRef.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const dt = now - lastTickRef.current;
      lastTickRef.current = now;
      let w = worldRef.current;
      w = tickProcesses(w, now);
      w = maybeSpawnOrder(w, now, state.seed, DURATION - w.timeLeft);
      w = expireOrders(w, now);
      const timeLeft = Math.max(0, w.timeLeft - dt);
      w = { ...w, timeLeft, version: w.version + 1, ts: now };
      broadcastWorld(w);
      if (timeLeft <= 0) {
        setState((p) => ({ ...p, stage: "fim" }));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 66);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state.stage, state.seed]);

  // auto-pausa se o par sair durante o jogo
  useEffect(() => {
    if (!peerOnline && state.stage === "jogando") {
      setState((p) => (p.stage === "jogando" ? { ...p, stage: "pausa", pausedBy: me } : p));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerOnline]);

  const bothReady = state.players.gu.ready && state.players.li.ready;
  useEffect(() => {
    if (isHost && state.stage === "espera" && bothReady && peerOnline) {
      const seed = Math.floor(Math.random() * 1e6) + 1;
      const w0 = initialWorld(seed);
      worldRef.current = w0;
      setWorld(w0);
      setState((p) => ({ ...p, stage: "jogando", seed, startAt: Date.now(), world: w0 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state.stage, bothReady, peerOnline]);

  const showBubble = (who: Me, text: string) => {
    const id = Date.now() + Math.random();
    setBubbles((b) => [...b.slice(-4), { who, text, id }]);
    engineRef.current?.showBubble(who, text);
    window.setTimeout(() => setBubbles((b) => b.filter((x) => x.id !== id)), 2600);
  };

  useEffect(
    () =>
      onEvent("chat", (data, from) => {
        const c = data as { text: string };
        showBubble(from, c.text);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onEvent],
  );

  // engine phaser (SSR safe: só no cliente, dentro do effect)
  useEffect(() => {
    if (state.stage !== "jogando" && state.stage !== "pausa") return;
    let destroyed = false;
    let handle: EngineHandle | null = null;
    (async () => {
      if (!containerRef.current) return;
      const mod = await import("./engine");
      if (destroyed || !containerRef.current) return;

      const applyHostAction = (stationId: string, held: HeldItem, forPlayer: Me = "gu") => {
        const w = worldRef.current;
        const now = Date.now();
        const res = applyAction(w, stationId, held, now);
        if (!res) return null;
        const heldBy = { ...w.heldBy, [forPlayer]: res.held };
        const nextWorld: WorldSnapshot = { ...res.world, heldBy };
        broadcastWorld(nextWorld);
        return { world: nextWorld, held: res.held };
      };

      const hooks: EngineHooks = {
        me,
        isHost,
        getWorld: () => worldRef.current,
        getStage: () => stageRef.current,
        outfits: {
          gu: { outfit: state.players.gu.outfit, hair: state.players.gu.hair },
          li: { outfit: state.players.li.outfit, hair: state.players.li.hair },
        },
        sendPos: (p: PosMsg) => sendEvent("pos", p),
        onPos: (cb) => onEvent("pos", (d, from) => cb(d as PosMsg, from)),
        sendAct: (a: ActMsg) => {
          if (isHost) {
            const r = applyHostAction(a.stationId, a.held, me);
            void r;
          } else {
            sendEvent("act", a);
          }
        },
        onAct: (cb) => onEvent("act", (d, from) => cb(d as ActMsg, from)),
        applyHostAction,
        onWorldChanged: (w) => {
          worldRef.current = w;
          setWorld(w);
        },
        onHeldChanged: setHeld,
        onStationFocus: setFocus,
        get showFps() {
          return showFpsRef.current;
        },
      } as EngineHooks;

      handle = await mod.createCozinhaGame(containerRef.current, hooks);
      if (destroyed) {
        handle.destroy();
        return;
      }
      engineRef.current = handle;
    })();
    return () => {
      destroyed = true;
      engineRef.current?.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage === "jogando" || state.stage === "pausa"]);

  const stageRef = useRef<Stage>(state.stage);
  useEffect(() => {
    stageRef.current = state.stage;
  }, [state.stage]);
  const showFpsRef = useRef(showFps);
  useEffect(() => {
    showFpsRef.current = showFps;
  }, [showFps]);

  // teclado: Space/E para ação
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key.toLowerCase() === "e") {
        e.preventDefault();
        engineRef.current?.pressAction();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const togglePause = () => {
    if (state.stage === "jogando") setState((p) => ({ ...p, stage: "pausa", pausedBy: me }));
    else if (state.stage === "pausa") setState((p) => ({ ...p, stage: "jogando", pausedBy: null }));
  };

  const playAgain = () => {
    const fresh = initialShared();
    fresh.players[me] = { ...fresh.players[me], outfit: meta.outfit, hair: meta.hair };
    setState(fresh);
  };

  const setReady = () => {
    setLocalReady(true);
    setState((p) => ({ ...p, players: { ...p.players, [me]: { ...p.players[me], outfit: meta.outfit, hair: meta.hair, ready: true } } }));
  };

  // ============ joystick / botão virtual ============
  const handleJoyStart = (e: React.PointerEvent) => {
    joyTouchId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateJoystick(e.clientX, e.clientY);
  };
  const updateJoystick = (clientX: number, clientY: number) => {
    if (!joyBaseRef.current) return;
    const rect = joyBaseRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = (clientX - cx) / (rect.width * 0.38);
    let dy = (clientY - cy) / (rect.height * 0.38);
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    if (len < 0.12) { dx = 0; dy = 0; }
    if (joyKnobRef.current) joyKnobRef.current.style.transform = `translate(${dx * 26}px, ${dy * 26}px)`;
    engineRef.current?.setJoystick(dx, dy);
  };
  const handleJoyMove = (e: React.PointerEvent) => {
    if (joyTouchId.current !== e.pointerId) return;
    updateJoystick(e.clientX, e.clientY);
  };
  const handleJoyEnd = (e: React.PointerEvent) => {
    if (joyTouchId.current !== e.pointerId) return;
    joyTouchId.current = null;
    if (joyKnobRef.current) joyKnobRef.current.style.transform = "translate(0, 0)";
    engineRef.current?.setJoystick(0, 0);
  };
  const handleActDown = (e: React.PointerEvent) => {
    actTouchId.current = e.pointerId;
    engineRef.current?.pressAction();
  };
  const handleActUp = (e: React.PointerEvent) => {
    if (actTouchId.current !== e.pointerId) return;
    actTouchId.current = null;
  };

  const endMessage = useMemo(() => END_MESSAGES[Math.floor(Math.random() * END_MESSAGES.length)], [state.stage === "fim"]);
  const actionLabel = held ? "Colocar" : focus ? "Pegar" : "Ação";

  // ============ telas ============
  if (!localReady) {
    return (
      <LandscapeGate><div className="fixed inset-0 h-dvh w-screen overflow-y-auto flex flex-col items-center justify-center gap-4 p-4 text-center bg-background">
        <button type="button" onClick={onExit} aria-label="Sair da cozinha" className="absolute left-2 top-2 z-20 rounded-md bg-background/80 p-2 text-foreground border border-border">
          <X size={18} />
        </button>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Cozinha a Dois</p>
          <h3 className="mt-1 text-2xl font-black text-foreground">Prepare seu cozinheiro</h3>
        </div>
        <div className="flex flex-col gap-3 items-center">
          <p className="text-xs text-muted-foreground">Uniforme</p>
          <div className="flex gap-2 flex-wrap justify-center max-w-xs">
            {OUTFIT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setMeta((m) => ({ ...m, outfit: c }))}
                aria-label="Escolher cor do uniforme"
                className={`w-9 h-9 rounded-full border-2 ${meta.outfit === c ? "border-foreground" : "border-transparent"}`}
                style={{ backgroundColor: `#${c.slice(2)}` }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Cabelo</p>
          <div className="flex gap-2 flex-wrap justify-center max-w-xs">
            {HAIR_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setMeta((m) => ({ ...m, hair: c }))}
                aria-label="Escolher cor do cabelo"
                className={`w-9 h-9 rounded-full border-2 ${meta.hair === c ? "border-foreground" : "border-transparent"}`}
                style={{ backgroundColor: `#${c.slice(2)}` }}
              />
            ))}
          </div>
        </div>
        <button onClick={() => { void enterLandscape(); setReady(); }} className="rounded-md bg-primary px-6 py-3 font-bold text-primary-foreground mt-2 inline-flex items-center gap-2">
          <Check size={18} /> Entrar na cozinha
        </button>
      </div></LandscapeGate>
    );
  }

  if (state.stage === "espera" || !peerOnline) {
    return (
      <LandscapeGate><div className="fixed inset-0 h-dvh w-screen flex flex-col items-center justify-center p-8 text-center bg-background">
        <button type="button" onClick={onExit} aria-label="Sair da cozinha" className="absolute left-2 top-2 z-20 rounded-md bg-background/80 p-2 text-foreground border border-border">
          <X size={18} />
        </button>
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <CookingPot className="text-primary" />
        </div>
        <p className="font-semibold text-foreground">esperando {NAME[other(me)]}...</p>
        <p className="text-xs text-muted-foreground mt-1">
          {state.players[me].ready ? "você já está pronto(a)!" : "escolha o look e aperte pronto"}
        </p>
      </div></LandscapeGate>
    );
  }

  if (state.stage === "fim") {
    return (
      <LandscapeGate><div className="fixed inset-0 h-dvh w-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-background">
        <button type="button" onClick={onExit} aria-label="Sair da cozinha" className="absolute left-2 top-2 z-20 rounded-md bg-background/80 p-2 text-foreground border border-border">
          <X size={18} />
        </button>
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Fim do turno</p>
        <p className="text-3xl font-black text-foreground">{world.score} pontos</p>
        <p className="text-lg text-muted-foreground max-w-sm">{endMessage}</p>
        <button onClick={playAgain} className="rounded-md bg-primary px-6 py-3 font-bold text-primary-foreground mt-2 inline-flex items-center gap-2">
          <RotateCcw size={18} /> Jogar de novo
        </button>
      </div></LandscapeGate>
    );
  }

  // jogando / pausa
  return (
    <LandscapeGate><div className="fixed inset-0 h-dvh w-screen bg-neutral-950 select-none overflow-hidden touch-none">
      <div ref={containerRef} className="absolute inset-0 h-full w-full overflow-hidden bg-neutral-950 [&>canvas]:block" />

      {/* topo: pausa + fps */}
      <div className="absolute top-2 right-2 flex gap-2 z-20">
        <button type="button" onClick={onExit} aria-label="Sair da cozinha" className="bg-background/80 text-foreground rounded-md p-1.5 border border-border">
          <X size={15} />
        </button>
        <button
          onClick={() => setShowFps((v) => !v)}
          aria-label="Mostrar desempenho"
          className="bg-background/80 text-muted-foreground text-[10px] rounded-md px-2 py-1 border border-border"
        >
          <Gauge size={15} />
        </button>
        <button aria-label={state.stage === "pausa" ? "Continuar" : "Pausar"} onClick={togglePause} className="bg-background/80 text-foreground rounded-md p-1.5 border border-border">
          {state.stage === "pausa" ? <Play size={15} /> : <Pause size={15} />}
        </button>
      </div>

      {/* bolhas de chat (fallback fora do canvas, em telas pequenas) */}
      <div className="absolute top-2 left-2 flex flex-col gap-1 z-20 pointer-events-none">
        {bubbles.map((b) => (
            <div key={b.id} className="bg-card/95 text-card-foreground text-[11px] rounded-md px-2 py-1 max-w-[160px] border border-border">
            <b>{b.who === me ? "você" : NAME[b.who]}:</b> {b.text}
          </div>
        ))}
      </div>

      {/* mensagens rápidas */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-20 flex-wrap justify-center max-w-[90%]">
        {QUICK_MESSAGES.map((m) => (
          <button
            key={m}
            onClick={() => {
              sendEvent("chat", { text: m });
              showBubble(me, m);
            }}
            className="bg-background/80 text-foreground text-[10px] rounded-md px-2.5 py-1.5 border border-border"
          >
            {m}
          </button>
        ))}
      </div>

      {/* joystick virtual (mobile) */}
      <div
        ref={joyBaseRef}
        onPointerDown={handleJoyStart}
        onPointerMove={handleJoyMove}
        onPointerUp={handleJoyEnd}
        onPointerCancel={handleJoyEnd}
        onPointerLeave={handleJoyEnd}
        className="absolute left-[max(1.25rem,env(safe-area-inset-left))] bottom-[max(1.25rem,env(safe-area-inset-bottom))] w-24 h-24 rounded-full bg-background/35 border-2 border-foreground/20 z-20 touch-none backdrop-blur-sm grid place-items-center"
      ><div ref={joyKnobRef} className="w-11 h-11 rounded-full bg-foreground/65 shadow-lg pointer-events-none transition-transform duration-75" /></div>

      {/* botão de ação (mobile) */}
      <button
        onPointerDown={handleActDown}
        onPointerUp={handleActUp}
        onPointerCancel={handleActUp}
        className="absolute right-[max(1.25rem,env(safe-area-inset-right))] bottom-[max(1.25rem,env(safe-area-inset-bottom))] w-20 h-20 rounded-full bg-primary active:bg-primary/80 text-primary-foreground text-xs font-bold z-20 touch-none border-4 border-primary-foreground/20 shadow-xl"
      >
        {actionLabel}
      </button>

      {state.stage === "pausa" && (
        <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center gap-3 z-30">
          <p className="text-foreground text-xl font-bold">Pausado</p>
          {state.pausedBy && <p className="text-muted-foreground text-sm">por {NAME[state.pausedBy]}</p>}
          <button onClick={togglePause} className="rounded-md bg-primary px-5 py-2 font-bold text-primary-foreground inline-flex items-center gap-2">
            <Play size={17} />
            Continuar
          </button>
        </div>
      )}
    </div></LandscapeGate>
  );
}
