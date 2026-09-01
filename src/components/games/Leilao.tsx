import { useCallback, useEffect, useState } from "react";
import { Gavel, Loader2, Trophy, Sparkles } from "lucide-react";
import { useGameChannel, type Me } from "./useGameChannel";
import { judgeAuction } from "@/lib/chat.functions";
import {
  THEMES,
  TEAM_SIZE,
  draftLots,
  markThemeUsed,
  pickBudget,
  pickThemeIndex,
  quotaFor,
  type Lot,
} from "@/lib/leilao";

type ItemNote = { item: string; note: number; why: string };

type Result = {
  guScore: number;
  liScore: number;
  guComment: string;
  liComment: string;
  winner: "gu" | "li" | "empate";
  summary: string;
  guItems?: ItemNote[];
  liItems?: ItemNote[];
};

type LState = {
  phase: "idle" | "bid" | "won" | "judging" | "done";
  themeIdx: number;
  budget: number;
  lots: Lot[];
  slot: number;
  turn: Me;
  bid: { by: Me; amount: number } | null;
  money: Record<Me, number>;
  squads: Record<Me, Lot[]>;
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
  const lot: Lot | undefined = state.lots[state.slot];
  const minBid = (state.bid?.amount ?? 0) + 1;

  const needs = useCallback(
    (who: Me, pos: string) => {
      const squad = state.squads[who];
      if (squad.length >= TEAM_SIZE) return false;
      const have = squad.filter((l) => l.pos === pos).length;
      return have < quotaFor(theme, pos);
    },
    [state.squads, theme],
  );

  const canBid = (who: Me) =>
    Boolean(lot) && needs(who, lot!.pos) && state.money[who] >= minBid;
  const bothFull =
    state.squads.gu.length >= TEAM_SIZE && state.squads.li.length >= TEAM_SIZE;
  const myTurn = state.phase === "bid" && state.turn === me;
  const nobodyCan = state.phase === "bid" && !canBid("gu") && !canBid("li") && !state.bid;

  useEffect(() => {
    setAmount(Math.min(minBid, Math.max(1, state.money[me])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.slot, state.bid?.amount, state.phase]);

  const judge = useCallback(
    (s: LState) => {
      const fmt = (arr: Lot[]) => arr.map((l) => `${l.pos}: ${l.item}`);
      void judgeAuction({
        data: {
          theme: THEMES[s.themeIdx].name,
          football: Boolean(THEMES[s.themeIdx].football),
          gu: fmt(s.squads.gu),
          li: fmt(s.squads.li),
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
      if (!winner) return { ...prev, phase: "won", wonBy: null, wonPrice: 0 };
      const price = prev.bid!.amount;
      const money = { ...prev.money, [winner]: Math.max(0, prev.money[winner] - price) };
      const squads = {
        ...prev.squads,
        [winner]: [...prev.squads[winner], prev.lots[prev.slot]],
      };
      return { ...prev, phase: "won", wonBy: winner, wonPrice: price, money, squads };
    });
  };

  const skip = () => setState((prev) => ({ ...prev, phase: "won", wonBy: null, wonPrice: 0 }));

  const next = () => {
    setState((prev) => {
      const full =
        prev.squads.gu.length >= TEAM_SIZE && prev.squads.li.length >= TEAM_SIZE;
      const nextSlot = prev.slot + 1;
      if (full || nextSlot >= prev.lots.length) {
        const s = { ...prev, phase: "judging" as const };
        setTimeout(() => judge(s), 0);
        return s;
      }
      // quem começa é quem tem menos itens (ou alterna)
      const guCount = prev.squads.gu.length;
      const liCount = prev.squads.li.length;
      const turn: Me = guCount === liCount ? other(prev.turn) : guCount < liCount ? "gu" : "li";
      return {
        ...prev,
        phase: "bid",
        slot: nextSlot,
        bid: null,
        wonBy: null,
        wonPrice: 0,
        turn,
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
            Cada rodada tem 1 item. Um oferece um valor, o outro pode cobrir o lance ou apertar em
            "deixar levar". Cada um monta um time de {TEAM_SIZE} itens ({TEAM_SIZE} vs {TEAM_SIZE}).
            Em temas de futebol o time precisa de 1 goleiro, 1 defensor, 2 meias e 1 atacante. No
            fim, a IA dá nota item por item.
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

  const posLine = (who: Me) => {
    if (!theme.football) return `${state.squads[who].length}/${TEAM_SIZE}`;
    return ["Goleiro", "Defensor", "Meio-campo", "Atacante"]
      .map((p) => {
        const have = state.squads[who].filter((l) => l.pos === p).length;
        return `${p[0]}${p === "Meio-campo" ? "EI" : ""}${have}/${quotaFor(theme, p)}`;
      })
      .join(" ");
  };

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
          <div className="flex justify-center gap-4 mt-1 text-[11px] text-white/50">
            <span>{posLine("gu")}</span>
            <span>{posLine("li")}</span>
          </div>
        </div>

        {(state.phase === "bid" || state.phase === "won") && lot && (
          <>
            <p className="text-center text-xs text-white/50 mt-3">
              Item {state.slot + 1} · {lot.pos}
            </p>
            <div className="mt-3 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-600/10 border border-amber-400/20 p-6 text-center">
              <p className="text-2xl font-black">{lot.item}</p>
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
            {nobodyCan ? (
              <div className="text-center space-y-3">
                <p className="text-sm text-white/60">
                  ninguém precisa desse {lot?.pos.toLowerCase()} 🤷
                </p>
                {isHost ? (
                  <button
                    onClick={skip}
                    className="w-full py-3 rounded-2xl bg-white/10 font-semibold"
                  >
                    Pular item
                  </button>
                ) : (
                  <p className="text-xs text-white/40">bb gu vai pular...</p>
                )}
              </div>
            ) : myTurn ? (
              canBid(me) ? (
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
                    className="w-full py-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 font-bold"
                  >
                    {state.bid
                      ? `Cobrir por R$${Math.max(minBid, amount)}`
                      : `Oferecer R$${amount}`}
                  </button>
                  <button
                    onClick={pass}
                    className="w-full py-3 rounded-2xl bg-white/10 font-semibold"
                  >
                    {state.bid ? `Deixar ${label(state.bid.by)} levar` : "Passar item"}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-center text-xs text-white/50">
                    você não pode levar esse item (posição cheia ou sem dinheiro)
                  </p>
                  <button
                    onClick={pass}
                    className="w-full py-3 rounded-2xl bg-white/10 font-semibold"
                  >
                    {state.bid ? `Deixar ${label(state.bid.by)} levar` : "Passar item"}
                  </button>
                </>
              )
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
                    {lot?.item} por R${state.wonPrice}
                  </p>
                </>
              ) : (
                <p className="text-lg font-black">Ninguém quis {lot?.item} 😅</p>
              )}
            </div>
            {isHost ? (
              <button
                onClick={next}
                className="w-full py-3 rounded-2xl bg-white text-black font-bold"
              >
                {bothFull || state.slot + 1 >= state.lots.length
                  ? "Ver resultado"
                  : "Próximo item"}
              </button>
            ) : (
              <p className="text-center text-xs text-white/50">bb gu abre o próximo item...</p>
            )}
          </div>
        )}

        {state.phase === "judging" && (
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <Loader2 className="animate-spin text-amber-400" />
            <p className="text-sm text-white/70">a IA está avaliando item por item...</p>
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
            {(["gu", "li"] as Me[]).map((m) => {
              const notes = m === "gu" ? state.result?.guItems : state.result?.liItems;
              return (
                <div key={m} className="rounded-2xl bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{label(m)}</p>
                    {state.result && (
                      <p className="font-black text-amber-400">
                        {m === "gu" ? state.result.guScore : state.result.liScore}/10
                      </p>
                    )}
                  </div>
                  <ul className="mt-2 space-y-1.5 text-sm text-white/80">
                    {state.squads[m].length === 0 && (
                      <li className="text-white/40 text-xs">nenhum item</li>
                    )}
                    {state.squads[m].map((it, i) => {
                      const n = notes?.find((x) =>
                        x.item.toLowerCase().includes(it.item.toLowerCase()),
                      );
                      return (
                        <li key={`${it.item}-${i}`}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span>
                              <span className="text-white/40 text-[11px] mr-1">{it.pos}</span>
                              {it.item}
                            </span>
                            {n && (
                              <span className="text-amber-300 text-xs font-bold shrink-0">
                                {n.note}
                              </span>
                            )}
                          </div>
                          {n?.why && <p className="text-[11px] text-white/45">{n.why}</p>}
                        </li>
                      );
                    })}
                  </ul>
                  {state.result && (
                    <p className="text-xs text-white/60 mt-2">
                      {m === "gu" ? state.result.guComment : state.result.liComment}
                    </p>
                  )}
                </div>
              );
            })}
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
