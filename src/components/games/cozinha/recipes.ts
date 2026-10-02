import type { Dish, HeldItem, Ingredient, StationState, StationType, WorldSnapshot, Order } from "./types";
import { STATIONS } from "./layout";

export const RECIPE_NEEDS: Record<Dish, Exclude<HeldItem, null>[]> = {
  hamburguer: ["pao", "carne_cozida"],
  sanduiche: ["pao", "queijo", "tomate_cortado"],
  pizza: ["massa", "molho", "queijo"], // vira pizza_crua, depois assar
  cupcake: ["cupcake_assado", "cobertura"],
  suco: ["fruta"],
};

export const DISH_LABEL: Record<Dish, string> = {
  hamburguer: "Hambúrguer",
  pizza: "Pizza",
  sanduiche: "Sanduíche",
  cupcake: "Cupcake",
  suco: "Suco",
};

export const ITEM_LABEL: Record<string, string> = {
  pao: "Pão",
  carne: "Carne",
  carne_cozida: "Carne cozida",
  queijo: "Queijo",
  tomate: "Tomate",
  tomate_cortado: "Tomate cortado",
  massa: "Massa",
  molho: "Molho",
  fruta: "Fruta",
  massa_cupcake: "Massa de cupcake",
  cobertura: "Cobertura",
  pizza_crua: "Pizza crua",
  cupcake_assado: "Cupcake assado",
  hamburguer: "Hambúrguer",
  pizza: "Pizza",
  sanduiche: "Sanduíche",
  cupcake: "Cupcake",
  suco: "Suco",
};

export const COOK_DURATIONS: Record<string, { ready: number; burn: number }> = {
  carne: { ready: 4000, burn: 9000 },
  pizza_crua: { ready: 5000, burn: 11000 },
  massa_cupcake: { ready: 5000, burn: 11000 },
  fruta: { ready: 2500, burn: 99999 },
};

export const PROCESS_RESULT: Record<string, Exclude<HeldItem, null>> = {
  carne: "carne_cozida",
  pizza_crua: "pizza",
  massa_cupcake: "cupcake_assado",
  fruta: "suco",
};

export function emptyStationState(id: string): StationState {
  return { id, held: null, bench: [] };
}

export function initialWorld(seed: number): WorldSnapshot {
  const stations: Record<string, StationState> = {};
  for (const s of STATIONS) {
    const st = emptyStationState(s.id);
    if (s.type === "fogao" || s.type === "forno" || s.type === "liquidificador") {
      st.process = { itemIn: null, startedAt: null, ready: false, burnt: false };
    }
    stations[s.id] = st;
  }
  return { version: 1, ts: Date.now(), stations, orders: [], timeLeft: 180000, score: 0, streak: 0, heldBy: { gu: null, li: null } };
}

function matchesRecipe(items: Exclude<HeldItem, null>[]): Dish | null {
  const sorted = [...items].sort().join(",");
  for (const dish of Object.keys(RECIPE_NEEDS) as Dish[]) {
    if (dish === "suco") continue; // suco não passa pela montagem
    const need = [...RECIPE_NEEDS[dish]].sort().join(",");
    if (need === sorted) return dish;
  }
  return null;
}

export interface ActionResult {
  world: WorldSnapshot;
  held: HeldItem;
}

// Função pura: aplica uma ação de interação em uma estação. Retorna null se inválida.
export function applyAction(world: WorldSnapshot, stationId: string, held: HeldItem, now: number): ActionResult | null {
  const def = STATIONS.find((s) => s.id === stationId);
  if (!def) return null;
  const st = world.stations[stationId];
  if (!st) return null;
  const type: StationType = def.type;
  const stations = { ...world.stations };

  const withStation = (next: StationState): WorldSnapshot => {
    stations[stationId] = next;
    return { ...world, stations, version: world.version + 1, ts: now };
  };

  switch (type) {
    case "geladeira": {
      if (held) return null;
      if (!def.ingredient) return null;
      return { world: { ...world, ts: now }, held: def.ingredient };
    }
    case "balcao": {
      if (held && !st.held) {
        return { world: withStation({ ...st, held }), held: null };
      }
      if (!held && st.held) {
        return { world: withStation({ ...st, held: null }), held: st.held };
      }
      return null;
    }
    case "tabua": {
      if (held === "tomate" && !st.held) {
        return { world: withStation({ ...st, held: "tomate_cortado" }), held: null };
      }
      if (!held && st.held) {
        return { world: withStation({ ...st, held: null }), held: st.held };
      }
      return null;
    }
    case "lixeira": {
      if (!held) return null;
      return { world: { ...world, ts: now }, held: null };
    }
    case "fogao":
    case "forno": {
      const proc = st.process!;
      const acceptIngredient = type === "fogao" ? "carne" : def.id.includes("f_") ? null : null;
      const accepted = type === "fogao" ? ["carne"] : ["pizza_crua", "massa_cupcake"];
      if (held && !proc.itemIn && accepted.includes(held)) {
        return {
          world: withStation({ ...st, process: { itemIn: held, startedAt: now, ready: false, burnt: false } }),
          held: null,
        };
      }
      if (!held && proc.itemIn && (proc.ready || proc.burnt)) {
        const result = proc.burnt ? "queimado" : PROCESS_RESULT[proc.itemIn];
        return {
          world: withStation({ ...st, process: { itemIn: null, startedAt: null, ready: false, burnt: false } }),
          held: result as HeldItem,
        };
      }
      return null;
    }
    case "liquidificador": {
      const proc = st.process!;
      if (held === "fruta" && !proc.itemIn) {
        return {
          world: withStation({ ...st, process: { itemIn: "fruta", startedAt: now, ready: false, burnt: false } }),
          held: null,
        };
      }
      if (!held && proc.itemIn && proc.ready) {
        return {
          world: withStation({ ...st, process: { itemIn: null, startedAt: null, ready: false, burnt: false } }),
          held: "suco",
        };
      }
      return null;
    }
    case "montagem": {
      const bench = st.bench ? [...st.bench] : [];
      if (held && bench.length < 4) {
        const nextBench = [...bench, held];
        const match = matchesRecipe(nextBench);
        if (match === "pizza") {
          return { world: withStation({ ...st, bench: [] }), held: null };
        }
        return { world: withStation({ ...st, bench: nextBench }), held: null };
      }
      if (!held) {
        const match = matchesRecipe(bench);
        if (match) {
          return { world: withStation({ ...st, bench: [] }), held: match };
        }
        if (bench.length) {
          const last = bench[bench.length - 1];
          return { world: withStation({ ...st, bench: bench.slice(0, -1) }), held: last };
        }
      }
      return null;
    }
    case "entrega": {
      if (!held) return null;
      const dish = held as Dish;
      const need = RECIPE_NEEDS[dish];
      if (!need) return null;
      const idx = world.orders.findIndex((o) => o.dish === dish);
      if (idx === -1) return null;
      const order = world.orders[idx];
      const elapsedRatio = Math.max(0, 1 - (now - order.bornAt) / order.patienceMs);
      const bonus = Math.round(elapsedRatio * 5);
      const orders = world.orders.filter((_, i) => i !== idx);
      return {
        world: { ...world, orders, score: world.score + 10 + bonus, streak: world.streak + 1, ts: now, version: world.version + 1 },
        held: null,
      };
    }
    default:
      return null;
  }
}

// Avança processos (fogão/forno/liquidificador) - chamado só pelo host.
export function tickProcesses(world: WorldSnapshot, now: number): WorldSnapshot {
  let changed = false;
  const stations = { ...world.stations };
  for (const id of Object.keys(stations)) {
    const st = stations[id];
    if (!st.process || !st.process.itemIn || !st.process.startedAt) continue;
    const dur = COOK_DURATIONS[st.process.itemIn];
    if (!dur) continue;
    const elapsed = now - st.process.startedAt;
    const ready = elapsed >= dur.ready;
    const burnt = elapsed >= dur.burn;
    if (ready !== st.process.ready || burnt !== st.process.burnt) {
      stations[id] = { ...st, process: { ...st.process, ready, burnt } };
      changed = true;
    }
  }
  if (!changed) return world;
  return { ...world, stations, ts: now };
}

const DISH_POOL: Dish[] = ["hamburguer", "sanduiche", "pizza", "cupcake", "suco"];

export function maybeSpawnOrder(world: WorldSnapshot, now: number, seed: number, elapsedRound: number): WorldSnapshot {
  const maxOrders = 4;
  if (world.orders.length >= maxOrders) return world;
  const difficulty = Math.min(1, elapsedRound / 150000);
  const spawnInterval = 11000 - difficulty * 6000;
  const lastOrder = world.orders[world.orders.length - 1];
  if (lastOrder && now - lastOrder.bornAt < spawnInterval) return world;
  const r = Math.abs(Math.sin(seed * 999 + now * 0.0001)) ;
  const dish = DISH_POOL[Math.floor(r * DISH_POOL.length) % DISH_POOL.length];
  const patience = 45000 - difficulty * 20000;
  const order: Order = { id: now + Math.floor(r * 1000), dish, bornAt: now, patienceMs: patience };
  return { ...world, orders: [...world.orders, order], ts: now, version: world.version + 1 };
}

export function expireOrders(world: WorldSnapshot, now: number): WorldSnapshot {
  const orders = world.orders.filter((o) => now - o.bornAt < o.patienceMs);
  if (orders.length === world.orders.length) return world;
  return { ...world, orders, ts: now, version: world.version + 1 };
}
