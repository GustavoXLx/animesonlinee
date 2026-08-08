import { useCallback, useEffect, useState } from "react";
import { Gavel, Loader2, Trophy } from "lucide-react";
import { useGameChannel, type Me } from "./useGameChannel";
import { judgeAuction } from "@/lib/chat.functions";
import { THEMES, draftItems, markThemeUsed, pickBudget, pickThemeIndex } from "@/lib/leilao";

type Bid = { item: 0 | 1; amount: number };

type Result = {
  guScore: number;
  liScore: number;
  guComment: string;
  liComment: string;
  winner: "gu" | "li" | "empate";
  summary: string;
};

type LState = {
  phase: "idle" | "bid" | "reveal" | "judging" | "done";
  themeIdx: number;
  budget: number;
  pairs: string[][];
  slot: number;
  money: Record<Me, number>;
  squads: Record<Me, string[]>;
  bids: Partial<Record<Me, Bid>>;
  reveal: string;
  result: Result | null;
};

const initial: LState = {
  phase: "idle",
  themeIdx: 0,
  budget: 100,
  pairs: [],
  slot: 0,
  money: { gu: 0, li: 0 },
  squads: { gu: [], li: [] },
  bids: {},
  reveal: "",
  result: null,
};

const HOST: Me = "gu";
const label = (m: Me) => (m === "gu" ? "bb gu" : "bb li");

export function Leilao({ me }: { me: Me }) {
  const { state, setState, peerOnline, sendEvent, onEvent } = useGameChannel<LState>(
    "leilao",
    me,
    initial,
  );
  const [myBid, setMyBid] = useState<Bid | null>(null);
  const [pick, setPick] = useState<0 | 1>(0);
  const [amount, setAmount] = useState(0);

  const theme = THEMES[state.themeIdx];
  const isHost = me === HOST;
  const other: Me = me === "gu" ? "li" : "gu";

  const resolve = useCallback(
    (bids: Record<Me, Bid>, s: LState) => {
      const pair = s.pairs[s.slot] ?? ["?", "?"];
      const money = { ...s.money };
      const squads = { gu: [...s.squads.gu], li: [...s.squads.li] };
      let text = "";

      if (bids.gu.item !== bids.li.item) {
        (["gu", "li"] as Me[]).forEach((m) => {
          const it = pair[bids[m].item];
          squads[m].push(it);
          money[m] = Math.max(0, money[m] - bids[m].amount);
        });
        text = `Ninguém disputou! bb gu levou ${pair[bids.gu.item]} por R$${bids.gu.amount} e bb li levou ${pair[bids.li.item]} por R$${bids.li.amount}.`;
      } else {
        const idx = bids.gu.item;
        const item = pair[idx];
        const outro = pair[idx === 0 ? 1 : 0];
        let winner: Me;
        if (bids.gu.amount === bids.li.amount) {
          winner = Math.random() < 0.5 ? "gu" : "li";
        } else {
          winner = bids.gu.amount > bids.li.amount ? "gu" : "li";
        }
        const loser: Me = winner === "gu" ? "li" : "gu";
        squads[winner].push(item);
        money[winner] = Math.max(0, money[winner] - bids[winner].amount);
        squads[loser].push(outro);
        text = `Disputa por ${item}! ${label(winner)} pagou R$${bids[winner].amount} e levou. ${label(loser)} ficou com ${outro} de graça.`;
      }

      const nextSlot = s.slot + 1;
      setState({
        ...s,
        money,
        squads,
        bids: {},
        reveal: text,
        slot: s.slot,
        phase: nextSlot >= s.pairs.length ? "judging" : "reveal",
      });

      if (nextSlot >= s.pairs.length) {
        void judgeAuction({
          data: {
            theme: THEMES[s.themeIdx].name,
            slots: THEMES[s.themeIdx].slots,
            gu: squads.gu,
            li: squads.li,
            budget: s.budget,
          },
        })
          .then((result) => {
            setState((prev) => ({ ...prev, phase: "done", result }));
          })
          .catch(() => {
            setState((prev) => ({ ...prev, phase: "done", result: null }));
          });
      }
    },
    [setState],
  );

  // host recebe os lances do parceiro
  useEffect(() => {
    if (!isHost) return;
    return onEvent("bid", (data) => {
      const bid = data as Bid;
      setState((prev) => {
        if (prev.phase !== "bid") return prev;
        const bids = { ...prev.bids, [other]: bid };
        if (bids.gu && bids.li) {
          setTimeout(() => resolve({ gu: bids.gu!, li: bids.li! }, { ...prev, bids }), 0);
          return prev;
        }
        return { ...prev, bids };
      });
    });
  }, [isHost, onEvent, other, resolve, setState]);

  const start = () => {
    const themeIdx = pickThemeIndex();
    markThemeUsed(THEMES[themeIdx].id);
    const budget = pickBudget();
    setState({
      ...initial,
      phase: "bid",
      themeIdx,
      budget,
      pairs: draftItems(THEMES[themeIdx]),
      money: { gu: budget, li: budget },
      squads: { gu: [], li: [] },
    });
    setMyBid(null);
  };

  useEffect(() => {
    setMyBid(null);
    setPick(0);
    setAmount(0);
  }, [state.slot, state.phase]);

  const submit = () => {
    const bid: Bid = { item: pick, amount: Math.min(amount, state.money[me]) };
    setMyBid(bid);
    if (isHost) {
      setState((prev) => {
        const bids = { ...prev.bids, gu: bid };
        if (bids.gu && bids.li) {
          setTimeout(() => resolve({ gu: bids.gu!, li: bids.li! }, { ...prev, bids }), 0);
          return prev;
        }
        return { ...prev, bids };
      });
    } else {
      sendEvent("bid", bid);
    }
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
            Cada rodada mostra 2 itens do tema. Escolham em segredo qual querem e quanto pagam. Se
            os dois quiserem o mesmo, o maior lance leva — o outro fica com o item restante de
            graça. No fim, a IA dá nota pros dois esquadrões.
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

  const pair = state.pairs[state.slot] ?? [];

  return (
    <div className="h-full overflow-y-auto p-4 pb-28">
      <div className="max-w-md mx-auto">
        <div className="rounded-2xl bg-white/5 p-4 text-center">
          <p className="text-[11px] uppercase tracking-wider text-white/40">Tema</p>
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

        {(state.phase === "bid" || state.phase === "reveal") && (
          <p className="text-center text-xs text-white/50 mt-3">
            Rodada {state.slot + 1}/{state.pairs.length} · {theme.slots[state.slot]}
          </p>
        )}

        {state.phase === "bid" && (
          <div className="mt-3 space-y-3">
            {pair.map((item, i) => (
              <button
                key={item}
                disabled={Boolean(myBid)}
                onClick={() => setPick(i as 0 | 1)}
                className={`w-full p-4 rounded-2xl text-left transition ${
                  pick === i ? "bg-amber-500/20 ring-2 ring-amber-400" : "bg-white/5"
                } disabled:opacity-60`}
              >
                <p className="font-semibold">{item}</p>
              </button>
            ))}

            {myBid ? (
              <p className="text-center text-sm text-white/60 py-4">
                lance enviado (R${myBid.amount}) · esperando {label(other)}...
              </p>
            ) : (
              <>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-sm mb-2">
                    Seu lance: <span className="font-bold text-amber-400">R${amount}</span>
                  </p>
                  <input
                    type="range"
                    min={0}
                    max={state.money[me]}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                  <div className="flex justify-between text-[11px] text-white/40">
                    <span>R$0</span>
                    <span>R${state.money[me]}</span>
                  </div>
                </div>
                <button
                  onClick={submit}
                  className="w-full py-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 font-bold"
                >
                  Dar lance
                </button>
              </>
            )}
          </div>
        )}

        {state.phase === "reveal" && (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl bg-white/5 p-4 text-sm">{state.reveal}</div>
            {isHost ? (
              <button
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    phase: "bid",
                    slot: prev.slot + 1,
                    bids: {},
                    reveal: "",
                  }))
                }
                className="w-full py-3 rounded-2xl bg-white text-black font-bold"
              >
                Próxima rodada
              </button>
            ) : (
              <p className="text-center text-xs text-white/50">bb gu abre a próxima rodada...</p>
            )}
          </div>
        )}

        {state.phase === "judging" && (
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <Loader2 className="animate-spin text-amber-400" />
            <p className="text-sm text-white/70">a IA está avaliando os esquadrões...</p>
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
                  {state.squads[m].map((item, i) => (
                    <li key={`${item}-${i}`}>
                      <span className="text-white/40 text-xs">{theme.slots[i]}: </span>
                      {item}
                    </li>
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
