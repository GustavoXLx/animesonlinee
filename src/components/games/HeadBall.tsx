import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Me } from "./useGameChannel";

/**
 * Head Ball (2D). Authoritative host = "gu". Guest = "li".
 * Host simulates physics @60fps, broadcasts snapshot @15Hz.
 * Guest sends input events. Both render at 60fps interpolated from last snapshot.
 */

const W = 800;
const H = 400;
const GROUND_Y = H - 30;
const GOAL_W = 12;
const GOAL_H = 130;
const HEAD_R = 38;
const FOOT_W = 34;
const FOOT_H = 10;
const BALL_R = 18;
const GRAVITY = 1500;
const MOVE_SPEED = 320;
const JUMP_V = -640;
const KICK_STRENGTH = 620;
const MAX_SCORE = 5;

type Look = {
  skin: string;
  shirt: string;
  shorts: string;
  hat: string; // "" for none
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
  kickT: number; // seconds remaining of kick anim
  facing: 1 | -1;
};

type Snapshot = {
  ball: { x: number; y: number; vx: number; vy: number };
  gu: PlayerState;
  li: PlayerState;
  score: { gu: number; li: number };
  finished: null | Me | "draw";
  t: number;
};

type Input = {
  left: boolean;
  right: boolean;
  jump: boolean;
  kick: boolean;
};

const initSnap = (): Snapshot => ({
  ball: { x: W / 2, y: H / 3, vx: 0, vy: 0 },
  gu: { x: 150, y: GROUND_Y - HEAD_R, vx: 0, vy: 0, onGround: true, kickT: 0, facing: 1 },
  li: { x: W - 150, y: GROUND_Y - HEAD_R, vx: 0, vy: 0, onGround: true, kickT: 0, facing: -1 },
  score: { gu: 0, li: 0 },
  finished: null,
  t: 0,
});

function loadLook(me: Me): Look {
  if (typeof window === "undefined") return DEFAULT_LOOKS[me];
  try {
    const raw = localStorage.getItem(`headball-look-${me}`);
    if (raw) return { ...DEFAULT_LOOKS[me], ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_LOOKS[me];
}
function saveLook(me: Me, look: Look) {
  try { localStorage.setItem(`headball-look-${me}`, JSON.stringify(look)); } catch { /* ignore */ }
}

export function HeadBall({ me }: { me: Me }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isHost = me === "gu";
  const [peerOnline, setPeerOnline] = useState(false);
  const [started, setStarted] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [myLook, setMyLook] = useState<Look>(() => loadLook(me));
  const [otherLook, setOtherLook] = useState<Look>(() => DEFAULT_LOOKS[me === "gu" ? "li" : "gu"]);
  const snapRef = useRef<Snapshot>(initSnap());
  const [scoreState, setScoreState] = useState({ gu: 0, li: 0 });
  const [finished, setFinished] = useState<null | Me | "draw">(null);
  const inputRef = useRef<Input>({ left: false, right: false, jump: false, kick: false });
  const remoteInputRef = useRef<Input>({ left: false, right: false, jump: false, kick: false });
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [goalFlash, setGoalFlash] = useState<null | Me>(null);

  // channel
  useEffect(() => {
    const other: Me = me === "gu" ? "li" : "gu";
    const channel = supabase.channel("game-headball", {
      config: { presence: { key: me }, broadcast: { self: false } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setPeerOnline(Boolean(channel.presenceState()[other]?.length));
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
      .on("broadcast", { event: "start" }, () => setStarted(true))
      .on("broadcast", { event: "reset" }, () => {
        snapRef.current = initSnap();
        setScoreState({ gu: 0, li: 0 });
        setFinished(null);
        setStarted(true);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ at: Date.now() });
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

  // re-broadcast look on change
  useEffect(() => {
    chanRef.current?.send({ type: "broadcast", event: "look", payload: { look: myLook, from: me } });
    saveLook(me, myLook);
  }, [myLook, me]);

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
      applyInput(s.gu, guIn, dtSec, 60, W / 2 - HEAD_R);
      applyInput(s.li, liIn, dtSec, W / 2 + HEAD_R, W - 60);
      integrate(s.gu, dtSec);
      integrate(s.li, dtSec);

      // ball physics
      s.ball.vy += GRAVITY * dtSec * 0.7;
      s.ball.x += s.ball.vx * dtSec;
      s.ball.y += s.ball.vy * dtSec;
      // ground
      if (s.ball.y > GROUND_Y - BALL_R) {
        s.ball.y = GROUND_Y - BALL_R;
        s.ball.vy *= -0.6;
        s.ball.vx *= 0.9;
      }
      // ceiling
      if (s.ball.y < BALL_R) { s.ball.y = BALL_R; s.ball.vy = -s.ball.vy * 0.6; }
      // side walls (goals excluded)
      if (s.ball.x < BALL_R) { s.ball.x = BALL_R; s.ball.vx = -s.ball.vx * 0.7; }
      if (s.ball.x > W - BALL_R) { s.ball.x = W - BALL_R; s.ball.vx = -s.ball.vx * 0.7; }

      // player head collision
      for (const p of [s.gu, s.li] as PlayerState[]) {
        const dx = s.ball.x - p.x;
        const dy = s.ball.y - (p.y);
        const dist = Math.hypot(dx, dy);
        const minD = HEAD_R + BALL_R;
        if (dist < minD && dist > 0) {
          const nx = dx / dist, ny = dy / dist;
          s.ball.x = p.x + nx * minD;
          s.ball.y = p.y + ny * minD;
          const rel = s.ball.vx - p.vx;
          s.ball.vx = -rel * 0.6 + nx * 260;
          s.ball.vy = ny * 380 - 80;
        }
        // foot / kick collision
        if (p.kickT > 0) {
          const fx = p.x + p.facing * HEAD_R;
          const fy = p.y + HEAD_R * 0.7;
          const ddx = s.ball.x - fx;
          const ddy = s.ball.y - fy;
          const dd = Math.hypot(ddx, ddy);
          if (dd < BALL_R + FOOT_W * 0.6) {
            s.ball.vx = p.facing * KICK_STRENGTH;
            s.ball.vy = -320;
          }
        }
      }

      // goals
      if (!s.finished) {
        // left goal (gu's) → li scores
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
      setTimeout(() => setGoalFlash(null), 1200);
      // reset positions
      s.ball = { x: W / 2, y: H / 3, vx: 0, vy: 0 };
      s.gu.x = 150; s.gu.y = GROUND_Y - HEAD_R; s.gu.vx = 0; s.gu.vy = 0;
      s.li.x = W - 150; s.li.y = GROUND_Y - HEAD_R; s.li.vx = 0; s.li.vy = 0;
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
          if (snapAcc >= 1 / 15) {
            snapAcc = 0;
            chanRef.current?.send({ type: "broadcast", event: "snap", payload: { snap: snapRef.current } });
          }
        } else {
          // guest: send input at 20Hz when changed
          inputAcc += dt;
          const key = JSON.stringify(inputRef.current);
          if (inputAcc >= 1 / 20 || key !== lastSentInput) {
            inputAcc = 0;
            if (key !== lastSentInput) {
              lastSentInput = key;
              chanRef.current?.send({ type: "broadcast", event: "input", payload: { input: inputRef.current, from: me } });
            }
          }
        }
      }

      render();
      raf = requestAnimationFrame(loop);
    };

    const render = () => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const s = snapRef.current;
      // sky
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0f172a");
      g.addColorStop(1, "#1e293b");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // stars
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      for (let i = 0; i < 30; i++) {
        const x = (i * 137) % W;
        const y = (i * 89) % (H - 100);
        ctx.fillRect(x, y, 1, 1);
      }
      // ground
      ctx.fillStyle = "#166534";
      ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(W / 2 - 1, 0, 2, GROUND_Y);
      // goals
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 4;
      ctx.strokeRect(0, GROUND_Y - GOAL_H, GOAL_W, GOAL_H);
      ctx.strokeRect(W - GOAL_W, GROUND_Y - GOAL_H, GOAL_W, GOAL_H);
      // net pattern
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(0, GROUND_Y - GOAL_H + (i * GOAL_H) / 5);
        ctx.lineTo(GOAL_W, GROUND_Y - GOAL_H + (i * GOAL_H) / 5);
        ctx.moveTo(W - GOAL_W, GROUND_Y - GOAL_H + (i * GOAL_H) / 5);
        ctx.lineTo(W, GROUND_Y - GOAL_H + (i * GOAL_H) / 5);
        ctx.stroke();
      }

      drawPlayer(ctx, s.gu, DEFAULT_LOOKS.gu.name === myLook.name ? myLook : (me === "gu" ? myLook : otherLook), 1);
      drawPlayer(ctx, s.li, me === "li" ? myLook : otherLook, -1);
      // ball
      ctx.save();
      ctx.translate(s.ball.x, s.ball.y);
      ctx.rotate(s.ball.x * 0.02);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.moveTo(-6, -8); ctx.lineTo(6, -8); ctx.lineTo(8, 4); ctx.lineTo(0, 10); ctx.lineTo(-8, 4);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isHost, peerOnline, started, finished, me, myLook, otherLook]);

  // controls: keyboard
  useEffect(() => {
    const map = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      let changed = false;
      if (k === "a" || k === "arrowleft") { inputRef.current.left = down; changed = true; }
      if (k === "d" || k === "arrowright") { inputRef.current.right = down; changed = true; }
      if (k === "w" || k === "arrowup" || k === " ") { inputRef.current.jump = down; changed = true; }
      if (k === "s" || k === "arrowdown" || k === "k") { inputRef.current.kick = down; changed = true; }
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

  const startMatch = () => {
    snapRef.current = initSnap();
    setScoreState({ gu: 0, li: 0 });
    setFinished(null);
    setStarted(true);
    chanRef.current?.send({ type: "broadcast", event: "reset", payload: {} });
  };

  const btn = (key: keyof Input) => ({
    onPointerDown: () => { inputRef.current[key] = true; },
    onPointerUp: () => { inputRef.current[key] = false; },
    onPointerLeave: () => { inputRef.current[key] = false; },
    onPointerCancel: () => { inputRef.current[key] = false; },
  });

  if (!peerOnline) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-neutral-950 text-white">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
        </div>
        <p className="font-semibold">esperando a outra pessoa entrar em ⚽ Head Ball...</p>
        <button onClick={() => setShowCustom(true)} className="mt-6 text-xs text-fuchsia-400 flex items-center gap-1">
          <Palette size={14} /> personalizar personagem
        </button>
        {showCustom && <CustomizeModal look={myLook} onSave={(l) => { setMyLook(l); setShowCustom(false); }} onClose={() => setShowCustom(false)} />}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-neutral-950 text-white">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <div className="text-xs">
          <p className="text-white/50">placar (até {MAX_SCORE})</p>
          <p className="font-bold">gu <span className="text-emerald-400">{scoreState.gu}</span> · li <span className="text-emerald-400">{scoreState.li}</span></p>
        </div>
        <p className="text-[10px] text-white/40">{isHost ? "host" : "guest"}</p>
        <div className="flex gap-2">
          <button onClick={() => setShowCustom(true)} className="p-2 text-white/50" title="personalizar"><Palette size={16} /></button>
          <button onClick={startMatch} className="p-2 text-white/50" title="reiniciar"><RotateCcw size={16} /></button>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center bg-black">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full h-full max-h-[55vh] object-contain"
          style={{ imageRendering: "auto" }}
        />
        {goalFlash && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-6xl font-black text-yellow-300 drop-shadow-lg animate-pulse">GOL!</p>
          </div>
        )}
        {!started && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
            <p className="font-bold text-lg">⚽ Head Ball</p>
            <p className="text-xs text-white/60">primeiro a {MAX_SCORE} gols vence</p>
            <button onClick={startMatch} className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full px-6 py-3 font-semibold">
              começar
            </button>
          </div>
        )}
        {finished && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
            <p className="text-2xl font-black">{finished === me ? "🏆 você venceu!" : finished === "draw" ? "empate" : "você perdeu 😢"}</p>
            <button onClick={startMatch} className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full px-6 py-3 font-semibold">
              revanche
            </button>
          </div>
        )}
      </div>

      {/* touch controls */}
      <div className="p-3 border-t border-white/10 grid grid-cols-4 gap-2 select-none">
        <button {...btn("left")} className="h-14 rounded-2xl bg-white/10 active:bg-white/20 font-bold text-2xl">←</button>
        <button {...btn("right")} className="h-14 rounded-2xl bg-white/10 active:bg-white/20 font-bold text-2xl">→</button>
        <button {...btn("jump")} className="h-14 rounded-2xl bg-sky-500/30 active:bg-sky-500/60 font-bold">PULA</button>
        <button {...btn("kick")} className="h-14 rounded-2xl bg-rose-500/40 active:bg-rose-500/70 font-bold">CHUTE</button>
      </div>

      {showCustom && <CustomizeModal look={myLook} onSave={(l) => { setMyLook(l); setShowCustom(false); }} onClose={() => setShowCustom(false)} />}
    </div>
  );
}

function applyInput(p: PlayerState, i: Input, dt: number, minX: number, maxX: number) {
  if (i.left) { p.vx = -MOVE_SPEED; p.facing = -1; }
  else if (i.right) { p.vx = MOVE_SPEED; p.facing = 1; }
  else p.vx = 0;
  if (i.jump && p.onGround) { p.vy = JUMP_V; p.onGround = false; }
  if (i.kick && p.kickT <= 0) p.kickT = 0.25;
  p.kickT = Math.max(0, p.kickT - dt);
  // clamp horizontally
  if (p.x < minX) p.x = minX;
  if (p.x > maxX) p.x = maxX;
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
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: PlayerState, look: Look, defaultFacing: 1 | -1) {
  const facing = p.facing || defaultFacing;
  // shirt (behind head)
  ctx.fillStyle = look.shirt;
  ctx.fillRect(p.x - 24, p.y + HEAD_R - 6, 48, 18);
  // shorts
  ctx.fillStyle = look.shorts;
  ctx.fillRect(p.x - 22, p.y + HEAD_R + 10, 44, 10);
  // head
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(p.x, p.y, HEAD_R, 0, Math.PI * 2);
  ctx.fill();
  // hair/hat
  if (look.hat) {
    ctx.fillStyle = look.hat;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 8, HEAD_R, Math.PI + 0.2, Math.PI * 2 - 0.2);
    ctx.fill();
  }
  // eye
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(p.x + facing * 10, p.y - 4, 3, 0, Math.PI * 2);
  ctx.fill();
  // smile
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x + facing * 4, p.y + 10, 6, 0, Math.PI);
  ctx.stroke();

  // foot (kicks forward on kickT)
  const kickOffset = p.kickT > 0 ? 22 : 0;
  ctx.fillStyle = "#111";
  ctx.fillRect(p.x + facing * (10 + kickOffset) - FOOT_W / 2, p.y + HEAD_R + 18, FOOT_W, FOOT_H);
}

function CustomizeModal({ look, onSave, onClose }: { look: Look; onSave: (l: Look) => void; onClose: () => void }) {
  const [l, setL] = useState<Look>(look);
  const swatch = (label: string, key: keyof Look, opts: string[]) => (
    <div>
      <p className="text-xs text-white/60 mb-1">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {opts.map((c) => (
          <button
            key={c || "none"}
            onClick={() => setL({ ...l, [key]: c })}
            className={`w-8 h-8 rounded-full border-2 ${l[key] === c ? "border-white" : "border-white/20"}`}
            style={{ background: c || "transparent", backgroundImage: c ? undefined : "linear-gradient(45deg,#333 25%,transparent 25%,transparent 75%,#333 75%),linear-gradient(45deg,#333 25%,transparent 25%,transparent 75%,#333 75%)", backgroundSize: "8px 8px", backgroundPosition: "0 0,4px 4px" }}
          />
        ))}
      </div>
    </div>
  );
  const previewLook = useMemo(() => l, [l]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-3xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <p className="font-bold text-lg">personalizar personagem</p>
        <div className="bg-black/40 rounded-2xl h-32 flex items-center justify-center">
          <PreviewChar look={previewLook} />
        </div>
        <input
          value={l.name}
          onChange={(e) => setL({ ...l, name: e.target.value.slice(0, 20) })}
          placeholder="nome"
          className="w-full bg-white/10 rounded-full px-4 py-2 text-sm outline-none"
        />
        {swatch("pele", "skin", ["#fde7cd", "#f5d0a9", "#c68863", "#8d5524", "#5c3317"])}
        {swatch("camisa", "shirt", ["#3b82f6", "#ec4899", "#10b981", "#f59e0b", "#a855f7", "#ef4444", "#111827"])}
        {swatch("shorts", "shorts", ["#1e3a8a", "#831843", "#064e3b", "#78350f", "#4c1d95", "#7f1d1d", "#000000"])}
        {swatch("cabelo/chapéu", "hat", ["", "#facc15", "#111827", "#7c2d12", "#f472b6", "#22d3ee", "#ffffff"])}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-full bg-white/10">cancelar</button>
          <button onClick={() => onSave(l)} className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 font-semibold">salvar</button>
        </div>
      </div>
    </div>
  );
}

function PreviewChar({ look }: { look: Look }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    const p: PlayerState = { x: c.width / 2, y: c.height / 2 - 10, vx: 0, vy: 0, onGround: true, kickT: 0, facing: 1 };
    drawPlayer(ctx, p, look, 1);
  }, [look]);
  return <canvas ref={ref} width={140} height={140} />;
}
