import { useCallback, useEffect, useState } from "react";
import { X, Sparkles, Grid3x3, Hand, ArrowLeft, RotateCcw, Send, Palette, Brush, Trophy } from "lucide-react";
import { useGameChannel, type Me } from "./useGameChannel";
import { Gartic } from "./Gartic";
import { HeadBall } from "./HeadBall";

type GameKey = "sintonia" | "velha" | "ppt" | "gartic" | "headball";

const GAMES: { key: GameKey; name: string; desc: string; icon: React.ComponentType<{ size?: number }>; gradient: string }[] = [
  { key: "headball", name: "Head Ball ⚽", desc: "futebol 1x1 com cabeças", icon: Trophy, gradient: "from-emerald-500 to-teal-600" },
  { key: "gartic", name: "Gartic 🎨", desc: "desenhe e adivinhe", icon: Brush, gradient: "from-pink-500 to-rose-600" },
  { key: "sintonia", name: "Sintonia", desc: "adivinhe a intensidade pela dica", icon: Sparkles, gradient: "from-fuchsia-500 to-indigo-600" },
  { key: "velha", name: "Jogo da Velha", desc: "clássico X e O", icon: Grid3x3, gradient: "from-sky-500 to-blue-600" },
  { key: "ppt", name: "Pedra Papel Tesoura", desc: "melhor de sempre", icon: Hand, gradient: "from-amber-500 to-rose-600" },
];

export function GamesPanel({ me, open, onClose }: { me: Me; open: boolean; onClose: () => void }) {
  const [active, setActive] = useState<GameKey | null>(null);

  useEffect(() => { if (!open) setActive(null); }, [open]);

  if (!open) return null;

  // ==== Fullscreen game view ====
  if (active) {
    const game = GAMES.find((g) => g.key === active)!;
    return (
      <div className="fixed inset-0 z-50 bg-neutral-950 text-white flex flex-col animate-fade-in">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
          <button onClick={() => setActive(null)} className="p-1"><ArrowLeft size={20} /></button>
          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${game.gradient} flex items-center justify-center`}>
            <game.icon size={16} />
          </div>
          <h2 className="flex-1 font-bold">{game.name}</h2>
          <button onClick={onClose} className="p-1"><X size={20} /></button>
        </header>
        <div className="flex-1 min-h-0 overflow-hidden">
          {active === "sintonia" && <Sintonia me={me} />}
          {active === "velha" && <Velha me={me} />}
          {active === "ppt" && <PPT me={me} />}
          {active === "gartic" && <Gartic me={me} />}
          {active === "headball" && <HeadBall me={me} />}
        </div>
      </div>
    );
  }

  // ==== Launcher (side drawer) ====
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose} />
      <aside className="relative w-[88%] max-w-sm h-full bg-neutral-950 border-r border-white/10 flex flex-col animate-slide-in-left">
        <header className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 flex items-center justify-center">
            <Sparkles size={16} />
          </div>
          <h2 className="flex-1 font-bold">Joguinhos 💕</h2>
          <button onClick={onClose} className="p-1"><X size={20} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-xs text-white/50 mb-2">escolham o mesmo jogo pra começar</p>
          {GAMES.map((g) => (
            <button
              key={g.key}
              onClick={() => setActive(g.key)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-[0.98] transition text-left"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${g.gradient} flex items-center justify-center shrink-0`}>
                <g.icon size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{g.name}</p>
                <p className="text-[11px] text-white/50">{g.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

// ============ Waiting screen ============
function WaitingPeer({ peerOnline, children }: { peerOnline: boolean; children: React.ReactNode }) {
  if (!peerOnline) {
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
  return <div className="h-full overflow-y-auto">{children}</div>;
}

// ============ SINTONIA ============
const SPECTRA: [string, string][] = [
  ["frio", "quente"], ["fácil", "difícil"], ["saudável", "gostoso"], ["barato", "caro"],
  ["chato", "divertido"], ["romântico", "esquisito"], ["útil", "inútil"], ["silencioso", "barulhento"],
  ["fofo", "assustador"], ["antigo", "moderno"], ["comum", "raro"], ["pequeno", "gigante"],
  ["seguro", "perigoso"], ["doce", "salgado"], ["real", "fictício"],
];

type SintoniaState = {
  phase: "idle" | "clue" | "guess" | "reveal";
  host: Me;
  spectrumIdx: number;
  target: number;
  clue: string;
  guess: number;
  scores: { gu: number; li: number };
  round: number;
};

const sintoniaInitial: SintoniaState = {
  phase: "idle", host: "gu", spectrumIdx: 0, target: 50, clue: "", guess: 50,
  scores: { gu: 0, li: 0 }, round: 0,
};

function Sintonia({ me }: { me: Me }) {
  const { state, setState, peerOnline } = useGameChannel<SintoniaState>("sintonia", me, sintoniaInitial);
  const [clueDraft, setClueDraft] = useState("");
  const [guessDraft, setGuessDraft] = useState(50);

  useEffect(() => { if (state.phase === "guess") setGuessDraft(50); }, [state.phase, state.round]);

  const startRound = () => {
    const host: Me = state.round === 0 ? me : state.host === "gu" ? "li" : "gu";
    setState({
      ...state, phase: "clue", host,
      spectrumIdx: Math.floor(Math.random() * SPECTRA.length),
      target: Math.floor(Math.random() * 101),
      clue: "", guess: 50, round: state.round + 1,
    });
    setClueDraft("");
  };
  const submitClue = () => { if (clueDraft.trim()) setState({ ...state, phase: "guess", clue: clueDraft.trim() }); };
  const submitGuess = () => {
    const diff = Math.abs(guessDraft - state.target);
    let pts = 0;
    if (diff <= 5) pts = 4; else if (diff <= 12) pts = 3; else if (diff <= 20) pts = 2; else if (diff <= 30) pts = 1;
    const scores = { ...state.scores };
    scores[state.host] += pts; scores[me] += pts;
    setState({ ...state, phase: "reveal", guess: guessDraft, scores });
  };
  const reset = () => setState({ ...sintoniaInitial });

  const [left, right] = SPECTRA[state.spectrumIdx] ?? SPECTRA[0];
  const isHost = state.host === me;

  return (
    <WaitingPeer peerOnline={peerOnline}>
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-3">
          <div className="text-xs">
            <p className="text-white/50">placar</p>
            <p className="font-bold">bb gu <span className="text-fuchsia-400">{state.scores.gu}</span> · bb li <span className="text-fuchsia-400">{state.scores.li}</span></p>
          </div>
          <button onClick={reset} className="p-2 text-white/50"><RotateCcw size={16} /></button>
        </div>

        {state.phase === "idle" && (
          <div className="text-center py-6">
            <p className="text-sm text-white/70 mb-4">Um dá uma dica, o outro adivinha onde tá o alvo na barrinha.</p>
            <button onClick={startRound} className="bg-gradient-to-r from-fuchsia-500 to-indigo-600 rounded-full px-6 py-3 font-semibold text-sm">começar rodada</button>
          </div>
        )}

        {state.phase === "clue" && (
          <div className="space-y-4">
            <Spectrum left={left} right={right} target={isHost ? state.target : undefined} />
            {isHost ? (
              <>
                <p className="text-xs text-white/60 text-center">Só você vê o alvo. Dê uma dica que leve a outra pessoa até lá.</p>
                <div className="flex gap-2">
                  <input autoFocus value={clueDraft} onChange={(e) => setClueDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitClue()} placeholder="digite sua dica..." className="flex-1 bg-white/10 rounded-full px-4 py-2.5 text-sm outline-none" />
                  <button onClick={submitClue} disabled={!clueDraft.trim()} className="bg-fuchsia-500 rounded-full w-11 h-11 flex items-center justify-center disabled:opacity-40"><Send size={16} /></button>
                </div>
              </>
            ) : (
              <p className="text-center text-sm text-white/60">esperando <b>{state.host === "gu" ? "bb gu" : "bb li"}</b> pensar numa dica...</p>
            )}
          </div>
        )}

        {state.phase === "guess" && (
          <div className="space-y-4">
            <div className="text-center bg-white/5 rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-white/40">dica</p>
              <p className="text-lg font-bold mt-1">"{state.clue}"</p>
            </div>
            <Spectrum left={left} right={right} guess={!isHost ? guessDraft : state.guess} interactive={!isHost} onChange={setGuessDraft} />
            {!isHost ? (
              <button onClick={submitGuess} className="w-full bg-gradient-to-r from-fuchsia-500 to-indigo-600 rounded-full py-3 font-semibold text-sm">confirmar palpite</button>
            ) : (
              <p className="text-center text-sm text-white/60">esperando o palpite...</p>
            )}
          </div>
        )}

        {state.phase === "reveal" && (
          <div className="space-y-4">
            <Spectrum left={left} right={right} target={state.target} guess={state.guess} />
            <div className="text-center bg-white/5 rounded-2xl p-4">
              <p className="text-xs text-white/50">dica era</p>
              <p className="font-bold">"{state.clue}"</p>
              <p className="text-xs text-white/50 mt-3">diferença</p>
              <p className="text-2xl font-black text-fuchsia-400">{Math.abs(state.guess - state.target)} pts de distância</p>
            </div>
            <button onClick={startRound} className="w-full bg-gradient-to-r from-fuchsia-500 to-indigo-600 rounded-full py-3 font-semibold text-sm">próxima rodada (trocar papel)</button>
          </div>
        )}
      </div>
    </WaitingPeer>
  );
}

function Spectrum({ left, right, target, guess, interactive, onChange }: {
  left: string; right: string; target?: number; guess?: number; interactive?: boolean; onChange?: (v: number) => void;
}) {
  return (
    <div>
      <div className="relative h-14 rounded-full bg-gradient-to-r from-sky-500 via-white/10 to-rose-500 overflow-visible">
        {typeof target === "number" && (
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-16 bg-yellow-300 rounded-full shadow-lg" style={{ left: `${target}%` }}>
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-yellow-300">alvo</div>
          </div>
        )}
        {typeof guess === "number" && (
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border-2 border-fuchsia-500 shadow-xl" style={{ left: `${guess}%` }} />
        )}
      </div>
      <div className="flex justify-between text-[11px] text-white/60 mt-2 px-1">
        <span>← {left}</span><span>{right} →</span>
      </div>
      {interactive && (
        <input type="range" min={0} max={100} value={guess ?? 50} onChange={(e) => onChange?.(Number(e.target.value))} className="w-full mt-3 accent-fuchsia-500" />
      )}
    </div>
  );
}

// ============ VELHA ============
type VelhaState = {
  board: (Me | null)[]; turn: Me; starter: Me;
  scores: { gu: number; li: number; draws: number };
  finished: null | { winner: Me | "draw"; line?: number[] };
};
const velhaInitial: VelhaState = { board: Array(9).fill(null), turn: "gu", starter: "gu", scores: { gu: 0, li: 0, draws: 0 }, finished: null };
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function checkWin(b: (Me | null)[]): { winner: Me | "draw" | null; line?: number[] } {
  for (const l of LINES) { const [a, c, d] = l; if (b[a] && b[a] === b[c] && b[a] === b[d]) return { winner: b[a]!, line: l }; }
  if (b.every(Boolean)) return { winner: "draw" };
  return { winner: null };
}
function Velha({ me }: { me: Me }) {
  const { state, setState, peerOnline } = useGameChannel<VelhaState>("velha", me, velhaInitial);
  const play = (i: number) => {
    if (state.finished || state.board[i] || state.turn !== me) return;
    const board = [...state.board]; board[i] = me;
    const res = checkWin(board);
    if (res.winner) {
      const scores = { ...state.scores };
      if (res.winner === "draw") scores.draws += 1; else scores[res.winner] += 1;
      setState({ ...state, board, finished: { winner: res.winner, line: res.line }, scores });
    } else setState({ ...state, board, turn: me === "gu" ? "li" : "gu" });
  };
  const newRound = () => { const starter: Me = state.starter === "gu" ? "li" : "gu"; setState({ ...state, board: Array(9).fill(null), turn: starter, starter, finished: null }); };
  const reset = () => setState({ ...velhaInitial });

  return (
    <WaitingPeer peerOnline={peerOnline}>
      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-3">
          <div className="text-xs">
            <p className="text-white/50">placar</p>
            <p className="font-bold">gu <span className="text-emerald-400">{state.scores.gu}</span> · li <span className="text-emerald-400">{state.scores.li}</span> · empates <span className="text-white/60">{state.scores.draws}</span></p>
          </div>
          <button onClick={reset} className="p-2 text-white/50"><RotateCcw size={16} /></button>
        </div>
        <p className="text-center text-sm">
          {state.finished
            ? state.finished.winner === "draw" ? "empatou!" : state.finished.winner === me ? "você ganhou! 🎉" : "você perdeu 😢"
            : state.turn === me ? "sua vez" : "vez da outra pessoa..."}
        </p>
        <div className="grid grid-cols-3 gap-2 aspect-square max-w-xs mx-auto">
          {state.board.map((cell, i) => {
            const highlight = state.finished?.line?.includes(i);
            return (
              <button key={i} onClick={() => play(i)} disabled={!!cell || !!state.finished || state.turn !== me}
                className={`rounded-2xl bg-white/5 flex items-center justify-center text-3xl font-black transition ${highlight ? "bg-emerald-500/30 ring-2 ring-emerald-400" : ""} ${!cell && !state.finished && state.turn === me ? "hover:bg-white/10 active:scale-95" : ""}`}>
                {cell === "gu" ? "G" : cell === "li" ? "L" : ""}
              </button>
            );
          })}
        </div>
        {state.finished && (
          <button onClick={newRound} className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full py-3 font-semibold text-sm">nova partida</button>
        )}
      </div>
    </WaitingPeer>
  );
}

// ============ PPT ============
type Pick = "pedra" | "papel" | "tesoura";
type PPTState = { picks: { gu: Pick | null; li: Pick | null }; scores: { gu: number; li: number; draws: number }; round: number; revealed: boolean };
const pptInitial: PPTState = { picks: { gu: null, li: null }, scores: { gu: 0, li: 0, draws: 0 }, round: 1, revealed: false };
const EMOJI: Record<Pick, string> = { pedra: "✊", papel: "✋", tesoura: "✌️" };
function pptWinner(a: Pick, b: Pick): 0 | 1 | -1 {
  if (a === b) return 0;
  if ((a === "pedra" && b === "tesoura") || (a === "papel" && b === "pedra") || (a === "tesoura" && b === "papel")) return 1;
  return -1;
}
function PPT({ me }: { me: Me }) {
  const { state, setState, peerOnline } = useGameChannel<PPTState>("ppt", me, pptInitial);
  useEffect(() => {
    if (state.revealed) return;
    if (state.picks.gu && state.picks.li) {
      const res = pptWinner(state.picks.gu, state.picks.li);
      const scores = { ...state.scores };
      if (res === 0) scores.draws += 1; else if (res === 1) scores.gu += 1; else scores.li += 1;
      setState({ ...state, revealed: true, scores });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.picks.gu, state.picks.li]);
  const pick = useCallback((p: Pick) => { if (state.revealed || state.picks[me]) return; setState({ ...state, picks: { ...state.picks, [me]: p } }); }, [state, me, setState]);
  const next = () => setState({ ...state, picks: { gu: null, li: null }, revealed: false, round: state.round + 1 });
  const reset = () => setState({ ...pptInitial });
  const myPick = state.picks[me];
  const otherPick = state.picks[me === "gu" ? "li" : "gu"];
  const res = state.revealed && state.picks.gu && state.picks.li ? pptWinner(state.picks.gu, state.picks.li) : null;
  const outcome = res === null ? null : res === 0 ? "empatou!" : (res === 1 && me === "gu") || (res === -1 && me === "li") ? "você ganhou! 🎉" : "você perdeu 😢";

  return (
    <WaitingPeer peerOnline={peerOnline}>
      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-3">
          <div className="text-xs">
            <p className="text-white/50">rodada {state.round}</p>
            <p className="font-bold">gu <span className="text-amber-400">{state.scores.gu}</span> · li <span className="text-amber-400">{state.scores.li}</span> · empates {state.scores.draws}</p>
          </div>
          <button onClick={reset} className="p-2 text-white/50"><RotateCcw size={16} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 rounded-2xl p-4 text-center">
            <p className="text-[10px] uppercase text-white/40 mb-2">você</p>
            <div className="text-6xl h-20 flex items-center justify-center">{myPick ? EMOJI[myPick] : "❓"}</div>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 text-center">
            <p className="text-[10px] uppercase text-white/40 mb-2">ela</p>
            <div className="text-6xl h-20 flex items-center justify-center">{state.revealed && otherPick ? EMOJI[otherPick] : otherPick ? "🔒" : "❓"}</div>
          </div>
        </div>
        {state.revealed ? (
          <>
            <p className="text-center font-bold">{outcome}</p>
            <button onClick={next} className="w-full bg-gradient-to-r from-amber-500 to-rose-600 rounded-full py-3 font-semibold text-sm">próxima rodada</button>
          </>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {(["pedra", "papel", "tesoura"] as Pick[]).map((p) => (
              <button key={p} onClick={() => pick(p)} disabled={!!myPick}
                className={`p-4 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition disabled:opacity-40 ${myPick === p ? "ring-2 ring-amber-400 bg-amber-500/20" : ""}`}>
                <div className="text-4xl">{EMOJI[p]}</div>
                <p className="text-[11px] mt-1 capitalize">{p}</p>
              </button>
            ))}
          </div>
        )}
        {myPick && !state.revealed && (
          <p className="text-center text-xs text-white/50">{otherPick ? "revelando..." : "esperando ela escolher..."}</p>
        )}
      </div>
    </WaitingPeer>
  );
}
