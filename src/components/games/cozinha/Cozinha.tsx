import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChefHat, CookingPot, Gauge, Palette, Pause, Play, RotateCcw, Shirt, Sparkles, Users, Wifi, X, Clock3 } from "lucide-react";
import { useGameChannel, type Me } from "../useGameChannel";
import { LandscapeGate, enterLandscape } from "../Landscape";
import { applyAction, initialWorld, DISH_LABEL, ITEM_LABEL, RECIPE_NEEDS } from "./recipes";
import { tickProcesses, maybeSpawnOrder, expireOrders } from "./recipes";
import type { EngineHandle, EngineHooks } from "./engine";
import type { ActMsg, Dish, HeldItem, PlayerMeta, PosMsg, SharedState, Stage, WorldSnapshot } from "./types";

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
  const startGame = () => {
    if (!isHost || state.stage !== "espera" || !bothReady || !peerOnline) return;
    const seed = Math.floor(Math.random() * 1e6) + 1;
    const w0 = initialWorld(seed);
    worldRef.current = w0;
    setWorld(w0);
    setState((p) => ({ ...p, stage: "jogando", seed, startAt: Date.now(), world: w0 }));
  };

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
  const isDish = (item: HeldItem): item is Dish => item === "hamburguer" || item === "sanduiche" || item === "pizza" || item === "cupcake" || item === "suco";
  const actionLabel = held && focus === "entrega" && isDish(held)
    ? "ENTREGAR"
    : focus?.startsWith("tabua") && !held
      ? "CORTAR"
      : held
        ? "COLOCAR"
        : focus
          ? "PEGAR"
          : "AÇÃO";

  // ============ telas ============
  if (state.stage === "espera") {
    const outfitNames: Record<string, string> = {
      "0xf59ac2": "Rosa chef",
      "0x7dd0e8": "Azul céu",
      "0xffd36e": "Amarelo sol",
      "0x9ed6a3": "Verde menta",
      "0xc3a6f2": "Lilás",
      "0xff9e80": "Coral",
    };
    const hairNames: Record<string, string> = {
      "0x3b2318": "Castanho",
      "0x6b4423": "Chocolate",
      "0xd4a24e": "Dourado",
      "0x1a1a1a": "Preto",
      "0xe0749b": "Rosa",
      "0x9e9e9e": "Prateado",
    };

    return (
      <LandscapeGate>
        <div className="fixed inset-0 h-dvh w-screen overflow-y-auto bg-[#17131a] text-white">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-pink-500/20 blur-3xl animate-pulse" />
            <div className="absolute -right-20 top-1/4 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl animate-pulse [animation-delay:700ms]" />
            <div className="absolute left-1/3 -bottom-32 h-96 w-96 rounded-full bg-amber-300/10 blur-3xl animate-pulse [animation-delay:1200ms]" />
            <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)", backgroundSize: "34px 34px" }} />
          </div>

          <button
            type="button"
            onClick={onExit}
            aria-label="Sair da cozinha"
            className="absolute left-4 top-4 z-30 rounded-2xl border border-white/10 bg-black/30 p-2.5 text-white/80 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>

          <div className="relative z-10 mx-auto flex min-h-full w-full max-w-6xl flex-col justify-center gap-4 px-4 py-6 md:px-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-amber-200/80">
                  <ChefHat size={14} />
                  Cozinha a Dois
                </div>
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl md:text-4xl">
                  Monte sua dupla de chefs
                </h2>
                <p className="mt-1 max-w-xl text-xs text-white/55 sm:text-sm">
                  Escolha seu estilo, confira seu parceiro e entre quando estiver pronto para o turno.
                </p>
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-2 text-[10px] font-bold text-emerald-200 sm:flex">
                <Wifi size={13} />
                Sala online
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto pb-1 lg:grid-cols-[1.15fr_.85fr] lg:overflow-visible">
              <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.055] p-4 shadow-2xl backdrop-blur-xl sm:p-5">
                <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-pink-400/10 blur-3xl" />
                <div className="relative flex h-full min-h-[250px] flex-col">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Seu chef</p>
                      <p className="mt-1 text-lg font-black">{NAME[me]}</p>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-2.5 text-pink-200">
                      <Sparkles size={18} />
                    </div>
                  </div>

                  <div className="my-4 flex flex-1 items-center justify-center">
                    <div className="relative">
                      <div className="absolute -inset-8 rounded-full bg-pink-400/10 blur-2xl animate-pulse" />
                      <div className="relative flex h-32 w-32 flex-col items-center justify-center rounded-[34px] border border-white/15 shadow-2xl transition duration-500 hover:scale-105" style={{ background: `linear-gradient(145deg, #${meta.outfit.slice(2)} 0%, #241b25 100%)` }}>
                        <div className="absolute -top-5 h-14 w-20 rounded-full border-4 border-white/20 bg-black/25" style={{ boxShadow: `inset 0 0 0 8px #${meta.hair.slice(2)}` }} />
                        <ChefHat size={35} className="relative mt-1 text-white drop-shadow-lg" />
                        <span className="mt-1 text-[10px] font-black text-white/80">CHEF</span>
                      </div>
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[10px] font-bold text-white/80 backdrop-blur">
                        {outfitNames[meta.outfit] ?? "Seu uniforme"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/45">
                        <Shirt size={13} /> Uniforme
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {OUTFIT_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setMeta((m) => ({ ...m, outfit: c }))}
                            aria-label={`Escolher ${outfitNames[c] ?? "uniforme"}`}
                            className={`group relative h-10 rounded-xl border-2 transition duration-200 hover:-translate-y-0.5 hover:scale-105 ${meta.outfit === c ? "border-white shadow-lg shadow-white/10" : "border-white/5"}`}
                            style={{ background: `linear-gradient(145deg, #${c.slice(2)}, #1d1720)` }}
                          >
                            {meta.outfit === c && <Check size={15} className="absolute right-1 top-1 text-white drop-shadow" />}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/45">
                        <Palette size={13} /> Cabelo
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {HAIR_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setMeta((m) => ({ ...m, hair: c }))}
                            aria-label={`Escolher cabelo ${hairNames[c] ?? "personalizado"}`}
                            className={`group relative h-10 rounded-xl border-2 transition duration-200 hover:-translate-y-0.5 hover:scale-105 ${meta.hair === c ? "border-white shadow-lg shadow-white/10" : "border-white/5"}`}
                            style={{ background: `radial-gradient(circle at 50% 35%, #${c.slice(2)} 0 38%, #17131a 40% 100%)` }}
                          >
                            {meta.hair === c && <Check size={15} className="absolute right-1 top-1 text-white drop-shadow" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => { void enterLandscape(); setReady(); }}
                    disabled={state.players[me].ready}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-orange-400 px-5 py-3.5 text-sm font-black text-white shadow-xl shadow-pink-950/30 transition duration-200 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0"
                  >
                    <Check size={18} />
                    {state.players[me].ready ? "Você está pronto!" : "Estou pronto para cozinhar"}
                  </button>
                  {isHost && (
                    <button
                      type="button"
                      onClick={startGame}
                      disabled={!bothReady || !peerOnline}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200/20 bg-amber-300/10 px-5 py-3 text-sm font-black text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <Play size={17} />
                      {bothReady ? "Iniciar cozinha" : "Aguardando os dois ficarem prontos"}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-col gap-4">
                <div className="rounded-[28px] border border-white/10 bg-white/[0.055] p-4 shadow-2xl backdrop-blur-xl sm:p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Sua equipe</p>
                      <p className="mt-1 text-lg font-black">Dupla de cozinha</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/60">
                      <Users size={13} /> 2 jogadores
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {([me, other(me)] as Me[]).map((player) => {
                      const online = player === me || peerOnline;
                      const ready = state.players[player].ready;
                      const p = state.players[player];
                      return (
                        <div key={player} className={`relative overflow-hidden rounded-2xl border p-3 transition duration-300 ${ready ? "border-emerald-300/30 bg-emerald-300/10" : "border-white/10 bg-black/20"}`}>
                          <div className="absolute -right-5 -top-5 h-16 w-16 rounded-full blur-2xl" style={{ backgroundColor: `#${p.outfit.slice(2)}55` }} />
                          <div className="relative">
                            <div className="mb-3 flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-wider text-white/45">{player === me ? "Você" : "Parceiro"}</span>
                              <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-400" : "bg-white/20"} `} />
                            </div>
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10" style={{ background: `linear-gradient(145deg, #${p.outfit.slice(2)}, #241b25)` }}>
                              <ChefHat size={23} className="text-white/90" />
                            </div>
                            <p className="mt-2 truncate text-center text-xs font-black">{NAME[player]}</p>
                            <div className={`mt-2 rounded-lg px-2 py-1 text-center text-[9px] font-bold uppercase tracking-wider ${ready ? "bg-emerald-400/15 text-emerald-200" : "bg-white/5 text-white/35"}`}>
                              {ready ? "Pronto" : online ? "Personalizando" : "Aguardando"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/[0.055] p-4 shadow-2xl backdrop-blur-xl sm:p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <CookingPot size={18} className="text-amber-200" />
                    <div>
                      <p className="text-sm font-black">Como funciona</p>
                      <p className="text-[10px] text-white/40">Coordene-se para servir mais rápido.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ["1", "Pegue", "ingredientes"],
                      ["2", "Prepare", "as receitas"],
                      ["3", "Sirva", "sem perder tempo"],
                    ].map(([n, title, desc]) => (
                      <div key={n} className="rounded-2xl border border-white/8 bg-black/15 p-3">
                        <div className="mb-2 flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 text-[10px] font-black text-amber-100">{n}</div>
                        <p className="text-[10px] font-black">{title}</p>
                        <p className="mt-0.5 text-[9px] leading-tight text-white/40">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-auto rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-center text-[10px] text-white/40">
                  {peerOnline ? "Seu parceiro está na sala. Quando os dois estiverem prontos, a cozinha começa." : "Compartilhe a sala com seu parceiro para começar a partida."}
                </div>
              </div>
            </div>
          </div>
        </div>
      </LandscapeGate>
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

      <div className="pointer-events-none absolute left-1/2 top-2 z-20 w-[min(92vw,900px)] -translate-x-1/2">
        <div className="flex items-start gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {world.orders.length === 0 ? (
            <div className="mx-auto rounded-2xl border border-white/10 bg-black/55 px-5 py-2.5 text-center text-[11px] font-black uppercase tracking-[0.18em] text-white/60 shadow-xl backdrop-blur-md">
              Aguardando próximo pedido…
            </div>
          ) : world.orders.map((order) => {
            const ratio = Math.max(0, Math.min(1, 1 - (Date.now() - order.bornAt) / order.patienceMs));
            const ingredients = RECIPE_NEEDS[order.dish].map((item) => ITEM_LABEL[item] ?? item);
            return (
              <div key={order.id} className="min-w-[190px] rounded-2xl border border-white/15 bg-[#fff9ee]/95 px-3 py-2 text-left text-slate-900 shadow-2xl backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-amber-100 px-2 py-1 text-[10px] font-black uppercase">{DISH_LABEL[order.dish]}</div>
                  <div className="ml-auto flex items-center gap-1 text-[9px] font-black text-slate-500"><Clock3 size={11} /> {Math.ceil((order.patienceMs - (Date.now() - order.bornAt)) / 1000)}s</div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {ingredients.map((item) => <span key={item} className="rounded-md bg-slate-900/8 px-1.5 py-0.5 text-[9px] font-bold">{item}</span>)}
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${ratio > 0.5 ? "bg-emerald-500" : ratio > 0.2 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${ratio * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

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

      {/* arremesso rápido */}
      <button
        type="button"
        onPointerDown={() => engineRef.current?.pressThrow()}
        aria-label="Arremessar ingrediente"
        className="absolute right-[max(1.25rem,env(safe-area-inset-right))] bottom-[max(7.2rem,calc(env(safe-area-inset-bottom)+7.2rem))] z-20 h-14 w-28 rounded-2xl border border-white/20 bg-slate-900/80 text-[10px] font-black tracking-wide text-white shadow-xl backdrop-blur-md touch-none active:scale-95"
      >
        ARREMESSAR
      </button>

      {/* botão de ação (mobile) */}
      <button
        onPointerDown={handleActDown}
        onPointerUp={handleActUp}
        onPointerCancel={handleActUp}
        className="absolute right-[max(1.25rem,env(safe-area-inset-right))] bottom-[max(1.25rem,env(safe-area-inset-bottom))] w-24 h-24 rounded-full bg-primary active:bg-primary/80 text-primary-foreground text-xs font-bold z-20 touch-none border-4 border-primary-foreground/20 shadow-xl"
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
