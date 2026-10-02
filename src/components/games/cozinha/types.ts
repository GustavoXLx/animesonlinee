export type Me = "gu" | "li";

export type Ingredient =
  | "pao"
  | "carne"
  | "carne_cozida"
  | "queijo"
  | "tomate"
  | "tomate_cortado"
  | "massa"
  | "molho"
  | "fruta"
  | "massa_cupcake"
  | "cobertura";

export type Dish = "hamburguer" | "pizza" | "sanduiche" | "cupcake" | "suco";

export type HeldItem =
  | Ingredient
  | Dish
  | "pizza_crua"
  | "cupcake_assado"
  | null;

export type StationType =
  | "parede"
  | "balcao"
  | "geladeira"
  | "tabua"
  | "fogao"
  | "forno"
  | "liquidificador"
  | "montagem"
  | "entrega"
  | "lixeira";

export interface StationDef {
  id: string;
  type: StationType;
  x: number;
  y: number;
  ingredient?: Ingredient;
}

export interface ProcessState {
  itemIn: Exclude<HeldItem, null> | null;
  startedAt: number | null;
  ready: boolean;
  burnt: boolean;
}

export interface StationState {
  id: string;
  held: HeldItem; // for balcao/tabua(single)/montagem base holder/entrega staging
  process?: ProcessState; // fogao/forno/liquidificador
  bench?: Exclude<HeldItem, null>[]; // montagem ingredients stacked
}

export interface Order {
  id: number;
  dish: Dish;
  bornAt: number;
  patienceMs: number;
}

export interface PlayerMeta {
  outfit: string;
  hair: string;
  ready: boolean;
}

export interface WorldSnapshot {
  version: number;
  ts: number;
  stations: Record<string, StationState>;
  orders: Order[];
  timeLeft: number;
  score: number;
  streak: number;
}

export type Stage = "espera" | "jogando" | "pausa" | "fim";

export interface SharedState {
  stage: Stage;
  seed: number;
  startAt: number | null;
  duration: number;
  pausedBy: Me | null;
  players: Record<Me, PlayerMeta>;
  world: WorldSnapshot;
}

export interface PosMsg {
  x: number;
  y: number;
  facing: "up" | "down" | "left" | "right";
  holding: HeldItem;
  t: number;
}

export interface ActMsg {
  seq: number;
  stationId: string;
}

export interface ChatMsg {
  text: string;
  t: number;
}
