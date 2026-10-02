import { useEffect, useMemo, useRef, useState } from "react";
import { useGameChannel, type Me } from "../useGameChannel";
import { applyAction, initialWorld } from "./recipes";
import { tickProcesses, maybeSpawnOrder, expireOrders } from "./recipes";
import type { EngineHandle, EngineHooks } from "./engine";
import type { ActMsg, HeldItem, PlayerMeta, PosMsg, SharedState, Stage, WorldSnapshot } from "./types";

const NAME: Record<Me, string> = { gu: "bb gu", li: "bb li" };
const other = (m: Me): Me => (m === "gu" ? "li" : "gu");
const DURATION = 180000;

const OUTFIT_COLORS = ["0xf59ac2", "0x7dd0e8", "0xffd36e", "0x9ed6a3", "0xc3a6f2", "0xff9e80"];
const HAIR_COLORS = ["0x3b2318", "0x6b4423", "0xd4a24e", "0x1a1a1a", "0xe0749b", "0x9e9e9e"];

const QUICK_MESSAGES = ["Me ajuda!", "Pega o queijo!", "Pedido pronto!", "Cuidado! 😂"];

const END_MESSAGES = [
  "Vocês são uma dupla perfeita! ❤️",
  "Que cozinha mais sincronizada, parabéns time! 🍳",
  "Com vocês dois até a cozinha pega fogo (de amor) 😍",
  "Juntos vocês conseguem qualquer receita da vida 💞",
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

export function Cozinha({ me }: { me: Me }) {
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
  const [bubbles, setBubbles] = useState<{ who: Me; text: string; id: number }[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const worldRef = useRef<WorldSnapshot>(state.world);
  const lastTickRef = useRef(0);
  const joyTouchId = useRef<number | null>(null);
  const actTouchId = useRef<number | null>(null);
  const joyBaseRef = useRef<HTMLDivElement | null>(null);

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
        onHeldChanged: () => {},
        onStationFocus: () => {},
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
  };
  const handleJoyMove = (e: React.PointerEvent) => {
    if (joyTouchId.current !== e.pointerId || !joyBaseRef.current) return;
    const rect = joyBaseRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = (e.clientX - cx) / (rect.width / 2);
    let dy = (e.clientY - cy) / (rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    engineRef.current?.setJoystick(dx, dy);
  };
  const handleJoyEnd = (e: React.PointerEvent) => {
    if (joyTouchId.current !== e.pointerId) return;
    joyTouchId.current = null;
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

  // ============ telas ============
  if (!localReady) {
    return (
      <div className="h-full overflow-y-auto flex flex-col items-center justify-center gap-5 p-6 text-center bg-gradient-to-b from-rose-950 to-neutral-950">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-rose-300/80">Cozinha a Dois</p>
          <h3 className="mt-1 text-2xl font-black text-white">Escolha seu look</h3>
        </div>
        <div className="flex flex-col gap-3 items-center">
          <p className="text-xs text-white/60">Roupa</p>
          <div className="flex gap-2 flex-wrap justify-center max-w-xs">
            {OUTFIT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setMeta((m) => ({ ...m, outfit: c }))}
                className={`w-9 h-9 rounded-full border-2 ${meta.outfit === c ? "border-white" : "border-transparent"}`}
                style={{ backgroundColor: `#${c.slice(2)}` }}
              />
            ))}
          </div>
          <p className="text-xs text-white/60 mt-2">Cabelo</p>
          <div className="flex gap-2 flex-wrap justify-center max-w-xs">
            {HAIR_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setMeta((m) => ({ ...m, hair: c }))}
                className={`w-9 h-9 rounded-full border-2 ${meta.hair === c ? "border-white" : "border-transparent"}`}
                style={{ backgroundColor: `#${c.slice(2)}` }}
              />
            ))}
          </div>
        </div>
        <button onClick={setReady} className="rounded-full bg-rose-500 px-6 py-3 font-bold text-white mt-2">
          Pronto(a)!
        </button>
      </div>
    );
  }

  if (state.stage === "espera" || !peerOnline) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-neutral-950">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
        </div>
        <p className="font-semibold text-white">esperando {NAME[other(me)]}...</p>
        <p className="text-xs text-white/50 mt-1">
          {state.players[me].ready ? "você já está pronto(a)!" : "escolha o look e aperte pronto"}
        </p>
      </div>
    );
  }

  if (state.stage === "fim") {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center bg-gradient-to-b from-rose-950 to-neutral-950">
        <p className="text-xs uppercase tracking-[0.3em] text-rose-300/70">Fim de turno</p>
        <p className="text-3xl font-black text-white">{world.score} pontos</p>
        <p className="text-lg text-rose-200 max-w-sm">{endMessage}</p>
        <button onClick={playAgain} className="rounded-full bg-rose-500 px-6 py-3 font-bold text-white mt-2">
          Jogar de novo
        </button>
      </div>
    );
  }

  // jogando / pausa
  return (
    <div className="relative h-full w-full bg-neutral-950 select-none overflow-hidden touch-none">
      <div ref={containerRef} className="w-full h-full flex items-center justify-center" />

      {/* topo: pausa + fps */}
      <div className="absolute top-2 right-2 flex gap-2 z-20">
        <button
          onClick={() => setShowFps((v) => !v)}
          className="bg-black/50 text-white/70 text-[10px] rounded-full px-2 py-1"
        >
          FPS
        </button>
        <button onClick={togglePause} className="bg-black/50 text-white text-xs rounded-full px-3 py-1">
          {state.stage === "pausa" ? "▶" : "⏸"}
        </button>
      </div>

      {/* bolhas de chat (fallback fora do canvas, em telas pequenas) */}
      <div className="absolute top-2 left-2 flex flex-col gap-1 z-20 pointer-events-none">
        {bubbles.map((b) => (
          <div key={b.id} className="bg-white/90 text-rose-900 text-[11px] rounded-xl px-2 py-1 max-w-[160px]">
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
            className="bg-rose-500/80 hover:bg-rose-500 text-white text-[10px] rounded-full px-2.5 py-1.5"
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
        className="absolute left-4 bottom-20 w-24 h-24 rounded-full bg-white/10 border border-white/20 z-20 touch-none md:hidden"
      />

      {/* botão de ação (mobile) */}
      <button
        onPointerDown={handleActDown}
        onPointerUp={handleActUp}
        onPointerCancel={handleActUp}
        className="absolute right-4 bottom-20 w-16 h-16 rounded-full bg-rose-500/80 active:bg-rose-500 text-white font-bold z-20 touch-none md:hidden"
      >
        Ação
      </button>

      {state.stage === "pausa" && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 z-30">
          <p className="text-white text-xl font-bold">Pausado</p>
          {state.pausedBy && <p className="text-white/60 text-sm">por {NAME[state.pausedBy]}</p>}
          <button onClick={togglePause} className="rounded-full bg-rose-500 px-5 py-2 font-bold text-white">
            Continuar
          </button>
        </div>
      )}
    </div>
  );
}
