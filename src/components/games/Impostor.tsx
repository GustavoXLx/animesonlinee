import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Eye,
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
import { supabase } from "@/integrations/supabase/client";

type Player = "gu" | "li" | "cpu1" | "cpu2" | "cpu3";
type Phase = "lobby" | "cards" | "round" | "vote" | "result";
type Theme = { name: string; items: string[] };
type ImpState = {
  phase: Phase; seed: number; themeIndex: number; round: number;
  ready: Record<Me, boolean>; seenCard: Record<Me, boolean>;
  clues: Record<Player, string[]>; clueSubmitted: Record<Me, boolean>;
  votes: Record<Player, Player | null>; voteDone: Player[];
  aiVotes: Record<"cpu1"|"cpu2"|"cpu3", Player | null>;
  aiAnalysis: Record<Player, number>;
  aiStatus: "idle" | "loading" | "ready" | "error";
};

const PLAYERS: Player[] = ["gu", "li", "cpu1", "cpu2", "cpu3"];
const NAMES: Record<Player, string> = { gu: "BB Gu", li: "BB Li", cpu1: "Alex", cpu2: "Nina", cpu3: "Theo" };
const GENDER: Record<Player, "male" | "female"> = { gu: "male", li: "female", cpu1: "male", cpu2: "female", cpu3: "male" };

const THEMES: Theme[] = [
  { name: "Comidas", items: ["Pizza","Hambúrguer","Sushi","Lasanha","Pudim","Coxinha"] },
  { name: "Países", items: ["Brasil","Japão","Itália","França","Egito","Canadá"] },
  { name: "Animais", items: ["Leão","Golfinho","Elefante","Pinguim","Cachorro","Girafa"] },
  { name: "Cidades", items: ["Paris","Tóquio","Nova York","Rio de Janeiro","Londres","Dubai"] },
  { name: "Esportes", items: ["Futebol","Basquete","Tênis","Vôlei","Boxe","Natação"] },
  { name: "Tecnologia", items: ["Celular","Notebook","Videogame","Drone","Robô","Smartwatch"] },
  { name: "Casa", items: ["Sofá","Geladeira","Cama","Chuveiro","Televisão","Micro-ondas"] },
  { name: "Viagem", items: ["Avião","Hotel","Passaporte","Mala","Aeroporto","Mapa"] },
  { name: "Natureza", items: ["Montanha","Cachoeira","Floresta","Vulcão","Deserto","Rio"] },
  { name: "Música", items: ["Violão","Piano","Bateria","Microfone","Show","Cantor"] },
  { name: "Moda", items: ["Vestido","Tênis","Jaqueta","Bolsa","Boné","Óculos"] },
  { name: "Festas", items: ["Aniversário","Casamento","Carnaval","Réveillon","Balada","Formatura"] },
  { name: "Doces", items: ["Chocolate","Sorvete","Brigadeiro","Bolo","Donut","Picolé"] },
];

const CLUES: Record<string, string[]> = {
  Pizza:["costuma ser dividida em fatias","o queijo derretido chama atenção","pode ter borda fina ou recheada"],
  Hambúrguer:["normalmente é montado em camadas","o pão fica por fora do recheio","pode receber vários complementos"],
  Sushi:["costuma ser servido em pedaços pequenos","é muito associado à culinária japonesa","pode levar arroz e ingredientes crus"],
  Lasanha:["é montada em várias camadas","o molho aparece entre as camadas","geralmente é servida em porções"],
  Pudim:["tem textura macia e cremosa","costuma ter uma calda por cima","normalmente é desenformado"],
  Coxinha:["tem formato parecido com uma gota","o recheio tradicional é frango","é muito comum em festas brasileiras"],
  Brasil:["é o maior país da América do Sul","o português é a língua oficial","a bandeira tem verde, amarelo, azul e branco"],
  Japão:["é formado por várias ilhas","mistura tecnologia e tradições antigas","a flor de cerejeira é um símbolo conhecido"],
  Itália:["Roma é a capital","é muito associada a massas e pizzas","tem formato parecido com uma bota no mapa"],
  França:["Paris é a capital","a Torre Eiffel é um símbolo famoso","é muito associada à gastronomia e à moda"],
  Egito:["o rio Nilo atravessa o país","as pirâmides são um símbolo conhecido","fica no nordeste da África"],
  Canadá:["a folha de bordo aparece na bandeira","é conhecido por seus invernos rigorosos","fica na América do Norte"],
  Leão:["o macho pode ter uma grande juba","é um predador de grande porte","vive em grupos"],
  Golfinho:["vive na água e precisa subir para respirar","costuma viver em grupos","é conhecido pela inteligência"],
  Elefante:["usa a tromba para pegar coisas","tem enormes orelhas","é um dos maiores animais terrestres"],
  Pinguim:["não consegue voar","usa as asas para nadar","é associado a regiões frias"],
  Cachorro:["tem olfato muito desenvolvido","é um dos animais domésticos mais comuns","existem muitas raças"],
  Girafa:["tem o pescoço extremamente comprido","usa a língua para alcançar folhas","é um animal muito alto"],
  Paris:["a Torre Eiffel é um cartão-postal","fica às margens do rio Sena","é muito ligada à arte e à moda"],
  Tóquio:["é a capital do Japão","tem uma enorme rede ferroviária","mistura bairros modernos e tradicionais"],
  "Nova York":["Manhattan é uma área muito conhecida","tem muitos arranha-céus","a Estátua da Liberdade fica na cidade"],
  "Rio de Janeiro":["o Cristo Redentor é um cartão-postal","tem praias muito conhecidas","o Pão de Açúcar fica na cidade"],
  Londres:["o Big Ben é um símbolo","os ônibus vermelhos são famosos","é a capital do Reino Unido"],
  Dubai:["é conhecida por construções muito altas","fica nos Emirados Árabes Unidos","é associada a luxo e arquitetura moderna"],
  Futebol:["dois times tentam marcar gols","é jogado com uma bola","tem onze jogadores de cada lado em campo"],
  Basquete:["envolve arremessos em uma cesta","é jogado em uma quadra","a bola é conduzida com as mãos"],
  Tênis:["é jogado com raquete","uma rede divide os lados","pode ser disputado individualmente ou em duplas"],
  Vôlei:["uma rede divide a quadra","a bola não pode tocar o chão do próprio lado","as equipes fazem rodízio"],
  Boxe:["os competidores usam luvas","é uma modalidade de combate","os golpes são feitos principalmente com as mãos"],
  Natação:["é praticada dentro da água","há diferentes estilos","pode ser disputada em piscinas"],
  Celular:["é portátil","possui aplicativos","é usado para comunicação"],
  Notebook:["é um computador portátil","tem tela e teclado juntos","pode ser levado para vários lugares"],
  Videogame:["é usado para jogar","pode ter controle","existem muitos gêneros diferentes"],
  Drone:["pode voar sem piloto dentro","é controlado remotamente","pode carregar uma câmera"],
  Robô:["é uma máquina programada","pode executar tarefas","pode ter sensores"],
  Smartwatch:["é usado no pulso","tem funções digitais","pode mostrar notificações"],
  Sofá:["é um móvel para sentar","costuma ficar na sala","pode acomodar várias pessoas"],
  Geladeira:["mantém alimentos refrigerados","fica ligada na tomada","tem portas e prateleiras"],
  Cama:["é usada para dormir","fica normalmente no quarto","pode ter colchão e travesseiro"],
  Chuveiro:["é usado durante o banho","fica em uma área molhada","libera água de cima"],
  Televisão:["tem uma tela","pode transmitir programas","é comum em salas"],
  "Micro-ondas":["aquece alimentos rapidamente","tem uma porta","possui um painel de controle"],
  Avião:["viaja pelo ar","tem asas","decola e pousa em aeroportos"],
  Hotel:["recebe viajantes","oferece quartos","pode ter recepção"],
  Passaporte:["é um documento","é usado em viagens internacionais","tem páginas para registros"],
  Mala:["serve para transportar roupas","tem alça","é comum em aeroportos"],
  Aeroporto:["recebe aviões","tem áreas de embarque","pode ter esteiras de bagagem"],
  Mapa:["ajuda na localização","pode mostrar estradas","representa lugares"],
  Montanha:["é uma grande elevação natural","pode ter neve no topo","é comum em paisagens"],
  Cachoeira:["tem água caindo de uma altura","pode ficar em uma área de mata","atrai visitantes"],
  Floresta:["tem muitas árvores","abriga diversos animais","pode ocupar uma área enorme"],
  Vulcão:["pode liberar lava","é uma formação geológica","pode ter uma cratera"],
  Deserto:["recebe pouca chuva","pode ter grandes áreas de areia","tem clima muito seco"],
  Rio:["é um curso natural de água","pode atravessar cidades","desemboca em outro corpo d'água"],
  Violão:["tem cordas","pode ser tocado com palheta","é muito usado em rodas de música"],
  Piano:["tem teclas","é um instrumento grande","pode aparecer em concertos"],
  Bateria:["é formada por peças de percussão","pode ser tocada com baquetas","marca o ritmo de músicas"],
  Microfone:["capta a voz","é usado em apresentações","pode ser conectado a caixas de som"],
  Show:["é uma apresentação para público","pode ter música","acontece em um palco"],
  Cantor:["usa a voz para se apresentar","pode trabalhar com uma banda","faz apresentações para público"],
  Vestido:["é uma peça de roupa","pode ter vários estilos","é usado em diferentes ocasiões"],
  Tênis:["é um tipo de calçado","é usado no dia a dia","pode ter sola de borracha"],
  Jaqueta:["é usada na parte de cima do corpo","pode proteger do frio","tem vários modelos"],
  Bolsa:["serve para carregar objetos","pode ser usada no ombro","tem muitos tamanhos"],
  Boné:["é usado na cabeça","tem uma aba","pode ter estampas"],
  Óculos:["fica diante dos olhos","pode corrigir a visão","também pode ser usado como acessório"],
  Aniversário:["acontece todos os anos","costuma ter comemoração","pode ter bolo"],
  Casamento:["é uma celebração","pode reunir familiares","costuma ter cerimônia"],
  Carnaval:["tem música e fantasias","é famoso pelos desfiles","atrai grandes multidões"],
  Réveillon:["marca a chegada de um novo ano","é comemorado à noite","pode ter fogos"],
  Balada:["costuma acontecer à noite","tem música","é ligada à dança"],
  Formatura:["marca o fim de uma etapa","pode ter cerimônia","reúne estudantes e familiares"],
  Chocolate:["é feito a partir de cacau","pode ser ao leite ou amargo","é uma sobremesa popular"],
  Sorvete:["é gelado","pode ter vários sabores","é servido em bolas ou porções"],
  Brigadeiro:["é um doce brasileiro","leva chocolate","costuma ser enrolado em pequenas porções"],
  Bolo:["é assado","pode ter cobertura","é comum em festas"],
  Donut:["tem formato circular","pode ter cobertura","tem um furo no centro"],
  Picolé:["é congelado","tem um palito","pode ter vários sabores"],
};

const HINTS: Record<string,string> = {
  Pizza:"Pense em algo redondo e que costuma ser servido em pedaços.",
  Hambúrguer:"Pense em algo montado em camadas e envolto por pão.",
  Sushi:"Pense em algo pequeno, japonês e servido em porções.",
  Brasil:"Pense em um país grande da América do Sul.",
  Japão:"Pense em um país de ilhas, tecnologia e tradição.",
  Leão:"Pense em um grande felino.",
  Golfinho:"Pense em um animal que vive no mar.",
  Paris:"Pense em uma cidade europeia com uma torre muito famosa.",
  Futebol:"Pense em um esporte com bola e gols.",
  Celular:"Pense em um aparelho portátil cheio de aplicativos.",
  Geladeira:"Pense em um eletrodoméstico ligado a alimentos frios.",
  Avião:"Pense em um transporte que viaja pelo céu.",
  Chocolate:"Pense em um doce feito com cacau.",
};

function hash(seed:number,salt:number){let x=(seed^Math.imul(salt,0x45d9f3b))>>>0;x=Math.imul(x^(x>>>16),0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return(x^(x>>>16))>>>0;}
function roleFor(seed:number){return PLAYERS[hash(seed,71)%PLAYERS.length];}
function themeFor(seed:number){return hash(seed,113)%THEMES.length;}
function wordFor(seed:number,themeIndex:number){const t=THEMES[themeIndex];return t.items[hash(seed,991+themeIndex)%t.items.length];}
const IMPOSTOR_CLUES: Record<string,string[]> = {
  Comidas:["Eu associaria a algo que costuma aparecer numa refeição.","É o tipo de coisa que muita gente reconhece de primeira.","Tem várias versões e cada pessoa pode ter uma preferência."],
  Países:["Eu pensaria em algo que aparece bastante em viagens.","É algo que pode ser reconhecido por referências culturais.","Tem características que fazem muita gente lembrar dele."],
  Animais:["Eu associaria a algo que você encontra na natureza ou em casa.","É algo que costuma ter comportamentos bem marcantes.","Dá para reconhecer por características do próprio jeito de viver."],
  Cidades:["Eu ligaria isso a um lugar que muita gente conhece.","É algo que pode ser lembrado por experiências ou imagens.","Tem uma identidade própria que chama atenção."],
  Esportes:["Eu pensaria em algo ligado a competição e entretenimento.","É algo que muita gente acompanha ou pratica.","Tem regras e características que fazem parte da experiência."],
  Tecnologia:["Eu associaria a algo presente no dia a dia moderno.","É algo que pode ter várias funções dependendo do uso.","É uma coisa que muita gente já teve contato."],
  Casa:["Eu pensaria em algo que faz parte da rotina doméstica.","É algo que costuma ter uma função bem prática.","Dá para encontrar em diferentes tipos de ambientes."],
  Viagem:["Eu associaria a algo que aparece durante uma viagem.","É uma coisa que pode fazer parte do planejamento ou do percurso.","Muita gente já teve contato com isso em algum deslocamento."],
  Natureza:["Eu pensaria em algo ligado a uma paisagem.","É algo que pode ser lembrado por uma experiência ao ar livre.","Tem características que ficam bem marcadas na memória."],
  Música:["Eu associaria a algo ligado a uma experiência musical.","É algo que pode aparecer em diferentes apresentações.","Tem uma relação forte com som e entretenimento."],
  Moda:["Eu pensaria em algo ligado ao visual e ao estilo.","É algo que pode mudar bastante conforme a ocasião.","Tem vários modelos e preferências pessoais."],
  Festas:["Eu associaria a algo que aparece em momentos de comemoração.","É algo ligado a encontros e celebrações.","Pode mudar bastante dependendo da ocasião."],
  Doces:["Eu pensaria em algo que muita gente escolhe como sobremesa.","É algo que pode ter várias versões e sabores.","Normalmente está ligado a uma experiência bem gostosa."],
};

const CLUE_STYLES = [
  (clue:string) => clue,
  (clue:string) => `Uma coisa que me chama atenção é que ${clue.charAt(0).toLowerCase()+clue.slice(1)}`,
  (clue:string) => `Eu ligaria isso ao fato de que ${clue.charAt(0).toLowerCase()+clue.slice(1)}`,
];

const SAFE_WORD_REPLACEMENTS: Record<string,string> = {
  "Paris é a capital":"é um país europeu muito associado à cultura",
  "Roma é a capital":"é um país europeu com forte tradição cultural",
  "a Torre Eiffel é um símbolo famoso":"tem um ponto turístico muito conhecido",
  "a Torre Eiffel é um cartão-postal":"tem um cartão-postal reconhecido no mundo todo",
  "o Cristo Redentor é um cartão-postal":"tem um cartão-postal conhecido internacionalmente",
  "o Big Ben é um símbolo":"tem um monumento muito reconhecido",
  "a folha de bordo aparece na bandeira":"tem símbolos nacionais bem marcantes",
  "fica no nordeste da África":"fica em uma região historicamente muito conhecida",
  "é o maior país da América do Sul":"ocupa uma área enorme do continente",
};

function clueFor(seed:number,themeIndex:number,player:Player,round:number){
  const word=wordFor(seed,themeIndex);
  const themeName=THEMES[themeIndex]?.name??"";
  if(roleFor(seed)===player){
    const variants=IMPOSTOR_CLUES[themeName]??[
      "Eu associaria a algo que tem características bem conhecidas.",
      "É algo que muita gente reconheceria por contexto.",
      "Tem mais de uma forma de ser percebido ou lembrado.",
    ];
    return variants[round];
  }
  const rawBank=CLUES[word]??["é bastante conhecido","tem características marcantes","tem diferentes versões"];
  const bank=rawBank.map(clue=>SAFE_WORD_REPLACEMENTS[clue]??clue);
  const playerIndex=PLAYERS.indexOf(player);
  const baseIndex=hash(seed,500+playerIndex*31)%bank.length;
  const styleIndex=(playerIndex+round)%CLUE_STYLES.length;
  const clue=bank[(baseIndex+round)%bank.length];
  return CLUE_STYLES[styleIndex](clue);
}
function emptyState():ImpState{return{phase:"lobby",seed:0,themeIndex:0,round:0,ready:{gu:false,li:false},seenCard:{gu:false,li:false},clues:{gu:[],li:[],cpu1:[],cpu2:[],cpu3:[]},clueSubmitted:{gu:false,li:false},votes:{gu:null,li:null,cpu1:null,cpu2:null,cpu3:null},voteDone:[],aiVotes:{cpu1:null,cpu2:null,cpu3:null},aiAnalysis:{gu:0,li:0,cpu1:0,cpu2:0,cpu3:0},aiStatus:"idle"};
}

function Character({player,size="md"}:{player:Player;size?: "sm"|"md"}) {
  const female=GENDER[player]==="female";
  const compact=size==="sm";
  const skin=female?"bg-[#f2c6a4]":"bg-[#d9a078]";
  const hair=female?"bg-[#6f4030]":"bg-[#29242f]";
  const outfit=female?"bg-[#c94f82]":"bg-[#416fc4]";
  const accent=female?"bg-[#f6d6e4]":"bg-[#9db8f2]";
  return <div className={`relative shrink-0 ${compact?"h-[72px] w-[58px]":"h-[126px] w-[92px]"}`}>
    <div className={`absolute left-1/2 top-0 -translate-x-1/2 rounded-full border-2 border-black/20 shadow-lg ${compact?"h-9 w-9":"h-14 w-14"} ${skin}`}>
      <div className={`absolute left-1/2 ${compact?"top-[12px]":"top-[18px]"} flex -translate-x-1/2 gap-2`}>
        <span className={`rounded-full bg-[#241c22] ${compact?"h-1.5 w-1.5":"h-2 w-2"}`}/>
        <span className={`rounded-full bg-[#241c22] ${compact?"h-1.5 w-1.5":"h-2 w-2"}`}/>
      </div>
      <div className={`absolute left-1/2 -translate-x-1/2 rounded-full border border-black/10 ${compact?"top-5 h-1 w-3":"top-8 h-1.5 w-4"} bg-[#b56f66]`}/>
      <div className={`absolute left-1/2 -top-1 -translate-x-1/2 rounded-t-full ${compact?"h-3 w-9":"h-5 w-14"} ${hair}`}/>
      {female&&<div className={`absolute -left-1 -top-1 rounded-full ${compact?"h-7 w-2":"h-11 w-3"} ${hair} shadow-[calc(100%+30px)_0_0_var(--tw-shadow-color)]`}/>}
    </div>
    <div className={`absolute left-1/2 ${compact?"top-8 h-7 w-10":"top-12 h-12 w-16"} -translate-x-1/2 rounded-t-[18px] rounded-b-xl border border-black/20 shadow-md ${outfit}`}>
      <span className={`absolute left-1/2 top-1/2 -translate-x-1/2 rounded-full ${compact?"h-2 w-2":"h-3 w-3"} ${accent}`}/>
    </div>
    <div className={`absolute left-1/2 ${compact?"top-[59px]":"top-[101px]"} -translate-x-1/2 rounded-full ${compact?"h-2 w-8":"h-3 w-12"} bg-[#25202a]`}/>
  </div>;
}
function CharacterCard({player,clue}:{player:Player;clue?:string}){
  const text=clue?.trim()||"Pensando em uma pista...";
  return <div className="relative flex min-h-[230px] flex-col items-center rounded-[26px] border border-white/10 bg-gradient-to-b from-white/[0.07] via-white/[0.025] to-black/20 px-3 pb-4 pt-3 shadow-lg">
    <div className="relative z-10 flex min-h-[74px] w-full items-center justify-center rounded-[20px] border border-black/10 bg-white px-4 py-3 text-center text-[14px] font-extrabold leading-5 text-[#211a25] shadow-[0_8px_24px_rgba(0,0,0,.28)]">
      <span>{text}</span>
      <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-black/10 bg-white"/>
    </div>
    <div className="mt-5"><Character player={player}/></div>
    <div className="-mt-1 text-center">
      <p className="text-[15px] font-black">{NAMES[player]}</p>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{player.startsWith("cpu")?"CPU":"jogador"}</p>
    </div>
  </div>;
}

export function Impostor({me}:{me:Me}){
  const {state,setState,peerOnline}=useGameChannel<ImpState>("impostor",me,emptyState());
  const [draft,setDraft]=useState("");
  const [resetKey,setResetKey]=useState(0);
  const ready=state.ready??{gu:false,li:false};
  const bothReady=ready.gu&&ready.li;
  const theme=THEMES[state.themeIndex]??THEMES[0];
  const secretWord=state.seed?wordFor(state.seed,state.themeIndex):"";
  const myImpostor=state.seed?roleFor(state.seed)===me:false;

  useEffect(()=>{if(!peerOnline||!bothReady||state.phase!=="lobby")return;const seed=hash(Date.now(),7001)||1;setState({...emptyState(),phase:"cards",seed,themeIndex:themeFor(seed),ready:{gu:true,li:true}});},[peerOnline,bothReady,state.phase,setState]);
  useEffect(()=>{if(state.phase!=="round"||!state.seed)return;const next={...state.clues};let changed=false;(["cpu1","cpu2","cpu3"] as Player[]).forEach(cpu=>{const existing=next[cpu]??[];if(!existing[state.round]){next[cpu]=[...existing,clueFor(state.seed,state.themeIndex,cpu,state.round)];changed=true;}});if(changed)setState({...state,clues:next});},[state.phase,state.round,state.seed,state.themeIndex,state.clues,setState]);
  useEffect(()=>{if(state.phase!=="round"||state.round!==2||!state.clueSubmitted.gu||!state.clueSubmitted.li)return;if(!state.clues.cpu1[2]||!state.clues.cpu2[2]||!state.clues.cpu3[2])return;setState({...state,phase:"vote"});},[state.phase,state.round,state.clueSubmitted,state.clues,setState]);
  useEffect(()=>{if(state.phase!=="vote"||!state.seed||state.aiStatus!=="idle")return;setState({...state,aiStatus:"loading"});(async()=>{  const {data,error}=await supabase.functions.invoke("analyze-impostor",{body:{theme:theme.name,word:secretWord,impostor:roleFor(state.seed),clues:state.clues}});  if(error||!data?.votes){setState(prev=>({...prev,aiStatus:"error"}));return;}  setState(prev=>({...prev,aiVotes:{cpu1:data.votes.cpu1??null,cpu2:data.votes.cpu2??null,cpu3:data.votes.cpu3??null},aiAnalysis:{...prev.aiAnalysis,...(data.analysis??{})},votes:{...prev.votes,cpu1:data.votes.cpu1??null,cpu2:data.votes.cpu2??null,cpu3:data.votes.cpu3??null},voteDone:[...new Set([...prev.voteDone,"cpu1","cpu2","cpu3"])],aiStatus:"ready"}));})().catch(()=>setState(prev=>({...prev,aiStatus:"error"})));},[state.phase,state.seed,state.aiStatus,state.clues,theme.name,secretWord,setState]);
  useEffect(()=>{if(state.phase!=="vote"||state.aiStatus!=="ready"||!state.votes.gu||!state.votes.li)return;setState({...state,phase:"result"});},[state.phase,state.aiStatus,state.votes,setState]);

  const reset=()=>{setResetKey(v=>v+1);setDraft("");setState(emptyState());};
  const toggleReady=()=>setState(prev=>({...prev,ready:{...(prev.ready??{gu:false,li:false}),[me]:!((prev.ready??{gu:false,li:false})[me])}}));
  const revealCard=()=>setState(prev=>({...prev,seenCard:{...prev.seenCard,[me]:true}}));
  const startRounds=()=>{setState(prev=>({...prev,phase:"round",round:0}));setDraft("");};
  const submitClue=()=>{const text=draft.trim();if(!text)return;setState(prev=>({...prev,clues:{...prev.clues,[me]:[...(prev.clues[me]??[]).slice(0,2),text]},clueSubmitted:{...prev.clueSubmitted,[me]:true}}));setDraft("");};
  const nextRound=()=>{setState(prev=>({...prev,round:prev.round+1,clueSubmitted:{gu:false,li:false}}));setDraft("");};
  const vote=(target:Player)=>{if(target===me||state.votes[me])return;setState(prev=>({...prev,votes:{...prev.votes,[me]:target},voteDone:[...new Set([...prev.voteDone,me])] }));};

  const result=useMemo(()=>{if(state.phase!=="result"||!state.seed)return null;const impostor=roleFor(state.seed);const counts=PLAYERS.reduce<Record<Player,number>>((a,p)=>{a[p]=0;return a},{} as Record<Player,number>);PLAYERS.forEach(p=>{const target=state.votes[p];if(target)counts[target]++});const max=Math.max(...Object.values(counts));const mostVoted=PLAYERS.find(p=>counts[p]===max)??"gu";return{impostor,counts,mostVoted,caught:mostVoted===impostor}},[state.phase,state.seed,state.votes]);

  if(!peerOnline)return <div className="min-h-[520px] flex items-center justify-center p-6"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#141118] p-8 text-center shadow-2xl"><Users className="mx-auto mb-4 text-white/60" size={34}/><h2 className="text-xl font-black">Impostor</h2><p className="mt-2 text-sm text-white/50">Aguardando BB Li entrar na sala.</p></div></div>;

  return <div key={resetKey} className="h-[min(760px,calc(100dvh-110px))] min-h-[520px] overflow-y-auto overscroll-contain bg-[#0e0b12] text-white p-4 md:p-6">
    <div className="mx-auto max-w-5xl space-y-4 pb-8">
      <header className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4">
        <div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-300">Sala de investigação</p><h1 className="mt-1 text-2xl font-black">Impostor</h1></div>
        <button onClick={reset} className="rounded-full border border-white/10 bg-white/5 p-2.5 text-white/60 hover:bg-white/10" title="Reiniciar"><RotateCcw size={17}/></button>
      </header>

      {state.phase==="lobby"&&<div className="grid gap-4 md:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><div className="flex items-center gap-3"><div className="rounded-2xl bg-fuchsia-500/15 p-3 text-fuchsia-300"><Users size={22}/></div><div><h2 className="font-bold">5 jogadores</h2><p className="text-xs text-white/45">1 impostor • 3 rodadas • votação final</p></div></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{PLAYERS.map(p=><div key={p} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 p-3"><Character player={p} size="sm"/><div className="min-w-0 flex-1"><p className="text-sm font-bold">{NAMES[p]}</p><p className="text-[11px] text-white/40">{p==="gu"||p==="li"?"jogador":"CPU"}</p></div><Check size={16} className={p==="gu"||p==="li"?(ready[p]?"text-emerald-400":"text-white/20"):"text-emerald-400"}/></div>)}</div></section>
        <section className="rounded-3xl border border-fuchsia-400/15 bg-fuchsia-500/[0.05] p-5"><p className="text-xs font-bold uppercase tracking-widest text-white/40">Preparação</p><p className="mt-2 text-2xl font-black">{Number(ready.gu)+Number(ready.li)}/2 prontos</p><p className="mt-2 text-sm leading-6 text-white/55">A partida só começa quando você e BB Li confirmarem a entrada.</p><button onClick={toggleReady} className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-bold transition ${ready[me]?"bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30":"bg-fuchsia-500 text-white hover:bg-fuchsia-400"}`}><UserCheck size={18}/>{ready[me]?"Pronto para jogar":"Estou pronto"}</button>{!bothReady&&<p className="mt-3 text-center text-xs text-white/35">Esperando a confirmação dos dois jogadores.</p>}</section>
      </div>}

      {state.phase==="cards"&&<section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">Tema: {theme.name}</p><h2 className="mt-3 text-3xl font-black">Sua carta</h2>{!state.seenCard[me]?<><div className="mx-auto mt-6 grid max-w-sm place-items-center rounded-3xl border border-white/10 bg-black/20 p-10"><LockKeyhole size={42} className="text-white/40"/><p className="mt-4 text-sm text-white/50">Só você deve olhar sua carta.</p></div><button onClick={revealCard} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-fuchsia-500 px-6 py-3 font-bold"><Eye size={18}/> Ver minha carta</button></>:<><div className={`mx-auto mt-6 max-w-sm rounded-3xl border p-7 ${myImpostor?"border-red-400/30 bg-red-500/10":"border-emerald-400/30 bg-emerald-500/10"}`}>{myImpostor?<Skull className="mx-auto text-red-300" size={40}/>:<Shield className="mx-auto text-emerald-300" size={40}/>}<p className="mt-4 text-2xl font-black">{myImpostor?"VOCÊ É O IMPOSTOR":"VOCÊ É INOCENTE"}</p><p className="mt-3 text-sm text-white/60">{myImpostor?`Sua dica: ${HINTS[secretWord]??"observe as pistas dos outros sem entregar que você não sabe a palavra."}`:`A palavra é: ${secretWord}`}</p></div><button onClick={startRounds} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-fuchsia-500 px-6 py-3 font-bold"><Play size={18}/> Continuar</button></>}</section>}

      {state.phase==="round"&&<section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-fuchsia-300">Rodada {state.round+1} de 3</p><h2 className="mt-1 text-xl font-black">{theme.name}</h2></div><div className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/55">Tema compartilhado</div></div><div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{PLAYERS.map(p=><CharacterCard key={p} player={p} clue={state.clues[p]?.[state.round]}/>)}</div>{!state.clueSubmitted[me]?<div className="mt-5 rounded-2xl border border-fuchsia-400/15 bg-fuchsia-500/[0.05] p-4"><p className="text-sm font-bold">Sua pista</p><p className="mt-1 text-xs text-white/45">Não diga a palavra diretamente. Dê uma característica.</p><div className="mt-3 flex gap-2"><input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitClue()} maxLength={100} placeholder="Ex.: costuma ser servido quente" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-fuchsia-400/50"/><button onClick={submitClue} disabled={!draft.trim()} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-fuchsia-500 disabled:opacity-30"><Check size={18}/></button></div></div>:state.round<2?<button onClick={nextRound} className="mt-5 w-full rounded-2xl bg-white/10 py-3 font-bold hover:bg-white/15">Próxima rodada</button>:<p className="mt-5 text-center text-xs text-white/40">As pistas foram registradas. Preparando a votação...</p>}</section>}

      {state.phase==="vote"&&<section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><div className="text-center"><Vote className="mx-auto text-fuchsia-300" size={30}/><p className="mt-3 text-xs font-black uppercase tracking-widest text-white/40">Votação final</p><h2 className="mt-1 text-2xl font-black">Quem é o impostor?</h2><p className="mt-2 text-sm text-white/50">Escolha um jogador. Seu voto não pode ser alterado.</p>{state.aiStatus==="loading"&&<p className="mx-auto mt-3 max-w-md rounded-xl bg-fuchsia-500/10 px-3 py-2 text-xs font-semibold text-fuchsia-200">A IA está analisando as três rodadas e cruzando as pistas de todos.</p>}{state.aiStatus==="error"&&<p className="mx-auto mt-3 max-w-md rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">A análise automática falhou. Tente reiniciar a partida.</p>}</div><div className="mt-6 grid gap-2 sm:grid-cols-2">{PLAYERS.filter(p=>p!==me).map(p=><button key={p} onClick={()=>vote(p)} disabled={Boolean(state.votes[me]) || state.aiStatus==="loading" || state.aiStatus==="error"} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${state.votes[me]===p?"border-fuchsia-400/50 bg-fuchsia-500/15":"border-white/10 bg-black/15 hover:bg-white/[0.07]"} disabled:opacity-70`}><Character player={p} size="sm"/><div className="flex-1"><p className="font-bold">{NAMES[p]}</p><p className="text-xs text-white/40">votar neste jogador</p></div>{state.votes[me]===p&&<Check size={17} className="text-fuchsia-300"/>}</button>)}</div>{state.votes[me]&&<p className="mt-4 text-center text-xs text-white/40">Seu voto foi registrado. Aguarde a outra pessoa.</p>}</section>}

      {state.phase==="result"&&result&&<section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"><div className="text-center">{result.caught?<Shield className="mx-auto text-emerald-300" size={42}/>:<Skull className="mx-auto text-red-300" size={42}/>}<p className="mt-4 text-xs font-black uppercase tracking-widest text-white/40">Resultado</p><h2 className="mt-1 text-3xl font-black">{result.caught?"Impostor descoberto":"O impostor escapou"}</h2><p className="mt-3 text-white/60">O impostor era <strong className="text-white">{NAMES[result.impostor]}</strong>.</p></div><div className="mt-6 grid gap-2">{PLAYERS.map(p=><div key={p} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 p-3"><Character player={p} size="sm"/><div className="min-w-0 flex-1"><p className="font-bold">{NAMES[p]}</p><p className="text-[10px] uppercase tracking-wider text-white/35">suspeita IA: {state.aiAnalysis[p]}%</p></div><p className="text-xs text-white/40">{result.counts[p]} voto{result.counts[p]===1?"":"s"}</p>{p===result.impostor?<Skull size={16} className="text-red-300"/>:<Shield size={16} className="text-emerald-300"/>}</div>)}</div><button onClick={reset} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-fuchsia-500 py-3 font-bold"><RotateCcw size={18}/> Jogar novamente</button></section>}
      {state.phase==="lobby"&&<p className="text-center text-[11px] text-white/30">A sala usa presença online real; CPUs entram automaticamente.</p>}
    </div>
  </div>;
}
