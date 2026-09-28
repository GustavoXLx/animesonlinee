import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Hand, RotateCcw } from "lucide-react";
import { useGameChannel, type Me } from "./useGameChannel";

const DEFAULT_THEMES = ["Nome", "Animal", "Cor", "Fruta", "Cidade/País", "Objeto", "Comida", "Marca"];
const LETTERS = "ABCDEFGHIJLMNOPRSTUV".split("");

type StopState = {
  phase: "setup" | "playing" | "review";
  themes: string[];
  letter: string;
  round: number;
  stopBy: Me | null;
  usedLetters: string[];
  /** respostas anuladas: "gu|Tema" */
  rejected: string[];
  total: { gu: number; li: number };
};

const initial: StopState = {
  phase: "setup",
  themes: DEFAULT_THEMES,
  letter: "",
  round: 0,
  stopBy: null,
  usedLetters: [],
  rejected: [],
  total: { gu: 0, li: 0 },
};

const norm = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

type Answers = Record<string, string>;

function scoreRound(s: StopState, a: Record<Me, Answers>) {
  const out = { gu: 0, li: 0 } as Record<Me, number>;
  const per: Record<string, Record<Me, number>> = {};
  for (const t of s.themes) {
    const ok = (who: Me) => {
      const v = norm(a[who][t] ?? "");
      return v.length > 1 && v[0] === norm(s.letter) && !s.rejected.includes(`${who}|${t}`) ? v : "";
    };
    const g = ok("gu");
    const l = ok("li");
    const pts = (mine: string, theirs: string) => (!mine ? 0 : mine === theirs ? 5 : 10);
    per[t] = { gu: pts(g, l), li: pts(l, g) };
    out.gu += per[t].gu;
    out.li += per[t].li;
  }
  return { out, per };
}

export function Stop({ me }: { me: Me }) {
  const { state, setState, peerOnline, sendEvent, onEvent } = useGameChannel<StopState>("stop", me, initial);
  const other: Me = me === "gu" ? "li" : "gu";
  const [mine, setMine] = useState<Answers>({});
  const [theirs, setTheirs] = useState<Answers | null>(null);
  const [newTheme, setNewTheme] = useState("");
  const mineRef = useRef(mine);
  mineRef.current = mine;
  const sentRef = useRef<number>(-1);

  // nova rodada: limpa as respostas
  useEffect(() => {
    if (state.phase === "playing") {
      setMine({});
      setTheirs(null);
      sentRef.current = -1;
    }
  }, [state.phase, state.round]);

  // troca de respostas quando alguém dá STOP
  useEffect(() => {
    const off = onEvent("ans", (d) => {
      const p = d as { round: number; answers: Answers };
      setTheirs(p.answers);
      if (sentRef.current !== p.round) {
        sentRef.current = p.round;
        sendEvent("ans", { round: p.round, answers: mineRef.current });
      }
    });
    return off;
  }, [onEvent, sendEvent]);

  useEffect(() => {
    if (state.phase === "review" && sentRef.current !== state.round) {
      sentRef.current = state.round;
      sendEvent("ans", { round: state.round, answers: mineRef.current });
    }
  }, [state.phase, state.round, sendEvent]);

  const all = useMemo(
    () => ({ [me]: mine, [other]: theirs ?? {} }) as Record<Me, Answers>,
    [me, other, mine, theirs],
  );
  const result = useMemo(() => scoreRound(state, all), [state, all]);

  const start = () => {
    const free = LETTERS.filter((l) => !state.usedLetters.includes(l));
    const pool = free.length ? free : LETTERS;
    const letter = pool[Math.floor(Math.random() * pool.length)];
    setState({
      ...state,
      phase: "playing",
      letter,
      round: state.round + 1,
      stopBy: null,
      rejected: [],
      usedLetters: free.length ? [...state.usedLetters, letter] : [letter],
    });
  };

  const stop = () => setState((p) => (p.phase === "playing" ? { ...p, phase: "review", stopBy: me } : p));

  const nextRound = () => {
    const total = { gu: state.total.gu + result.out.gu, li: state.total.li + result.out.li };
    setState({ ...state, total, phase: "setup" });
  };

  if (!peerOnline) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <span className="mb-4 h-3 w-3 animate-pulse rounded-full bg-amber-400" />
        <p className="font-semibold">esperando a outra pessoa...</p>
        <p className="mt-1 text-xs text-white/50">o jogo começa quando vocês dois entrarem</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-md space-y-4 p-4">
        <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-xs">
          <div>
            <p className="text-white/50">stop · rodada {state.round}</p>
            <p className="font-bold">
              gu <span className="text-rose-400">{state.total.gu}</span> · li{" "}
              <span className="text-rose-400">{state.total.li}</span>
            </p>
          </div>
          <button onClick={() => setState({ ...initial, themes: state.themes })} aria-label="Zerar placar" className="p-2 text-white/50">
            <RotateCcw size={16} />
          </button>
        </div>

        {state.phase === "setup" && (
          <>
            <p className="text-sm font-semibold">Temas da partida</p>
            <div className="flex flex-wrap gap-2">
              {state.themes.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-full bg-white/10 pl-3 pr-1 py-1 text-xs">
                  {t}
                  <button
                    aria-label={`Remover ${t}`}
                    onClick={() => setState((p) => ({ ...p, themes: p.themes.filter((x) => x !== t) }))}
                    className="p-0.5 text-white/50"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const t = newTheme.trim().slice(0, 30);
                if (!t) return;
                setState((p) => (p.themes.includes(t) ? p : { ...p, themes: [...p.themes, t].slice(0, 16) }));
                setNewTheme("");
              }}
            >
              <input
                value={newTheme}
                onChange={(e) => setNewTheme(e.target.value)}
                placeholder="novo tema (ex: Anime, Filme...)"
                className="flex-1 rounded-full bg-white/10 px-4 py-2 text-sm outline-none"
              />
              <button className="rounded-full bg-white/15 px-3" aria-label="Adicionar tema">
                <Plus size={16} />
              </button>
            </form>
            <button
              disabled={state.themes.length < 2}
              onClick={start}
              className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-sm font-bold disabled:opacity-40"
            >
              sortear letra e começar
            </button>
          </>
        )}

        {state.phase !== "setup" && (
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-white/40">letra</p>
            <p className="text-6xl font-black text-emerald-400">{state.letter}</p>
          </div>
        )}

        {state.phase === "playing" && (
          <>
            <div className="space-y-2">
              {state.themes.map((t) => (
                <label key={t} className="block">
                  <span className="text-[11px] text-white/50">{t}</span>
                  <input
                    value={mine[t] ?? ""}
                    onChange={(e) => setMine((m) => ({ ...m, [t]: e.target.value }))}
                    placeholder={`${state.letter}...`}
                    className="mt-0.5 w-full rounded-xl bg-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
              ))}
            </div>
            <button
              onClick={stop}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-red-500 to-rose-600 py-4 text-lg font-black"
            >
              <Hand size={20} /> STOP!
            </button>
          </>
        )}

        {state.phase === "review" && (
          <>
            <p className="text-center text-sm text-white/60">
              <b>{state.stopBy === "gu" ? "bb gu" : "bb li"}</b> pediu STOP! toque numa resposta pra anular
            </p>
            {!theirs && <p className="text-center text-xs text-white/40">recebendo respostas...</p>}
            <div className="space-y-2">
              {state.themes.map((t) => (
                <div key={t} className="rounded-xl bg-white/5 p-3">
                  <p className="mb-2 text-[11px] text-white/50">{t}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["gu", "li"] as Me[]).map((w) => {
                      const key = `${w}|${t}`;
                      const off = state.rejected.includes(key);
                      return (
                        <button
                          key={w}
                          onClick={() =>
                            setState((p) => ({
                              ...p,
                              rejected: p.rejected.includes(key) ? p.rejected.filter((x) => x !== key) : [...p.rejected, key],
                            }))
                          }
                          className={`rounded-lg px-2 py-1.5 text-left text-sm ${off ? "bg-red-500/20 line-through text-white/40" : "bg-white/10"}`}
                        >
                          <span className="block text-[9px] text-white/40">{w === "gu" ? "bb gu" : "bb li"}</span>
                          {all[w][t] || "—"}
                          <span className="float-right text-xs text-emerald-400">+{result.per[t]?.[w] ?? 0}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-white/5 p-3 text-center text-sm">
              rodada: gu <b>+{result.out.gu}</b> · li <b>+{result.out.li}</b>
            </div>
            <button
              disabled={!theirs}
              onClick={nextRound}
              className="w-full rounded-full bg-white/15 py-3 text-sm font-semibold disabled:opacity-40"
            >
              somar pontos e próxima rodada
            </button>
          </>
        )}
      </div>
    </div>
  );
}
