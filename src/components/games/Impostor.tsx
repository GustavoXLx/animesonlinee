import { useEffect, useState } from "react";
import { Check, Eye, Fingerprint, LockKeyhole, RotateCcw, Send, Shield, Skull, Users, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGameChannel, type Me } from "./useGameChannel";
import { cpuClue, cpuVote, freshGame, hintFor, impostorsFor, NAMES, playersFor, submitClue, submitVote, tally, themeFor, turnPlayer, wordFor, type GameState, type Mode, type Player } from "./impostorRules";

const avatars: Record<Player, string> = { gu: "GU", li: "LI", cpu1: "AX", cpu2: "NI", cpu3: "TH", cpu4: "MY", cpu5: "LU", cpu6: "BI", cpu7: "DV", cpu8: "LN" };
function PlayerBadge({ player, small = false }: { player: Player; small?: boolean }) {
  return <span className={`inline-grid shrink-0 place-items-center rounded-md border border-border bg-secondary font-bold text-secondary-foreground ${small ? "h-9 w-9 text-xs" : "h-12 w-12 text-sm"}`}>{avatars[player]}</span>;
}
export function Impostor({ me }: { me: Me }) {
  const { state, setState, peerOnline } = useGameChannel<GameState>("impostor", me, freshGame());
  const [draft, setDraft] = useState("");
  const pool = playersFor(state.mode);
  const current = turnPlayer(state);
  const isCpuTurn = current?.startsWith("cpu") ?? false;
  const theme = state.seed ? themeFor(state.seed) : null;
  const role = state.seed ? impostorsFor(state.seed, state.mode).includes(me) : false;
  const total = state.mode * 3;

  // Only bb gu drives automatic transitions: each CPU has a visible, separate turn.
  useEffect(() => {
    if (me !== "gu" || !peerOnline || state.phase !== "lobby" || !state.ready.gu || !state.ready.li) return;
    const timer = window.setTimeout(() => setState(prev => prev.phase === "lobby" && prev.ready.gu && prev.ready.li
      ? { ...freshGame(prev.mode), phase: "cards", seed: Math.floor(Math.random() * 0x7fffffff) + 1, ready: { gu: true, li: true } } : prev), 250);
    return () => window.clearTimeout(timer);
  }, [me, peerOnline, state.phase, state.ready.gu, state.ready.li, setState]);
  useEffect(() => {
    if (me !== "gu" || !peerOnline || state.phase !== "cards" || !state.seenCard.gu || !state.seenCard.li) return;
    const timer = window.setTimeout(() => setState(prev => prev.phase === "cards" && prev.seenCard.gu && prev.seenCard.li ? { ...prev, phase: "clues", turn: 0 } : prev), 500);
    return () => window.clearTimeout(timer);
  }, [me, peerOnline, state.phase, state.seenCard.gu, state.seenCard.li, setState]);
  useEffect(() => {
    if (me !== "gu" || !peerOnline || !isCpuTurn || !current) return;
    const timer = window.setTimeout(() => setState(prev => {
      if (turnPlayer(prev) !== current) return prev;
      return prev.phase === "clues" ? submitClue(prev, current, cpuClue(prev, current)) : submitVote(prev, current, cpuVote(prev, current));
    }), state.phase === "clues" ? 950 : 850);
    return () => window.clearTimeout(timer);
  }, [me, peerOnline, isCpuTurn, current, state.phase, state.turn, setState]);

  const reset = () => { setDraft(""); setState(freshGame(state.mode)); };
  const sendClue = () => {
    const text = draft.trim();
    if (!text || text.length > 100 || current !== me) return;
    setState(prev => submitClue(prev, me, text));
    setDraft("");
  };
  const result = state.phase === "result" ? tally(state) : null;
  const progress = state.phase === "clues" ? state.turn + 1 : state.phase === "vote" ? state.turn + 1 : 0;

  return <div className="h-full overflow-y-auto overscroll-contain bg-background text-foreground">
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-5 sm:px-8">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-md bg-primary text-primary-foreground"><Fingerprint size={23}/></span><div><p className="text-xs font-bold uppercase text-muted-foreground">Sala de investigação</p><h1 className="text-2xl font-bold">Impostor</h1></div></div>
        {state.phase !== "lobby" && <Button variant="ghost" size="icon" title="Reiniciar partida" aria-label="Reiniciar partida" onClick={reset}><RotateCcw size={18}/></Button>}
      </header>
      {!peerOnline && <p className="mt-5 border-l-2 border-primary bg-secondary px-4 py-3 text-sm text-secondary-foreground">Esperando {me === "gu" ? "BB Li" : "BB Gu"} entrar no Impostor. A partida continua quando os dois estiverem aqui.</p>}

      {state.phase === "lobby" && <div className="pt-6">
        <p className="mb-3 text-xs font-bold uppercase text-muted-foreground">Escolham o tamanho da sala</p>
        <div className="grid grid-cols-2 gap-3">{([5, 10] as Mode[]).map(mode => <Button key={mode} variant="outline" onClick={() => setState(prev => prev.phase === "lobby" ? { ...freshGame(mode) } : prev)} className={`h-auto flex-col items-start gap-1 p-4 text-left whitespace-normal ${state.mode === mode ? "border-primary bg-primary/10 text-foreground" : ""}`}><span className="flex items-center gap-2 font-bold"><Users size={16}/>{mode} jogadores</span><span className="text-xs font-normal text-muted-foreground">{mode === 5 ? "1 impostor · 3 CPUs" : "2 impostores · 8 CPUs"}</span></Button>)}</div>
        <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-5">{pool.map(player => <div key={player} className="flex items-center gap-2 border-b border-border py-2"><PlayerBadge player={player} small/><span className="min-w-0 truncate text-sm font-medium">{NAMES[player]}</span></div>)}</div>
        <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-border pt-5"><Button disabled={!peerOnline} onClick={() => setState(prev => prev.phase === "lobby" ? { ...prev, ready: { ...prev.ready, [me]: !prev.ready[me] } } : prev)}><Check size={16}/>{state.ready[me] ? "Cancelar pronto" : "Estou pronto"}</Button><span className="text-sm text-muted-foreground">{Number(state.ready.gu) + Number(state.ready.li)} de 2 prontos</span></div>
      </div>}

      {state.phase === "cards" && <div className="mx-auto max-w-xl pt-10 text-center"><p className="text-xs font-bold uppercase text-primary">{theme?.name} · {state.mode} jogadores</p><h2 className="mt-2 text-3xl font-bold">Sua carta secreta</h2>{!state.seenCard[me] ? <><div className="mt-8 grid min-h-48 place-items-center border border-border bg-card"><LockKeyhole className="text-muted-foreground" size={48}/></div><Button className="mt-6" onClick={() => setState(prev => prev.phase === "cards" ? { ...prev, seenCard: { ...prev.seenCard, [me]: true } } : prev)}><Eye size={16}/> Revelar somente para mim</Button></> : <><div className={`mt-8 border p-7 ${role ? "border-destructive bg-destructive/10" : "border-primary bg-primary/10"}`}>{role ? <Skull className="mx-auto text-destructive" size={36}/> : <Shield className="mx-auto text-primary" size={36}/>}<p className="mt-3 text-xl font-bold">{role ? "Você é impostor" : "Você conhece a palavra"}</p><p className="mt-3 text-sm">{role ? hintFor(state.seed) : <strong className="text-2xl">{wordFor(state.seed)}</strong>}</p></div><p className="mt-5 text-sm text-muted-foreground">Aguardando os dois abrirem as cartas.</p></>}</div>}

      {state.phase === "clues" && <div className="pt-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase text-primary">{theme?.name} · rodada {state.round + 1} de 3</p><h2 className="mt-1 text-2xl font-bold">Pistas, uma por vez</h2></div><span className="text-sm text-muted-foreground">{progress} / {total}</span></div><div className="mt-4 h-1 bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${state.turn / total * 100}%` }}/></div>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">{pool.map((player, idx) => <div key={player} className={`flex min-h-20 items-center gap-3 border p-3 transition-colors ${current === player ? "border-primary bg-primary/10" : "border-border bg-card"}`}><span className="w-5 shrink-0 text-center text-xs text-muted-foreground">{idx + 1}</span><PlayerBadge player={player} small/><div className="min-w-0 flex-1"><p className="text-sm font-bold">{NAMES[player]} {current === player && <span className="ml-1 text-xs font-normal text-primary">· falando</span>}</p><p className="mt-0.5 break-words text-sm text-muted-foreground">{state.clues[player]?.[state.round] ?? (current === player ? "Escolhendo uma pista..." : "Aguardando a vez")}</p></div></div>)}</div>
        {current === me && <div className="mt-5 border-t border-border pt-5"><label htmlFor="impostor-clue" className="text-sm font-bold">Sua pista</label><p className="mt-1 text-xs text-muted-foreground">Dê uma característica sem revelar a palavra.</p><div className="mt-3 flex gap-2"><input id="impostor-clue" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && sendClue()} maxLength={100} placeholder="Escreva sua pista" className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"/><Button disabled={!draft.trim() || !peerOnline} onClick={sendClue} aria-label="Enviar pista"><Send size={16}/></Button></div></div>}
      </div>}

      {state.phase === "vote" && <div className="pt-6"><p className="text-xs font-bold uppercase text-primary">{theme?.name} · votação</p><h2 className="mt-1 text-2xl font-bold">Quem está blefando?</h2><p className="mt-1 text-sm text-muted-foreground">Cada jogador vota uma vez, na sua vez. Não vale votar em si mesmo.</p><p className="mt-5 border-l-2 border-primary bg-secondary px-4 py-3 text-sm">Vez de <strong>{current ? NAMES[current] : "—"}</strong> · voto {progress} de {state.mode}</p><div className="mt-5 grid gap-2 sm:grid-cols-2">{pool.map(player => <Button key={player} variant="outline" disabled={current !== me || player === me || !peerOnline} onClick={() => setState(prev => submitVote(prev, me, player))} className="h-auto min-h-16 justify-start gap-3 whitespace-normal p-3 text-left"><PlayerBadge player={player} small/><span className="min-w-0 flex-1"><span className="block font-bold">{NAMES[player]}</span><span className="block text-xs text-muted-foreground">{state.votes[player] ? "Voto registrado" : player === me ? "Você" : "Escolher"}</span></span>{state.votes[me] === player && <Check size={16} className="text-primary"/>}</Button>)}</div></div>}

      {result && <div className="pt-8"><div className="border-b border-border pb-7 text-center">{result.caught ? <Shield className="mx-auto text-primary" size={42}/> : <Skull className="mx-auto text-destructive" size={42}/>}<p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Caso encerrado</p><h2 className="mt-1 text-3xl font-bold">{result.caught ? "Impostor descoberto" : "Impostor escapou"}</h2><p className="mt-2 text-sm text-muted-foreground">{state.mode === 10 ? "Os impostores eram" : "O impostor era"} {result.impostors.map(p => NAMES[p]).join(" e ")}. Palavra: {wordFor(state.seed)}.</p></div><div className="mt-5 space-y-2">{pool.map(player => <div key={player} className="flex items-center gap-3 border-b border-border py-2"><PlayerBadge player={player} small/><span className="flex-1 text-sm font-bold">{NAMES[player]} {result.impostors.includes(player) && <span className="font-normal text-destructive">· impostor</span>}</span><span className="text-xs text-muted-foreground">{result.counts[player]} voto{result.counts[player] === 1 ? "" : "s"}</span></div>)}</div><div className="mt-5 border-t border-border pt-4"><p className="text-xs font-bold uppercase text-muted-foreground">Como cada um votou</p><div className="mt-2 grid gap-1 sm:grid-cols-2">{pool.map(player => <p key={player} className="text-sm text-muted-foreground">{NAMES[player]} → {state.votes[player] ? NAMES[state.votes[player]] : "—"}</p>)}</div></div><Button onClick={reset} className="mt-7 w-full"><RotateCcw size={16}/> Jogar novamente</Button></div>}
      <p className="mt-10 text-center text-xs text-muted-foreground"><Vote size={13} className="mr-1 inline"/> {state.mode} jogadores · {state.mode === 5 ? 1 : 2} impostor{state.mode === 5 ? "" : "es"}</p>
    </div>
  </div>;
}
