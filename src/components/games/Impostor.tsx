import { useEffect, useState } from "react";
import { Eye, EyeOff, MessageCircle, RotateCcw, Shield, Skull, Sparkles, Users, Vote, Check, Clock3, Play, LockKeyhole, UserCheck } from "lucide-react";
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
  ready: Record<"gu" | "li", boolean>;
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

const WORD_HINTS: Record<string, string> = {
  Pizza:"É redonda e costuma levar queijo por cima.", Hambúrguer:"É montado em camadas e costuma ir dentro de um pão.",
  Sushi:"É pequeno, geralmente servido em pedaços e tem origem japonesa.", Lasanha:"É feita em camadas e costuma levar molho e queijo.",
  Pudim:"É uma sobremesa macia, moldada e normalmente servida gelada.", Coxinha:"É um salgado de massa recheado, muito comum em festas.",
  Brasil:"Tem uma grande faixa litorânea e é conhecido por suas cores verde e amarelo.", Japão:"É um país insular conhecido por tecnologia e cultura tradicional.",
  Itália:"É famosa por sua culinária e por cidades históricas.", França:"É conhecida por sua gastronomia, arte e monumentos.",
  Egito:"É muito associado às pirâmides e ao rio Nilo.", Canadá:"É conhecido pelo frio, grandes áreas naturais e uma folha em sua bandeira.",
  Leão:"É um grande felino conhecido pela juba.", Golfinho:"É um animal marinho conhecido por sua inteligência.",
  Elefante:"É um animal muito grande, com tromba e grandes orelhas.", Pinguim:"É uma ave que não voa e está muito ligada a regiões frias.",
  Cachorro:"É um animal doméstico conhecido por ser companheiro das pessoas.", Girafa:"É um animal alto, com pescoço muito comprido.",
  Paris:"É uma cidade europeia famosa por sua torre mais conhecida.", Tóquio:"É uma enorme cidade asiática conhecida por tecnologia e movimento.",
  "Nova York":"É uma cidade com arranha-céus e uma famosa praça cheia de luzes.", "Rio de Janeiro":"É uma cidade brasileira conhecida por praias e uma grande estátua no alto.",
  Londres:"É uma capital europeia conhecida por ônibus de dois andares e um grande relógio.", Dubai:"É uma cidade conhecida por construções muito altas e luxo.",
  Futebol:"É jogado com uma bola e dois times tentando marcar gols.", Basquete:"É jogado em uma quadra e envolve arremessos em uma cesta.",
  Tênis:"É disputado com raquete e uma rede dividindo os lados.", Vôlei:"É jogado com uma rede alta e uma bola que não pode tocar o chão.",
  Boxe:"É uma luta em que os competidores usam luvas.", Natação:"É um esporte praticado dentro da água.",
  Médico:"É um profissional que cuida da saúde das pessoas.", Professor:"É um profissional ligado ao ensino e à aprendizagem.",
  Chef:"É um profissional especializado em preparar e comandar uma cozinha.", Bombeiro:"É um profissional treinado para combater incêndios e fazer resgates.",
  Piloto:"É quem conduz uma aeronave durante um voo.", Fotógrafo:"É um profissional que trabalha registrando imagens.",
  Comédia:"É um gênero feito para provocar humor e diversão.", Terror:"É um gênero que busca provocar medo e tensão.",
  Ação:"É um gênero conhecido por perseguições, lutas e cenas intensas.", Romance:"É um gênero que costuma colocar relacionamentos no centro da história.",
  "Ficção científica":"É um gênero que costuma explorar tecnologia, espaço ou futuros possíveis.", Animação:"É um formato em que personagens e cenários são criados quadro a quadro.",
  Celular:"É um aparelho portátil usado para comunicação e vários aplicativos.", Notebook:"É um computador portátil que pode ser levado de um lugar para outro.",
  Videogame:"É um aparelho ou sistema usado para jogar jogos eletrônicos.", Drone:"É um equipamento voador controlado remotamente.",
  Robô:"É uma máquina criada para executar tarefas automaticamente.", Smartwatch:"É um relógio que também possui funções digitais e aplicativos.",
  Sofá:"É um móvel comprido usado principalmente para sentar ou deitar.", Geladeira:"É um eletrodoméstico usado para manter alimentos refrigerados.",
  Cama:"É um móvel usado principalmente para dormir.", Chuveiro:"É usado para tomar banho com água caindo de cima.",
  Televisão:"É um aparelho usado para assistir a programas e vídeos.", "Micro-ondas":"É um aparelho usado para aquecer alimentos rapidamente.",
  "Guarda-sol":"É usado para criar sombra em locais abertos.", Areia:"É formada por muitos pequenos grãos e aparece bastante no litoral.",
  Prancha:"É usada por quem quer deslizar sobre a água.", Biquíni:"É uma peça de roupa de banho formada por duas partes.",
  Quente:"É uma característica associada a temperaturas elevadas.", "Protetor solar":"É usado para proteger a pele da exposição ao sol.",
  Prova:"É uma atividade usada para avaliar o conhecimento de estudantes.", Caderno:"É usado para escrever e organizar anotações.",
  Mochila:"É carregada nas costas e serve para transportar objetos.", Recreio:"É um intervalo comum na rotina escolar.",
  Lápis:"É um instrumento usado para escrever e desenhar.", Avião:"É um meio de transporte que viaja pelo ar.",
  Hotel:"É um lugar onde viajantes podem se hospedar.", Passaporte:"É um documento usado em viagens internacionais.",
  Mala:"É usada para transportar roupas e objetos durante viagens.", Aeroporto:"É um local de embarque e desembarque de aviões.",
  Mapa:"É usado para representar lugares e ajudar na localização.", Montanha:"É uma elevação natural de grande tamanho.",
  Cachoeira:"É um trecho em que a água de um rio cai de uma altura.", Floresta:"É uma grande área coberta principalmente por árvores.",
  Vulcão:"É uma formação geológica que pode liberar lava e gases.", Deserto:"É uma região muito seca, com pouca chuva.",
  Rio:"É um curso natural de água que percorre uma determinada região.", Violão:"É um instrumento de cordas muito usado em músicas.",
  Piano:"É um instrumento com teclas e muitas cordas internas.", Bateria:"É um conjunto de instrumentos de percussão tocado com baquetas.",
  Microfone:"É usado para captar a voz e outros sons.", Show:"É uma apresentação feita para um público.", Cantor:"É uma pessoa que usa a voz como instrumento musical.",
  Vestido:"É uma peça de roupa geralmente formada por uma parte única.", Tênis:"É um calçado muito usado no dia a dia.",
  Jaqueta:"É uma peça usada principalmente na parte de cima do corpo.", Bolsa:"É usada para carregar objetos pessoais.",
  Boné:"É um acessório usado na cabeça com uma aba na frente.", Óculos:"É um acessório usado diante dos olhos e pode corrigir a visão.",
  Carro:"É um veículo comum usado para transportar pessoas.", Ônibus:"É um veículo grande que transporta vários passageiros.",
  Metrô:"É um transporte coletivo que circula principalmente por trilhos.", Navio:"É um grande meio de transporte que viaja pela água.",
  Bicicleta:"É um veículo de duas rodas movido principalmente por pedais.", Motocicleta:"É um veículo de duas rodas equipado com motor.",
  Aniversário:"É uma comemoração que acontece todos os anos na mesma data.", Casamento:"É uma celebração ligada à união de duas pessoas.",
  Carnaval:"É uma festa conhecida por música, fantasias e desfiles.", Réveillon:"É uma celebração que marca a chegada de um novo ano.",
  Balada:"É uma festa noturna geralmente ligada a música e dança.", Formatura:"É uma cerimônia que marca a conclusão de uma etapa de estudos.",
  Chave:"É pequena e costuma ser usada para abrir ou fechar algo.", Relógio:"É usado para indicar as horas.",
  Tesoura:"É um objeto com duas lâminas usado para cortar.", Chocolate:"É um doce feito principalmente a partir de cacau.",
  Sorvete:"É uma sobremesa gelada e cremosa.", Brigadeiro:"É um doce brasileiro pequeno, geralmente feito com chocolate.",
  Bolo:"É uma sobremesa assada muito comum em festas.", Donut:"É um doce geralmente redondo com um furo no centro.", Picolé:"É uma sobremesa congelada presa a um palito.",
  Herói:"É um personagem que costuma proteger pessoas e enfrentar perigos.", Vilão:"É um personagem que normalmente se opõe ao protagonista.",
  Máscara:"É usada para cobrir parte do rosto.", Capa:"É uma peça que pode ser usada sobre a roupa e aparece muito em personagens.",
  Poder:"É uma habilidade extraordinária que um personagem pode possuir.", Quartel:"É um local que pode servir como base para um grupo de heróis.",
};

function impostorHint(seed:number, theme:Theme) {
  const word = theme.items[wordIndex(seed, THEMES.indexOf(theme))];
  return WORD_HINTS[word] ?? theme.clues[0];
}

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

  const bothReady = state.ready.gu && state.ready.li;
  const myReady = state.ready[me];

  const toggleReady = () => {
    if (!peerOnline || state.phase !== "lobby") return;
    setState((prev) => ({ ...prev, ready:{ ...prev.ready, [me]:!prev.ready[me] } }));
  };

  useEffect(() => {
    if (me !== "gu" || !peerOnline || state.phase !== "lobby" || !state.ready.gu || !state.ready.li) return;
    const timer = window.setTimeout(() => {
      setState((prev) => {
        if (prev.phase !== "lobby" || !prev.ready.gu || !prev.ready.li) return prev;
        const seed = Math.floor(Math.random() * 0x7fffffff) + 1;
        return { ...resetState(), phase:"cards", seed, themeIndex:themeIndex(seed) };
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [me, peerOnline, state.phase, state.ready.gu, state.ready.li]);

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
            <section className="space-y-4">
              <div className="relative overflow-hidden rounded-[30px] border border-violet-300/15 bg-gradient-to-br from-violet-950/70 via-[#11111d] to-fuchsia-950/40 p-5 shadow-2xl sm:p-7">
                <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-fuchsia-500/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />
                <div className="relative grid gap-6 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
                  <div>
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-200/10 bg-white/[0.05] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-violet-200/70">
                      <LockKeyhole size={12} /> Sala privada
                    </div>
                    <h2 className="max-w-xl text-3xl font-black tracking-tight sm:text-4xl">Quem está escondendo a palavra?</h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/50">
                      Vocês dois precisam apertar <strong className="text-white/75">Iniciar</strong>. Só depois da confirmação dos dois a partida é criada e as cartas são distribuídas.
                    </p>
                    <div className="mt-5 grid gap-2 sm:grid-cols-3">
                      {[
                        ["1","Confirmem","Você e BB Li apertam Iniciar."],
                        ["2","Recebam a carta","Apenas o impostor recebe uma dica curta."],
                        ["3","Descubram","Três rodadas de pistas e votação."],
                      ].map(([n,t,d]) => (
                        <div key={n} className="rounded-2xl border border-white/8 bg-black/20 p-3">
                          <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-violet-400/10 text-[10px] font-black text-violet-200">{n}</div>
                          <p className="text-xs font-black">{t}</p>
                          <p className="mt-1 text-[10px] leading-relaxed text-white/35">{d}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[26px] border border-white/10 bg-black/25 p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Preparação</p>
                        <p className="mt-1 text-sm font-black">{bothReady ? "Tudo pronto" : "Aguardando confirmação"}</p>
                      </div>
                      <div className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${bothReady ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-200"}`}>
                        {bothReady ? "2 de 2" : `${Number(state.ready.gu) + Number(state.ready.li)} de 2`}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {(["gu","li"] as const).map((p) => {
                        const isMe = p === me;
                        const ready = state.ready[p];
                        return (
                          <div key={p} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.035] p-3">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${CPU_COLORS[p]} text-[10px] font-black`}>
                              {p === "gu" ? "GU" : "LI"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-black">{playerName(p)}{isMe ? " • você" : ""}</p>
                              <p className="mt-0.5 text-[9px] uppercase tracking-wider text-white/30">{ready ? "Pronto para iniciar" : "Ainda não confirmou"}</p>
                            </div>
                            {ready ? <UserCheck size={17} className="text-emerald-300" /> : <span className="h-2.5 w-2.5 rounded-full bg-white/15" />}
                          </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={toggleReady}
                      disabled={!peerOnline}
                      className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35 ${myReady ? "border border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-xl shadow-violet-950/30"}`}
                    >
                      {myReady ? <Check size={17} /> : <Play size={17} />}
                      {myReady ? "Início confirmado" : "Iniciar partida"}
                    </button>
                    <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-white/30">
                      <Users size={12} /> {peerOnline ? "BB Li está conectado" : "Aguardando BB Li entrar"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {(["cpu1","cpu2","cpu3"] as const).map((p, i) => (
                  <div key={p} className="rounded-[24px] border border-white/8 bg-white/[0.035] p-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${CPU_COLORS[p]} text-[10px] font-black`}>0{i+1}</div>
                      <div className="min-w-0">
                        <p className="text-xs font-black">{playerName(p)}</p>
                        <p className="text-[9px] uppercase tracking-wider text-violet-200/40">CPU • entra automaticamente</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-white/35">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Pronto para jogar
                    </div>
                  </div>
                ))}
              </div>
            </section>
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
                      <p className="mt-3 text-xs text-white/45">{myImpostor ? "Você não vê a palavra. Recebe uma dica curta para tentar se encaixar." : "Você conhece a palavra secreta."}</p>
                      <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 px-6 py-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Tema</p>
                        <p className="mt-1 text-xl font-black">{theme.name}</p>
                        {myImpostor ? <><p className="mt-3 text-[9px] font-black uppercase tracking-[0.2em] text-amber-200/50">Dica</p><p className="mt-1 max-w-xs text-sm font-bold leading-relaxed text-amber-100">{impostorHint(state.seed, theme)}</p></> : <><p className="mt-3 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-200/50">Palavra</p><p className="mt-1 text-2xl font-black text-emerald-100">{secret}</p></>}
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
