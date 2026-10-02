import type { StationDef } from "./types";

export const COLS = 15;
export const ROWS = 9;
export const TILE = 56;

// Cozinha compacta em estilo top-down cooperativo: cada jogador circula por
// corredores largos e precisa cruzar a cozinha para buscar, preparar, cozinhar e servir.
export const STATIONS: StationDef[] = [
  // perímetro
  ...Array.from({ length: 15 }, (_, x) => ({ id: `wall-top-${x}`, type: "parede" as const, x, y: 0 })),
  ...Array.from({ length: 15 }, (_, x) => ({ id: `wall-bottom-${x}`, type: "parede" as const, x, y: 8 })),
  ...Array.from({ length: 7 }, (_, i) => ({ id: `wall-left-${i + 1}`, type: "parede" as const, x: 0, y: i + 1 })),
  ...Array.from({ length: 7 }, (_, i) => ({ id: `wall-right-${i + 1}`, type: "parede" as const, x: 14, y: i + 1 })),

  // linha de ingredientes: leitura imediata e acesso pelos dois chefs
  { id: "f_pao", type: "geladeira", x: 1, y: 1, ingredient: "pao" },
  { id: "f_carne", type: "geladeira", x: 2, y: 1, ingredient: "carne" },
  { id: "f_queijo", type: "geladeira", x: 3, y: 1, ingredient: "queijo" },
  { id: "f_tomate", type: "geladeira", x: 4, y: 1, ingredient: "tomate" },
  { id: "f_fruta", type: "geladeira", x: 10, y: 1, ingredient: "fruta" },
  { id: "f_massa", type: "geladeira", x: 11, y: 1, ingredient: "massa" },
  { id: "f_molho", type: "geladeira", x: 12, y: 1, ingredient: "molho" },
  { id: "f_massacup", type: "geladeira", x: 13, y: 1, ingredient: "massa_cupcake" },

  // preparo à esquerda
  { id: "tabua1", type: "tabua", x: 2, y: 3 },
  { id: "tabua2", type: "tabua", x: 3, y: 3 },
  { id: "c_prep1", type: "balcao", x: 4, y: 3 },
  { id: "c_prep2", type: "balcao", x: 2, y: 4 },
  { id: "c_prep3", type: "balcao", x: 3, y: 4 },

  // ilha central de montagem, mantendo corredores largos ao redor
  { id: "montagem1", type: "montagem", x: 6, y: 4 },
  { id: "montagem2", type: "montagem", x: 8, y: 4 },
  { id: "c_mid1", type: "balcao", x: 6, y: 3 },
  { id: "c_mid2", type: "balcao", x: 8, y: 3 },

  // cozinha à direita
  { id: "fogao1", type: "fogao", x: 10, y: 3 },
  { id: "fogao2", type: "fogao", x: 11, y: 3 },
  { id: "forno1", type: "forno", x: 12, y: 3 },
  { id: "forno2", type: "forno", x: 13, y: 3 },
  { id: "liq1", type: "liquidificador", x: 10, y: 5 },
  { id: "c_cook1", type: "balcao", x: 11, y: 5 },
  { id: "c_cook2", type: "balcao", x: 12, y: 5 },
  { id: "lixeira", type: "lixeira", x: 13, y: 5 },

  // expedição na parte inferior
  { id: "c_delivery1", type: "balcao", x: 10, y: 7 },
  { id: "c_delivery2", type: "balcao", x: 11, y: 7 },
  { id: "c_delivery3", type: "balcao", x: 12, y: 7 },
  { id: "entrega", type: "entrega", x: 13, y: 7 },
];

export function buildSolidGrid(): boolean[][] {
  const solid: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  for (const s of STATIONS) solid[s.y][s.x] = true;
  return solid;
}

export function stationAt(x: number, y: number): StationDef | undefined {
  return STATIONS.find((s) => s.x === x && s.y === y);
}
