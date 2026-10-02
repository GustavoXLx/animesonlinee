import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, MessageCircle, RotateCcw, Shield, Skull, Sparkles, Users, Vote, Check, Clock3 } from "lucide-react";
import { useGameChannel, type Me } from "./useGameChannel";

type Player = "gu" | "li" | "cpu1" | "cpu2" | "cpu3";
type Phase = "lobby" | "cards" | "round" | "vote" | "result";

type Theme = {
  name: string;
  items: string[];
  clues: string[];
};

const THEMES: Theme[] = [
  { name:"Comidas", items:["Pizza","Hambúrguer","Sushi","Lasanha","Pudim","Coxinha"], clues:["aparece em refeições","é comum em restaurantes","tem várias versões","pode ser servido quente","é conhecido por muita gente","combina com diferentes acompanhamentos"] },
  { name:"Países", items:["Brasil","Japão","Itália","França","Egito","Canadá"], clues:["é destino de viagem","tem uma cultura marcante","tem culinária própria","possui lugares famosos","tem símbolos conhecidos","é associado a uma região do mundo"] },
  { name:"Animais", items:["Leão","Golfinho","Elefante","Pinguim","Cachorro","Girafa"], clues:["é conhecido por muita gente","tem características físicas marcantes","vive em um ambiente específico","aparece bastante em documentários","tem um comportamento característico","pode ser visto em zoológicos ou na natureza"] },
  { name:"Cidades", items:["Paris","Tóquio","Nova York","Rio de Janeiro","Londres","Dubai"], clues:["é muito visitada","tem pontos turísticos famosos","tem uma identidade visual própria","tem regiões bastante conhecidas","aparece em filmes e viagens","recebe pessoas do mundo todo"] },
  { name:"Esportes", items:["Futebol","Basquete","Tênis","Vôlei","Boxe","Natação"], clues:["tem regras próprias","pode ser praticado profissionalmente","exige treino","tem competições","tem atletas famosos","pode ser acompanhado pela televisão"] },
  { name:"Profissões", items:["Médico","Professor","Chef","Bombeiro","Piloto","Fotógrafo"], clues:["exige habilidades específicas","pode virar carreira","tem rotina própria","pode exigir formação","é conhecido por sua função","pode trabalhar com outras pessoas"] },
  { name:"Filmes e séries", items:["Comédia","Terror","Ação","Romance","Ficção científica","Animação"], clues:["é um tipo de produção audiovisual","pode ter personagens marcantes","pode prender a atenção","tem fãs específicos","pode aparecer no cinema ou streaming","tem elementos característicos"] },
  { name:"Tecnologia", items:["Celular","Notebook","Videogame","Drone","Robô","Smartwatch"], clues:["usa tecnologia","faz parte da vida moderna","pode ter bateria","tem funções diferentes","pode receber atualizações","é encontrado em lojas de eletrônicos"] },
  { name:"Casa", items:["Sofá","Geladeira","Cama","Chuveiro","Televisão","Micro-ondas"], clues:["fica dentro de casa","tem uso frequente","faz parte da rotina","tem diferentes modelos","pode ser encontrado em lojas","facilita alguma tarefa do dia a dia"] },
  { name:"Praia", items:["Guarda-sol","Areia","Prancha","Biquíni","Quente","Protetor solar"], clues:["combina com dias de sol","é associado ao litoral","pode aparecer durante férias","faz parte de um passeio","é comum no verão","pode ficar exposto ao sol"] },
  { name:"Escola", items:["Prova","Caderno","Mochila","Professor","Recreio","Lápis"], clues:["faz parte da rotina escolar","é comum entre estudantes","pode aparecer em uma sala","está ligado ao aprendizado","tem relação com aulas","é conhecido por crianças e adolescentes"] },
  { name:"Viagem", items:["Avião","Hotel","Passaporte","Mala","Aeroporto","Mapa"], clues:["aparece antes ou durante uma viagem","ajuda no deslocamento","pode fazer parte do planejamento","é comum em férias","tem relação com destinos","pode ser encontrado em uma viagem internacional"] },
  { name:"Natureza", items:["Montanha","Cachoeira","Floresta","Vulcão","Deserto","Rio"], clues:["existe na natureza","pode ser cenário de viagem","tem paisagens marcantes","pode ser fotografado","tem relação com geografia","pode ocupar uma grande área"] },
  { name:"Música", items:["Violão","Piano","Bateria","Microfone","Show","Cantor"], clues:["tem relação com música","pode aparecer em apresentações","pode fazer parte de uma banda","é reconhecido pelo público","pode envolver som ao vivo","faz parte do universo musical"] },
  { name:"Moda", items:["Vestido","Tênis","Jaqueta","Bolsa","Boné","Óculos"], clues:["faz parte de um look","tem diferentes estilos","pode mudar conforme a ocasião","é vendido em lojas","pode ter várias cores","é usado para compor visual"] },
  { name:"Transporte", items:["Carro","Ônibus","Metrô","Navio","Bicicleta","Motocicleta"], clues:["serve para deslocamento","pode levar pessoas","tem diferentes modelos","é usado no dia a dia","pode fazer parte de uma viagem","tem relação com mobilidade"] },
  { name:"Festas", items:["Aniversário","Casamento","Carnaval","Réveillon","Balada","Formatura"], clues:["reúne pessoas","pode ter música","costuma ter decoração","pode envolver comida","é uma ocasião especial","pode gerar muitas fotos"] },
  { name:"Objetos", items:["Chave","Relógio","Óculos","Guarda-chuva","Tesoura","Mochila"], clues:["é um objeto físico","pode ser carregado","tem uma função específica","é encontrado em casas","pode ser usado diariamente","tem diferentes modelos"] },
  { name:"Doces", items:["Chocolate","Sorvete","Brigadeiro","Bolo","Donut","Picolé"], clues:["é associado a sobremesa","tem sabor doce","pode aparecer em festas","tem várias versões","é vendido em muitos lugares","costuma ser uma opção de sobremesa"] },
  { name:"Super-heróis", items:["Herói","Vilão","Máscara","Capa","Poder","Quartel"], clues:["aparece em histórias","tem elementos marcantes","pode envolver batalhas","tem fãs de várias idades","pode aparecer em filmes","faz parte de um universo fictício"] },
];

const PLAYERS: Player[] = ["gu","li","cpu1","cpu2","cpu3"];
const CPU_NAMES: Record<Player,string> = { gu:"Você", li:"BB Li", cpu1:"Alex", cpu2:"Nina", cpu3:"Theo" };
const CPU_COLORS: Record<Player,string> = { gu:"from-pink-500 to-rose-500", li:"from-cyan-400 to-blue-500", cpu1:"from-violet-500 to-indigo-500", cpu2:"from-amber-400 to-orange-500", cpu3:"from-emerald-400 to-teal-500" };

type ImpState = {
  phase: Phase;
  seed: number;
  themeIndex: number;
  round: number;
  clues: Record<Player, string[]>;
  votes: Record<Player, Player | null>;
  voteDone: Player[];
};

const initial: ImpState = {
  phase:"lobby",
  seed:0,
  themeIndex:0,
  round:0,
  clues:{ gu:[], li:[], cpu1:[], cpu2:[], cpu3:[] },
  votes:{ gu:null, li:null, cpu1:null, cpu2:null, cpu3:null },
  voteDone:[],
};

function hash(seed:number, salt:number) {
  let x = (seed ^ (salt * 0x45d9f3b)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}

function roleIndex(seed:number) {
  return hash(seed, 71) % PLAYERS.length;
}

function themeIndex(seed:number) {
  return hash(seed, 113) % THEMES.length;
}

function wordIndex(seed:number, theme:number) {
  return hash(seed, theme + 991) % THEMES[theme].items.length;
}

function playerIsImpostor(seed:number, player:Player) {
  return roleIndex(seed) === PLAYERS.indexOf(player);
}

function playerName(p:Player) {
  return CPU_NAMES[p];
}

function clueFor(seed:number, theme:Theme, themeIdx:number, player:Player, round:number) {
  const imp = playerIsImpostor(seed, player);
  if (imp) {
    const vague = ["é bem conhecido","tem a ver com o tema","muita gente conhece","pode aparecer em vários lugares","depende bastante da situação","é algo que chama atenção"];
    return vague[hash(seed, 4000 + PLAYERS.indexOf(player) * 13 + round) % vague.length];
  }
  return theme.clues[hash(seed, themeIdx * 100 + PLAYERS.indexOf(player) * 17 + round) % theme.clues.length];
}

function resetState(): ImpState {
  return {
    phase:"lobby",
    seed:0,
    themeIndex:0,
    round:0,
    clues:{ gu:[], li:[], cpu1:[], cpu2:[], cpu3:[] },
    votes:{ gu:null, li:null, cpu1:null, cpu2:null, cpu3:null },
    voteDone:[],
  };
}

export function Impostor({ me }: { me: Me }) {
  const { state, setState, peerOnline } = useGameChannel<ImpState>("impostor", me, initial);
  const [draft, setDraft] = useState("");
  const [showCard, setShowCard] = useState(true);

  const theme = THEMES[state.themeIndex] ?? THEMES[0];
  const secret = state.seed ? theme.items[wordIndex(state.seed, state.themeIndex)] : "";
  const myImpostor = state.seed ? playerIsImpostor(state.seed, me) : false;
  const impostor = state.seed ? PLAYERS[roleIndex(state.seed)] : null;

  const allClues = useMemo(() => PLAYERS.map((p) => ({
    player:p,
    clue:state.clues[p]?.[state.round] ?? "",
  })), [state.clues, state.round]);

  const start = () => {
    if (me !== "gu" || !peerOnline || state.phase !== "lobby") return;
    const seed = Math.floor(Math.random() * 0x7fffffff) + 1;
    const ti = themeIndex(seed);
    setState({
      ...resetState(),
      phase:"cards",
      seed,
      themeIndex:ti,
    });
  };

  useEffect(() => {
    if (me !== "gu" || state.phase !== "cards") return;
    const timer = window.setTimeout(() => setState({ ...state, phase:"round", round:0 }), 2400);
    return () => window.clearTimeout(timer);
  }, [me, state.phase]);

  useEffect(() => {
    if (me !== "gu" || state.phase !== "round") return;
    const missing = PLAYERS.filter((p) => !state.clues[p]?.[state.round]);
    if (!missing.length) {
      const timer = window.setTimeout(() => {
        if (state.round >= 2) setState({ ...state, phase:"vote" });
        else setState({ ...state, round:state.round + 1 });
      }, 650);
      return () => window.clearTimeout(timer);
    }
    const cpu = missing.find((p) => p.startsWith("cpu"));
    if (!cpu) return;
    const timer = window.setTimeout(() => {
      const clues = { ...state.clues };
      clues[cpu] = [...(clues[cpu] ?? []), clueFor(state.seed, theme, state.themeIndex, cpu, state.round)];
      setState({ ...state, clues });
    }, 850 + PLAYERS.indexOf(cpu) * 380);
    return () => window.clearTimeout(timer);
  }, [me, state.phase, state.round, state.clues]);

  useEffect(() => {
    if (me !== "gu" || state.phase !== "vote") return;
    const missing = PLAYERS.filter((p) => !state.votes[p]);
    if (!missing.length) return;
    const cpu = missing.find((p) => p.startsWith("cpu"));
    if (!cpu) return;
    const timer = window.setTimeout(() => {
      const candidates = PLAYERS.filter((p) => p !== cpu);
      const scored = candidates.map((target) => {
        let suspicion = 0;
        for (let r=0;r<3;r++) {
          const clue = state.clues[target]?.[r] ?? "";
          suspicion += clue.length < 14 ? 3 : clue.length < 23 ? 1 : 0;
          if (/conhece|tema|situação|lugares|atenção/.test(clue)) suspicion += 2;
        }
        if (playerIsImpostor(state.seed, cpu)) {
          suspicion += hash(state.seed, 900 + PLAYERS.indexOf(target) * 31 + cpu.length) % 5;
          if (target === "gu" || target === "li") suspicion += 1;
        }
        return { target, suspicion };
      });
      const max = Math.max(...scored.map((x) => x.suspicion));
      const tied = scored.filter((x) => x.suspicion === max);
      const vote = tied[hash(state.seed, 1200 + PLAYERS.indexOf(cpu)) % tied.length].target;
      setState({ ...state, votes:{ ...state.votes, [cpu]:vote }, voteDone:[...state.voteDone, cpu] });
    }, 900 + PLAYERS.indexOf(cpu) * 420);
    return () => window.clearTimeout(timer);
  }, [me, state.phase, state.votes]);

  useEffect(() => {
    if (me !== "gu" || state.phase !== "vote") return;
    if (state.voteDone.length < 3 || !state.votes.gu || !state.votes.li) return;
    const timer = window.setTimeout(() => setState({ ...state, phase:"result" }), 800);
    return () => window.clearTimeout(timer);
  }, [me, state.phase, state.voteDone.length, state.votes.gu, state.votes.li]);

  const submitClue = () => {
    const value = draft.trim();
    if (!value || state.phase !== "round" || state.clues[me]?.[state.round]) return;
    const clues = { ...state.clues, [me]: [...(state.clues[me] ?? []), value.slice(0, 80)] };
    setDraft("");
    setState({ ...state, clues });
  };

  const vote = (target:Player) => {
    if (state.phase !== "vote" || state.votes[me]) return;
    setState({
      ...state,
      votes:{ ...state.votes, [me]:target },
      voteDone:state.voteDone.includes(me) ? state.voteDone : [...state.voteDone, me],
    });
  };

  const restart = () => {
    if (me === "gu") setState(resetState());
  };

  const voted = Boolean(state.votes[me]);
  const voteCounts = PLAYERS.reduce<Record<Player,number>>((acc,p) => {
    const target = state.votes[p];
    if (target) acc[target] = (acc[target] ?? 0) + 1;
    return acc;
  }, {} as Record<Player,number>);
  const maxVotes = Math.max(0, ...Object.values(voteCounts));
  const topVoted = PLAYERS.filter((p) => voteCounts[p] === maxVotes && maxVotes > 0);
  const caught = topVoted.length === 1 && topVoted[0] === impostor;
  const myResultText = state.phase === "result"
    ? myImpostor ? (caught ? "Você era o impostor e foi descoberto." : "Você era o impostor e escapou.") : (caught ? "O impostor foi descoberto." : "O impostor escapou.")
    : "";

  return (
    <div className="h-full overflow-y-auto bg-[#090a10] text-white">
      <div className="relative mx-auto min-h-full w-full max-w-4xl px-4 py-5 sm:px-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-violet-500/15 via-fuchsia-500/5 to-transparent" />
        <div className="relative">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200">
              <Eye size={21} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-violet-200/60">jogo social • 5 jogadores</p>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">IMPOSTOR</h1>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-bold text-emerald-200">
              <Users size={13} /> 2 + 3 CPU
            </div>
          </div>

          {state.phase === "lobby" && (
            <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
              <section className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-2xl">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-200"><Sparkles size={22} /></div>
                  <div>
                    <h2 className="text-lg font-black">Descubram quem está blefando</h2>
                    <p className="text-xs text-white/45">Um impostor. Um tema. Três rodadas de pistas.</p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    ["01","Recebam a carta","Cada jogador recebe secretamente seu papel."],
                    ["02","Dê uma pista","Todos falam uma característica por rodada."],
                    ["03","Votem","Depois de 3 rodadas, todos escolhem um suspeito."],
                  ].map(([n,t,d]) => (
                    <div key={n} className="rounded-2xl border border-white/8 bg-black/20 p-3">
                      <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-violet-400/10 text-[10px] font-black text-violet-200">{n}</div>
                      <p className="text-xs font-black">{t}</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-white/40">{d}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-amber-200/10 bg-amber-200/5 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200/60">Como funciona</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/55">
                    Os dois jogadores reais participam com mais três CPUs. Só uma das cinco pessoas é o impostor. O inocente vê a palavra secreta; o impostor vê apenas o tema.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={start}
                  disabled={me !== "gu" || !peerOnline}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-600 px-5 py-3.5 text-sm font-black shadow-xl shadow-violet-950/30 transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Sparkles size={17} /> {me !== "gu" ? "Aguardando bb gu" : peerOnline ? "Começar partida" : "Aguardando os dois jogadores"}
                </button>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-2xl">
                <div className="mb-4 flex items-center gap-2">
                  <Users size={18} className="text-cyan-200" />
                  <div>
                    <p className="text-sm font-black">Mesa</p>
                    <p className="text-[10px] text-white/40">5 lugares nesta partida</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {PLAYERS.map((p, i) => (
                    <div key={p} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${CPU_COLORS[p]} text-xs font-black`}>
                        {p === "gu" || p === "li" ? p === me ? "VOCÊ" : p === "li" ? "LI" : "GU" : `0${i}`}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black">{playerName(p)}</p>
                        <p className="text-[9px] uppercase tracking-wider text-white/35">{p.startsWith("cpu") ? "CPU" : "jogador"}</p>
                      </div>
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {state.phase === "cards" && (
            <section className="mx-auto max-w-xl">
              <div className="mb-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-violet-200/60">Sua carta</p>
                <h2 className="mt-1 text-2xl font-black">Não deixe ninguém ver</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCard((v) => !v)}
                className="group relative w-full overflow-hidden rounded-[30px] border border-violet-300/20 bg-gradient-to-br from-violet-950 via-[#171326] to-fuchsia-950 p-7 text-left shadow-2xl"
              >
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-fuchsia-500/15 blur-3xl" />
                <div className="relative flex min-h-[300px] flex-col items-center justify-center text-center">
                  {showCard ? (
                    <>
                      <div className={`mb-4 flex h-20 w-20 items-center justify-center rounded-3xl ${myImpostor ? "bg-red-500/15 text-red-300" : "bg-emerald-400/15 text-emerald-200"}`}>
                        {myImpostor ? <Skull size={38} /> : <Shield size={38} />}
                      </div>
                      <p className={`text-[11px] font-black uppercase tracking-[0.25em] ${myImpostor ? "text-red-300" : "text-emerald-200"}`}>
                        {myImpostor ? "VOCÊ É O IMPOSTOR" : "VOCÊ É INOCENTE"}
                      </p>
                      <p className="mt-3 text-xs text-white/45">{myImpostor ? "Você conhece apenas o tema." : "Você conhece a palavra secreta."}</p>
                      <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 px-6 py-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Tema</p>
                        <p className="mt-1 text-xl font-black">{theme.name}</p>
                        {!myImpostor && <><p className="mt-3 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-200/50">Palavra</p><p className="mt-1 text-2xl font-black text-emerald-100">{secret}</p></>}
                      </div>
                    </>
                  ) : (
                    <>
                      <EyeOff size={42} className="text-white/30" />
                      <p className="mt-4 text-sm font-black">Carta escondida</p>
                      <p className="mt-1 text-xs text-white/40">Toque para revelar novamente.</p>
                    </>
                  )}
                </div>
              </button>
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/40">
                <Clock3 size={13} /> A partida começa automaticamente.
              </div>
            </section>
          )}

          {state.phase === "round" && (
            <section>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-violet-200/60">Tema • {theme.name}</p>
                  <h2 className="mt-1 text-2xl font-black">Rodada {state.round + 1} de 3</h2>
                  <p className="mt-1 text-xs text-white/45">Fale uma característica. Não diga a palavra diretamente.</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {[0,1,2].map((r) => <div key={r} className={`h-2 w-12 rounded-full ${r <= state.round ? "bg-violet-400" : "bg-white/10"}`} />)}
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_.72fr]">
                <div className="space-y-2">
                  {PLAYERS.map((p) => {
                    const clue = state.clues[p]?.[state.round];
                    return (
                      <div key={p} className={`rounded-2xl border p-3 ${clue ? "border-white/10 bg-white/[0.045]" : "border-white/6 bg-black/20"}`}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${CPU_COLORS[p]}`} />
                            <div><p className="text-xs font-black">{playerName(p)}</p><p className="text-[9px] uppercase tracking-wider text-white/30">{p.startsWith("cpu") ? "CPU" : "jogador"}</p></div>
                          </div>
                          {clue ? <Check size={15} className="text-emerald-300" /> : <span className="text-[9px] text-white/25">pensando...</span>}
                        </div>
                        {clue ? <div className="flex items-start gap-2 rounded-xl bg-black/20 px-3 py-2.5 text-sm text-white/80"><MessageCircle size={14} className="mt-0.5 shrink-0 text-violet-300" />{clue}</div> : <div className="h-9 rounded-xl bg-white/[0.03] animate-pulse" />}
                      </div>
                    );
                  })}
                </div>
                <div className="h-fit rounded-[24px] border border-violet-300/10 bg-violet-400/[0.05] p-4">
                  <div className="mb-3 flex items-center gap-2 text-violet-200"><MessageCircle size={16} /><p className="text-xs font-black">Sua vez de falar</p></div>
                  <p className="text-[10px] leading-relaxed text-white/40">Dê uma característica verdadeira se você for inocente. Se for o impostor, tente se encaixar sem entregar que não sabe a palavra.</p>
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} disabled={Boolean(state.clues[me]?.[state.round])} maxLength={80} rows={3} placeholder="Ex.: é algo que muita gente conhece..." className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/25 p-3 text-sm outline-none placeholder:text-white/20 focus:border-violet-300/30" />
                  <button type="button" onClick={submitClue} disabled={!draft.trim() || Boolean(state.clues[me]?.[state.round])} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 py-2.5 text-xs font-black disabled:opacity-30"><MessageCircle size={14} /> Enviar característica</button>
                  {state.clues[me]?.[state.round] && <p className="mt-2 text-center text-[10px] text-emerald-300/70">Sua pista foi enviada.</p>}
                </div>
              </div>
            </section>
          )}

          {state.phase === "vote" && (
            <section className="mx-auto max-w-3xl">
              <div className="mb-5 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-400/10 text-red-300"><Vote size={25} /></div>
                <p className="mt-3 text-[10px] font-black uppercase tracking-[0.25em] text-red-200/60">hora da votação</p>
                <h2 className="mt-1 text-2xl font-black">Quem é o impostor?</h2>
                <p className="mt-1 text-xs text-white/45">Todos os cinco jogadores precisam votar.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {PLAYERS.map((p) => (
                  <button key={p} type="button" onClick={() => vote(p)} disabled={voted} className={`rounded-2xl border p-4 text-left transition ${state.votes[me] === p ? "border-red-300/50 bg-red-400/10" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"} disabled:cursor-default`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${CPU_COLORS[p]}`} />
                      <div className="min-w-0 flex-1"><p className="text-sm font-black">{playerName(p)}</p><p className="text-[9px] uppercase tracking-wider text-white/30">{p === me ? "Você" : p.startsWith("cpu") ? "CPU" : "Jogador"}</p></div>
                      {state.votes[me] === p && <Check size={16} className="text-red-300" />}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-center text-xs text-white/45">{voted ? "Seu voto foi registrado. Os CPUs também estão votando..." : "Escolha um suspeito."}</div>
            </section>
          )}

          {state.phase === "result" && (
            <section className="mx-auto max-w-3xl">
              <div className={`rounded-[30px] border p-6 text-center shadow-2xl ${caught ? "border-emerald-300/20 bg-emerald-300/[0.06]" : "border-red-300/20 bg-red-300/[0.06]"}`}>
                <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-3xl ${caught ? "bg-emerald-400/15 text-emerald-200" : "bg-red-400/15 text-red-200"}`}>
                  {caught ? <Shield size={32} /> : <Skull size={32} />}
                </div>
                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.25em] text-white/40">resultado</p>
                <h2 className="mt-1 text-3xl font-black">{playerName(impostor!)}</h2>
                <p className="mt-1 text-sm text-white/55">{myResultText}</p>
                <div className="mt-5 grid gap-2 sm:grid-cols-5">
                  {PLAYERS.map((p) => (
                    <div key={p} className={`rounded-2xl border p-3 ${p === impostor ? "border-red-300/30 bg-red-400/10" : "border-white/8 bg-black/20"}`}>
                      <p className="text-xs font-black">{playerName(p)}</p>
                      <p className={`mt-1 text-[9px] font-black uppercase tracking-wider ${p === impostor ? "text-red-300" : "text-emerald-300"}`}>{p === impostor ? "Impostor" : "Inocente"}</p>
                      <p className="mt-2 text-[10px] text-white/35">{voteCounts[p] ?? 0} voto(s)</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl border border-white/8 bg-black/20 p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Palavra secreta</p>
                  <p className="mt-1 text-xl font-black">{secret}</p>
                  <p className="mt-1 text-xs text-white/35">Tema: {theme.name}</p>
                </div>
                {me === "gu" && <button type="button" onClick={restart} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-xs font-black hover:bg-white/15"><RotateCcw size={15} /> Nova partida</button>}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
