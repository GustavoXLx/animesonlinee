/** Lógica pura da "Nossa Casa" — usada no servidor (aplica ações) e no cliente (exibe). */
export type Who = "gu" | "li";

export type Category = "moveis" | "plantas" | "gamer" | "decor" | "pets" | "luz" | "quadros" | "jardim";
export const CATEGORIES: { id: Category; name: string }[] = [
  { id: "moveis", name: "Móveis" },
  { id: "plantas", name: "Plantas" },
  { id: "gamer", name: "Gamer" },
  { id: "decor", name: "Decoração" },
  { id: "pets", name: "Pets" },
  { id: "luz", name: "Iluminação" },
  { id: "quadros", name: "Quadros" },
  { id: "jardim", name: "Jardim" },
];

export type ShopItem = { id: string; name: string; icon: string; price: number; cat: Category; garden?: boolean };
export const SHOP: ShopItem[] = [
  { id: "sofa2", name: "Sofá novo", icon: "🛋️", price: 100, cat: "moveis" },
  { id: "poltrona", name: "Poltrona", icon: "🪑", price: 60, cat: "moveis" },
  { id: "estante", name: "Estante", icon: "📚", price: 80, cat: "moveis" },
  { id: "tapete", name: "Tapete", icon: "🟫", price: 40, cat: "moveis" },
  { id: "planta", name: "Planta", icon: "🪴", price: 50, cat: "plantas" },
  { id: "cacto", name: "Cacto", icon: "🌵", price: 35, cat: "plantas" },
  { id: "girassol", name: "Girassol", icon: "🌻", price: 45, cat: "plantas" },
  { id: "console", name: "Console", icon: "🕹️", price: 300, cat: "gamer" },
  { id: "headset", name: "Headset", icon: "🎧", price: 120, cat: "gamer" },
  { id: "arcade", name: "Fliperama", icon: "👾", price: 250, cat: "gamer" },
  { id: "urso", name: "Ursinho", icon: "🧸", price: 70, cat: "decor" },
  { id: "vela", name: "Velas", icon: "🕯️", price: 30, cat: "decor" },
  { id: "relogio", name: "Relógio", icon: "🕰️", price: 55, cat: "decor" },
  { id: "cachorro", name: "Cachorro", icon: "🐶", price: 500, cat: "pets" },
  { id: "gato", name: "Gato", icon: "🐱", price: 450, cat: "pets" },
  { id: "abajur", name: "Abajur", icon: "💡", price: 45, cat: "luz" },
  { id: "pisca", name: "Pisca-pisca", icon: "✨", price: 60, cat: "luz" },
  { id: "quadro1", name: "Quadro de paisagem", icon: "🖼️", price: 65, cat: "quadros" },
  { id: "foto", name: "Porta-retrato", icon: "📷", price: 50, cat: "quadros" },
  { id: "rosa", name: "Rosa", icon: "🌹", price: 25, cat: "jardim", garden: true },
  { id: "tulipa", name: "Tulipa", icon: "🌷", price: 25, cat: "jardim", garden: true },
  { id: "arvore", name: "Árvore", icon: "🌳", price: 120, cat: "jardim", garden: true },
  { id: "banco", name: "Banco", icon: "🪑", price: 90, cat: "jardim", garden: true },
  { id: "poste", name: "Luz do jardim", icon: "🏮", price: 70, cat: "jardim", garden: true },
  { id: "fonte", name: "Fonte", icon: "⛲", price: 350, cat: "jardim", garden: true },
  { id: "casinha", name: "Casinha do pet", icon: "🛖", price: 200, cat: "jardim", garden: true },
];
export const itemById = (id: string) => SHOP.find((s) => s.id === id);

export type Placed = { uid: string; item: string; note: string; date: string; by: Who };
export type Letter = { id: string; from: Who; text: string; openAt: string | null; created: string; opened: boolean };
export type Memory = { id: string; title: string; desc: string; date: string; photo: string | null; by: Who };

export type HouseData = {
  hearts: number;
  placed: Placed[];
  owned: string[]; // compras ainda não colocadas
  letters: Letter[];
  memories: Memory[];
  pet: "cachorro" | "gato" | null;
  petName: string;
  /** chaves `yyyy-mm-dd:who:key` já resgatadas */
  claims: string[];
  /** contadores do dia `yyyy-mm-dd:who:evento` */
  counts: Record<string, number>;
  log: { t: string; text: string }[];
};

export const emptyHouse = (): HouseData => ({
  hearts: 20,
  placed: [],
  owned: [],
  letters: [],
  memories: [
    { id: "m0", title: "Criamos nossa casinha", desc: "O começo do nosso cantinho.", date: new Date().toISOString().slice(0, 10), photo: null, by: "gu" },
  ],
  pet: null,
  petName: "",
  claims: [],
  counts: {},
  log: [],
});

export function normalize(d: Partial<HouseData> | null | undefined): HouseData {
  return { ...emptyHouse(), ...(d ?? {}) } as HouseData;
}

export const today = () => {
  const d = new Date(Date.now() - 3 * 3600_000); // horário de Brasília
  return d.toISOString().slice(0, 10);
};

/** Recompensas diárias, uma vez por pessoa por dia. */
export const REWARDS: Record<string, { label: string; amount: number }> = {
  daily: { label: "Primeiro login do dia", amount: 10 },
  game: { label: "Jogou um jogo", amount: 10 },
  interact: { label: "Interagiu com a casa", amount: 5 },
};

export type Mission = { id: string; title: string; reward: number; event: string; need: number };
export const MISSIONS: Mission[] = [
  { id: "m_game", title: "Joguem uma partida juntos", reward: 20, event: "game", need: 1 },
  { id: "m_letter", title: "Escreva uma carta", reward: 25, event: "letter", need: 1 },
  { id: "m_memory", title: "Adicione uma nova memória", reward: 30, event: "memory", need: 1 },
  { id: "m_music", title: "Escolha uma música na TV", reward: 15, event: "music", need: 1 },
  { id: "m_obj", title: "Interaja com 5 objetos", reward: 15, event: "interact", need: 5 },
  { id: "m_hug", title: "Dê um abraço ou beijo", reward: 10, event: "emote", need: 1 },
];

export const countKey = (who: Who, ev: string) => `${today()}:${who}:${ev}`;
export const claimKey = (who: Who, k: string) => `${today()}:${who}:${k}`;

export const secretUnlocked = (h: HouseData) => h.memories.length >= 3 && h.letters.length >= 2 && h.placed.length >= 3;

export type HouseOp =
  | { op: "claim"; key: string }
  | { op: "event"; ev: string }
  | { op: "mission"; id: string }
  | { op: "buy"; item: string }
  | { op: "place"; item: string; note: string }
  | { op: "unplace"; uid: string }
  | { op: "note"; uid: string; note: string }
  | { op: "letter"; text: string; openAt: string | null }
  | { op: "openLetter"; id: string }
  | { op: "memory"; title: string; desc: string; date: string; photo: string | null }
  | { op: "delMemory"; id: string }
  | { op: "petName"; name: string };

const uid = () => Math.random().toString(36).slice(2, 10);
const NAME = { gu: "bb gu", li: "bb li" };

/** Aplica uma ação. Retorna mensagem (ex. "+10 ❤️") ou lança erro. */
export function applyHouse(h: HouseData, who: Who, a: HouseOp): string {
  const now = new Date().toISOString();
  const log = (text: string) => {
    h.log.unshift({ t: now, text });
    h.log = h.log.slice(0, 40);
  };
  const bump = (ev: string) => {
    const k = countKey(who, ev);
    h.counts[k] = (h.counts[k] ?? 0) + 1;
  };
  // limpa dados de dias antigos
  const t = today();
  h.claims = h.claims.filter((c) => c >= t.slice(0, 8));
  for (const k of Object.keys(h.counts)) if (!k.startsWith(t)) delete h.counts[k];

  switch (a.op) {
    case "claim": {
      const r = REWARDS[a.key];
      if (!r) throw new Error("recompensa inválida");
      const k = claimKey(who, a.key);
      if (h.claims.includes(k)) return "";
      h.claims.push(k);
      h.hearts += r.amount;
      if (a.key === "game") bump("game");
      if (a.key === "interact") bump("interact");
      return `${r.label} +${r.amount} ❤️`;
    }
    case "event": {
      if (!["interact", "music", "emote", "game"].includes(a.ev)) throw new Error("evento inválido");
      bump(a.ev);
      return "";
    }
    case "mission": {
      const m = MISSIONS.find((x) => x.id === a.id);
      if (!m) throw new Error("missão inválida");
      const k = claimKey(who, m.id);
      if (h.claims.includes(k)) throw new Error("já resgatada hoje");
      if ((h.counts[countKey(who, m.event)] ?? 0) < m.need) throw new Error("missão ainda não concluída");
      h.claims.push(k);
      h.hearts += m.reward;
      log(`${NAME[who]} completou "${m.title}"`);
      return `Missão concluída +${m.reward} ❤️`;
    }
    case "buy": {
      const it = itemById(a.item);
      if (!it) throw new Error("item inválido");
      if (h.hearts < it.price) throw new Error("corações insuficientes");
      if (it.cat === "pets") {
        if (h.pet) throw new Error("vocês já têm um pet");
        h.pet = it.id as "cachorro" | "gato";
      } else h.owned.push(it.id);
      h.hearts -= it.price;
      log(`${NAME[who]} comprou ${it.name}`);
      return `${it.name} comprado!`;
    }
    case "place": {
      const i = h.owned.indexOf(a.item);
      if (i < 0) throw new Error("item não está no inventário");
      h.owned.splice(i, 1);
      h.placed.push({ uid: uid(), item: a.item, note: a.note.slice(0, 80), date: t, by: who });
      return "Colocado na casa!";
    }
    case "unplace": {
      const i = h.placed.findIndex((p) => p.uid === a.uid);
      if (i < 0) throw new Error("não encontrado");
      h.owned.push(h.placed[i].item);
      h.placed.splice(i, 1);
      return "Guardado no inventário";
    }
    case "note": {
      const p = h.placed.find((x) => x.uid === a.uid);
      if (p) p.note = a.note.slice(0, 80);
      return "";
    }
    case "letter": {
      const text = a.text.trim().slice(0, 3000);
      if (!text) throw new Error("carta vazia");
      h.letters.unshift({ id: uid(), from: who, text, openAt: a.openAt, created: now, opened: false });
      bump("letter");
      log(`${NAME[who]} deixou uma carta na caixa de correio`);
      return "Carta enviada 💌";
    }
    case "openLetter": {
      const l = h.letters.find((x) => x.id === a.id);
      if (!l || l.from === who) return "";
      if (l.openAt && l.openAt > t) throw new Error("ainda não pode abrir");
      l.opened = true;
      return "";
    }
    case "memory": {
      const title = a.title.trim().slice(0, 80);
      if (!title) throw new Error("dê um título");
      h.memories.push({ id: uid(), title, desc: a.desc.slice(0, 600), date: a.date || t, photo: a.photo, by: who });
      h.memories.sort((x, y) => x.date.localeCompare(y.date));
      bump("memory");
      log(`${NAME[who]} adicionou a memória "${title}"`);
      return "Memória guardada 📖";
    }
    case "delMemory": {
      h.memories = h.memories.filter((m) => m.id !== a.id);
      return "";
    }
    case "petName": {
      h.petName = a.name.slice(0, 20);
      return "";
    }
  }
}
