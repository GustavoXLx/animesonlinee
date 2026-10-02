import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Play,
  RotateCcw,
  Shield,
  Skull,
  UserCheck,
  Users,
  Vote,
} from "lucide-react";
import { useGameChannel, type Me } from "./useGameChannel";

type Player = "gu" | "li" | "cpu1" | "cpu2" | "cpu3";
type Phase = "lobby" | "cards" | "round" | "vote" | "result";

type Theme = {
  name: string;
  items: string[];
};

type ImpState = {
  phase: Phase;
  seed: number;
  themeIndex: number;
  round: number;
  ready: Record<Me, boolean>;
  seenCard: Record<Me, boolean>;
  clues: Record<Player, string[]>;
  clueSubmitted: Record<Me, boolean>;
  votes: Record<Player, Player | null>;
  voteDone: Player[];
};

const PLAYERS: Player[] = ["gu", "li", "cpu1", "cpu2", "cpu3"];
const CPU_NAMES: Record<Player, string> = {
  gu: "Você",
  li: "BB Li",
  cpu1: "Alex",
  cpu2: "Nina",
  cpu3: "Theo",
};

const THEMES: Theme[] = [
  { name: "Comidas", items: ["Pizza", "Hambúrguer", "Sushi", "Lasanha", "Pudim", "Coxinha"] },
  { name: "Países", items: ["Brasil", "Japão", "Itália", "França", "Egito", "Canadá"] },
  { name: "Animais", items: ["Leão", "Golfinho", "Elefante", "Pinguim", "Cachorro", "Girafa"] },
  { name: "Cidades", items: ["Paris", "Tóquio", "Nova York", "Rio de Janeiro", "Londres", "Dubai"] },
  { name: "Esportes", items: ["Futebol", "Basquete", "Tênis", "Vôlei", "Boxe", "Natação"] },
  { name: "Tecnologia", items: ["Celular", "Notebook", "Videogame", "Drone", "Robô", "Smartwatch"] },
  { name: "Casa", items: ["Sofá", "Geladeira", "Cama", "Chuveiro", "Televisão", "Micro-ondas"] },
  { name: "Viagem", items: ["Avião", "Hotel", "Passaporte", "Mala", "Aeroporto", "Mapa"] },
  { name: "Natureza", items: ["Montanha", "Cachoeira", "Floresta", "Vulcão", "Deserto", "Rio"] },
  { name: "Música", items: ["Violão", "Piano", "Bateria", "Microfone", "Show", "Cantor"] },
  { name: "Moda", items: ["Vestido", "Tênis", "Jaqueta", "Bolsa", "Boné", "Óculos"] },
  { name: "Festas", items: ["Aniversário", "Casamento", "Carnaval", "Réveillon", "Balada", "Formatura"] },
  { name: "Doces", items: ["Chocolate", "Sorvete", "Brigadeiro", "Bolo", "Donut", "Picolé"] },
];

const CLUES: Record<string, string[]> = {
  Pizza: ["costuma ser dividida em fatias", "o queijo derretido chama atenção", "pode ter borda fina ou recheada"],
  Hambúrguer: ["normalmente é montado em camadas", "o pão fica por fora do recheio", "pode receber vários complementos"],
  Sushi: ["costuma ser servido em pedaços pequenos", "é muito associado à culinária japonesa", "pode levar arroz e ingredientes crus"],
  Lasanha: ["é montada em várias camadas", "o molho aparece entre as camadas", "geralmente é servida em porções"],
  Pudim: ["tem textura macia e cremosa", "costuma ter uma calda por cima", "normalmente é desenformado"],
  Coxinha: ["tem formato parecido com uma gota", "o recheio tradicional é frango", "é muito comum em festas brasileiras"],
  Brasil: ["é o maior país da América do Sul", "o português é a língua oficial", "a bandeira tem verde, amarelo, azul e branco"],
  Japão: ["é formado por várias ilhas", "mistura tecnologia e tradições antigas", "a flor de cerejeira é um símbolo conhecido"],
  Itália: ["Roma é a capital", "é muito associada a massas e pizzas", "tem formato parecido com uma bota no mapa"],
  França: ["Paris é a capital", "a Torre Eiffel é um símbolo famoso", "é muito associada à gastronomia e à moda"],
  Egito: ["o rio Nilo atravessa o país", "as pirâmides são um símbolo conhecido", "fica no nordeste da África"],
  Canadá: ["a folha de bordo aparece na bandeira", "é conhecido por seus invernos rigorosos", "fica na América do Norte"],
  Leão: ["o macho pode ter uma grande juba", "é um predador de grande porte", "vive em grupos"],
  Golfinho: ["vive na água e precisa subir para respirar", "costuma viver em grupos", "é conhecido pela inteligência"],
  Elefante: ["usa a tromba para pegar coisas", "tem enormes orelhas", "é um dos maiores animais terrestres"],
  Pinguim: ["não consegue voar", "usa as asas para nadar", "é associado a regiões frias"],
  Cachorro: ["tem olfato muito desenvolvido", "é um dos animais domésticos mais comuns", "existem muitas raças"],
  Girafa: ["tem o pescoço extremamente comprido", "usa a língua para alcançar folhas", "é um animal muito alto"],
  Paris: ["a Torre Eiffel é um cartão-postal", "fica às margens do rio Sena", "é muito ligada à arte e à moda"],
  Tóquio: ["é a capital do Japão", "tem uma enorme rede ferroviária", "mistura bairros modernos e tradicionais"],
  "Nova York": ["Manhattan é uma área muito conhecida", "tem muitos arranha-céus", "a Estátua da Liberdade fica na cidade"],
  "Rio de Janeiro": ["o Cristo Redentor é um cartão-postal", "tem praias muito conhecidas", "o Pão de Açúcar fica na cidade"],
  Londres: ["o Big Ben é um símbolo", "os ônibus vermelhos são famosos", "é a capital do Reino Unido"],
  Dubai: ["é conhecida por construções muito altas", "fica nos Emirados Árabes Unidos", "é associada a luxo e arquitetura moderna"],
  Futebol: ["dois times tentam marcar gols", "é jogado com uma bola", "tem onze jogadores de cada lado em campo"],
  Basquete: ["envolve arremessos em uma cesta", "é jogado em uma quadra", "a bola é conduzida com as mãos"],
  Tênis: ["é jogado com raquete", "uma rede divide os lados", "pode ser disputado individualmente ou em duplas"],
  Vôlei: ["uma rede divide a quadra", "a bola não pode tocar o chão do próprio lado", "as equipes fazem rodízio"],
  Boxe: ["os competidores usam luvas", "é uma modalidade de combate", "os golpes são feitos principalmente com as mãos"],
  Natação: ["é praticada dentro da água", "há diferentes estilos", "pode ser disputada em piscinas"],
  Celular: ["é portátil", "possui aplicativos", "é usado para comunicação"],
  Notebook: ["é um computador portátil", "tem tela e teclado juntos", "pode ser levado para vários lugares"],
  Videogame: ["é usado para jogar", "pode ter controle", "existem muitos gêneros diferentes"],
  Drone: ["pode voar sem piloto dentro", "é controlado remotamente", "pode carregar uma câmera"],
  Robô: ["é uma máquina programada", "pode executar tarefas", "pode ter sensores"],
  Smartwatch: ["é usado no pulso", "tem funções digitais", "pode mostrar notificações"],
  Sofá: ["é um móvel para sentar", "costuma ficar na sala", "pode acomodar várias pessoas"],
  Geladeira: ["mantém alimentos refrigerados", "fica ligada na tomada", "tem portas e prateleiras"],
  Cama: ["é usada para dormir", "fica normalmente no quarto", "pode ter colchão e travesseiro"],
  Chuveiro: ["é usado durante o banho", "fica em uma área molhada", "libera água de cima"],
  Televisão: ["tem uma tela", "pode transmitir programas", "é comum em salas"],
  "Micro-ondas": ["aquece alimentos rapidamente", "tem uma porta", "possui um painel de controle"],
  Avião: ["viaja pelo ar", "tem asas", "decola e pousa em aeroportos"],
  Hotel: ["recebe viajantes", "oferece quartos", "pode ter recepção"],
  Passaporte: ["é um documento", "é usado em viagens internacionais", "tem páginas para registros"],
  Mala: ["serve para transportar roupas", "tem alça", "é comum em aeroportos"],
  Aeroporto: ["recebe aviões", "tem áreas de embarque", "pode ter esteiras de bagagem"],
  Mapa: ["ajuda na localização", "pode mostrar estradas", "representa lugares"],
  Montanha: ["é uma grande elevação natural", "pode ter neve no topo", "é comum em paisagens"],
  Cachoeira: ["tem água caindo de uma altura", "pode ficar em uma área de mata", "atrai visitantes"],
  Floresta: ["tem muitas árvores", "abriga diversos animais", "pode ocupar uma área enorme"],
  Vulcão: ["pode liberar lava", "é uma formação geológica", "pode ter uma cratera"],
  Deserto: ["recebe pouca chuva", "pode ter grandes áreas de areia", "tem clima muito seco"],
  Rio: ["é um curso natural de água", "pode atravessar cidades", "desemboca em outro corpo d'água"],
  Violão: ["tem cordas", "pode ser tocado com palheta", "é muito usado em rodas de música"],
  Piano: ["tem teclas", "é um instrumento grande", "pode aparecer em concertos"],
  Bateria: ["é formada por peças de percussão", "pode ser tocada com baquetas", "marca o ritmo de músicas"],
  Microfone: ["capta a voz", "é usado em apresentações", "pode ser conectado a caixas de som"],
  Show: ["é uma apresentação para público", "pode ter música", "acontece em um palco"],
  Cantor: ["usa a voz para se apresentar", "pode trabalhar com uma banda", "faz apresentações para público"],
  Vestido: ["é uma peça de roupa", "pode ter vários estilos", "é usado em diferentes ocasiões"],
  Tênis: ["é um tipo de calçado", "é usado no dia a dia", "pode ter sola de borracha"],
  Jaqueta: ["é usada na parte de cima do corpo", "pode proteger do frio", "tem vários modelos"],
  Bolsa: ["serve para carregar objetos", "pode ser usada no ombro", "tem muitos tamanhos"],
  Boné: ["é usado na cabeça", "tem uma aba", "pode ter estampas"],
  Óculos: ["fica diante dos olhos", "pode corrigir a visão", "também pode ser usado como acessório"],
  Aniversário: ["acontece todos os anos", "costuma ter comemoração", "pode ter bolo"],
  Casamento: ["é uma celebração", "pode reunir familiares", "costuma ter cerimônia"],
  Carnaval: ["tem música e fantasias", "é famoso pelos desfiles", "atrai grandes multidões"],
  Réveillon: ["marca a chegada de um novo ano", "é comemorado à noite", "pode ter fogos"],
  Balada: ["costuma acontecer à noite", "tem música", "é ligada à dança"],
  Formatura: ["marca o fim de uma etapa", "pode ter cerimônia", "reúne estudantes e familiares"],
  Chocolate: ["é feito a partir de cacau", "pode ser ao leite ou amargo", "é uma sobremesa popular"],
  Sorvete: ["é gelado", "pode ter vários sabores", "é servido em bolas ou porções"],
  Brigadeiro: ["é um doce brasileiro", "leva chocolate", "costuma ser enrolado em pequenas porções"],
  Bolo: ["é assado", "pode ter cobertura", "é comum em festas"],
  Donut: ["tem formato circular", "pode ter cobertura", "tem um furo no centro"],
  Picolé: ["é congelado", "tem um palito", "pode ter vários sabores"],
};

const HINTS: Record<string, string> = {
  Pizza: "Pense em algo redondo e que costuma ser servido em pedaços.",
  Hambúrguer: "Pense em algo montado em camadas e envolto por pão.",
  Sushi: "Pense em algo pequeno, japonês e servido em porções.",
  Brasil: "Pense em um país grande da América do Sul.",
  Japão: "Pense em um país de ilhas, tecnologia e tradição.",
  Leão: "Pense em um grande felino.",
  Golfinho: "Pense em um animal que vive no mar.",
  Paris: "Pense em uma cidade europeia com uma torre muito famosa.",
  Futebol: "Pense em um esporte com bola e gols.",
  Celular: "Pense em um aparelho portátil cheio de aplicativos.",
  Geladeira: "Pense em um eletrodoméstico ligado a alimentos frios.",
  Avião: "Pense em um transporte que viaja pelo céu.",
  Chocolate: "Pense em um doce feito com cacau.",
};

function hash(seed: number, salt: number) {
  let x = (seed ^ Math.imul(salt, 0x45d9f3b)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}

function roleFor(seed: number) {
  return PLAYERS[hash(seed, 71) % PLAYERS.length];
}

function themeFor(seed: number) {
  return hash(seed, 113) % THEMES.length;
}

function wordFor(seed: number, themeIndex: number) {
  const theme = THEMES[themeIndex];
  return theme.items[hash(seed, 991 + themeIndex) % theme.items.length];
}

function clueFor(seed: number, themeIndex: number, player: Player, round: number) {
  const word = wordFor(seed, themeIndex);
  if (roleFor(seed) === player) {
    const hint = HINTS[word] ?? "Pense em uma característica geral do que os outros receberam.";
    const variants = [
      "Vou por uma característica que combine com isso.",
      "Eu pensaria em algo ligado a isso.",
      hint,
    ];
    return variants[round];
  }

  const bank = CLUES[word] ?? ["é bastante conhecido", "tem características marcantes", "tem diferentes versões"];
  const offset = hash(seed, 500 + PLAYERS.indexOf(player) * 31) % bank.length;
  return bank[(offset + round) % bank.length];
}

function emptyState(): ImpState {
  return {
    phase: "lobby",
    seed: 0,
    themeIndex: 0,
    round: 0,
    ready: { gu: false, li: false },
    seenCard: { gu: false, li: false },
    clues: { gu: [], li: [], cpu1: [], cpu2: [], cpu3: [] },
    clueSubmitted: { gu: false, li: false },
    votes: { gu: null, li: null, cpu1: null, cpu2: null, cpu3: null },
    voteDone: [],
  };
}

function avatarLetter(player: Player) {
  return player === "gu" ? "G" : player === "li" ? "L" : player.slice(-1).toUpperCase();
}

export function Impostor({ me }: { me: Me }) {
  const { state, setState, peerOnline } = useGameChannel<ImpState>("impostor", me, emptyState());
  const [draft, setDraft] = useState("");
  const [resetKey, setResetKey] = useState(0);

  const ready = state.ready ?? { gu: false, li: false };
  const bothReady = ready.gu && ready.li;
  const theme = THEMES[state.themeIndex] ?? THEMES[0];
  const secretWord = state.seed ? wordFor(state.seed, state.themeIndex) : "";
  const myImpostor = state.seed ? roleFor(state.seed) === me : false;

  useEffect(() => {
    if (!peerOnline || !bothReady || state.phase !== "lobby") return;
    const seed = hash(Date.now(), 7001) || 1;
    setState({
      ...emptyState(),
      phase: "cards",
      seed,
      themeIndex: themeFor(seed),
      ready: { gu: true, li: true },
    });
  }, [peerOnline, bothReady, state.phase, setState]);

  useEffect(() => {
    if (state.phase !== "round" || !state.seed) return;
    const nextClues = { ...state.clues };
    let changed = false;
    (["cpu1", "cpu2", "cpu3"] as Player[]).forEach((cpu) => {
      const existing = nextClues[cpu] ?? [];
      if (!existing[state.round]) {
        nextClues[cpu] = [...existing, clueFor(state.seed, state.themeIndex, cpu, state.round)];
        changed = true;
      }
    });
    if (changed) setState({ ...state, clues: nextClues });
  }, [state.phase, state.round, state.seed, state.themeIndex, state.clues, setState]);

  useEffect(() => {
    if (state.phase !== "round") return;
    if (state.round !== 2) return;
    if (!state.clueSubmitted.gu || !state.clueSubmitted.li) return;
    if (!state.clues.cpu1[2] || !state.clues.cpu2[2] || !state.clues.cpu3[2]) return;
    setState({ ...state, phase: "vote" });
  }, [state.phase, state.round, state.clueSubmitted, state.clues, setState]);

  useEffect(() => {
    if (state.phase !== "vote" || !state.seed) return;
    const nextVotes = { ...state.votes };
    const done = [...state.voteDone];
    let changed = false;

    (["cpu1", "cpu2", "cpu3"] as Player[]).forEach((cpu) => {
      if (nextVotes[cpu]) return;
      const candidates = PLAYERS.filter((p) => p !== cpu);
      let best = candidates[0];
      let bestScore = -Infinity;
      for (const candidate of candidates) {
        let score = hash(state.seed, 900 + PLAYERS.indexOf(cpu) * 37 + PLAYERS.indexOf(candidate));
        const clues = state.clues[candidate] ?? [];
        score += clues.reduce((sum, clue) => sum + (clue.length < 24 ? 3 : 0), 0);
        if (candidate === roleFor(state.seed)) score += roleFor(state.seed) === cpu ? -2 : 4;
        if (candidate === "gu" || candidate === "li") score += 1;
        if (score > bestScore) {
          best = candidate;
          bestScore = score;
        }
      }
      nextVotes[cpu] = best;
      done.push(cpu);
      changed = true;
    });

    if (changed) setState({ ...state, votes: nextVotes, voteDone: [...new Set(done)] });
  }, [state.phase, state.seed, state.clues, state.votes, state.voteDone, setState]);

  useEffect(() => {
    if (state.phase !== "vote") return;
    if (state.voteDone.length < 3) return;
    if (!state.votes.gu || !state.votes.li) return;
    setState({ ...state, phase: "result" });
  }, [state.phase, state.voteDone, state.votes, setState]);

  const reset = () => {
    setResetKey((v) => v + 1);
    setDraft("");
    setState(emptyState());
  };

  const toggleReady = () => {
    setState((prev) => ({
      ...prev,
      ready: { ...(prev.ready ?? { gu: false, li: false }), [me]: !((prev.ready ?? { gu: false, li: false })[me]) },
    }));
  };

  const revealCard = () => {
    setState((prev) => ({
      ...prev,
      seenCard: { ...prev.seenCard, [me]: true },
    }));
  };

  const startRounds = () => {
    setState((prev) => ({ ...prev, phase: "round", round: 0 }));
    setDraft("");
  };

  const submitClue = () => {
    const text = draft.trim();
    if (!text) return;
    setState((prev) => ({
      ...prev,
      clues: { ...prev.clues, [me]: [...(prev.clues[me] ?? []).slice(0, 2), text] },
      clueSubmitted: { ...prev.clueSubmitted, [me]: true },
    }));
    setDraft("");
  };

  const nextRound = () => {
    setState((prev) => ({
      ...prev,
      round: prev.round + 1,
      clueSubmitted: { gu: false, li: false },
    }));
    setDraft("");
  };

  const vote = (target: Player) => {
    if (target === me || state.votes[me]) return;
    setState((prev) => ({
      ...prev,
      votes: { ...prev.votes, [me]: target },
      voteDone: [...new Set([...prev.voteDone, me])],
    }));
  };

  const result = useMemo(() => {
    if (state.phase !== "result" || !state.seed) return null;
    const impostor = roleFor(state.seed);
    const counts = PLAYERS.reduce<Record<Player, number>>((acc, p) => {
      acc[p] = 0;
      return acc;
    }, {} as Record<Player, number>);
    PLAYERS.forEach((p) => {
      const target = state.votes[p];
      if (target) counts[target] += 1;
    });
    const max = Math.max(...Object.values(counts));
    const mostVoted = PLAYERS.find((p) => counts[p] === max) ?? "gu";
    return { impostor, counts, mostVoted, caught: mostVoted === impostor };
  }, [state.phase, state.seed, state.votes]);

  if (!peerOnline) {
    return (
      <div className="min-h-[520px] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#141118] p-8 text-center shadow-2xl">
          <Users className="mx-auto mb-4 text-white/60" size={34} />
          <h2 className="text-xl font-black text-white">Impostor</h2>
          <p className="mt-2 text-sm text-white/50">Aguardando BB Li entrar na sala.</p>
        </div>
      </div>
    );
  }

  return (
    <div key={resetKey} className="min-h-[520px] bg-[#0e0b12] text-white p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-300">Sala de investigação</p>
            <h1 className="mt-1 text-2xl font-black">Impostor</h1>
          </div>
          <button onClick={reset} className="rounded-full border border-white/10 bg-white/5 p-2.5 text-white/60 hover:bg-white/10" title="Reiniciar">
            <RotateCcw size={17} />
          </button>
        </header>

        {state.phase === "lobby" && (
          <div className="grid gap-4 md:grid-cols-[1.2fr_.8fr]">
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-fuchsia-500/15 p-3 text-fuchsia-300"><Users size={22} /></div>
                <div>
                  <h2 className="font-bold">5 jogadores</h2>
                  <p className="text-xs text-white/45">1 impostor • 3 rodadas • votação final</p>
                </div>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {PLAYERS.map((player) => (
                  <div key={player} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 p-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 font-black">{avatarLetter(player)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{CPU_NAMES[player]}</p>
                      <p className="text-[11px] text-white/40">{player === "gu" || player === "li" ? "jogador" : "CPU"}</p>
                    </div>
                    <Check size={16} className={player === "gu" || player === "li" ? (ready[player] ? "text-emerald-400" : "text-white/20") : "text-emerald-400"} />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-fuchsia-400/15 bg-fuchsia-500/[0.05] p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-white/40">Preparação</p>
              <p className="mt-2 text-2xl font-black">{Number(ready.gu) + Number(ready.li)}/2 prontos</p>
              <p className="mt-2 text-sm leading-6 text-white/55">A partida só começa quando você e BB Li confirmarem a entrada.</p>
              <button
                onClick={toggleReady}
                className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-bold transition ${ready[me] ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30" : "bg-fuchsia-500 text-white hover:bg-fuchsia-400"}`}
              >
                <UserCheck size={18} />
                {ready[me] ? "Pronto para jogar" : "Estou pronto"}
              </button>
              {!bothReady && <p className="mt-3 text-center text-xs text-white/35">Esperando a confirmação dos dois jogadores.</p>}
            </section>
          </div>
        )}

        {state.phase === "cards" && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">Tema: {theme.name}</p>
            <h2 className="mt-3 text-3xl font-black">Sua carta</h2>
            {!state.seenCard[me] ? (
              <>
                <div className="mx-auto mt-6 grid max-w-sm place-items-center rounded-3xl border border-white/10 bg-black/20 p-10">
                  <LockKeyhole size={42} className="text-white/40" />
                  <p className="mt-4 text-sm text-white/50">Só você deve olhar sua carta.</p>
                </div>
                <button onClick={revealCard} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-fuchsia-500 px-6 py-3 font-bold">
                  <Eye size={18} /> Ver minha carta
                </button>
              </>
            ) : (
              <>
                <div className={`mx-auto mt-6 max-w-sm rounded-3xl border p-7 ${myImpostor ? "border-red-400/30 bg-red-500/10" : "border-emerald-400/30 bg-emerald-500/10"}`}>
                  {myImpostor ? <Skull className="mx-auto text-red-300" size={40} /> : <Shield className="mx-auto text-emerald-300" size={40} />}
                  <p className="mt-4 text-2xl font-black">{myImpostor ? "VOCÊ É O IMPOSTOR" : "VOCÊ É INOCENTE"}</p>
                  <p className="mt-3 text-sm text-white/60">{myImpostor ? `Sua dica: ${HINTS[secretWord] ?? "observe as pistas dos outros sem entregar que você não sabe a palavra."}` : `A palavra é: ${secretWord}`}</p>
                </div>
                <button onClick={startRounds} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-fuchsia-500 px-6 py-3 font-bold">
                  <Play size={18} /> Continuar
                </button>
              </>
            )}
          </section>
        )}

        {state.phase === "round" && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-fuchsia-300">Rodada {state.round + 1} de 3</p>
                <h2 className="mt-1 text-xl font-black">{theme.name}</h2>
              </div>
              <div className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/55">Tema compartilhado</div>
            </div>

            <div className="mt-5 space-y-2">
              {PLAYERS.map((player) => {
                const clue = state.clues[player]?.[state.round];
                return (
                  <div key={player} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-sm font-black">{avatarLetter(player)}</div>
                      <p className="text-sm font-bold">{CPU_NAMES[player]}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/70">{clue ?? "pensando na pista..."}</p>
                  </div>
                );
              })}
            </div>

            {!state.clueSubmitted[me] ? (
              <div className="mt-5 rounded-2xl border border-fuchsia-400/15 bg-fuchsia-500/[0.05] p-4">
                <p className="text-sm font-bold">Sua pista</p>
                <p className="mt-1 text-xs text-white/45">Não diga a palavra diretamente. Dê uma característica.</p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitClue()}
                    maxLength={100}
                    placeholder="Ex.: costuma ser servido quente"
                    className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-fuchsia-400/50"
                  />
                  <button onClick={submitClue} disabled={!draft.trim()} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-fuchsia-500 disabled:opacity-30">
                    <Check size={18} />
                  </button>
                </div>
              </div>
            ) : state.round < 2 ? (
              <button onClick={nextRound} className="mt-5 w-full rounded-2xl bg-white/10 py-3 font-bold hover:bg-white/15">
                Próxima rodada
              </button>
            ) : (
              <p className="mt-5 text-center text-xs text-white/40">As pistas foram registradas. Preparando a votação...</p>
            )}
          </section>
        )}

        {state.phase === "vote" && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-center">
              <Vote className="mx-auto text-fuchsia-300" size={30} />
              <p className="mt-3 text-xs font-black uppercase tracking-widest text-white/40">Votação final</p>
              <h2 className="mt-1 text-2xl font-black">Quem é o impostor?</h2>
              <p className="mt-2 text-sm text-white/50">Escolha um jogador. Seu voto não pode ser alterado.</p>
            </div>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {PLAYERS.filter((p) => p !== me).map((player) => (
                <button
                  key={player}
                  onClick={() => vote(player)}
                  disabled={Boolean(state.votes[me])}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${state.votes[me] === player ? "border-fuchsia-400/50 bg-fuchsia-500/15" : "border-white/10 bg-black/15 hover:bg-white/[0.07]"} disabled:opacity-70`}
                >
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 font-black">{avatarLetter(player)}</div>
                  <div className="flex-1"><p className="font-bold">{CPU_NAMES[player]}</p><p className="text-xs text-white/40">votar neste jogador</p></div>
                  {state.votes[me] === player && <Check size={17} className="text-fuchsia-300" />}
                </button>
              ))}
            </div>
            {state.votes[me] && <p className="mt-4 text-center text-xs text-white/40">Seu voto foi registrado. Aguarde a outra pessoa.</p>}
          </section>
        )}

        {state.phase === "result" && result && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="text-center">
              {result.caught ? <Shield className="mx-auto text-emerald-300" size={42} /> : <Skull className="mx-auto text-red-300" size={42} />}
              <p className="mt-4 text-xs font-black uppercase tracking-widest text-white/40">Resultado</p>
              <h2 className="mt-1 text-3xl font-black">{result.caught ? "Impostor descoberto" : "O impostor escapou"}</h2>
              <p className="mt-3 text-white/60">O impostor era <strong className="text-white">{CPU_NAMES[result.impostor]}</strong>.</p>
            </div>

            <div className="mt-6 grid gap-2">
              {PLAYERS.map((player) => (
                <div key={player} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 p-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-sm font-black">{avatarLetter(player)}</div>
                  <p className="flex-1 font-bold">{CPU_NAMES[player]}</p>
                  <p className="text-xs text-white/40">{result.counts[player]} voto{result.counts[player] === 1 ? "" : "s"}</p>
                  {player === result.impostor ? <Skull size={16} className="text-red-300" /> : <Shield size={16} className="text-emerald-300" />}
                </div>
              ))}
            </div>

            <button onClick={reset} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-fuchsia-500 py-3 font-bold">
              <RotateCcw size={18} /> Jogar novamente
            </button>
          </section>
        )}

        {state.phase === "lobby" && (
          <p className="text-center text-[11px] text-white/30">A sala usa presença online real; CPUs entram automaticamente.</p>
        )}
      </div>
    </div>
  );
}
