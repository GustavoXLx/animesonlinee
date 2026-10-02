import { useMemo, useState } from "react";
import { FlameKindling, Car, Compass, Flame, Lock, RotateCcw, Shield, Sparkles, TentTree, TreePine, WandSparkles } from "lucide-react";
import { useGameChannel, type Me } from "./useGameChannel";

type Ready = { gu: boolean; li: boolean };

function Gate({ peerOnline, ready, me, onReady, started, onStart, title, subtitle, children }: {
  peerOnline: boolean; ready: Ready; me: Me; onReady: () => void; started: boolean; onStart: () => void;
  title: string; subtitle: string; children: React.ReactNode;
}) {
  if (!peerOnline) return <div className="h-full min-h-[420px] flex items-center justify-center p-6 text-center"><div className="max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-7"><Lock className="mx-auto mb-4 text-amber-300" size={30}/><h3 className="font-black text-lg">Aguardando o outro jogador</h3><p className="mt-2 text-sm text-white/50">Os dois precisam estar dentro deste jogo para continuar.</p></div></div>;
  if (!started) return <div className="h-full overflow-y-auto p-4"><div className="mx-auto max-w-xl pb-8"><div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-6"><div className="flex items-center gap-3"><Sparkles className="text-fuchsia-300" size={22}/><div><h2 className="text-xl font-black">{title}</h2><p className="text-xs text-white/50">{subtitle}</p></div></div><div className="mt-6 grid grid-cols-2 gap-3">{(["gu","li"] as Me[]).map(p=><div key={p} className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs uppercase tracking-widest text-white/40">{p==="gu"?"BB Gu":"BB Li"}</p><p className={"mt-2 text-sm font-bold "+(ready[p]?"text-emerald-300":"text-white/60")}>{ready[p]?"Pronto":"Ainda não"}</p></div>)}</div><button onClick={onReady} disabled={ready[me]} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-indigo-600 py-3 font-black disabled:opacity-50">{ready[me]?"Você está pronto":"Estou pronto"}</button><button onClick={onStart} disabled={!ready.gu||!ready.li} className="mt-2 w-full rounded-2xl bg-white/10 py-3 text-sm font-bold disabled:opacity-30">{ready.gu&&ready.li?"Começar partida":"Os dois precisam estar prontos"}</button></div></div></div>;
  return <div className="h-full overflow-y-auto">{children}</div>;
}

/* MALA TETRIS */
type Shape = {x:number;y:number};
type BagItem = {id:string;name:string;icon:string;shape:Shape[];owner:Me;placed:boolean;points:number};
const BAG_ITEMS:BagItem[]=[
{id:"shirt",name:"2 blusas",icon:"BL",shape:[{x:0,y:0},{x:1,y:0}],owner:"gu",placed:false,points:2},
{id:"shoe",name:"Tênis",icon:"TN",shape:[{x:0,y:0},{x:0,y:1},{x:0,y:2}],owner:"gu",placed:false,points:3},
{id:"camera",name:"Câmera",icon:"CM",shape:[{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}],owner:"gu",placed:false,points:4},
{id:"dryer",name:"Secador",icon:"SC",shape:[{x:0,y:0},{x:1,y:0},{x:2,y:0}],owner:"li",placed:false,points:3},
{id:"coat",name:"Casaco",icon:"CA",shape:[{x:0,y:0},{x:0,y:1},{x:1,y:1},{x:2,y:1}],owner:"li",placed:false,points:4},
{id:"gift",name:"Presente",icon:"PR",shape:[{x:0,y:0},{x:1,y:0},{x:1,y:1}],owner:"li",placed:false,points:3},
];
const BAG_EVENTS=["Vai chover no destino.","A temperatura caiu 10 graus.","Vocês decidiram levar mais uma lembrança."];
type BagState={phase:"lobby"|"playing"|"done";ready:Ready;grid:(string|null)[];items:BagItem[];turn:Me;turnCount:number;eventIndex:number;message:string};
const bagInitial:BagState={phase:"lobby",ready:{gu:false,li:false},grid:Array(48).fill(null),items:BAG_ITEMS,turn:"gu",turnCount:0,eventIndex:0,message:"Escolham um item e encaixem na mala."};

export function MalaTetris({me}:{me:Me}){
 const {state,setState,peerOnline}=useGameChannel<BagState>("mala-tetris",me,bagInitial);
 const [selected,setSelected]=useState<string|null>(null); const [rotation,setRotation]=useState(0);
 const ready=()=>setState(s=>({...s,ready:{...s.ready,[me]:true}}));
 const start=()=>{if(peerOnline&&state.ready.gu&&state.ready.li)setState({...state,phase:"playing",message:"BB Gu começa. Cada jogador coloca seus próprios itens."});};
 const shape=(src:Shape[])=>{let s=src.map(p=>({...p}));for(let i=0;i<rotation;i++)s=s.map(p=>({x:-p.y,y:p.x}));const mx=Math.min(...s.map(p=>p.x)),my=Math.min(...s.map(p=>p.y));return s.map(p=>({x:p.x-mx,y:p.y-my}));};
 const place=(index:number)=>{if(state.phase!=="playing"||state.turn!==me||!selected)return;const item=state.items.find(i=>i.id===selected);if(!item||item.placed)return;const sh=shape(item.shape),row=Math.floor(index/8),col=index%8;if(!sh.every(p=>{const r=row+p.y,c=col+p.x;return r>=0&&r<6&&c>=0&&c<8&&!state.grid[r*8+c]}))return;const grid=[...state.grid];sh.forEach(p=>{grid[(row+p.y)*8+col+p.x]=item.id});const items=state.items.map(i=>i.id===item.id?{...i,placed:true}:i);const count=state.turnCount+1;const done=items.every(i=>i.placed);setState({...state,grid,items,turn:me==="gu"?"li":"gu",turnCount:count,eventIndex:Math.min(2,Math.floor(count/2)),phase:done?"done":"playing",message:done?"Mala fechada. Vocês levaram o essencial.":BAG_EVENTS[Math.min(2,Math.floor(count/2))]});setSelected(null);setRotation(0);};
 const score=useMemo(()=>state.items.filter(i=>i.placed).reduce((a,i)=>a+i.points,0),[state.items]);
 return <Gate peerOnline={peerOnline} ready={state.ready} me={me} onReady={ready} started={state.phase!=="lobby"} onStart={start} title="Mala Tetris" subtitle="Encaixem tudo numa única mala."><div className="mx-auto max-w-3xl space-y-4 p-4 pb-8"><div className="flex justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div><p className="text-xs text-white/40">turno</p><p className="font-black">{state.phase==="done"?"Fim":state.turn===me?"Sua vez":"Vez do outro jogador"}</p></div><p className="font-black text-fuchsia-300">Pontos {score}</p></div>{state.phase!=="done"&&<div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4"><p className="text-xs uppercase tracking-widest text-amber-200">situação</p><p className="font-bold mt-1">{BAG_EVENTS[state.eventIndex]}</p></div>}<div className="grid gap-4 md:grid-cols-[1fr_280px]"><div className="rounded-3xl border border-white/10 bg-[#111318] p-4"><div className="grid grid-cols-8 gap-1 rounded-2xl bg-black/30 p-2">{state.grid.map((cell,i)=><button key={i} onClick={()=>place(i)} className={"aspect-square rounded-md border text-[9px] font-black "+(cell?"border-fuchsia-300/30 bg-fuchsia-500/50":"border-white/5 bg-white/[0.03]")}>{cell?state.items.find(x=>x.id===cell)?.icon:""}</button>)}</div>{state.phase==="done"&&<div className="mt-4 rounded-2xl bg-emerald-400/10 p-4 text-center"><p className="font-black text-emerald-300">Viagem pronta</p><p className="text-sm text-white/60 mt-1">Vocês esqueceram o carregador. Claro.</p></div>}</div><div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"><div className="flex justify-between"><p className="font-black">Seus objetos</p><button onClick={()=>setRotation(r=>(r+1)%4)} className="rounded-xl bg-white/10 p-2"><RotateCcw size={16}/></button></div><div className="mt-3 space-y-2">{state.items.filter(i=>i.owner===me&&!i.placed).map(i=><button key={i.id} onClick={()=>setSelected(i.id)} disabled={state.turn!==me} className={"w-full rounded-2xl border p-3 text-left "+(selected===i.id?"border-fuchsia-400 bg-fuchsia-500/10":"border-white/10 bg-black/20")+" "+(state.turn!==me?"opacity-40":"")}><p className="font-bold">{i.name}</p><p className="text-xs text-white/40">{i.shape.length} blocos</p></button>)}</div>{selected&&<p className="mt-3 text-xs text-fuchsia-200">Selecione uma célula da mala para encaixar.</p>}</div></div></div></Gate>;
}

/* ACAMPAMENTO */
type CampState={phase:"lobby"|"day"|"night"|"done";ready:Ready;day:number;night:number;wood:number;food:number;water:number;fire:number;shelter:number;explorerAction:boolean;baseAction:boolean;message:string;danger:boolean};
const campInitial:CampState={phase:"lobby",ready:{gu:false,li:false},day:1,night:0,wood:3,food:3,water:3,fire:4,shelter:1,explorerAction:false,baseAction:false,message:"Sobrevivam a três noites.",danger:false};

export function Acampamento({me}:{me:Me}){
 const {state,setState,peerOnline}=useGameChannel<CampState>("acampamento",me,campInitial);
 const ready=()=>setState(s=>({...s,ready:{...s.ready,[me]:true}}));
 const start=()=>{if(peerOnline&&state.ready.gu&&state.ready.li)setState({...state,phase:"day",message:"BB Gu explora. BB Li cuida da base."});};
 const act=()=>{if(state.phase!=="day")return;if(me==="gu"&&!state.explorerAction)setState({...state,wood:state.wood+2,food:state.food+1,water:state.water+1,explorerAction:true,message:"Você voltou da floresta com recursos."});if(me==="li"&&!state.baseAction)setState({...state,fire:Math.min(8,state.fire+2),shelter:Math.min(3,state.shelter+1),baseAction:true,message:"A base está mais protegida e a fogueira está forte."});};
 const next=()=>{if(!state.explorerAction||!state.baseAction)return;const food=Math.max(0,state.food-1),water=Math.max(0,state.water-1),fire=Math.max(0,state.fire-1),night=state.night+1,lost=food===0||water===0||fire===0;if(lost||night>=3)setState({...state,phase:"done",night,food,water,fire,danger:night===2,message:lost?"A expedição terminou antes do resgate.":"Vocês sobreviveram às três noites."});else setState({...state,phase:"night",night,food,water,fire,danger:night===2,message:night===2?"Você ouviu algo na floresta. Só a base consegue enxergar.":"A noite passou. Mantenham tudo funcionando."});};
 const wake=()=>setState({...state,day:state.day+1,phase:"day",explorerAction:false,baseAction:false,danger:false,message:"Novo dia. Façam suas tarefas."});
 return <Gate peerOnline={peerOnline} ready={state.ready} me={me} onReady={ready} started={state.phase!=="lobby"} onStart={start} title="Acampamento" subtitle="Um explora. O outro cuida da base e vê coisas que o explorador não vê."><div className="mx-auto max-w-2xl space-y-4 p-4 pb-8"><div className="grid grid-cols-2 md:grid-cols-5 gap-2">{[["Madeira",state.wood],["Comida",state.food],["Água",state.water],["Fogo",state.fire],["Abrigo",state.shelter]].map(x=><div key={String(x[0])} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-[10px] text-white/40">{x[0]}</p><p className="text-xl font-black">{x[1]}</p></div>)}</div><div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-950 to-slate-950 p-6"><div className="flex items-center gap-3"><TentTree className="text-emerald-300" size={28}/><div><p className="text-xs text-white/40">Dia {state.day} · Noites {state.night}/3</p><p className="text-xl font-black">{state.phase==="night"?"Noite":state.phase==="done"?"Fim":"Acampamento"}</p></div></div><p className="text-center text-lg font-bold mt-5">{state.message}</p>{state.danger&&<div className="mt-4 rounded-2xl bg-red-500/10 p-4 text-center"><TreePine className="mx-auto mb-2 text-red-300" size={22}/><p className="font-bold">Só quem está na base viu o movimento.</p></div>}</div>{state.phase==="day"&&<div className="grid md:grid-cols-2 gap-3"><button onClick={act} disabled={me!=="gu"||state.explorerAction} className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 text-left disabled:opacity-40"><Compass className="mb-3 text-sky-300" size={24}/><p className="font-black">Explorar</p><p className="text-xs text-white/50 mt-1">Encontrar madeira, comida e água.</p></button><button onClick={act} disabled={me!=="li"||state.baseAction} className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 text-left disabled:opacity-40"><FlameKindling className="mb-3 text-orange-300" size={24}/><p className="font-black">Cuidar da base</p><p className="text-xs text-white/50 mt-1">Reforçar fogo e abrigo.</p></button></div>}{state.phase==="day"&&state.explorerAction&&state.baseAction&&<button onClick={next} className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 font-black">Passar a noite</button>}{state.phase==="night"&&<button onClick={wake} className="w-full rounded-2xl bg-white/10 py-3 font-black">Amanhecer</button>}{state.phase==="done"&&<div className="rounded-3xl bg-emerald-400/10 p-6 text-center"><Flame className="mx-auto mb-2 text-orange-300" size={28}/><p className="font-black">{state.food>0&&state.water>0&&state.fire>0?"Resgate concluído":"A floresta venceu desta vez"}</p></div>}</div></Gate>;
}

/* ALIENÍGENA NO BANCO DE TRÁS */
type Passenger = {
  name:string;
  age:number;
  profession:string;
  destination:string;
  personality:string;
  story:string;
  favoriteFood:string;
  cityMemory:string;
  travelItem:string;
  secret:string;
};

type AlienRound = {
  passenger:number;
  question:string;
  answer:string;
};

type AlienStateLocal = {
  phase:"home"|"playing"|"vote-driver"|"vote-investigator"|"done";
  passengers:Passenger[];
  alien:number;
  rounds:AlienRound[];
  clues:string[];
  driverVote:number|null;
  investigatorVote:number|null;
};

const PASSENGER_NAMES=["Ana","Bruno","Clara","Diego"];
const AGES=[24,29,34,41,27,38,46,31];
const PROFESSIONS=["fotógrafa","chef de cozinha","arquiteto","professora","veterinária","designer","músico","engenheira"];
const DESTINATIONS=["Campinas","Santos","São Paulo","Holambra","Jundiaí","Ribeirão Preto","Ubatuba","Sorocaba"];
const PERSONALITIES=["curioso e observador","calmo e reservado","falante e brincalhão","prático e direto","entusiasmado e sociável","cuidadoso e organizado"];
const STORIES=[
  "estava terminando um projeto e resolveu aproveitar o fim de semana para visitar amigos.",
  "tinha recebido um convite inesperado e decidiu fazer a viagem de última hora.",
  "estava de férias e queria conhecer um lugar diferente antes de voltar para casa.",
  "precisava resolver uma questão pessoal e aproveitou para passar alguns dias fora."
];
const FOODS=["pizza","lasanha","hambúrguer","sushi","pão de queijo","bolo de chocolate"];
const MEMORIES=[
  "uma praça movimentada no centro",
  "um mercado cheio de barracas",
  "um parque perto do rio",
  "uma rua com muitos cafés",
  "um museu pequeno e silencioso",
  "uma feira de domingo"
];
const ITEMS=["uma câmera","um caderno","um fone de ouvido","uma mochila pequena","um livro","uma garrafa de água"];

const QUESTIONS=[
  "De onde você veio?",
  "Para onde você está indo?",
  "Qual é a sua profissão?",
  "Por que você está viajando?",
  "Qual é a sua comida favorita?",
  "Você já esteve nesta cidade?",
  "O que você estava fazendo antes de entrar no carro?"
];

const HUMAN_RESPONSES=[
  (p:Passenger)=>`Vim de uma cidade aqui perto. Estou indo para ${p.destination}.`,
  (p:Passenger)=>`Estou indo para ${p.destination}. Quero ficar por lá alguns dias.`,
  (p:Passenger)=>`Trabalho como ${p.profession}. É uma rotina bem movimentada.`,
  (p:Passenger)=>`Eu estava ${p.story}`,
  (p:Passenger)=>`Minha comida favorita é ${p.favoriteFood}. É difícil eu recusar.`,
  (p:Passenger)=>`Sim. A lembrança que mais ficou foi ${p.cityMemory}.`,
  (p:Passenger)=>`Antes de entrar no carro, eu estava com ${p.travelItem} e procurando o endereço.`
];

const ALIEN_RESPONSES=[
  (p:Passenger)=>`Vim de longe. Estou indo para ${p.destination}.`,
  (p:Passenger)=>`Meu destino é ${p.destination}. Ainda estou conhecendo a região.`,
  (p:Passenger)=>`Tenho um trabalho ligado a pessoas e projetos.`,
  (p:Passenger)=>`Eu estava ${p.story.replace("estava ","")}`,
  (p:Passenger)=>`Eu escolheria algo simples. Talvez ${p.favoriteFood}.`,
  (p:Passenger)=>`Não conheço muito esta cidade. Acho que já passei por aqui uma vez.`,
  (p:Passenger)=>`Eu estava esperando encontrar o carro e segurando ${p.travelItem}.`
];

function shuffle<T>(items:T[], seed:number):T[]{
  const out=[...items];
  for(let i=out.length-1;i>0;i--){
    seed=(seed*1664525+1013904223)>>>0;
    const j=seed%(i+1);
    [out[i],out[j]]=[out[j],out[i]];
  }
  return out;
}

function buildPassengers(){
  const names=shuffle(PASSENGER_NAMES,Date.now()%100000);
  const ages=shuffle(AGES,Date.now()%99991);
  const professions=shuffle(PROFESSIONS,Date.now()%99989);
  const destinations=shuffle(DESTINATIONS,Date.now()%99971);
  const personalities=shuffle(PERSONALITIES,Date.now()%99961);
  const stories=shuffle(STORIES,Date.now()%99959);
  const foods=shuffle(FOODS,Date.now()%99929);
  const memories=shuffle(MEMORIES,Date.now()%99923);
  const items=shuffle(ITEMS,Date.now()%99901);
  return names.map((name,i)=>({
    name,
    age:ages[i],
    profession:professions[i],
    destination:destinations[i],
    personality:personalities[i],
    story:stories[i],
    favoriteFood:foods[i],
    cityMemory:memories[i],
    travelItem:items[i],
    secret:""
  }));
}

function makeAlienGame():AlienStateLocal{
  const passengers=buildPassengers();
  const secretPool=[
    "coleciona cartões-postais das cidades que visita.",
    "sempre leva um caderno pequeno para anotar lugares.",
    "prefere viajar bem cedo para evitar movimento.",
    "tem o hábito de guardar uma lembrança de cada viagem."
  ];
  passengers.forEach((p,i)=>{p.secret=secretPool[i%secretPool.length];});
  const alien=Math.floor(Math.random()*passengers.length);
  const anomaly=Math.floor(Math.random()*3);
  let alienSecret="";
  let clue="";
  if(anomaly===0){
    alienSecret="O alienígena não reconhece pão de queijo como comida.";
    clue="O passageiro alienígena não reconhece pão de queijo como comida, embora os outros passageiros humanos conheçam esse alimento.";
  }else if(anomaly===1){
    alienSecret="O alienígena não entende por que as pessoas colocam o cinto de segurança no carro.";
    clue="O passageiro alienígena não sabe explicar o que fazia antes de entrar no carro porque ainda não entende bem para que serve o cinto de segurança.";
  }else{
    alienSecret="O alienígena não consegue lembrar uma experiência real nesta cidade.";
    clue="O passageiro alienígena diz que já esteve nesta cidade, mas não consegue relacionar a visita a uma lembrança concreta.";
  }
  passengers[alien]={...passengers[alien],secret:alienSecret};
  return {
    phase:"home",
    passengers,
    alien,
    rounds:[],
    clues:[clue],
    driverVote:null,
    investigatorVote:null
  };
}

function answerFor(game:AlienStateLocal,passenger:number,question:number){
  const p=game.passengers[passenger];
  if(passenger!==game.alien)return HUMAN_RESPONSES[question](p);
  if(game.clues[0].startsWith("O passageiro alienígena não reconhece pão de queijo")&&question===4){
    return "Não conheço muito bem essas comidas. Talvez eu escolheria algo simples.";
  }
  if(game.clues[0].startsWith("O passageiro alienígena não sabe explicar")&&question===6){
    return "Eu estava esperando o carro e tentando entender como funciona esse cinto.";
  }
  if(game.clues[0].startsWith("O passageiro alienígena diz que já esteve")&&question===5){
    return "Acho que já passei por aqui, mas não consigo lembrar de nada específico.";
  }
  return ALIEN_RESPONSES[question](p);
}

export function AlienBancoTras({me:_me}:{me:Me}){
  const [game,setGame]=useState<AlienStateLocal>(()=>makeAlienGame());
  const [selected,setSelected]=useState<number|null>(null);
  const [question,setQuestion]=useState(0);
  const [lastAnswer,setLastAnswer]=useState("");
  const [clueIndex,setClueIndex]=useState(0);

  const start=()=>{
    const fresh=makeAlienGame();
    fresh.phase="playing";
    setGame(fresh);
    setSelected(null);
    setQuestion(0);
    setLastAnswer("");
    setClueIndex(0);
  };

  const ask=()=>{
    if(selected===null)return;
    const answer=answerFor(game,selected,question);
    setGame(g=>({...g,rounds:[...g.rounds,{passenger:selected,question:QUESTIONS[question],answer}]}));
    setLastAnswer(answer);
  };

  const nextQuestion=()=>{
    setSelected(null);
    setLastAnswer("");
    setQuestion(q=>(q+1)%QUESTIONS.length);
  };

  const voteDriver=(value:number)=>{
    setGame(g=>({...g,driverVote:value,phase:"vote-investigator"}));
  };

  const voteInvestigator=(value:number)=>{
    setGame(g=>({...g,investigatorVote:value,phase:"done"}));
  };

  if(game.phase==="home") return <div className="h-full overflow-y-auto p-4"><div className="mx-auto flex min-h-[520px] max-w-2xl items-center justify-center"><div className="w-full overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-gradient-to-br from-[#0b1720] via-[#101522] to-[#171024] p-7 shadow-2xl"><div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10"><Car className="text-cyan-200" size={34}/></div><p className="text-center text-xs font-black uppercase tracking-[0.25em] text-cyan-200/70">jogo para 2 jogadores</p><h1 className="mt-2 text-center text-3xl font-black tracking-tight">ALIENÍGENA NO BANCO DE TRÁS</h1><p className="mx-auto mt-4 max-w-lg text-center text-sm leading-6 text-white/60">Um dos passageiros não é humano. Descubram quem é antes que seja tarde demais.</p><div className="mt-7 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs font-black uppercase tracking-widest text-cyan-200/70">Jogador 1</p><p className="mt-1 font-black">MOTORISTA</p><p className="mt-1 text-xs text-white/45">Faz perguntas aos passageiros.</p></div><div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs font-black uppercase tracking-widest text-violet-200/70">Jogador 2</p><p className="mt-1 font-black">INVESTIGADOR</p><p className="mt-1 text-xs text-white/45">Recebe pistas diferentes e compara as respostas.</p></div></div><button onClick={start} className="mt-7 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 py-4 text-sm font-black shadow-lg shadow-cyan-950/30">COMEÇAR</button></div></div></div>;

  if(game.phase==="playing"){
    const recent=game.rounds[game.rounds.length-1];
    return <div className="h-full overflow-y-auto p-4"><div className="mx-auto max-w-4xl space-y-4 pb-8"><div className="rounded-3xl border border-white/10 bg-[#0e121a] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/60">Jogador 1 — MOTORISTA</p><p className="mt-1 text-sm text-white/50">Escolha um passageiro e faça uma pergunta.</p></div><div className="rounded-full border border-violet-300/15 bg-violet-400/10 px-3 py-1 text-xs font-bold text-violet-200">Jogador 2 — INVESTIGADOR: compartilha as pistas pessoalmente</div></div></div><div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]"><section className="rounded-3xl border border-white/10 bg-white/[0.035] p-4"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-white/40">Os 4 passageiros</p><p className="font-black">Quem está escondendo alguma coisa?</p></div><div className="rounded-xl bg-cyan-400/10 px-3 py-2 text-xs font-black text-cyan-200">4 passageiros</div></div><div className="grid grid-cols-2 gap-3">{game.passengers.map((p,i)=><button key={p.name} onClick={()=>{setSelected(i);setLastAnswer("");}} className={"rounded-2xl border p-4 text-left transition "+(selected===i?"border-cyan-300 bg-cyan-400/10":"border-white/10 bg-black/20 hover:bg-white/[0.05]")}><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/20 to-violet-400/20 text-sm font-black">{p.name.slice(0,1)}</div><span className="text-[10px] text-white/35">{p.age} anos</span></div><p className="mt-3 font-black">{p.name}</p><p className="mt-1 text-xs text-white/45">{p.profession}</p><p className="mt-2 text-[11px] leading-4 text-white/35">{p.personality}</p></button>)}</div><div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs font-black uppercase tracking-widest text-cyan-200/60">Perguntas</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{QUESTIONS.map((q,i)=><button key={q} onClick={()=>setQuestion(i)} className={"rounded-xl border p-3 text-left text-xs font-bold "+(question===i?"border-cyan-300/50 bg-cyan-400/10":"border-white/10 bg-white/[0.03]")}>{q}</button>)}</div><button onClick={ask} disabled={selected===null} className="mt-3 w-full rounded-xl bg-cyan-500 py-3 text-sm font-black text-slate-950 disabled:opacity-30">Fazer pergunta</button></div>{lastAnswer&&<div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-cyan-200/60">Resposta de {recent?game.passengers[recent.passenger].name:"passageiro"}</p><p className="mt-2 text-sm font-semibold leading-6">{lastAnswer}</p><button onClick={nextQuestion} className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-xs font-black">Escolher outra pergunta</button></div>}</section><aside className="space-y-4"><div className="rounded-3xl border border-violet-300/15 bg-violet-500/[0.07] p-5"><p className="text-xs font-black uppercase tracking-widest text-violet-200/70">PISTAS DO INVESTIGADOR</p><p className="mt-1 text-xs text-white/45">O Jogador 2 pode ler estas pistas e contar ao motorista.</p><div className="mt-4 space-y-2">{game.clues.map((clue,i)=><div key={clue} className={"rounded-2xl border p-4 "+(i===clueIndex?"border-violet-300/30 bg-violet-400/10":"border-white/10 bg-black/20")}><p className="text-sm leading-5">{clue}</p></div>)}</div><button onClick={()=>setClueIndex(i=>(i+1)%game.clues.length)} className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-xs font-black">Trocar pista</button></div><div className="rounded-3xl border border-white/10 bg-black/20 p-5"><p className="text-xs font-black uppercase tracking-widest text-white/35">Comunicação</p><p className="mt-2 text-sm leading-6 text-white/60">O motorista conta as respostas. O investigador conta as pistas. A dedução acontece entre vocês, no mesmo dispositivo.</p></div><div className="rounded-3xl border border-amber-300/15 bg-amber-400/[0.06] p-5"><p className="text-xs font-black uppercase tracking-widest text-amber-200/60">Informação reservada</p><p className="mt-2 text-sm text-white/55">O alienígena está definido desde o início e não muda durante a partida.</p></div></aside></div><button onClick={()=>setGame(g=>({...g,phase:"vote-driver"}))} disabled={game.rounds.length<4} className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 py-3 text-sm font-black text-slate-950 disabled:opacity-30">Encerrar investigação e votar</button></div></div>;
  }

  if(game.phase==="vote-driver") return <div className="h-full overflow-y-auto p-4"><div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-6"><p className="text-xs font-black uppercase tracking-widest text-cyan-200/60">Jogador 1 — MOTORISTA</p><h2 className="mt-2 text-2xl font-black">Seu voto</h2><p className="mt-2 text-sm text-white/50">Escolha em segredo quem você acredita ser o alienígena.</p><div className="mt-5 grid grid-cols-2 gap-3">{game.passengers.map((p,i)=><button key={p.name} onClick={()=>voteDriver(i)} className="rounded-2xl border border-white/10 bg-black/20 p-5 text-left hover:border-amber-300/50"><p className="font-black">{p.name}</p><p className="mt-1 text-xs text-white/40">{p.profession} · {p.age} anos</p></button>)}</div></div></div>;

  if(game.phase==="vote-investigator") return <div className="h-full overflow-y-auto p-4"><div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-6"><p className="text-xs font-black uppercase tracking-widest text-violet-200/60">Jogador 2 — INVESTIGADOR</p><h2 className="mt-2 text-2xl font-black">Seu voto</h2><p className="mt-2 text-sm text-white/50">Agora o investigador vota sem alterar o voto do motorista.</p><div className="mt-5 grid grid-cols-2 gap-3">{game.passengers.map((p,i)=><button key={p.name} onClick={()=>voteInvestigator(i)} className="rounded-2xl border border-white/10 bg-black/20 p-5 text-left hover:border-amber-300/50"><p className="font-black">{p.name}</p><p className="mt-1 text-xs text-white/40">{p.destination} · {p.personality}</p></button>)}</div></div></div>;

  const driverCorrect=game.driverVote===game.alien;
  const investigatorCorrect=game.investigatorVote===game.alien;
  return <div className="h-full overflow-y-auto p-4"><div className="mx-auto max-w-xl rounded-3xl border border-emerald-300/15 bg-gradient-to-br from-emerald-500/[0.08] to-violet-500/[0.05] p-7 text-center"><Shield className="mx-auto mb-3 text-emerald-300" size={34}/><p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Resultado</p><h2 className="mt-2 text-3xl font-black">{game.passengers[game.alien].name} era o alienígena</h2><p className="mt-3 text-sm text-white/60">{game.passengers[game.alien].secret}</p><div className="mt-6 grid grid-cols-2 gap-3 text-left"><div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-white/40">Motorista</p><p className="mt-1 font-black">{driverCorrect?"Acertou":"Errou"}</p></div><div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-white/40">Investigador</p><p className="mt-1 font-black">{investigatorCorrect?"Acertou":"Errou"}</p></div></div><button onClick={start} className="mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3 font-black">Jogar novamente</button></div></div>;
}

/* FEITIÇO ERRADO */
type SpellState={phase:"lobby"|"playing"|"done";ready:Ready;round:number;score:number;target:string[];message:string};
const SPELLS=[["SOL","VENTO"],["GELO","VENTO"],["PEDRA","VENTO"],["SOL","PEDRA"],["LUZ","FLORESTA"],["GELO","PEDRA"]];
const spellNames=["SOL","GELO","VENTO","PEDRA","FLORESTA","LUZ"];
const spellInitial:SpellState={phase:"lobby",ready:{gu:false,li:false},round:1,score:0,target:SPELLS[0],message:""};

export function FeiticoErrado({me}:{me:Me}){
 const {state,setState,peerOnline}=useGameChannel<SpellState>("feitico-errado",me,spellInitial);const [picked,setPicked]=useState<string[]>([]);
 const ready=()=>setState(s=>({...s,ready:{...s.ready,[me]:true}}));const start=()=>{if(peerOnline&&state.ready.gu&&state.ready.li)setState({...state,phase:"playing",round:1,score:0,target:SPELLS[0],message:"Conversem: cada jogador enxerga uma parte do livro."});};
 const cast=()=>{if(picked.length!==2)return;const key=picked.slice().sort().join("+"),target=state.target.slice().sort().join("+"),hit=key===target;const next=state.round+1;setState({...state,score:state.score+(hit?2:0),round:next,phase:next>5?"done":"playing",target:SPELLS[(next-1)%SPELLS.length],message:hit?"O feitiço funcionou. Vocês resolveram a situação.":"O feitiço saiu errado. Tentem outra combinação."});setPicked([]);};
 return <Gate peerOnline={peerOnline} ready={state.ready} me={me} onReady={ready} started={state.phase!=="lobby"} onStart={start} title="Feitiço errado" subtitle="Dois aprendizes precisam descobrir combinações sem conhecer o livro inteiro."><div className="mx-auto max-w-2xl space-y-4 p-4 pb-8">{state.phase==="playing"&&<><div className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-950 to-slate-950 p-6"><div className="flex items-center gap-3"><WandSparkles className="text-violet-300" size={28}/><div><p className="text-xs text-white/40">Problema {state.round}/5</p><p className="font-black">Descubram o feitiço que resolve a situação.</p></div></div><div className="mt-5 rounded-2xl bg-black/20 p-4"><p className="text-xs text-white/40">Pistas do seu fragmento</p><p className="mt-1 text-sm text-white/70">{me==="gu"?"SOL aquece. VENTO movimenta. PEDRA protege.":"GELO resfria. FLORESTA cria vida. LUZ revela caminhos."}</p></div></div><div className="grid grid-cols-2 gap-3">{spellNames.map(s=><button key={s} onClick={()=>setPicked(p=>p.includes(s)?p.filter(x=>x!==s):p.length<2?[...p,s]:p)} className={"rounded-2xl border p-4 font-black "+(picked.includes(s)?"border-violet-300 bg-violet-400/15":"border-white/10 bg-white/[0.04]")}>{s}</button>)}</div><p className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">Combinação: <b className="text-white">{picked.length?picked.join(" + "):"nenhuma"}</b></p><button onClick={cast} disabled={picked.length!==2} className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-600 py-3 font-black disabled:opacity-30">Lançar feitiço</button><div className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">{state.message}</div></>}{state.phase==="done"&&<div className="rounded-3xl border border-violet-300/20 bg-violet-500/10 p-6 text-center"><p className="text-3xl font-black">{state.score} pontos</p><p className="mt-2 text-white/60">{state.message}</p></div>}</div></Gate>;
}
