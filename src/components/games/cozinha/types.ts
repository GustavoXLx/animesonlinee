export type Me = "gu" | "li";
export type Ingredient =
  | "pao" | "carne" | "carne_cozida" | "queijo" | "tomate" | "tomate_cortado"
  | "massa" | "molho" | "fruta" | "massa_cupcake" | "cobertura";
export type Dish = "hamburguer" | "sanduiche" | "pizza" | "cupcake" | "suco";
export type HeldItem = Ingredient | Dish | "pizza_crua" | "cupcake_assado" | "queimado" | null;
export type StationType =
  | "parede" | "balcao" | "geladeira" | "tabua" | "fogao" | "forno"
  | "liquidificador" | "montagem" | "entrega" | "lixeira";
export interface StationDef { id:string; type:StationType; x:number; y:number; ingredient?:Ingredient; }
export interface ProcessState { itemIn: Exclude<HeldItem,null>|null; startedAt:number|null; ready:boolean; burnt:boolean; }
export interface StationState {
  id:string; held:HeldItem; process?:ProcessState; bench?:Exclude<HeldItem,null>[];
  prep?:{ item:Exclude<HeldItem,null>; hits:number; needed:number };
}
export interface Order { id:number; dish:Dish; bornAt:number; patienceMs:number; }
export interface PlayerMeta { outfit:string; hair:string; ready:boolean; }
export interface WorldSnapshot {
  version:number; ts:number; stations:Record<string,StationState>; orders:Order[];
  timeLeft:number; score:number; streak:number; heldBy:Record<Me,HeldItem>;
}
export type Stage="espera"|"jogando"|"pausa"|"fim";
export interface SharedState {
  stage:Stage; seed:number; startAt:number|null; duration:number; pausedBy:Me|null;
  players:Record<Me,PlayerMeta>; world:WorldSnapshot;
}
export interface PosMsg { x:number;y:number;facing:"up"|"down"|"left"|"right";holding:HeldItem;t:number; }
export interface ActMsg { seq:number; stationId:string; held:HeldItem; }
export interface ChatMsg { text:string;t:number; }
