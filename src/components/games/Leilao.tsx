import { useCallback, useEffect, useState } from "react";
import { Gavel, Loader2, Trophy, Sparkles } from "lucide-react";
import { useGameChannel, type Me } from "./useGameChannel";
import { judgeAuction } from "@/lib/chat.functions";
import { THEMES, draftLots, markThemeUsed, pickBudget, pickThemeIndex } from "@/lib/leilao";

type Result = {
  guScore: number;
  liScore: number;
  guComment: string;
  liComment: string;
  winner: "gu" | "li" | "empate";
  summary: string;
};

type LState = {
  phase: "idle" | "bid" | "won" | "judging" | "done";
  themeIdx: number;
  budget: number;
  lots: string[];
  slot: number;
  turn: Me;
  bid: { by: Me; amount: number } | null;
  money: Record<Me, number>;
  squads: Record<Me, string[]>;
  wonBy: Me | null;
  wonPrice: number;
  result: Result | null;
};

const initial: LState = {
  phase: "idle",
  themeIdx: 0,
  budget: 100,
  lots: [],
  slot: 0,
  turn: "gu",
  bid: null,
  money: { gu: 0, li: 0 },
  squads: { gu: [], li: [] },
  wonBy: null,
  wonPrice: 0,
  result: null,
};

const HOST: Me = "gu";
const label = (m: Me) => (m === "gu" ? "bb gu" : "bb li");
const other = (m: Me): Me => (m === "gu" ? "li" : "gu");

export function Leilao({ me }: { me: Me }) {
  const { state, setState, peerOnline } = useGameChannel<LState>("leilao", me, initial);
  const [amount, setAmount] = useState(1);

  const theme = THEMES[state.themeIdx];
  const isHost = me === HOST;
  const item = state.lots[state.slot] ?? "?";
  const myTurn = state.phase === "bid" && state.turn === me;
  const minBid = (state.bid?.amount ?? 0) + 1;

  useEffect(() => {
    setAmount(Math.min(minBid, state.money[me] || 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.slot, state.bid?.amount, state.phase]);

  const judge = useCallback(
    (s: LState) => {
      void judgeAuction({
        data: {
          theme: THEMES[s.themeIdx].name,
          slots: THEMES[s.themeIdx].slots,
          gu: s.squads.gu,
          li: s.squads.li,
          budget: s.budget,
        },
      })
        .then((result) => setState((prev) => ({ ...prev, phase: "done", result })))
        .catch(() => setState((prev) => ({ ...prev, phase: "done", result: null })));
    },
    [setState],
  );

  const start = () => {
    const themeIdx = pickThemeIndex();
    markThemeUsed(THEMES[themeIdx].id);
    const budget = pickBudget();
    setState({
      ...initial,
      phase: "bid",
      themeIdx,
      budget,
      lots: draftLots(THEMES[themeIdx]),
      turn: Math.random() < 0.5 ? "gu" : "li",
      money: { gu: budget, li: budget },
      squads: { gu: [], li: [] },
    });
  };

  const raise = () => {
    const value = Math.max(minBid, Math.min(amount, state.money[me]));
    if (value < minBid) return;
    setState((prev) => ({ ...prev, bid: { by: me, amount: value }, turn: other(me) }));
  };

  // deixar levar / passar
  const pass = () => {
    setState((prev) => {
      const winner = prev.bid?.by ?? null;
      if (!winner) {
        // ninguém deu lance: item fica sem dono
        return { ...prev, phase: "won", wonBy: null, wonPrice: 0 };
      }
      const price = prev.bid!.amount;
      const money = { ...prev.money, [winner]: Math.max(0, prev.money[winner] - price) };
      const squads = { ...prev.squads, [winner]: [...prev.squads[winner], prev.lots[prev.slot]] };
      return { ...prev, phase: "won", wonBy: winner, wonPrice: price, money, squads };
    });
  };

  const next = () => {
    setState((prev) => {
      const nextSlot = prev.slot + 1;
      if (nextSlot >= prev.lots.length) {
        const s = { ...prev, phase: "judging" as const };
        setTimeout(() => judge(s), 0);
        return s;
      }
      return {
        ...prev,
        phase: "bid",
        slot: nextSlot,
        bid: null,
        wonBy: null,
        wonPrice: 0,
        // alterna quem começa
        turn: nextSlot % 2 === 0 ? prev.turn : other(prev.turn),
      };
    });
  };

  if (!peerOnline) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <Gavel size={34} className="mb-3 text-amber-400" />
        <p className="font-semibold">esperando a outra pessoa...</p>
        <p className="text-xs text-white/50 mt-1">os dois precisam abrir o Leilão</p>
      </div>
    );
  }

  if (state.phase === "idle") {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-4">
        <Gavel size={40} className="text-amber-400" />
        <div>
          <p className="font-bold text-lg">Leilão</p>
          <p className="text-xs text-white/60 mt-2 max-w-xs">
            Cada rodada tem 1 item do tema. Um oferece um valor, o outro pode cobrir o lance ou
            apertar em "deixar levar" — quem cobriu por último leva o item e paga. No fim, a IA dá
            nota pros dois times.
          </p>
        </div>
        {isHost ? (
          <button
            onClick={start}
            className="px-6 py-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 font-bold"
          >
            Sortear tema e começar
          </button>
        ) : (
          <p className="text-xs text-white/50">bb gu vai sortear o tema...</p>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 pb-28">
      <div className="max-w-md mx-auto">
        <div className="rounded-2xl bg-white/5 p-4 text-center">
          <p className="text-[11px] uppercase tracking-wider text-white/40">Leilão</p>
          <p className="font-bold text-lg">
            {theme.emoji} {theme.name}
          </p>
          <div className="flex justify-center gap-4 mt-3 text-sm">
            <span className="text-emerald-400 font-semibold">
              {label("gu")}: R${state.money.gu}
            </span>
            <span className="text-fuchsia-400 font-semibold">
              {label("li")}: R${state.money.li}
            </span>
          </div>
        </div>

        {(state.phase === "bid" || state.phase === "won") && (
          <>
            <p className="text-center text-xs text-white/50 mt-3">
              Item {state.slot + 1}/{state.lots.length} · {theme.slots[state.slot]}
            </p>
            <div className="mt-3 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-600/10 border border-amber-400/20 p-6 text-center">
              <p className="text-2xl font-black">{item}</p>
              <p className="mt-2 text-sm text-white/70">
                {state.bid
                  ? `Lance atual: R$${state.bid.amount} · ${label(state.bid.by)}`
                  : "Sem lances ainda"}
              </p>
            </div>
          </>
        )}

        {state.phase === "bid" && (
          <div className="mt-4 space-y-3">
            {myTurn ? (
              <>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-sm mb-2">
                    Sua oferta: <span className="font-bold text-amber-400">R${amount}</span>
                  </p>
                  <input
                    type="range"
                    min={Math.min(minBid, state.money[me])}
                    max={Math.max(state.money[me], minBid)}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                  <div className="flex justify-between text-[11px] text-white/40">
                    <span>R${minBid}</span>
                    <span>R${state.money[me]}</span>
                  </div>
                </div>
                <button
                  onClick={raise}
                  disabled={state.money[me] < minBid}
                  className="w-full py-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 font-bold disabled:opacity-40"
                >
                  {state.bid ? `Cobrir por R$${Math.max(minBid, amount)}` : `Oferecer R$${amount}`}
                </button>
                <button
                  onClick={pass}
                  className="w-full py-3 rounded-2xl bg-white/10 font-semibold"
                >
                  {state.bid ? `Deixar ${label(state.bid.by)} levar` : "Passar item"}
                </button>
              </>
            ) : (
              <p className="text-center text-sm text-white/60 py-6">
                vez de {label(state.turn)}...
              </p>
            )}
          </div>
        )}

        {state.phase === "won" && (
          <div className="mt-5 space-y-4">
            <div className="rounded-3xl bg-white/5 p-6 text-center animate-in fade-in zoom-in duration-300">
              <Sparkles className="mx-auto text-amber-400 mb-2 animate-pulse" />
              {state.wonBy ? (
                <>
                  <p className="text-lg font-black">
                    {state.wonBy === me ? "Você levou!" : `${label(state.wonBy)} levou!`}
                  </p>
                  <p className="text-sm text-white/70 mt-1">
                    {item} por R${state.wonPrice}
                  </p>
                </>
              ) : (
                <p className="text-lg font-black">Ninguém quis {item} 😅</p>
              )}
            </div>
            {isHost ? (
              <button onClick={next} className="w-full py-3 rounded-2xl bg-white text-black font-bold">
                {state.slot + 1 >= state.lots.length ? "Ver resultado" : "Próximo item"}
              </button>
            ) : (
              <p className="text-center text-xs text-white/50">bb gu abre o próximo item...</p>
            )}
          </div>
        )}

        {state.phase === "judging" && (
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <Loader2 className="animate-spin text-amber-400" />
            <p className="text-sm text-white/70">a IA está avaliando os times...</p>
          </div>
        )}

        {state.phase === "done" && (
          <div className="mt-4 space-y-3">
            {state.result && (
              <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/10 p-4 text-center">
                <Trophy className="mx-auto text-amber-400 mb-1" />
                <p className="font-black text-lg">
                  {state.result.winner === "empate"
                    ? "Empate!"
                    : `${label(state.result.winner)} venceu!`}
                </p>
                <p className="text-xs text-white/70 mt-1">{state.result.summary}</p>
              </div>
            )}
            {(["gu", "li"] as Me[]).map((m) => (
              <div key={m} className="rounded-2xl bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold">{label(m)}</p>
                  {state.result && (
                    <p className="font-black text-amber-400">
                      {m === "gu" ? state.result.guScore : state.result.liScore}/10
                    </p>
                  )}
                </div>
                <ul className="mt-2 space-y-1 text-sm text-white/80">
                  {state.squads[m].length === 0 && (
                    <li className="text-white/40 text-xs">nenhum item</li>
                  )}
                  {state.squads[m].map((it, i) => (
                    <li key={`${it}-${i}`}>{it}</li>
                  ))}
                </ul>
                {state.result && (
                  <p className="text-xs text-white/60 mt-2">
                    {m === "gu" ? state.result.guComment : state.result.liComment}
                  </p>
                )}
              </div>
            ))}
            {isHost && (
              <button
                onClick={start}
                className="w-full py-3 rounded-2xl bg-white text-black font-bold"
              >
                Novo tema
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
