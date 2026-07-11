import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Send, Eraser, Trash2 } from "lucide-react";
import { useGameChannel, type Me } from "./useGameChannel";

const WORDS = [
  "gato", "pizza", "sol", "coração", "arco-íris", "sereia", "cachorro", "praia",
  "banana", "guitarra", "carro", "avião", "sorvete", "unicórnio", "abacaxi",
  "bolo", "estrela", "lua", "castelo", "dinossauro", "robô", "hambúrguer",
  "casa", "árvore", "flor", "peixe", "borboleta", "beijo", "abraço", "café",
  "chocolate", "óculos", "chapéu", "sapato", "bicicleta", "elefante", "leão",
  "girafa", "pinguim", "panda", "livro", "relógio", "câmera", "computador",
  "celular", "chuva", "neve", "fogo", "montanha", "rio", "onda", "nuvem",
  "coelho", "rato", "vaca", "porco", "cavalo", "galinha", "pato", "sapo",
  "cobra", "aranha", "abelha", "formiga",
];

const COLORS = ["#ffffff", "#f43f5e", "#f59e0b", "#84cc16", "#06b6d4", "#6366f1", "#a855f7", "#000000"];

type Phase = "idle" | "playing" | "reveal";

type GarticState = {
  phase: Phase;
  drawer: Me;
  word: string;
  wordMask: string; // "____"
  startedAt: number;
  scores: { gu: number; li: number };
  round: number;
  winner: Me | null;
  guesses: { from: Me; text: string; correct: boolean; at: number }[];
};

const initial: GarticState = {
  phase: "idle",
  drawer: "gu",
  word: "",
  wordMask: "",
  startedAt: 0,
  scores: { gu: 0, li: 0 },
  round: 0,
  winner: null,
  guesses: [],
};

const ROUND_MS = 90_000;

type Stroke = { x: number; y: number; nx: number; ny: number; c: string; w: number };

export function Gartic({ me }: { me: Me }) {
  const { state, setState, peerOnline, sendEvent, onEvent } = useGameChannel<GarticState>("gartic", me, initial);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState("#ffffff");
  const [brush, setBrush] = useState(4);
  const [guess, setGuess] = useState("");
  const [now, setNow] = useState(Date.now());
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const strokeBufferRef = useRef<Stroke[]>([]);

  const isDrawer = state.drawer === me;
  const isGuesser = !isDrawer;

  // tick for timer
  useEffect(() => {
    if (state.phase !== "playing") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [state.phase]);

  // draw remote strokes
  useEffect(() => {
    return onEvent("stroke", (data) => {
      const s = data as Stroke[];
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      for (const p of s) drawSeg(ctx, p);
    });
  }, [onEvent]);

  useEffect(() => {
    return onEvent("clear", () => {
      const c = canvasRef.current;
      c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    });
  }, [onEvent]);

  // Clear canvas when round starts/changes
  useEffect(() => {
    const c = canvasRef.current;
    c?.getContext("2d")?.clearRect(0, 0, c?.width || 0, c?.height || 0);
  }, [state.round, state.phase]);

  // Auto-end when timeout
  useEffect(() => {
    if (state.phase !== "playing") return;
    if (!isDrawer) return; // drawer is authoritative on time
    const remain = ROUND_MS - (Date.now() - state.startedAt);
    if (remain <= 0) endRound(null);
    const t = setTimeout(() => endRound(null), Math.max(0, remain));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.startedAt, isDrawer]);

  const startRound = () => {
    const drawer: Me = state.round === 0 ? me : state.drawer === "gu" ? "li" : "gu";
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    const mask = word.replace(/\S/g, "_");
    setState({
      ...state,
      phase: "playing",
      drawer,
      word,
      wordMask: mask,
      startedAt: Date.now(),
      round: state.round + 1,
      winner: null,
      guesses: [],
    });
    setGuess("");
  };

  const endRound = (winner: Me | null) => {
    const scores = { ...state.scores };
    if (winner) {
      scores[winner] += 3;
      scores[state.drawer] += 1;
    }
    setState({ ...state, phase: "reveal", winner, scores });
  };

  const reset = () => setState({ ...initial });

  // Canvas drawing
  const onPointerDown = (e: React.PointerEvent) => {
    if (!isDrawer || state.phase !== "playing") return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    const p = getPos(e);
    lastRef.current = p;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current || !isDrawer) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !lastRef.current) return;
    const p = getPos(e);
    const seg: Stroke = { x: lastRef.current.x, y: lastRef.current.y, nx: p.x, ny: p.y, c: color, w: brush };
    drawSeg(ctx, seg);
    strokeBufferRef.current.push(seg);
    lastRef.current = p;
    flushStrokes();
  };
  const onPointerUp = () => {
    drawingRef.current = false;
    lastRef.current = null;
    flushStrokesNow();
  };

  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushStrokes = () => {
    if (flushTimer.current) return;
    flushTimer.current = setTimeout(flushStrokesNow, 80);
  };
  const flushStrokesNow = () => {
    if (flushTimer.current) { clearTimeout(flushTimer.current); flushTimer.current = null; }
    if (strokeBufferRef.current.length === 0) return;
    sendEvent("stroke", strokeBufferRef.current);
    strokeBufferRef.current = [];
  };

  const clearCanvas = () => {
    const c = canvasRef.current;
    c?.getContext("2d")?.clearRect(0, 0, c?.width || 0, c?.height || 0);
    sendEvent("clear", null);
  };

  const submitGuess = () => {
    if (!guess.trim() || state.phase !== "playing" || isDrawer) return;
    const g = guess.trim();
    const correct = norm(g) === norm(state.word);
    const entry = { from: me, text: g, correct, at: Date.now() };
    const guesses = [...state.guesses, entry];
    setGuess("");
    if (correct) {
      const scores = { ...state.scores };
      scores[me] += 3;
      scores[state.drawer] += 1;
      setState({ ...state, guesses, phase: "reveal", winner: me, scores });
    } else {
      setState({ ...state, guesses });
    }
  };

  const remaining = Math.max(0, Math.ceil((ROUND_MS - (now - state.startedAt)) / 1000));

  const info = useMemo(() => {
    if (state.phase === "playing") {
      return isDrawer ? `desenha: ${state.word}` : `adivinhe: ${state.wordMask}`;
    }
    return "";
  }, [state, isDrawer]);

  if (!peerOnline) return <WaitingPeer />;

  return (
    <div className="h-full flex flex-col bg-neutral-950 text-white">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 gap-3">
        <div className="text-xs min-w-0 flex-1">
          <p className="text-white/50">placar · rodada {state.round}</p>
          <p className="font-bold truncate">
            gu <span className="text-fuchsia-400">{state.scores.gu}</span> · li <span className="text-fuchsia-400">{state.scores.li}</span>
          </p>
        </div>
        {state.phase === "playing" && (
          <div className="text-center">
            <p className="text-[10px] text-white/50">tempo</p>
            <p className={`font-bold ${remaining < 15 ? "text-rose-400" : ""}`}>{remaining}s</p>
          </div>
        )}
        <button onClick={reset} className="p-2 text-white/50"><RotateCcw size={16} /></button>
      </div>

      {state.phase === "idle" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
          <p className="text-lg font-bold">🎨 Gartic</p>
          <p className="text-sm text-white/60">um desenha, o outro adivinha. quem adivinhar ganha 3 pts.</p>
          <button
            onClick={startRound}
            className="bg-gradient-to-r from-fuchsia-500 to-indigo-600 rounded-full px-6 py-3 font-semibold"
          >
            começar rodada
          </button>
        </div>
      )}

      {state.phase === "playing" && (
        <>
          <div className="px-4 py-2 bg-white/5 text-center">
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              {isDrawer ? "sua palavra (só você vê)" : "adivinhe"}
            </p>
            <p className="font-black text-xl tracking-widest">{info.split(": ")[1]}</p>
          </div>

          <div className="flex-1 relative bg-white/5 overflow-hidden">
            <canvas
              ref={canvasRef}
              width={800}
              height={800}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="absolute inset-0 w-full h-full touch-none bg-neutral-900"
              style={{ cursor: isDrawer ? "crosshair" : "not-allowed" }}
            />
            {state.guesses.length > 0 && (
              <div className="absolute top-2 right-2 max-h-40 w-40 overflow-y-auto bg-black/60 backdrop-blur rounded-xl p-2 space-y-1 text-xs">
                {state.guesses.slice(-8).map((g, i) => (
                  <div key={i} className={g.correct ? "text-emerald-400 font-bold" : "text-white/70"}>
                    <b>{g.from}:</b> {g.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          {isDrawer ? (
            <div className="p-3 border-t border-white/10 space-y-2">
              <div className="flex gap-1.5 items-center overflow-x-auto">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full shrink-0 border-2 ${color === c ? "border-white" : "border-white/20"}`}
                    style={{ background: c }}
                  />
                ))}
                <div className="w-px h-6 bg-white/20 mx-1" />
                {[2, 4, 8, 14].map((w) => (
                  <button
                    key={w}
                    onClick={() => setBrush(w)}
                    className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center bg-white/10 ${brush === w ? "ring-2 ring-fuchsia-400" : ""}`}
                  >
                    <span className="rounded-full bg-white" style={{ width: w, height: w }} />
                  </button>
                ))}
                <button onClick={() => setColor("#0a0a0a")} className="p-1.5 rounded-full bg-white/10"><Eraser size={14} /></button>
                <button onClick={clearCanvas} className="p-1.5 rounded-full bg-white/10 ml-auto"><Trash2 size={14} /></button>
              </div>
              <button onClick={() => endRound(null)} className="w-full text-xs text-white/40 py-1">desistir da rodada</button>
            </div>
          ) : (
            <div className="p-3 border-t border-white/10 flex gap-2">
              <input
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitGuess()}
                placeholder="chute aqui..."
                className="flex-1 bg-white/10 rounded-full px-4 py-2.5 text-sm outline-none"
              />
              <button onClick={submitGuess} className="w-11 h-11 rounded-full bg-fuchsia-500 flex items-center justify-center"><Send size={16} /></button>
            </div>
          )}
        </>
      )}

      {state.phase === "reveal" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
          <p className="text-sm text-white/50">a palavra era</p>
          <p className="text-3xl font-black text-fuchsia-400">{state.word}</p>
          <p className="text-lg mt-2">
            {state.winner === null
              ? "ninguém acertou 😅"
              : state.winner === me
              ? "você acertou! 🎉"
              : "a outra pessoa acertou!"}
          </p>
          <button
            onClick={startRound}
            className="mt-4 bg-gradient-to-r from-fuchsia-500 to-indigo-600 rounded-full px-6 py-3 font-semibold"
          >
            próxima rodada (trocar)
          </button>
        </div>
      )}
    </div>
  );
}

function drawSeg(ctx: CanvasRenderingContext2D, s: Stroke) {
  ctx.strokeStyle = s.c;
  ctx.lineWidth = s.w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(s.nx, s.ny);
  ctx.stroke();
}

function getPos(e: React.PointerEvent): { x: number; y: number } {
  const c = e.currentTarget as HTMLCanvasElement;
  const rect = c.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * c.width,
    y: ((e.clientY - rect.top) / rect.height) * c.height,
  };
}

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function WaitingPeer() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
      </div>
      <p className="font-semibold">esperando a outra pessoa...</p>
      <p className="text-xs text-white/50 mt-1">peça pra ela entrar no mesmo jogo</p>
    </div>
  );
}
