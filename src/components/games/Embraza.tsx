import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, RotateCcw, ArrowRight } from "lucide-react";
import { useGameChannel, type Me } from "./useGameChannel";
import { LEVELS, PROMPTS, type PartyLevel, type PartyMode } from "./embrazaData";
import { genPartyPrompts } from "@/lib/chat.functions";

type Ans = "ja" | "nunca" | "gu" | "li";
type S = {
  phase: "setup" | "play";
  mode: PartyMode;
  level: PartyLevel;
  label: string;
  deck: string[];
  idx: number;
  answers: Partial<Record<Me, Ans>>;
  match: number;
  played: number;
};

const initial: S = {
  phase: "setup",
  mode: "nunca",
  level: "fofo",
  label: "",
  deck: [],
  idx: 0,
  answers: {},
  match: 0,
  played: 0,
};

const USED = "anistream-embraza-used";
const NAME: Record<Me, string> = { gu: "bb gu", li: "bb li" };

function shuffle<T>(a: T[]) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function buildDeck(mode: PartyMode, level: PartyLevel) {
  const pool = PROMPTS[mode][level];
  let used: string[] = [];
  try {
    used = JSON.parse(localStorage.getItem(USED) || "[]");
  } catch {}
  let fresh = pool.filter((p) => !used.includes(p));
  if (fresh.length < 5) {
    used = used.filter((u) => !pool.includes(u));
    fresh = pool;
  }
  try {
    localStorage.setItem(USED, JSON.stringify([...used, ...fresh].slice(-500)));
  } catch {}
  return shuffle(fresh);
}

export function Embraza({ me }: { me: Me }) {
  const { state: s, setState, peerOnline } = useGameChannel<S>("embraza", me, initial);
  const gen = useServerFn(genPartyPrompts);
  const [mode, setMode] = useState<PartyMode>("nunca");
  const [level, setLevel] = useState<PartyLevel>("fofo");
  const [theme, setTheme] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const other: Me = me === "gu" ? "li" : "gu";

  const start = (deck: string[], label: string) =>
    setState({ ...initial, phase: "play", mode, level, label, deck });

  const startAi = async () => {
    if (!theme.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await gen({ data: { mode, level, theme: theme.trim() } });
      if (r.error || !r.prompts.length) setErr(r.error || "Não deu pra gerar.");
      else start(r.prompts, `IA · ${theme.trim()}`);
    } catch {
      setErr("Não deu pra gerar agora.");
    } finally {
      setBusy(false);
    }
  };

  if (s.phase === "setup") {
    return (
      <div className="h-full overflow-y-auto p-4 pr-16 pb-6 space-y-5 max-w-md mx-auto">
        {!peerOnline && (
          <p className="text-xs text-center text-white/50">Esperando {NAME[other]} entrar...</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["nunca", "Eu Nunca"],
              ["provavel", "O Mais Provável"],
            ] as const
          ).map(([k, n]) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              className={`rounded-2xl p-4 font-bold border transition ${mode === k ? "bg-gradient-to-br from-rose-500 to-fuchsia-600 border-transparent" : "border-white/10 bg-white/5"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-white/50">Nível</p>
          {LEVELS.map((l) => (
            <button
              key={l.key}
              onClick={() => setLevel(l.key)}
              className={`w-full text-left rounded-xl px-4 py-3 border transition ${level === l.key ? "border-rose-400 bg-rose-500/15" : "border-white/10 bg-white/5"}`}
            >
              <span className="font-semibold">{l.name}</span>
              <span className="text-xs text-white/50 ml-2">{l.desc}</span>
            </button>
          ))}
        </div>
        <button
          disabled={!peerOnline}
          onClick={() => start(buildDeck(mode, level), LEVELS.find((l) => l.key === level)!.name)}
          className="w-full rounded-2xl py-3 font-bold bg-gradient-to-r from-rose-500 to-fuchsia-600 disabled:opacity-40"
        >
          Jogar
        </button>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
          <p className="flex items-center gap-2 font-semibold">
            <Sparkles size={16} /> Tema com IA
          </p>
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            maxLength={80}
            placeholder="ex: viagem, praia, ciúmes, comida..."
            className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 outline-none"
          />
          <button
            disabled={!peerOnline || busy || !theme.trim()}
            onClick={startAi}
            className="w-full rounded-xl py-2 font-semibold bg-white/10 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={16} className="animate-spin" />} Gerar cartas
          </button>
          {err && <p className="text-xs text-rose-300">{err}</p>}
        </div>
      </div>
    );
  }

  const card = s.deck[s.idx];
  const mine = s.answers[me];
  const both = s.answers.gu && s.answers.li;
  const opts: { v: Ans; t: string }[] =
    s.mode === "nunca"
      ? [
          { v: "ja", t: "Eu já" },
          { v: "nunca", t: "Eu nunca" },
        ]
      : [
          { v: "gu", t: "bb gu" },
          { v: "li", t: "bb li" },
        ];
  const label = (a?: Ans) => opts.find((o) => o.v === a)?.t ?? "";

  const answer = (v: Ans) =>
    setState((p) => {
      const answers = { ...p.answers, [me]: v };
      if (answers.gu && answers.li) {
        return { ...p, answers, played: p.played + 1, match: p.match + (answers.gu === answers.li ? 1 : 0) };
      }
      return { ...p, answers };
    });
  const next = () => setState((p) => ({ ...p, idx: p.idx + 1, answers: {} }));

  if (!card) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-2xl font-bold">Acabaram as cartas</p>
        <p className="text-white/60">
          Vocês concordaram em {s.match} de {s.played}
        </p>
        <button onClick={() => setState(initial)} className="rounded-xl px-5 py-3 bg-white/10 flex items-center gap-2">
          <RotateCcw size={16} /> Jogar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 pr-16 pb-6 max-w-md mx-auto">
      <div className="flex justify-between text-xs text-white/50 mb-3">
        <span>
          {s.mode === "nunca" ? "Eu Nunca" : "O Mais Provável"} · {s.label}
        </span>
        <span>
          {s.idx + 1}/{s.deck.length} · sintonia {s.match}/{s.played}
        </span>
      </div>
      <div
        key={s.idx}
        className="flex-1 min-h-[200px] rounded-3xl bg-gradient-to-br from-rose-500 to-fuchsia-700 p-6 flex items-center justify-center text-center shadow-2xl animate-scale-in"
      >
        <p className="text-2xl font-bold leading-snug">{card}</p>
      </div>
      <div className="mt-4 space-y-3">
        {!both ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {opts.map((o) => (
                <button
                  key={o.v}
                  onClick={() => answer(o.v)}
                  className={`rounded-2xl py-4 font-bold border transition ${mine === o.v ? "bg-white text-neutral-900 border-white" : "bg-white/5 border-white/15"}`}
                >
                  {o.t}
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-white/50">
              {mine ? `Esperando ${NAME[other]} responder...` : "Escolha em segredo — aparece quando os dois responderem"}
            </p>
          </>
        ) : (
          <div className="space-y-3 animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
              {(["gu", "li"] as Me[]).map((w) => (
                <div key={w} className="rounded-2xl bg-white/5 border border-white/10 p-3 text-center">
                  <p className="text-xs text-white/50">{NAME[w]}</p>
                  <p className="font-bold text-lg">{label(s.answers[w])}</p>
                </div>
              ))}
            </div>
            <p className="text-center text-sm font-semibold">
              {s.answers.gu === s.answers.li ? "Sintonia!" : "Opa, discordaram..."}
            </p>
            <button
              onClick={next}
              className="w-full rounded-2xl py-3 font-bold bg-gradient-to-r from-rose-500 to-fuchsia-600 flex items-center justify-center gap-2"
            >
              Próxima <ArrowRight size={16} />
            </button>
          </div>
        )}
        <button onClick={() => setState(initial)} className="w-full text-xs text-white/40 py-1">
          Trocar jogo/nível
        </button>
      </div>
    </div>
  );
}
