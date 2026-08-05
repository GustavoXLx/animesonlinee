import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Palette, Users, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Me } from "./useGameChannel";

/**
 * Head Ball 2.0 — bigger field, better graphics, cross-midfield allowed.
 * Authoritative host = "gu". Guest = "li".
 * Host simulates @60fps, broadcasts snapshot @20Hz. Guest sends input @25Hz.
 */

const W = 1100;
const H = 560;
const GROUND_Y = H - 60;
const GOAL_W = 16;
const GOAL_H = 190;
const HEAD_R = 44;
const FOOT_W = 42;
const FOOT_H = 14;
const BALL_R = 22;
const GRAVITY = 1700;
const MOVE_SPEED = 380;
const JUMP_V = -780;
const KICK_STRENGTH = 780;
const KICK_UP = -360;
const DASH_V = 620;
const DASH_COOLDOWN = 1.6;
const MAX_SCORE = 5;

type Look = {
  skin: string;
  shirt: string;
  shorts: string;
  hat: string; // "" = none (bald)
  name: string;
};

const DEFAULT_LOOKS: Record<Me, Look> = {
  gu: { skin: "#f5d0a9", shirt: "#3b82f6", shorts: "#1e3a8a", hat: "#facc15", name: "bb gu" },
  li: { skin: "#f5d0a9", shirt: "#ec4899", shorts: "#831843", hat: "#f472b6", name: "bb li" },
};

type PlayerState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  kickT: number;
  dashCd: number;
  facing: 1 | -1;
  runPhase: number;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

type Snapshot = {
  ball: { x: number; y: number; vx: number; vy: number; spin: number };
  gu: PlayerState;
  li: PlayerState;
  score: { gu: number; li: number };
  finished: null | Me | "draw";
  t: number;
};

type Input = { left: boolean; right: boolean; jump: boolean; kick: boolean; dash: boolean };

const initSnap = (): Snapshot => ({
  ball: { x: W / 2, y: H / 3, vx: 0, vy: 0, spin: 0 },
  gu: {
    x: 180,
    y: GROUND_Y - HEAD_R,
    vx: 0,
    vy: 0,
    onGround: true,
    kickT: 0,
    dashCd: 0,
    facing: 1,
    runPhase: 0,
  },
  li: {
    x: W - 180,
    y: GROUND_Y - HEAD_R,
    vx: 0,
    vy: 0,
    onGround: true,
    kickT: 0,
    dashCd: 0,
    facing: -1,
    runPhase: 0,
  },
  score: { gu: 0, li: 0 },
  finished: null,
  t: 0,
});

function loadLook(me: Me): Look {
  if (typeof window === "undefined") return DEFAULT_LOOKS[me];
  try {
    const raw = localStorage.getItem(`headball-look-${me}`);
    if (raw) return { ...DEFAULT_LOOKS[me], ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_LOOKS[me];
}
function saveLook(me: Me, look: Look) {
  try {
    localStorage.setItem(`headball-look-${me}`, JSON.stringify(look));
  } catch {
    /* ignore */
  }
}

export function HeadBall({ me }: { me: Me }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isHost = me === "gu";
  const other: Me = me === "gu" ? "li" : "gu";
  const [peerOnline, setPeerOnline] = useState(false);
  const [peerReady, setPeerReady] = useState(false);
  const [meReady, setMeReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [myLook, setMyLook] = useState<Look>(() => loadLook(me));
  const [otherLook, setOtherLook] = useState<Look>(() => DEFAULT_LOOKS[other]);
  const snapRef = useRef<Snapshot>(initSnap());
  const [scoreState, setScoreState] = useState({ gu: 0, li: 0 });
  const [finished, setFinished] = useState<null | Me | "draw">(null);
  const inputRef = useRef<Input>({
    left: false,
    right: false,
    jump: false,
    kick: false,
    dash: false,
  });
  const remoteInputRef = useRef<Input>({
    left: false,
    right: false,
    jump: false,
    kick: false,
    dash: false,
  });
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [goalFlash, setGoalFlash] = useState<null | Me>(null);
  const particlesRef = useRef<Particle[]>([]);
  const [dashCd, setDashCd] = useState(0);

  // channel
  useEffect(() => {
    const channel = supabase.channel("game-headball-v2", {
      config: { presence: { key: me }, broadcast: { self: false } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, { ready?: boolean }[]>;
        setPeerOnline(Boolean(state[other]?.length));
        setPeerReady(Boolean(state[other]?.[0]?.ready));
      })
      .on("broadcast", { event: "look" }, (payload) => {
        const p = payload.payload as { look: Look; from: Me };
        if (p?.from === other) setOtherLook(p.look);
      })
      .on("broadcast", { event: "input" }, (payload) => {
        const p = payload.payload as { input: Input; from: Me };
        if (p?.from === other) remoteInputRef.current = p.input;
      })
      .on("broadcast", { event: "snap" }, (payload) => {
        if (isHost) return;
        const s = (payload.payload as { snap: Snapshot }).snap;
        if (!s) return;
        snapRef.current = s;
        setScoreState(s.score);
        setFinished(s.finished);
      })
      .on("broadcast", { event: "goal" }, (payload) => {
        const who = (payload.payload as { who: Me }).who;
        setGoalFlash(who);
        spawnGoalParticles(who);
        setTimeout(() => setGoalFlash(null), 1400);
      })
      .on("broadcast", { event: "start" }, () => {
        snapRef.current = initSnap();
        setScoreState({ gu: 0, li: 0 });
        setFinished(null);
        setStarted(true);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ at: Date.now(), ready: false });
          channel.send({ type: "broadcast", event: "look", payload: { look: myLook, from: me } });
        }
      });
    chanRef.current = channel;
    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      chanRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  // presence ready sync
  useEffect(() => {
    chanRef.current?.track({ at: Date.now(), ready: meReady });
  }, [meReady]);

  // rebroadcast look
  useEffect(() => {
    chanRef.current?.send({
      type: "broadcast",
      event: "look",
      payload: { look: myLook, from: me },
    });
    saveLook(me, myLook);
  }, [myLook, me]);

  // auto-start when both ready (host triggers)
  useEffect(() => {
    if (!isHost) return;
    if (meReady && peerReady && !started) {
      snapRef.current = initSnap();
      setScoreState({ gu: 0, li: 0 });
      setFinished(null);
      setStarted(true);
      chanRef.current?.send({ type: "broadcast", event: "start", payload: {} });
    }
  }, [meReady, peerReady, started, isHost]);

  const spawnGoalParticles = (who: Me) => {
    const goalX = who === "gu" ? W - GOAL_W : GOAL_W;
    for (let i = 0; i < 40; i++) {
      particlesRef.current.push({
        x: goalX,
        y: GROUND_Y - GOAL_H / 2,
        vx: (Math.random() - 0.5) * 500,
        vy: -Math.random() * 500,
        life: 1.2,
        color: ["#facc15", "#f59e0b", "#fb923c", "#ef4444"][i % 4],
      });
    }
  };

  // physics + render loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let snapAcc = 0;
    let inputAcc = 0;
    let lastSentInput = "";

    const step = (dtSec: number) => {
      const s = snapRef.current;
      const guIn = isHost ? inputRef.current : remoteInputRef.current;
      const liIn = isHost ? remoteInputRef.current : inputRef.current;
      applyInput(s.gu, guIn, dtSec);
      applyInput(s.li, liIn, dtSec);
      integrate(s.gu, dtSec);
      integrate(s.li, dtSec);

      // player vs player push
      const pdx = s.li.x - s.gu.x;
      const overlap = HEAD_R * 2 - Math.abs(pdx);
      if (overlap > 0 && Math.abs(s.gu.y - s.li.y) < HEAD_R * 1.5) {
        const push = overlap / 2;
        if (pdx >= 0) {
          s.gu.x -= push;
          s.li.x += push;
        } else {
          s.gu.x += push;
          s.li.x -= push;
        }
      }

      // ball
      s.ball.vy += GRAVITY * dtSec * 0.75;
      s.ball.vx *= 0.998;
      s.ball.x += s.ball.vx * dtSec;
      s.ball.y += s.ball.vy * dtSec;
      s.ball.spin += s.ball.vx * dtSec * 0.03;

      if (s.ball.y > GROUND_Y - BALL_R) {
        s.ball.y = GROUND_Y - BALL_R;
        s.ball.vy *= -0.62;
        s.ball.vx *= 0.88;
      }
      if (s.ball.y < BALL_R + 20) {
        s.ball.y = BALL_R + 20;
        s.ball.vy = -s.ball.vy * 0.55;
      }
      // walls (only outside goal opening)
      if (s.ball.x < BALL_R + GOAL_W && s.ball.y < GROUND_Y - GOAL_H) {
        s.ball.x = BALL_R + GOAL_W;
        s.ball.vx = -s.ball.vx * 0.75;
      }
      if (s.ball.x > W - BALL_R - GOAL_W && s.ball.y < GROUND_Y - GOAL_H) {
        s.ball.x = W - BALL_R - GOAL_W;
        s.ball.vx = -s.ball.vx * 0.75;
      }
      if (s.ball.x < BALL_R) {
        s.ball.x = BALL_R;
        s.ball.vx = Math.abs(s.ball.vx) * 0.6;
      }
      if (s.ball.x > W - BALL_R) {
        s.ball.x = W - BALL_R;
        s.ball.vx = -Math.abs(s.ball.vx) * 0.6;
      }

      // head collision
      for (const p of [s.gu, s.li] as PlayerState[]) {
        const dx = s.ball.x - p.x;
        const dy = s.ball.y - p.y;
        const dist = Math.hypot(dx, dy);
        const minD = HEAD_R + BALL_R;
        if (dist < minD && dist > 0) {
          const nx = dx / dist,
            ny = dy / dist;
          s.ball.x = p.x + nx * minD;
          s.ball.y = p.y + ny * minD;
          const rel = s.ball.vx - p.vx;
          s.ball.vx = -rel * 0.7 + nx * 320 + p.vx * 0.4;
          s.ball.vy = ny * 460 - 120;
        }
        // foot kick
        if (p.kickT > 0) {
          const fx = p.x + p.facing * (HEAD_R + 6);
          const fy = p.y + HEAD_R * 0.75;
          const ddx = s.ball.x - fx;
          const ddy = s.ball.y - fy;
          const dd = Math.hypot(ddx, ddy);
          if (dd < BALL_R + FOOT_W * 0.6) {
            const power = p.dashCd > DASH_COOLDOWN - 0.2 ? 1.4 : 1;
            s.ball.vx = p.facing * KICK_STRENGTH * power;
            s.ball.vy = KICK_UP;
          }
        }
      }

      // goals
      if (!s.finished) {
        if (s.ball.x < GOAL_W + BALL_R && s.ball.y > GROUND_Y - GOAL_H) {
          s.score.li += 1;
          triggerGoal("li", s);
        } else if (s.ball.x > W - GOAL_W - BALL_R && s.ball.y > GROUND_Y - GOAL_H) {
          s.score.gu += 1;
          triggerGoal("gu", s);
        }
        if (s.score.gu >= MAX_SCORE) s.finished = "gu";
        else if (s.score.li >= MAX_SCORE) s.finished = "li";
      }
      s.t += dtSec;
    };

    const triggerGoal = (who: Me, s: Snapshot) => {
      setGoalFlash(who);
      spawnGoalParticles(who);
      setTimeout(() => setGoalFlash(null), 1400);
      chanRef.current?.send({ type: "broadcast", event: "goal", payload: { who } });
      s.ball = { x: W / 2, y: H / 3, vx: 0, vy: 0, spin: 0 };
      s.gu = { ...s.gu, x: 180, y: GROUND_Y - HEAD_R, vx: 0, vy: 0, kickT: 0 };
      s.li = { ...s.li, x: W - 180, y: GROUND_Y - HEAD_R, vx: 0, vy: 0, kickT: 0 };
    };

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      if (started && peerOnline && !finished) {
        if (isHost) {
          step(dt);
          setScoreState({ ...snapRef.current.score });
          if (snapRef.current.finished) setFinished(snapRef.current.finished);
          snapAcc += dt;
          if (snapAcc >= 1 / 20) {
            snapAcc = 0;
            chanRef.current?.send({
              type: "broadcast",
              event: "snap",
              payload: { snap: snapRef.current },
            });
          }
        } else {
          inputAcc += dt;
          const key = JSON.stringify(inputRef.current);
          if (inputAcc >= 1 / 25 || key !== lastSentInput) {
            inputAcc = 0;
            if (key !== lastSentInput) {
              lastSentInput = key;
              chanRef.current?.send({
                type: "broadcast",
                event: "input",
                payload: { input: inputRef.current, from: me },
              });
            }
          }
        }
        // update my dash cooldown display
        setDashCd(
          inputRef.current ? (isHost ? snapRef.current.gu.dashCd : snapRef.current.li.dashCd) : 0,
        );
      }

      // update particles
      const ps = particlesRef.current;
      for (const p of ps) {
        p.vy += 900 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      particlesRef.current = ps.filter((p) => p.life > 0);

      render();
      raf = requestAnimationFrame(loop);
    };

    const render = () => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const s = snapRef.current;
      drawStadium(ctx, s.t);
      drawPlayer(ctx, s.gu, me === "gu" ? myLook : otherLook, 1);
      drawPlayer(ctx, s.li, me === "li" ? myLook : otherLook, -1);
      drawBall(ctx, s.ball);
      // particles
      for (const p of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
      }
      ctx.globalAlpha = 1;
      drawScoreboard(
        ctx,
        s.score,
        me === "gu" ? myLook : otherLook,
        me === "li" ? myLook : otherLook,
      );
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isHost, peerOnline, started, finished, me, myLook, otherLook]);

  // keyboard
  useEffect(() => {
    const map = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      let changed = false;
      if (k === "a" || k === "arrowleft") {
        inputRef.current.left = down;
        changed = true;
      }
      if (k === "d" || k === "arrowright") {
        inputRef.current.right = down;
        changed = true;
      }
      if (k === "w" || k === "arrowup" || k === " ") {
        inputRef.current.jump = down;
        changed = true;
      }
      if (k === "s" || k === "arrowdown" || k === "k") {
        inputRef.current.kick = down;
        changed = true;
      }
      if (k === "shift" || k === "j") {
        inputRef.current.dash = down;
        changed = true;
      }
      if (changed) e.preventDefault();
    };
    const dn = (e: KeyboardEvent) => map(e, true);
    const up = (e: KeyboardEvent) => map(e, false);
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const restartMatch = () => {
    snapRef.current = initSnap();
    setScoreState({ gu: 0, li: 0 });
    setFinished(null);
    setStarted(true);
    chanRef.current?.send({ type: "broadcast", event: "start", payload: {} });
  };

  const btn = (key: keyof Input) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      inputRef.current[key] = true;
    },
    onPointerUp: () => {
      inputRef.current[key] = false;
    },
    onPointerLeave: () => {
      inputRef.current[key] = false;
    },
    onPointerCancel: () => {
      inputRef.current[key] = false;
    },
  });

  // ============ LOBBY ============
  if (!started || !peerOnline) {
    return (
      <div className="h-full overflow-y-auto bg-gradient-to-b from-emerald-950 via-neutral-950 to-neutral-950 text-white">
        <div className="min-h-full flex flex-col items-center justify-center p-6 gap-6">
          <div className="text-center">
            <p className="text-5xl mb-2">⚽</p>
            <h1 className="text-3xl font-black tracking-tight">Head Ball</h1>
            <p className="text-xs text-white/50 mt-1">futebol 1x1 · primeiro a {MAX_SCORE} gols</p>
          </div>

          <div className="w-full max-w-md grid grid-cols-2 gap-3">
            <PlayerCard
              side="left"
              look={me === "gu" ? myLook : otherLook}
              isMe={me === "gu"}
              online={me === "gu" || peerOnline}
              ready={me === "gu" ? meReady : peerReady}
            />
            <PlayerCard
              side="right"
              look={me === "li" ? myLook : otherLook}
              isMe={me === "li"}
              online={me === "li" || peerOnline}
              ready={me === "li" ? meReady : peerReady}
            />
          </div>

          {!peerOnline && (
            <div className="flex items-center gap-2 text-amber-300 text-sm">
              <Users size={16} />
              <span className="animate-pulse">esperando {DEFAULT_LOOKS[other].name} entrar...</span>
            </div>
          )}

          {peerOnline && (
            <>
              <button
                onClick={() => setMeReady((v) => !v)}
                className={`w-full max-w-md rounded-2xl py-4 font-bold text-lg shadow-xl transition ${
                  meReady
                    ? "bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300"
                    : "bg-gradient-to-r from-emerald-500 to-teal-600 active:scale-[0.98]"
                }`}
              >
                {meReady ? "✓ pronto — esperando..." : "estou pronto"}
              </button>
              {meReady && peerReady && (
                <p className="text-emerald-400 font-semibold animate-pulse">começando!</p>
              )}
            </>
          )}

          <button
            onClick={() => setShowCustom(true)}
            className="flex items-center gap-2 text-fuchsia-300 text-sm bg-white/5 rounded-full px-4 py-2"
          >
            <Palette size={14} /> personalizar meu personagem
          </button>

          <div className="text-[11px] text-white/40 max-w-sm text-center leading-relaxed">
            <b className="text-white/60">controles:</b> ← → mover · ↑/espaço pular · ↓/K chutar ·
            Shift/J dash
            <br />
            no celular use os botões abaixo do campo
          </div>
        </div>

        {showCustom && (
          <CustomizeModal
            look={myLook}
            onSave={(l) => {
              setMyLook(l);
              setShowCustom(false);
            }}
            onClose={() => setShowCustom(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-neutral-950 text-white select-none">
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full h-full object-contain max-h-[calc(100vh-220px)]"
        />
        {goalFlash && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-7xl sm:text-9xl font-black text-yellow-300 drop-shadow-[0_0_30px_rgba(250,204,21,0.8)] animate-pulse">
              GOL!
            </p>
          </div>
        )}
        {finished && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur flex flex-col items-center justify-center gap-4 z-10">
            <p className="text-6xl">{finished === me ? "🏆" : "😢"}</p>
            <p className="text-3xl font-black">
              {finished === me ? "você venceu!" : "você perdeu"}
            </p>
            <p className="text-white/60">
              {scoreState.gu} × {scoreState.li}
            </p>
            <button
              onClick={restartMatch}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full px-8 py-3 font-bold shadow-xl active:scale-95"
            >
              revanche
            </button>
          </div>
        )}
        <button
          onClick={() => setShowCustom(true)}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center"
          title="personalizar"
        >
          <Palette size={16} />
        </button>
        <button
          onClick={restartMatch}
          className="absolute top-3 right-14 w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center"
          title="reiniciar"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* touch controls */}
      <div className="p-3 border-t border-white/10 grid grid-cols-5 gap-2 shrink-0 bg-neutral-950">
        <button
          {...btn("left")}
          className="h-16 rounded-2xl bg-white/10 active:bg-amber-500/40 font-black text-3xl"
        >
          ←
        </button>
        <button
          {...btn("right")}
          className="h-16 rounded-2xl bg-white/10 active:bg-amber-500/40 font-black text-3xl"
        >
          →
        </button>
        <button
          {...btn("jump")}
          className="h-16 rounded-2xl bg-sky-500/30 active:bg-sky-500/60 font-bold text-sm"
        >
          PULA
        </button>
        <button
          {...btn("kick")}
          className="h-16 rounded-2xl bg-rose-500/40 active:bg-rose-500/70 font-bold text-sm"
        >
          CHUTE
        </button>
        <button
          {...btn("dash")}
          className="h-16 rounded-2xl bg-fuchsia-500/40 active:bg-fuchsia-500/70 font-bold text-sm relative"
        >
          <Zap size={16} className="inline" /> DASH
          {dashCd > 0 && (
            <span className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center text-xs">
              {dashCd.toFixed(1)}s
            </span>
          )}
        </button>
      </div>

      {showCustom && (
        <CustomizeModal
          look={myLook}
          onSave={(l) => {
            setMyLook(l);
            setShowCustom(false);
          }}
          onClose={() => setShowCustom(false)}
        />
      )}
    </div>
  );
}

function applyInput(p: PlayerState, i: Input, dt: number) {
  const target = i.left ? -MOVE_SPEED : i.right ? MOVE_SPEED : 0;
  // smoother accel
  p.vx = p.vx * 0.65 + target * 0.35;
  if (i.left) p.facing = -1;
  if (i.right) p.facing = 1;
  if (i.jump && p.onGround) {
    p.vy = JUMP_V;
    p.onGround = false;
  }
  if (i.kick && p.kickT <= 0) p.kickT = 0.28;
  if (i.dash && p.dashCd <= 0 && (i.left || i.right)) {
    p.vx = p.facing * DASH_V;
    p.dashCd = DASH_COOLDOWN;
  }
  p.kickT = Math.max(0, p.kickT - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  if (Math.abs(p.vx) > 30) p.runPhase += dt * Math.abs(p.vx) * 0.02;
}

function integrate(p: PlayerState, dt: number) {
  p.vy += GRAVITY * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (p.y > GROUND_Y - HEAD_R) {
    p.y = GROUND_Y - HEAD_R;
    p.vy = 0;
    p.onGround = true;
  }
  // no midfield restriction — cross freely; only clamp to field bounds
  if (p.x < HEAD_R + GOAL_W + 4) p.x = HEAD_R + GOAL_W + 4;
  if (p.x > W - HEAD_R - GOAL_W - 4) p.x = W - HEAD_R - GOAL_W - 4;
}

// ============ RENDERING ============
function drawStadium(ctx: CanvasRenderingContext2D, t: number) {
  // sky gradient sunset
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, "#1e1b4b");
  sky.addColorStop(0.5, "#7c3aed");
  sky.addColorStop(0.85, "#f97316");
  sky.addColorStop(1, "#fbbf24");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);

  // sun
  ctx.fillStyle = "rgba(255,240,180,0.9)";
  ctx.beginPath();
  ctx.arc(W * 0.7, GROUND_Y - 80, 45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,220,140,0.2)";
  ctx.beginPath();
  ctx.arc(W * 0.7, GROUND_Y - 80, 85, 0, Math.PI * 2);
  ctx.fill();

  // stadium back wall / graffiti
  ctx.fillStyle = "rgba(30,20,15,0.55)";
  ctx.fillRect(0, GROUND_Y - 220, W, 220);

  // crowd (waving heads)
  for (let i = 0; i < 60; i++) {
    const x = 20 + i * 18;
    const bob = Math.sin(t * 3 + i * 0.7) * 3;
    const skinTones = ["#c68863", "#f5d0a9", "#8d5524", "#e0ac69"];
    ctx.fillStyle = skinTones[i % 4];
    ctx.beginPath();
    ctx.arc(x, GROUND_Y - 145 + bob, 6, 0, Math.PI * 2);
    ctx.fill();
    // shirt
    const shirtColors = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7"];
    ctx.fillStyle = shirtColors[i % 5];
    ctx.fillRect(x - 6, GROUND_Y - 139 + bob, 12, 10);
  }

  // chain-link fence
  ctx.strokeStyle = "rgba(200,200,200,0.25)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y - 165);
    ctx.lineTo(x + 12, GROUND_Y - 120);
    ctx.moveTo(x + 12, GROUND_Y - 165);
    ctx.lineTo(x, GROUND_Y - 120);
    ctx.stroke();
  }

  // stadium lights
  for (const lx of [80, W - 80]) {
    ctx.fillStyle = "#4b5563";
    ctx.fillRect(lx - 3, 0, 6, 90);
    ctx.fillStyle = "#fef3c7";
    ctx.beginPath();
    ctx.arc(lx, 90, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(254,243,199,0.15)";
    ctx.beginPath();
    ctx.moveTo(lx, 90);
    ctx.lineTo(lx - 200, GROUND_Y);
    ctx.lineTo(lx + 200, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }

  // ground / grass
  const grass = ctx.createLinearGradient(0, GROUND_Y, 0, H);
  grass.addColorStop(0, "#15803d");
  grass.addColorStop(1, "#052e16");
  ctx.fillStyle = grass;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  // grass stripes
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.05)";
    ctx.fillRect((i * W) / 10, GROUND_Y, W / 10, H - GROUND_Y);
  }
  // field line
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(W, GROUND_Y);
  ctx.stroke();
  // midline
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(W / 2, GROUND_Y);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);
  // center circle
  ctx.beginPath();
  ctx.arc(W / 2, GROUND_Y + 30, 45, Math.PI, 0);
  ctx.stroke();

  // goals
  drawGoal(ctx, 0);
  drawGoal(ctx, W - GOAL_W);
}

function drawGoal(ctx: CanvasRenderingContext2D, x: number) {
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(x, GROUND_Y - GOAL_H, GOAL_W, GOAL_H);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.5;
  // net grid
  for (let i = 1; i < 8; i++) {
    const y = GROUND_Y - GOAL_H + (i * GOAL_H) / 8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + GOAL_W, y);
    ctx.stroke();
  }
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (i * GOAL_W) / 3, GROUND_Y - GOAL_H);
    ctx.lineTo(x + (i * GOAL_W) / 3, GROUND_Y);
    ctx.stroke();
  }
  // frame
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x + (x === 0 ? GOAL_W : 0), GROUND_Y);
  ctx.lineTo(x + (x === 0 ? GOAL_W : 0), GROUND_Y - GOAL_H);
  ctx.lineTo(x + (x === 0 ? 0 : GOAL_W), GROUND_Y - GOAL_H);
  ctx.stroke();
}

function drawBall(ctx: CanvasRenderingContext2D, b: { x: number; y: number; spin: number }) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.spin);
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  // white
  const g = ctx.createRadialGradient(-6, -6, 2, 0, 0, BALL_R);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#d4d4d4");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  // pentagon pattern
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.moveTo(0, -10);
  for (let i = 1; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10);
  }
  ctx.closePath();
  ctx.fill();
  // outline
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: PlayerState,
  look: Look,
  defaultFacing: 1 | -1,
) {
  const facing = p.facing || defaultFacing;
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(p.x, GROUND_Y + 2, HEAD_R * 0.9, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // legs (running animation)
  const legSwing = Math.sin(p.runPhase) * 12;
  ctx.fillStyle = look.skin;
  ctx.fillRect(p.x - 10, p.y + HEAD_R + 8, 8, 22 + Math.max(0, legSwing));
  ctx.fillRect(p.x + 2, p.y + HEAD_R + 8, 8, 22 - Math.max(0, legSwing));

  // shorts
  ctx.fillStyle = look.shorts;
  ctx.beginPath();
  ctx.roundRect
    ? ctx.roundRect(p.x - 24, p.y + HEAD_R + 4, 48, 16, 4)
    : ctx.rect(p.x - 24, p.y + HEAD_R + 4, 48, 16);
  ctx.fill();

  // shirt / torso
  ctx.fillStyle = look.shirt;
  ctx.beginPath();
  ctx.roundRect
    ? ctx.roundRect(p.x - 26, p.y + HEAD_R - 8, 52, 22, 6)
    : ctx.rect(p.x - 26, p.y + HEAD_R - 8, 52, 22);
  ctx.fill();
  // shirt highlight
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(p.x - 20, p.y + HEAD_R - 6, 8, 18);

  // arm swinging
  ctx.strokeStyle = look.skin;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(p.x - facing * 20, p.y + HEAD_R);
  ctx.lineTo(p.x - facing * (24 + legSwing), p.y + HEAD_R + 18 - legSwing);
  ctx.stroke();

  // head shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.arc(p.x + 2, p.y + 2, HEAD_R, 0, Math.PI * 2);
  ctx.fill();
  // head
  const hg = ctx.createRadialGradient(p.x - 8, p.y - 8, 4, p.x, p.y, HEAD_R);
  hg.addColorStop(0, lighten(look.skin, 15));
  hg.addColorStop(1, look.skin);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(p.x, p.y, HEAD_R, 0, Math.PI * 2);
  ctx.fill();

  // hair/hat
  if (look.hat) {
    ctx.fillStyle = look.hat;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 6, HEAD_R + 2, Math.PI + 0.15, Math.PI * 2 - 0.15);
    ctx.fill();
    // fringe
    ctx.beginPath();
    ctx.arc(p.x - facing * 10, p.y - 4, 12, 0, Math.PI);
    ctx.fill();
  }

  // eye
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(p.x + facing * 12, p.y - 6, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(p.x + facing * 14, p.y - 5, 3, 0, Math.PI * 2);
  ctx.fill();

  // cheek
  ctx.fillStyle = "rgba(244,114,182,0.4)";
  ctx.beginPath();
  ctx.arc(p.x + facing * 18, p.y + 8, 5, 0, Math.PI * 2);
  ctx.fill();

  // mouth
  ctx.strokeStyle = "#7c2d12";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(p.x + facing * 6, p.y + 12, 8, 0.1, Math.PI - 0.1);
  ctx.stroke();

  // shoe / kick foot
  const kicking = p.kickT > 0;
  const kickOffset = kicking ? 30 : 0;
  const kickUp = kicking ? -8 : 0;
  // back foot (planted)
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.roundRect
    ? ctx.roundRect(p.x - facing * 18 - FOOT_W / 2, p.y + HEAD_R + 26, FOOT_W, FOOT_H, 4)
    : ctx.rect(p.x - facing * 18 - FOOT_W / 2, p.y + HEAD_R + 26, FOOT_W, FOOT_H);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.fillRect(p.x - facing * 18 - FOOT_W / 2, p.y + HEAD_R + 26 + FOOT_H - 3, FOOT_W, 3);
  // front (kick) foot
  ctx.fillStyle = kicking ? "#ef4444" : "#f97316";
  ctx.save();
  ctx.translate(p.x + facing * (14 + kickOffset), p.y + HEAD_R + 26 + kickUp);
  ctx.rotate(kicking ? facing * -0.4 : 0);
  ctx.beginPath();
  ctx.roundRect
    ? ctx.roundRect(-FOOT_W / 2, 0, FOOT_W, FOOT_H, 4)
    : ctx.rect(-FOOT_W / 2, 0, FOOT_W, FOOT_H);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.fillRect(-FOOT_W / 2, FOOT_H - 3, FOOT_W, 3);
  ctx.restore();

  // dash trail
  if (p.dashCd > DASH_COOLDOWN - 0.25) {
    ctx.fillStyle = "rgba(217,70,239,0.4)";
    ctx.beginPath();
    ctx.arc(p.x - p.facing * 30, p.y + 5, HEAD_R * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawScoreboard(
  ctx: CanvasRenderingContext2D,
  score: { gu: number; li: number },
  guLook: Look,
  liLook: Look,
) {
  const bx = W / 2 - 130;
  const by = 12;
  // panel
  ctx.fillStyle = "rgba(15,23,42,0.85)";
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 2;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(bx, by, 260, 60, 10);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(bx, by, 260, 60);
    ctx.strokeRect(bx, by, 260, 60);
  }
  // names
  ctx.font = "bold 14px system-ui,sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = guLook.shirt;
  ctx.fillText(guLook.name, bx + 12, by + 20);
  ctx.textAlign = "right";
  ctx.fillStyle = liLook.shirt;
  ctx.fillText(liLook.name, bx + 248, by + 20);
  // score
  ctx.font = "900 30px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#fef08a";
  ctx.fillText(`${score.gu}  :  ${score.li}`, bx + 130, by + 48);
}

function lighten(hex: string, pct: number) {
  const h = hex.replace("#", "");
  const num = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  let r = (num >> 16) + pct;
  let g = ((num >> 8) & 0xff) + pct;
  let b = (num & 0xff) + pct;
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `rgb(${r},${g},${b})`;
}

// ============ LOBBY CARD ============
function PlayerCard({
  side,
  look,
  isMe,
  online,
  ready,
}: {
  side: "left" | "right";
  look: Look;
  isMe: boolean;
  online: boolean;
  ready: boolean;
}) {
  return (
    <div
      className={`relative rounded-3xl p-4 border-2 transition ${
        ready
          ? "border-emerald-400 bg-emerald-500/10"
          : online
            ? "border-white/20 bg-white/5"
            : "border-white/10 bg-white/[0.02] opacity-60"
      }`}
    >
      <div className="flex flex-col items-center gap-2">
        <MiniAvatar look={look} facing={side === "left" ? 1 : -1} />
        <p className="font-bold text-sm">{look.name}</p>
        <p className="text-[10px] uppercase tracking-wider">
          {!online ? (
            <span className="text-white/40">offline</span>
          ) : ready ? (
            <span className="text-emerald-400">✓ pronto</span>
          ) : (
            <span className="text-amber-300">esperando</span>
          )}
        </p>
        {isMe && <span className="text-[9px] text-fuchsia-400">você</span>}
      </div>
    </div>
  );
}

function MiniAvatar({ look, facing }: { look: Look; facing: 1 | -1 }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    const p: PlayerState = {
      x: c.width / 2,
      y: c.height / 2 - 5,
      vx: 0,
      vy: 0,
      onGround: true,
      kickT: 0,
      dashCd: 0,
      facing: facing,
      runPhase: 0,
    };
    // temporarily lower ground to fit
    drawPlayer(ctx, p, look, facing);
  }, [look, facing]);
  return <canvas ref={ref} width={110} height={130} className="rounded-2xl" />;
}

// ============ CUSTOMIZE ============
function CustomizeModal({
  look,
  onSave,
  onClose,
}: {
  look: Look;
  onSave: (l: Look) => void;
  onClose: () => void;
}) {
  const [l, setL] = useState<Look>(look);
  const swatch = (label: string, key: keyof Look, opts: string[]) => (
    <div>
      <p className="text-xs text-white/60 mb-1.5">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {opts.map((c) => (
          <button
            key={c || "none"}
            onClick={() => setL({ ...l, [key]: c })}
            className={`w-9 h-9 rounded-full border-2 transition ${l[key] === c ? "border-white scale-110" : "border-white/20"}`}
            style={
              c
                ? { background: c }
                : {
                    backgroundImage:
                      "linear-gradient(45deg,#333 25%,transparent 25%,transparent 75%,#333 75%),linear-gradient(45deg,#333 25%,transparent 25%,transparent 75%,#333 75%)",
                    backgroundSize: "8px 8px",
                    backgroundPosition: "0 0,4px 4px",
                  }
            }
          />
        ))}
      </div>
    </div>
  );
  const previewLook = useMemo(() => l, [l]);
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-bold text-lg">personalizar personagem</p>
        <div className="bg-gradient-to-b from-sky-900 to-emerald-900 rounded-2xl h-40 flex items-center justify-center">
          <MiniAvatar look={previewLook} facing={1} />
        </div>
        <input
          value={l.name}
          onChange={(e) => setL({ ...l, name: e.target.value.slice(0, 20) })}
          placeholder="nome"
          className="w-full bg-white/10 rounded-full px-4 py-2.5 text-sm outline-none"
        />
        {swatch("pele", "skin", ["#fde7cd", "#f5d0a9", "#c68863", "#8d5524", "#5c3317"])}
        {swatch("camisa", "shirt", [
          "#3b82f6",
          "#ec4899",
          "#10b981",
          "#f59e0b",
          "#a855f7",
          "#ef4444",
          "#06b6d4",
          "#111827",
        ])}
        {swatch("shorts", "shorts", [
          "#1e3a8a",
          "#831843",
          "#064e3b",
          "#78350f",
          "#4c1d95",
          "#7f1d1d",
          "#0891b2",
          "#000000",
        ])}
        {swatch("cabelo/chapéu", "hat", [
          "",
          "#facc15",
          "#111827",
          "#7c2d12",
          "#f472b6",
          "#22d3ee",
          "#ffffff",
          "#dc2626",
        ])}
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-full bg-white/10 font-semibold">
            cancelar
          </button>
          <button
            onClick={() => onSave(l)}
            className="flex-1 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 font-bold"
          >
            salvar
          </button>
        </div>
      </div>
    </div>
  );
}
