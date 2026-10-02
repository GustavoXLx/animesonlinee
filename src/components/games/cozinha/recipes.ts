import type {Dish,HeldItem,StationState,WorldSnapshot,Order} from "./types";
import {STATIONS} from "./layout";

export const RECIPE_NEEDS:Record<Dish,Exclude<HeldItem,null>[]> = {
 hamburguer:["pao","carne_cozida"],
 sanduiche:["pao","queijo","tomate_cortado"],
 pizza:["massa","molho","queijo"],
 cupcake:["cupcake_assado","cobertura"],
 suco:["fruta"],
};
export const DISH_LABEL:Record<Dish,string>={
 hamburguer:"HAMBÚRGUER",sanduiche:"SANDUÍCHE",pizza:"PIZZA",cupcake:"CUPCAKE",suco:"SUCO"
};
export const ITEM_LABEL:Record<string,string>={
 pao:"Pão",carne:"Carne",carne_cozida:"Carne cozida",queijo:"Queijo",tomate:"Tomate",
 tomate_cortado:"Tomate cortado",massa:"Massa",molho:"Molho",fruta:"Fruta",
 massa_cupcake:"Massa de cupcake",cobertura:"Cobertura",pizza_crua:"Pizza crua",
 cupcake_assado:"Cupcake assado",hamburguer:"Hambúrguer",pizza:"Pizza",sanduiche:"Sanduíche",
 cupcake:"Cupcake",suco:"Suco",queimado:"Queimado"
};
export const COOK_DURATIONS:Record<string,{ready:number;burn:number}>={
 carne:{ready:4200,burn:8500},
 pizza_crua:{ready:5500,burn:10000},
 massa_cupcake:{ready:5000,burn:9500},
 fruta:{ready:2200,burn:999999}
};
export const PROCESS_RESULT:Record<string,Exclude<HeldItem,null>>={
 carne:"carne_cozida",pizza_crua:"pizza",massa_cupcake:"cupcake_assado",fruta:"suco"
};

export function emptyStationState(id:string):StationState{return{id,held:null,bench:[]};}
export function initialWorld(seed:number):WorldSnapshot{
 const stations:Record<string,StationState>={};
 for(const s of STATIONS){
  const st=emptyStationState(s.id);
  if(["fogao","forno","liquidificador"].includes(s.type)){
   st.process={itemIn:null,startedAt:null,ready:false,burnt:false};
  }
  stations[s.id]=st;
 }
 return{version:1,ts:Date.now(),stations,orders:[],timeLeft:180000,score:0,streak:0,heldBy:{gu:null,li:null}};
}
function matches(items:Exclude<HeldItem,null>[]):Dish|null{
 const a=[...items].sort().join("|");
 for(const d of Object.keys(RECIPE_NEEDS) as Dish[]){
  if(d==="suco")continue;
  if([...RECIPE_NEEDS[d]].sort().join("|")===a)return d;
 }
 return null;
}
export interface ActionResult{world:WorldSnapshot;held:HeldItem;}

export function applyAction(world:WorldSnapshot,stationId:string,held:HeldItem,now:number):ActionResult|null{
 const def=STATIONS.find(s=>s.id===stationId),st=world.stations[stationId];
 if(!def||!st)return null;
 const stations={...world.stations};
 const put=(next:StationState)=>{stations[stationId]=next;return{...world,stations,version:world.version+1,ts:now};};

 switch(def.type){
  case"geladeira":
   return held||!def.ingredient?null:{world,held:def.ingredient};

  case"balcao":
   if(held&&!st.held)return{world:put({...st,held}),held:null};
   if(!held&&st.held)return{world:put({...st,held:null}),held:st.held};
   return null;

  case"tabua":
   if(held==="tomate"&&!st.held&&!st.prep)
    return{world:put({...st,held:"tomate",prep:{item:"tomate",hits:0,needed:3,startedAt:now}}),held:null};
   if(!held&&st.held==="tomate"&&st.prep){
    const hits=st.prep.hits+1;
    if(hits>=st.prep.needed)
     return{world:put({...st,held:"tomate_cortado",prep:undefined}),held:null};
    return{world:put({...st,prep:{...st.prep,hits}}),held:null};
   }
   if(!held&&st.held)return{world:put({...st,held:null,prep:undefined}),held:st.held};
   return null;

  case"lixeira":
   return held?{world,held:null}:null;

  case"fogao":
  case"forno":{
   const p=st.process!;
   const accepted=def.type==="fogao"?["carne"]:["pizza_crua","massa_cupcake"];
   if(held&&accepted.includes(held)&&!p.itemIn)
    return{world:put({...st,process:{itemIn:held,startedAt:now,ready:false,burnt:false}}),held:null};
   if(!held&&p.itemIn&&(p.ready||p.burnt)){
    const result=p.burnt?"queimado":PROCESS_RESULT[p.itemIn];
    return{world:put({...st,process:{itemIn:null,startedAt:null,ready:false,burnt:false}}),held:result};
   }
   return null;
  }

  case"liquidificador":{
   const p=st.process!;
   if(held==="fruta"&&!p.itemIn)
    return{world:put({...st,process:{itemIn:"fruta",startedAt:now,ready:false,burnt:false}}),held:null};
   if(!held&&p.itemIn&&p.ready)
    return{world:put({...st,process:{itemIn:null,startedAt:null,ready:false,burnt:false}}),held:"suco"};
   return null;
  }

  case"montagem":{
   const bench=[...(st.bench??[])];
   if(held&&bench.length<4){
    const next=[...bench,held];
    const dish=matches(next);
    if(dish==="pizza")return{world:put({...st,bench:[]}),held:"pizza_crua"};
    return{world:put({...st,bench:next}),held:null};
   }
   if(!held){
    const dish=matches(bench);
    if(dish)return{world:put({...st,bench:[]}),held:dish};
    if(bench.length){
     const last=bench[bench.length-1];
     return{world:put({...st,bench:bench.slice(0,-1)}),held:last};
    }
   }
   return null;
  }

  case"entrega":{
   if(!held||!["hamburguer","sanduiche","pizza","cupcake","suco"].includes(held))return null;
   const i=world.orders.findIndex(o=>o.dish===held);
   if(i<0)return null;
   const o=world.orders[i];
   const ratio=Math.max(0,1-(now-o.bornAt)/o.patienceMs);
   const combo=Math.min(5,world.streak);
   const points=10+Math.round(ratio*15)+combo*2;
   return{
    world:{...world,orders:world.orders.filter((_,n)=>n!==i),score:world.score+points,streak:world.streak+1,version:world.version+1,ts:now},
    held:null
   };
  }

  default:return null;
 }
}

export function tickProcesses(world:WorldSnapshot,now:number){
 let changed=false;
 const stations={...world.stations};
 for(const id of Object.keys(stations)){
  const st=stations[id],p=st.process;
  if(!p?.itemIn||!p.startedAt)continue;
  const d=COOK_DURATIONS[p.itemIn];
  if(!d)continue;
  const ready=now-p.startedAt>=d.ready;
  const burnt=now-p.startedAt>=d.burn;
  if(ready!==p.ready||burnt!==p.burnt){
   stations[id]={...st,process:{...p,ready,burnt}};
   changed=true;
  }
 }
 return changed?{...world,stations,ts:now}:world;
}

const POOL: Dish[]=["hamburguer","sanduiche","pizza","cupcake","suco"];
export function maybeSpawnOrder(world:WorldSnapshot,now:number,seed:number,elapsed:number){
 if(world.orders.length>=4)return world;
 const difficulty=Math.min(1,elapsed/150000);
 const interval=9000-difficulty*3200;
 const last=world.orders[world.orders.length-1];
 if(last&&now-last.bornAt<interval)return world;
 const r=Math.abs(Math.sin(seed*12.9898+world.version*78.233));
 const dish=POOL[Math.floor(r*POOL.length)%POOL.length];
 const patience=52000-difficulty*15000;
 const order:Order={id:now+world.version,dish,bornAt:now,patienceMs:patience};
 return{...world,orders:[...world.orders,order],version:world.version+1,ts:now};
}
export function expireOrders(world:WorldSnapshot,now:number){
 const orders=world.orders.filter(o=>now-o.bornAt<o.patienceMs);
 if(orders.length===world.orders.length)return world;
 return{...world,orders,streak:0,version:world.version+1,ts:now};
}