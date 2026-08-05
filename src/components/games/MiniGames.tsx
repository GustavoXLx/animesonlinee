import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Send } from "lucide-react";
import { useGameChannel, type Me } from "./useGameChannel";

function Waiting({ peerOnline, children }: { peerOnline: boolean; children: React.ReactNode }) {
  if (!peerOnline) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
          <span className="h-3 w-3 animate-pulse rounded-full bg-amber-400" />
        </div>
        <p className="font-semibold">esperando a outra pessoa...</p>
        <p className="mt-1 text-xs text-white/50">o jogo começa quando vocês dois entrarem</p>
      </div>
    );
  }
  return <div className="h-full overflow-y-auto">{children}</div>;
}

function Board({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md space-y-4 p-4">{children}</div>;
}

function ScoreBar({ label, right, onReset }: { label: string; right: React.ReactNode; onReset: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
      <div className="text-xs">
        <p className="text-white/50">{label}</p>
        <p className="font-bold">{right}</p>
      </div>
      <button onClick={onReset} aria-label="Reiniciar" className="p-2 text-white/50">
        <RotateCcw size={16} />
      </button>
    </div>
  );
}

// ============ LIG 4 ============
type Lig4State = {
  cells: (Me | null)[]; // 7 cols x 6 rows, index = row*7+col
  turn: Me;
  starter: Me;
  scores: { gu: number; li: number };
  winner: Me | "draw" | null;
  line: number[];
};
const lig4Initial: Lig4State = {
  cells: Array(42).fill(null), turn: "gu", starter: "gu", scores: { gu: 0, li: 0 }, winner: null, line: [],
};

function lig4Check(cells: (Me | null)[], idx: number): number[] | null {
  const row = Math.floor(idx / 7);
  const col = idx % 7;
  const who = cells[idx];
  const dirs: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    const line = [idx];
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && cells[r * 7 + c] === who) {
        line.push(r * 7 + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

export function Lig4({ me }: { me: Me }) {
  const { state, setState, peerOnline } = useGameChannel<Lig4State>("lig4", me, lig4Initial);

  const drop = (col: number) => {
    if (state.winner || state.turn !== me) return;
    let target = -1;
    for (let r = 5; r >= 0; r--) {
      if (!state.cells[r * 7 + col]) { target = r * 7 + col; break; }
    }
    if (target < 0) return;
    const cells = [...state.cells];
    cells[target] = me;
    const line = lig4Check(cells, target);
    if (line) {
      const scores = { ...state.scores };
      scores[me] += 1;
      setState({ ...state, cells, winner: me, line, scores });
    } else if (cells.every(Boolean)) {
      setState({ ...state, cells, winner: "draw" });
    } else {
      setState({ ...state, cells, turn: me === "gu" ? "li" : "gu" });
    }
  };

  const newRound = () => {
    const starter: Me = state.starter === "gu" ? "li" : "gu";
    setState({ ...state, cells: Array(42).fill(null), turn: starter, starter, winner: null, line: [] });
  };

  return (
    <Waiting peerOnline={peerOnline}>
      <Board>
        <ScoreBar
          label="lig 4"
          right={<>gu <span className="text-sky-400">{state.scores.gu}</span> · li <span className="text-sky-400">{state.scores.li}</span></>}
          onReset={() => setState({ ...lig4Initial })}
        />
        <p className="text-center text-sm">
          {state.winner
            ? state.winner === "draw" ? "empatou!" : state.winner === me ? "você ganhou! 🎉" : "você perdeu 😢"
            : state.turn === me ? "sua vez — escolha a coluna" : "vez da outra pessoa..."}
        </p>
        <div className="grid grid-cols-7 gap-1.5 rounded-3xl bg-sky-900/40 p-2">
          {Array.from({ length: 42 }, (_, i) => {
            const v = state.cells[i];
            const hl = state.line.includes(i);
            return (
              <button
                key={i}
                onClick={() => drop(i % 7)}
                className={`aspect-square rounded-full transition ${
                  v === "gu" ? "bg-gradient-to-br from-sky-400 to-indigo-600" : v === "li" ? "bg-gradient-to-br from-pink-400 to-rose-600" : "bg-neutral-950/60"
                } ${hl ? "ring-2 ring-emerald-400" : ""}`}
              />
            );
          })}
        </div>
        {state.winner && (
          <button onClick={newRound} className="w-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 py-3 text-sm font-semibold">
            nova partida
          </button>
        )}
      </Board>
    </Waiting>
  );
}

// ============ JOGO DA MEMÓRIA ============
const PAIRS = ["🐶", "🐱", "🌙", "🍕", "🎮", "💍", "🍀", "🎧"];
type MemState = {
  deck: string[];
  flipped: number[];
  matched: number[];
  turn: Me;
  scores: { gu: number; li: number };
  started: boolean;
};
const memInitial: MemState = { deck: [], flipped: [], matched: [], turn: "gu", scores: { gu: 0, li: 0 }, started: false };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function Memoria({ me }: { me: Me }) {
  const { state, setState, peerOnline } = useGameChannel<MemState>("memoria", me, memInitial);

  const start = () =>
    setState({ ...memInitial, deck: shuffle([...PAIRS, ...PAIRS]), started: true, turn: me });

  useEffect(() => {
    if (state.flipped.length !== 2) return;
    const [a, b] = state.flipped;
    const hit = state.deck[a] === state.deck[b];
    const t = setTimeout(() => {
      if (hit) {
        const scores = { ...state.scores };
        scores[state.turn] += 1;
        setState({ ...state, matched: [...state.matched, a, b], flipped: [], scores });
      } else {
        setState({ ...state, flipped: [], turn: state.turn === "gu" ? "li" : "gu" });
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.flipped.length]);

  const flip = (i: number) => {
    if (state.turn !== me || state.flipped.length >= 2) return;
    if (state.flipped.includes(i) || state.matched.includes(i)) return;
    setState({ ...state, flipped: [...state.flipped, i] });
  };

  const done = state.started && state.matched.length === state.deck.length && state.deck.length > 0;

  return (
    <Waiting peerOnline={peerOnline}>
      <Board>
        <ScoreBar
          label="memória"
          right={<>gu <span className="text-violet-400">{state.scores.gu}</span> · li <span className="text-violet-400">{state.scores.li}</span></>}
          onReset={() => setState({ ...memInitial })}
        />
        {!state.started ? (
          <div className="py-8 text-center">
            <p className="mb-4 text-sm text-white/70">Ache os pares. Quem acerta joga de novo.</p>
            <button onClick={start} className="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 px-6 py-3 text-sm font-semibold">
              começar
            </button>
          </div>
        ) : (
          <>
            <p className="text-center text-sm">
              {done
                ? state.scores[me] > state.scores[me === "gu" ? "li" : "gu"] ? "você ganhou! 🎉" : state.scores.gu === state.scores.li ? "empatou!" : "você perdeu 😢"
                : state.turn === me ? "sua vez" : "vez da outra pessoa..."}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {state.deck.map((emoji, i) => {
                const shown = state.flipped.includes(i) || state.matched.includes(i);
                return (
                  <button
                    key={i}
                    onClick={() => flip(i)}
                    className={`flex aspect-square items-center justify-center rounded-2xl text-3xl transition ${
                      shown ? "bg-white/15" : "bg-gradient-to-br from-violet-600 to-fuchsia-700 active:scale-95"
                    } ${state.matched.includes(i) ? "opacity-50" : ""}`}
                  >
                    {shown ? emoji : ""}
                  </button>
                );
              })}
            </div>
            {done && (
              <button onClick={start} className="w-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 py-3 text-sm font-semibold">
                jogar de novo
              </button>
            )}
          </>
        )}
      </Board>
    </Waiting>
  );
}

// ============ FORCA ============
type ForcaState = {
  phase: "idle" | "setting" | "playing";
  host: Me;
  word: string;
  hint: string;
  guesses: string[];
  scores: { gu: number; li: number };
};
const forcaInitial: ForcaState = { phase: "idle", host: "gu", word: "", hint: "", guesses: [], scores: { gu: 0, li: 0 } };
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const MAX_ERR = 6;

export function Forca({ me }: { me: Me }) {
  const { state, setState, peerOnline } = useGameChannel<ForcaState>("forca", me, forcaInitial);
  const [word, setWord] = useState("");
  const [hint, setHint] = useState("");

  const isHost = state.host === me;
  const norm = (s: string) => s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const letters = norm(state.word).split("");
  const errors = state.guesses.filter((g) => !letters.includes(g)).length;
  const won = state.phase === "playing" && letters.every((l) => l === " " || state.guesses.includes(l));
  const lost = errors >= MAX_ERR;

  const startSetting = () => {
    const host: Me = state.phase === "idle" ? me : state.host === "gu" ? "li" : "gu";
    setState({ ...state, phase: "setting", host, word: "", hint: "", guesses: [] });
    setWord(""); setHint("");
  };

  const confirmWord = () => {
    if (word.trim().length < 3) return;
    setState({ ...state, phase: "playing", word: word.trim(), hint: hint.trim(), guesses: [] });
  };

  const guess = (l: string) => {
    if (isHost || won || lost || state.guesses.includes(l)) return;
    setState({ ...state, guesses: [...state.guesses, l] });
  };

  useEffect(() => {
    if (state.phase !== "playing" || isHost) return;
    if (!won && !lost) return;
    const scores = { ...state.scores };
    if (won) scores[me] += 1; else scores[state.host] += 1;
    if (scores.gu !== state.scores.gu || scores.li !== state.scores.li) {
      setState({ ...state, scores, phase: "playing" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won, lost]);

  return (
    <Waiting peerOnline={peerOnline}>
      <Board>
        <ScoreBar
          label="forca"
          right={<>gu <span className="text-amber-400">{state.scores.gu}</span> · li <span className="text-amber-400">{state.scores.li}</span></>}
          onReset={() => setState({ ...forcaInitial })}
        />

        {state.phase === "idle" && (
          <div className="py-8 text-center">
            <p className="mb-4 text-sm text-white/70">Um escolhe a palavra e a dica, o outro adivinha.</p>
            <button onClick={startSetting} className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-3 text-sm font-semibold">
              começar rodada
            </button>
          </div>
        )}

        {state.phase === "setting" && (
          isHost ? (
            <div className="space-y-3">
              <p className="text-center text-xs text-white/60">só você vê a palavra</p>
              <input
                autoFocus value={word} onChange={(e) => setWord(e.target.value)}
                placeholder="palavra secreta"
                className="w-full rounded-2xl bg-white/10 px-4 py-2.5 text-sm outline-none"
              />
              <input
                value={hint} onChange={(e) => setHint(e.target.value)}
                placeholder="dica (opcional)"
                className="w-full rounded-2xl bg-white/10 px-4 py-2.5 text-sm outline-none"
              />
              <button onClick={confirmWord} disabled={word.trim().length < 3} className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 py-3 text-sm font-semibold disabled:opacity-40">
                <Send size={14} /> enviar
              </button>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-white/60">
              esperando <b>{state.host === "gu" ? "bb gu" : "bb li"}</b> escolher a palavra...
            </p>
          )
        )}

        {state.phase === "playing" && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-white/40">dica</p>
              <p className="text-sm font-semibold">{state.hint || "sem dica 😈"}</p>
            </div>
            <p className="text-center text-3xl tracking-[0.3em]">
              {letters.map((l, i) => (l === " " ? " " : state.guesses.includes(l) || won || lost ? l : "_")).join("")}
            </p>
            <p className="text-center text-xs text-white/50">
              erros {errors}/{MAX_ERR} {"❤️".repeat(Math.max(0, MAX_ERR - errors))}
            </p>
            {won && <p className="text-center font-bold text-emerald-400">acertou! 🎉</p>}
            {lost && <p className="text-center font-bold text-red-400">acabaram as chances — era "{state.word}"</p>}
            {!isHost && !won && !lost && (
              <div className="grid grid-cols-7 gap-1.5">
                {ALPHA.map((l) => {
                  const used = state.guesses.includes(l);
                  return (
                    <button
                      key={l}
                      onClick={() => guess(l)}
                      disabled={used}
                      className={`rounded-lg py-2 text-sm font-bold ${
                        used ? (letters.includes(l) ? "bg-emerald-600/40" : "bg-red-600/30 opacity-60") : "bg-white/10 active:scale-95"
                      }`}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            )}
            {isHost && !won && !lost && (
              <p className="text-center text-xs text-white/50">esperando os palpites...</p>
            )}
            {(won || lost) && (
              <button onClick={startSetting} className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 py-3 text-sm font-semibold">
                próxima rodada (troca quem escolhe)
              </button>
            )}
          </div>
        )}
      </Board>
    </Waiting>
  );
}

// ============ VERDADE OU DESAFIO ============
const VERDADES = [
  "Qual foi a primeira coisa que você pensou de mim?",
  "Qual foi a mentirinha mais boba que você já me contou?",
  "O que mais te dá ciúme?",
  "Qual momento nosso você repetiria hoje?",
  "O que você mais sente falta quando estamos longe?",
  "Qual foi a vez que você mais riu comigo?",
  "Tem algo que você quis me dizer e não disse?",
  "Qual é o seu plano secreto pra gente?",
];
const DESAFIOS = [
  "Manda um áudio cantando nossa música.",
  "Manda uma selfie fazendo a cara mais feia possível.",
  "Escreva uma declaração em 5 palavras.",
  "Manda uma foto do que você está fazendo agora.",
  "Imite eu falando por 10 segundos em áudio.",
  "Diga 3 coisas que ama em mim, sem pensar.",
  "Escolha um apelido novo pra mim agora.",
  "Manda um poema tosco de 2 linhas.",
];

type VDState = {
  turn: Me;
  kind: "verdade" | "desafio" | null;
  prompt: string;
  answered: boolean;
  count: { gu: number; li: number };
};
const vdInitial: VDState = { turn: "gu", kind: null, prompt: "", answered: false, count: { gu: 0, li: 0 } };

export function VerdadeDesafio({ me }: { me: Me }) {
  const { state, setState, peerOnline } = useGameChannel<VDState>("verdade", me, vdInitial);

  const pick = useCallback(
    (kind: "verdade" | "desafio") => {
      const pool = kind === "verdade" ? VERDADES : DESAFIOS;
      setState({ ...state, kind, prompt: pool[Math.floor(Math.random() * pool.length)], answered: false });
    },
    [state, setState],
  );

  const done = () => {
    const count = { ...state.count };
    count[state.turn] += 1;
    setState({ ...state, answered: true, count });
  };

  const next = () =>
    setState({ ...state, turn: state.turn === "gu" ? "li" : "gu", kind: null, prompt: "", answered: false });

  const mine = state.turn === me;

  return (
    <Waiting peerOnline={peerOnline}>
      <Board>
        <ScoreBar
          label="verdade ou desafio"
          right={<>gu <span className="text-rose-400">{state.count.gu}</span> · li <span className="text-rose-400">{state.count.li}</span></>}
          onReset={() => setState({ ...vdInitial })}
        />
        <p className="text-center text-sm text-white/60">
          vez de <b>{state.turn === "gu" ? "bb gu" : "bb li"}</b>
        </p>

        {!state.kind ? (
          mine ? (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => pick("verdade")} className="rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-600 py-8 text-sm font-bold">
                verdade 💬
              </button>
              <button onClick={() => pick("desafio")} className="rounded-3xl bg-gradient-to-br from-rose-500 to-red-600 py-8 text-sm font-bold">
                desafio 🔥
              </button>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-white/50">esperando a escolha...</p>
          )
        ) : (
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-center">
              <p className="text-[10px] uppercase tracking-widest text-white/40">{state.kind}</p>
              <p className="mt-2 text-lg font-semibold leading-snug">{state.prompt}</p>
            </div>
            {mine && !state.answered && (
              <button onClick={done} className="w-full rounded-full bg-gradient-to-r from-rose-500 to-red-600 py-3 text-sm font-semibold">
                cumpri! ✅
              </button>
            )}
            {state.answered && (
              <button onClick={next} className="w-full rounded-full bg-white/10 py-3 text-sm font-semibold">
                passar a vez
              </button>
            )}
            {!mine && !state.answered && (
              <p className="text-center text-xs text-white/50">responde aí no chat 👀</p>
            )}
          </div>
        )}
      </Board>
    </Waiting>
  );
}
