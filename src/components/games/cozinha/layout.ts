import type { StationDef } from "./types";

export const COLS = 13;
export const ROWS = 9;
export const TILE = 56;

// Grid de estações: perímetro cheio de estações força o caminho pelo meio.
export const STATIONS: StationDef[] = [
  // parede/contador topo
  { id: "w0", type: "parede", x: 0, y: 0 },
  { id: "f_pao", type: "geladeira", x: 1, y: 0, ingredient: "pao" },
  { id: "f_carne", type: "geladeira", x: 2, y: 0, ingredient: "carne" },
  { id: "f_queijo", type: "geladeira", x: 3, y: 0, ingredient: "queijo" },
  { id: "f_tomate", type: "geladeira", x: 4, y: 0, ingredient: "tomate" },
  { id: "c_top1", type: "balcao", x: 5, y: 0 },
  { id: "tabua1", type: "tabua", x: 6, y: 0 },
  { id: "tabua2", type: "tabua", x: 7, y: 0 },
  { id: "c_top2", type: "balcao", x: 8, y: 0 },
  { id: "f_fruta", type: "geladeira", x: 9, y: 0, ingredient: "fruta" },
  { id: "f_massa", type: "geladeira", x: 10, y: 0, ingredient: "massa" },
  { id: "f_molho", type: "geladeira", x: 11, y: 0, ingredient: "molho" },
  { id: "w1", type: "parede", x: 12, y: 0 },

  // laterais: entrega e bancadas de passagem
  { id: "wl1", type: "parede", x: 0, y: 1 },
  { id: "wl2", type: "parede", x: 0, y: 2 },
  { id: "wl3", type: "parede", x: 0, y: 3 },
  { id: "entrega", type: "entrega", x: 0, y: 4 },
  { id: "wl5", type: "parede", x: 0, y: 5 },
  { id: "wl6", type: "parede", x: 0, y: 6 },
  { id: "wl7", type: "parede", x: 0, y: 7 },

  { id: "wr1", type: "parede", x: 12, y: 1 },
  { id: "c_r2", type: "balcao", x: 12, y: 2 },
  { id: "wr3", type: "parede", x: 12, y: 3 },
  { id: "c_r4", type: "balcao", x: 12, y: 4 },
  { id: "wr5", type: "parede", x: 12, y: 5 },
  { id: "c_r6", type: "balcao", x: 12, y: 6 },
  { id: "wr7", type: "parede", x: 12, y: 7 },

  // duas ilhas centrais, com corredores largos para os dois jogadores
  { id: "ic1", type: "balcao", x: 4, y: 3 },
  { id: "ic2", type: "montagem", x: 5, y: 3 },
  { id: "ic3", type: "balcao", x: 6, y: 3 },
  { id: "ic4", type: "montagem", x: 7, y: 3 },
  { id: "ic5", type: "balcao", x: 8, y: 3 },
  { id: "ic6", type: "balcao", x: 4, y: 5 },
  { id: "ic7", type: "tabua", x: 5, y: 5 },
  { id: "ic8", type: "balcao", x: 6, y: 5 },
  { id: "ic9", type: "tabua", x: 7, y: 5 },
  { id: "ic10", type: "balcao", x: 8, y: 5 },

  // base
  { id: "w2", type: "parede", x: 0, y: 8 },
  { id: "fogao1", type: "fogao", x: 1, y: 8 },
  { id: "fogao2", type: "fogao", x: 2, y: 8 },
  { id: "forno1", type: "forno", x: 3, y: 8 },
  { id: "forno2", type: "forno", x: 4, y: 8 },
  { id: "liq1", type: "liquidificador", x: 5, y: 8 },
  { id: "montagem1", type: "montagem", x: 6, y: 8 },
  { id: "montagem2", type: "montagem", x: 7, y: 8 },
  { id: "lixeira", type: "lixeira", x: 8, y: 8 },
  { id: "f_massacup", type: "geladeira", x: 9, y: 8, ingredient: "massa_cupcake" },
  { id: "f_cobertura", type: "geladeira", x: 10, y: 8, ingredient: "cobertura" },
  { id: "c_bot", type: "balcao", x: 11, y: 8 },
  { id: "w3", type: "parede", x: 12, y: 8 },
];

export function buildSolidGrid(): boolean[][] {
  const solid: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  for (const s of STATIONS) {
    solid[s.y][s.x] = true;
  }
  return solid;
}

export function stationAt(x: number, y: number): StationDef | undefined {
  return STATIONS.find((s) => s.x === x && s.y === y);
}
