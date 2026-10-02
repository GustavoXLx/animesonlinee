import type { StationDef } from "./types";

export const COLS=18;
export const ROWS=12;
export const TILE=52;

const walls:StationDef[]=[
 ...Array.from({length:COLS},(_,x)=>({id:`w-t-${x}`,type:"parede" as const,x,y:0})),
 ...Array.from({length:COLS},(_,x)=>({id:`w-b-${x}`,type:"parede" as const,x,y:ROWS-1})),
 ...Array.from({length:ROWS-2},(_,i)=>({id:`w-l-${i+1}`,type:"parede" as const,x:0,y:i+1})),
 ...Array.from({length:ROWS-2},(_,i)=>({id:`w-r-${i+1}`,type:"parede" as const,x:COLS-1,y:i+1})),
];

export const STATIONS:StationDef[]=[
 ...walls,
 {id:"ing-pao",type:"geladeira",x:2,y:2,ingredient:"pao",label:"PÃO"},
 {id:"ing-carne",type:"geladeira",x:3,y:2,ingredient:"carne",label:"CARNE"},
 {id:"ing-queijo",type:"geladeira",x:4,y:2,ingredient:"queijo",label:"QUEIJO"},
 {id:"ing-tomate",type:"geladeira",x:5,y:2,ingredient:"tomate",label:"TOMATE"},
 {id:"ing-fruta",type:"geladeira",x:12,y:2,ingredient:"fruta",label:"FRUTA"},
 {id:"ing-massa",type:"geladeira",x:13,y:2,ingredient:"massa",label:"MASSA"},
 {id:"ing-molho",type:"geladeira",x:14,y:2,ingredient:"molho",label:"MOLHO"},
 {id:"ing-cup",type:"geladeira",x:15,y:2,ingredient:"massa_cupcake",label:"MASSA"},
 {id:"ing-cob",type:"geladeira",x:16,y:2,ingredient:"cobertura",label:"COBERTURA"},
 {id:"cut-1",type:"tabua",x:2,y:4,label:"PREP"},
 {id:"cut-2",type:"tabua",x:3,y:4,label:"PREP"},
 {id:"cut-3",type:"tabua",x:4,y:4,label:"PREP"},
 {id:"cut-4",type:"tabua",x:5,y:4,label:"PREP"},
 {id:"counter-1",type:"balcao",x:7,y:4,label:"BANCADA"},
 {id:"assembly-1",type:"montagem",x:8,y:4,label:"MONTAR"},
 {id:"assembly-2",type:"montagem",x:9,y:4,label:"MONTAR"},
 {id:"counter-2",type:"balcao",x:10,y:4,label:"BANCADA"},
 {id:"counter-3",type:"balcao",x:7,y:5,label:"BANCADA"},
 {id:"counter-4",type:"balcao",x:10,y:5,label:"BANCADA"},
 {id:"stove-1",type:"fogao",x:12,y:4,label:"FOGÃO"},
 {id:"stove-2",type:"fogao",x:13,y:4, label:"FOGÃO"},
 {id:"oven-1",type:"forno",x:14,y:4,label:"FORNO"},
 {id:"oven-2",type:"forno",x:15,y:4,label:"FORNO"},
 {id:"blend",type:"liquidificador",x:13,y:6,label:"BATER"},
 {id:"trash",type:"lixeira",x:15,y:6,label:"LIXO"},
 {id:"counter-5",type:"balcao",x:3,y:9,label:"BANCADA"},
 {id:"counter-6",type:"balcao",x:4,y:9,label:"BANCADA"},
 {id:"counter-7",type:"balcao",x:11,y:9,label:"BANCADA"},
 {id:"counter-8",type:"balcao",x:12,y:9,label:"BANCADA"},
 {id:"delivery",type:"entrega",x:15,y:9,label:"ENTREGA"},
];

export function buildSolidGrid(){
 const g:boolean[][]=Array.from({length:ROWS},()=>Array(COLS).fill(false));
 for(const s of STATIONS)g[s.y][s.x]=true;
 return g;
}
export function stationAt(x:number,y:number){return STATIONS.find(s=>s.x===x&&s.y===y);}