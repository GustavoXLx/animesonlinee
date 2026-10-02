import { sanitizeLook } from "./look";
// Nossa Casa — regras compartilhadas (cliente e servidor).
export type Who = "gu" | "li";

export type CatalogItem = {
  key: string;
  name: string;
  cat: "sala" | "quarto" | "cozinha" | "banheiro" | "decor";
  price: number;
  seat?: boolean;
  /** vai em cima de mesas/balcões */
  top?: boolean;
  /** pode ficar por cima de tapete */
  flat?: boolean;
};

export const CATALOG: CatalogItem[] = [
  { key: "loungeSofa", name: "Sofá", cat: "sala", price: 40, seat: true },
  { key: "loungeSofaLong", name: "Sofá grande", cat: "sala", price: 60, seat: true },
  { key: "loungeDesignSofa", name: "Sofá design", cat: "sala", price: 70, seat: true },
  { key: "loungeChair", name: "Poltrona", cat: "sala", price: 30, seat: true },
  { key: "loungeChairRelax", name: "Poltrona relax", cat: "sala", price: 35, seat: true },
  { key: "tableCoffee", name: "Mesa de centro", cat: "sala", price: 20 },
  { key: "tableCoffeeGlass", name: "Mesa de vidro", cat: "sala", price: 25 },
  { key: "rugRectangle", name: "Tapete", cat: "sala", price: 15, flat: true },
  { key: "rugRound", name: "Tapete redondo", cat: "sala", price: 15, flat: true },
  { key: "rugSquare", name: "Tapete quadrado", cat: "sala", price: 12, flat: true },
  { key: "televisionModern", name: "TV moderna", cat: "sala", price: 50 },
  { key: "televisionVintage", name: "TV antiga", cat: "sala", price: 35 },
  { key: "cabinetTelevision", name: "Rack", cat: "sala", price: 25 },
  { key: "bookcaseOpen", name: "Estante", cat: "sala", price: 30 },
  { key: "bookcaseClosedWide", name: "Armário largo", cat: "sala", price: 35 },
  { key: "speaker", name: "Caixa de som", cat: "sala", price: 20 },
  { key: "radio", name: "Rádio", cat: "sala", price: 15 },
  { key: "bedDouble", name: "Cama de casal", cat: "quarto", price: 60, seat: true },
  { key: "bedSingle", name: "Cama de solteiro", cat: "quarto", price: 35, seat: true },
  { key: "cabinetBedDrawer", name: "Criado-mudo", cat: "quarto", price: 15 },
  { key: "lampRoundTable", name: "Abajur", cat: "quarto", price: 10 },
  { key: "lampRoundFloor", name: "Luminária redonda", cat: "quarto", price: 15 },
  { key: "lampSquareFloor", name: "Luminária quadrada", cat: "quarto", price: 15 },
  { key: "pillow", name: "Almofada", cat: "quarto", price: 5 },
  { key: "pillowBlue", name: "Almofada azul", cat: "quarto", price: 5 },
  { key: "bear", name: "Ursinho", cat: "quarto", price: 10 },
  { key: "washer", name: "Máquina de lavar", cat: "quarto", price: 30 },
  { key: "kitchenFridge", name: "Geladeira", cat: "cozinha", price: 40 },
  { key: "kitchenStove", name: "Fogão", cat: "cozinha", price: 35 },
  { key: "kitchenSink", name: "Pia", cat: "cozinha", price: 30 },
  { key: "kitchenCabinet", name: "Balcão", cat: "cozinha", price: 20 },
  { key: "kitchenCoffeeMachine", name: "Cafeteira", cat: "cozinha", price: 15 },
  { key: "kitchenMicrowave", name: "Micro-ondas", cat: "cozinha", price: 15 },
  { key: "table", name: "Mesa", cat: "cozinha", price: 25 },
  { key: "tableRound", name: "Mesa redonda", cat: "cozinha", price: 25 },
  { key: "chair", name: "Cadeira", cat: "cozinha", price: 10, seat: true },
  { key: "chairCushion", name: "Cadeira estofada", cat: "cozinha", price: 12, seat: true },
  { key: "stoolBar", name: "Banqueta", cat: "cozinha", price: 8, seat: true },
  { key: "pottedPlant", name: "Planta grande", cat: "decor", price: 10 },
  { key: "plantSmall1", name: "Plantinha", cat: "decor", price: 6 },
  { key: "plantSmall2", name: "Suculenta", cat: "decor", price: 6 },
  { key: "plantSmall3", name: "Vasinho", cat: "decor", price: 6 },
  { key: "books", name: "Livros", cat: "decor", price: 5 },
  { key: "coatRackStanding", name: "Cabideiro", cat: "decor", price: 12 },
  { key: "desk", name: "Escrivaninha", cat: "decor", price: 25 },
  { key: "chairDesk", name: "Cadeira de PC", cat: "decor", price: 15, seat: true },
  { key: "computerScreen", name: "Monitor", cat: "decor", price: 30 },
  { key: "laptop", name: "Notebook", cat: "decor", price: 30 },
  { key: "sideTable", name: "Mesinha", cat: "decor", price: 12 },
  { key: "trashcan", name: "Lixeira", cat: "decor", price: 4 },
  { key: "cardboardBoxOpen", name: "Caixa", cat: "decor", price: 3 },
  { key: "loungeSofaCorner", name: "Sofá de canto", cat: "sala", price: 65, seat: true },
  { key: "loungeSofaOttoman", name: "Puff", cat: "sala", price: 15, seat: true },
  { key: "loungeDesignChair", name: "Poltrona design", cat: "sala", price: 40, seat: true },
  { key: "tableCoffeeSquare", name: "Mesa de centro quadrada", cat: "sala", price: 20 },
  { key: "tableCoffeeGlassSquare", name: "Mesa de vidro quadrada", cat: "sala", price: 25 },
  { key: "bookcaseOpenLow", name: "Estante baixa", cat: "sala", price: 20 },
  { key: "cabinetTelevisionDoors", name: "Rack com portas", cat: "sala", price: 30 },
  { key: "speakerSmall", name: "Caixinha de som", cat: "sala", price: 10, top: true },
  { key: "televisionAntenna", name: "TV de antena", cat: "sala", price: 30, top: true },
  { key: "rugRounded", name: "Tapete arredondado", cat: "sala", price: 15, flat: true },
  { key: "rugDoormat", name: "Capacho", cat: "decor", price: 5, flat: true },
  { key: "bedBunk", name: "Beliche", cat: "quarto", price: 50, seat: true },
  { key: "cabinetBedDrawerTable", name: "Criado com gaveta", cat: "quarto", price: 18 },
  { key: "lampSquareTable", name: "Abajur quadrado", cat: "quarto", price: 10, top: true },
  { key: "pillowLong", name: "Almofada longa", cat: "quarto", price: 6, top: true },
  { key: "pillowBlueLong", name: "Almofada longa azul", cat: "quarto", price: 6, top: true },
  { key: "dryer", name: "Secadora", cat: "quarto", price: 30 },
  { key: "washerDryerStacked", name: "Lava e seca", cat: "quarto", price: 50 },
  { key: "bookcaseClosedDoors", name: "Guarda-roupa", cat: "quarto", price: 40 },
  { key: "coatRack", name: "Cabide de parede", cat: "quarto", price: 8 },
  { key: "kitchenBar", name: "Bancada", cat: "cozinha", price: 25 },
  { key: "kitchenBarEnd", name: "Ponta da bancada", cat: "cozinha", price: 20 },
  { key: "kitchenFridgeLarge", name: "Geladeira duplex", cat: "cozinha", price: 60 },
  { key: "kitchenStoveElectric", name: "Cooktop", cat: "cozinha", price: 40 },
  { key: "kitchenCabinetDrawer", name: "Gaveteiro", cat: "cozinha", price: 20 },
  { key: "kitchenBlender", name: "Liquidificador", cat: "cozinha", price: 12, top: true },
  { key: "toaster", name: "Torradeira", cat: "cozinha", price: 10, top: true },
  { key: "tableGlass", name: "Mesa de vidro", cat: "cozinha", price: 30 },
  { key: "tableCloth", name: "Mesa com toalha", cat: "cozinha", price: 30 },
  { key: "tableCross", name: "Mesa rústica", cat: "cozinha", price: 28 },
  { key: "chairModernCushion", name: "Cadeira moderna", cat: "cozinha", price: 14, seat: true },
  { key: "chairRounded", name: "Cadeira redonda", cat: "cozinha", price: 12, seat: true },
  { key: "stoolBarSquare", name: "Banqueta quadrada", cat: "cozinha", price: 8, seat: true },
  { key: "bathtub", name: "Banheira", cat: "banheiro", price: 60 },
  { key: "shower", name: "Chuveiro", cat: "banheiro", price: 45 },
  { key: "toilet", name: "Vaso", cat: "banheiro", price: 25, seat: true },
  { key: "bathroomSink", name: "Pia do banheiro", cat: "banheiro", price: 25 },
  { key: "bathroomCabinet", name: "Armário do banheiro", cat: "banheiro", price: 20 },
  { key: "bench", name: "Banco", cat: "decor", price: 15, seat: true },
  { key: "benchCushion", name: "Banco estofado", cat: "decor", price: 20, seat: true },
  { key: "deskCorner", name: "Escrivaninha em L", cat: "decor", price: 35 },
  { key: "computerKeyboard", name: "Teclado", cat: "decor", price: 6, top: true },
  { key: "computerMouse", name: "Mouse", cat: "decor", price: 4, top: true },
  { key: "sideTableDrawers", name: "Mesinha com gaveta", cat: "decor", price: 15 },
  { key: "cardboardBoxClosed", name: "Caixa fechada", cat: "decor", price: 3 },
];
const OLD_TOP = ["televisionModern", "televisionVintage", "lampRoundTable", "laptop", "computerScreen", "books", "plantSmall1", "plantSmall2", "plantSmall3", "radio", "kitchenCoffeeMachine", "kitchenMicrowave", "pillow", "pillowBlue", "bear", "speaker"];
for (const c of CATALOG) if (OLD_TOP.includes(c.key)) c.top = true;
export const CAT_BY_KEY = Object.fromEntries(CATALOG.map((c) => [c.key, c]));

export const WALLS = [
  { id: "creme", name: "Creme", color: "#efe3cf", price: 0 },
  { id: "rosa", name: "Rosa chá", color: "#e9c4c4", price: 30 },
  { id: "salvia", name: "Sálvia", color: "#b9c9ae", price: 30 },
  { id: "ceu", name: "Céu", color: "#b9cfe0", price: 30 },
  { id: "lavanda", name: "Lavanda", color: "#cdbfe0", price: 30 },
  { id: "terracota", name: "Terracota", color: "#d49c7f", price: 40 },
];
export const FLOORS = [
  { id: "carvalho", name: "Carvalho", a: "#c89b6d", b: "#b98a5c", price: 0 },
  { id: "nogueira", name: "Nogueira", a: "#8a5f3f", b: "#7a5236", price: 30 },
  { id: "clara", name: "Madeira clara", a: "#e2c9a2", b: "#d6b98f", price: 30 },
  { id: "cinza", name: "Porcelanato", a: "#cfcac4", b: "#bdb7b0", price: 40 },
];

export const CHARACTERS = [
  "female-a", "female-b", "female-c", "female-d", "female-e", "female-f",
  "male-a", "male-b", "male-c", "male-d", "male-e", "male-f",
];
export const PETS = [
  { kind: "cat", name: "Gato" },
  { kind: "dog", name: "Cachorro" },
  { kind: "bunny", name: "Coelho" },
  { kind: "fox", name: "Raposa" },
  { kind: "panda", name: "Panda" },
  { kind: "penguin", name: "Pinguim" },
];

export const ROOM = 4.5; // metros (unidades) de cada lado de um cômodo
export const HOUSE = ROOM * 2; // casa 2x2 cômodos
export const ROOM_NAMES = ["Sala", "Quarto", "Cozinha", "Escritório"];

export type PlacedItem = { uid: string; k: string; x: number; z: number; r: number; room?: number };
export type MissionId = "juntos" | "tempo" | "sentar" | "pet" | "decor";
export const MISSIONS: { id: MissionId; title: string; desc: string; reward: number }[] = [
  { id: "juntos", title: "Em casa juntos", desc: "Estarem os dois na casa ao mesmo tempo", reward: 15 },
  { id: "tempo", title: "Tempo de qualidade", desc: "Ficarem 5 minutos juntos na casa", reward: 25 },
  { id: "sentar", title: "Juntinhos", desc: "Sentarem os dois ao mesmo tempo", reward: 20 },
  { id: "pet", title: "Cuidar do pet", desc: "Cada um cuidar do pet com o outro presente", reward: 15 },
  { id: "decor", title: "Decorar a dois", desc: "Cada um mexer num móvel com o outro presente", reward: 15 },
];
export const BONUS = 30;
export const TOGETHER_GOAL = 300;

export const MAX_PETS = 6;
export type Pet = { kind: string; name: string; lastFed: number; lastPet: number };
export type Home = {
  coins: number;
  items: PlacedItem[];
  inv: string[];
  wall: string;
  floor: string;
  styles: string[];
  avatars: Record<Who, string>;
  /** visual personalizado de cada um */
  looks?: Partial<Record<Who, import("./look").Look>>;
  pet: Pet | null;
  /** todos os pets (o primeiro também fica em `pet`) */
  pets: Pet[];
  day: string;
  missions: Partial<Record<MissionId, boolean>>;
  prog: { pet: Partial<Record<Who, boolean>>; decor: Partial<Record<Who, boolean>> };
  bonus: boolean;
  log: { t: number; text: string }[];
  /** fotos dos quadros (caminho no armazenamento), índice = quadro */
  frames: (string | null)[];
};
export const FRAME_COUNT = 6;
export const FRAME_PATH_RE = /^\d+_[a-z0-9]{4,12}\.(jpg|jpeg|png|webp|heic|gif)$/i;

export function today() {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

let uidN = 0;
const uid = () => `${Date.now().toString(36)}${(uidN++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function starter(): Home {
  return {
    coins: 60,
    items: [
      { uid: "s1", k: "rugRectangle", x: 2.25, z: 2.6, r: 0 },
      { uid: "s2", k: "loungeSofa", x: 2.25, z: 3.6, r: 2 },
      { uid: "s3", k: "tableCoffee", x: 2.25, z: 2.6, r: 0 },
      { uid: "s4", k: "pottedPlant", x: 0.4, z: 0.4, r: 0 },
      { uid: "s5", k: "lampRoundFloor", x: 3.5, z: 3.8, r: 0 },
      { uid: "s6", k: "cabinetTelevision", x: 2.25, z: 0.35, r: 0 },
      { uid: "s7", k: "televisionModern", x: 2.25, z: 0.35, r: 0 },
    ],
    inv: [],
    wall: "creme",
    floor: "carvalho",
    styles: ["creme", "carvalho"],
    avatars: { gu: "male-a", li: "female-a" },
    pet: null,
    pets: [],
    day: today(),
    missions: {},
    prog: { pet: {}, decor: {} },
    bonus: false,
    log: [],
    frames: [],
  };
}

export function normalize(raw: Partial<Home> | null | undefined): Home {
  const s = starter();
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.items)) return s;
  const h: Home = { ...s, ...raw, frames: Array.isArray(raw.frames) ? raw.frames : [], avatars: { ...s.avatars, ...(raw.avatars ?? {}) }, prog: { pet: {}, decor: {}, ...(raw.prog ?? {}) } };
  h.pets = Array.isArray(raw.pets) ? raw.pets : raw.pet ? [raw.pet] : [];
  h.pet = h.pets[0] ?? null;
  if (h.day !== today()) {
    h.day = today();
    h.missions = {};
    h.prog = { pet: {}, decor: {} };
    h.bonus = false;
  }
  return h;
}

export const name = (w: Who) => (w === "gu" ? "bb gu" : "bb li");

function note(h: Home, text: string) {
  h.log = [{ t: Date.now(), text }, ...h.log].slice(0, 20);
}

/** Marca missões e paga recompensas. Retorna true se mudou algo. */
export function checkMissions(
  h: Home,
  ctx: { bothOnline: boolean; togetherS: number; bothSitting: boolean },
): boolean {
  let changed = false;
  const done = (id: MissionId) => {
    if (h.missions[id]) return;
    h.missions[id] = true;
    const m = MISSIONS.find((x) => x.id === id)!;
    h.coins += m.reward;
    note(h, `Missão "${m.title}" concluída: +${m.reward} corações`);
    changed = true;
  };
  if (ctx.bothOnline) done("juntos");
  if (ctx.togetherS >= TOGETHER_GOAL) done("tempo");
  if (ctx.bothSitting) done("sentar");
  if (h.prog.pet.gu && h.prog.pet.li) done("pet");
  if (h.prog.decor.gu && h.prog.decor.li) done("decor");
  if (!h.bonus && MISSIONS.every((m) => h.missions[m.id])) {
    h.bonus = true;
    h.coins += BONUS;
    note(h, `Todas as missões do dia! +${BONUS} corações`);
    changed = true;
  }
  return changed;
}

export type HomeAction =
  | { t: "buy"; key: string }
  | { t: "place"; key: string; x: number; z: number; r: number; room?: number }
  | { t: "move"; uid: string; x: number; z: number; r: number; room?: number }
  | { t: "store"; uid: string }
  | { t: "style"; kind: "wall" | "floor"; id: string }
  | { t: "avatar"; model: string }
  | { t: "look"; look: unknown }
  | { t: "adopt"; kind: string; name: string }
  | { t: "feed"; i?: number }
  | { t: "pat"; i?: number }
  | { t: "frame"; i: number; path: string | null };

const clampPos = (v: number) => Math.max(0.2, Math.min(ROOM - 0.2, Math.round(v * 4) / 4));
const clampRoom = (r: number | undefined) => (r === 1 || r === 2 || r === 3 ? r : 0);

export function applyHome(h: Home, who: Who, a: HomeAction, otherOnline: boolean): string {
  switch (a.t) {
    case "buy": {
      const c = CAT_BY_KEY[a.key];
      if (!c) throw new Error("Item inválido");
      if (h.coins < c.price) throw new Error("Corações insuficientes");
      h.coins -= c.price;
      h.inv.push(c.key);
      note(h, `${name(who)} comprou ${c.name}`);
      return `${c.name} foi pra caixa de itens`;
    }
    case "place": {
      const i = h.inv.indexOf(a.key);
      if (i < 0) throw new Error("Item não está na caixa");
      h.inv.splice(i, 1);
      h.items.push({ uid: uid(), k: a.key, x: clampPos(a.x), z: clampPos(a.z), r: ((a.r % 4) + 4) % 4, room: clampRoom(a.room) });
      if (otherOnline) h.prog.decor[who] = true;
      return "";
    }
    case "move": {
      const it = h.items.find((x) => x.uid === a.uid);
      if (!it) throw new Error("Item não encontrado");
      it.x = clampPos(a.x);
      it.z = clampPos(a.z);
      it.r = ((a.r % 4) + 4) % 4;
      if (a.room !== undefined) it.room = clampRoom(a.room);
      if (otherOnline) h.prog.decor[who] = true;
      return "";
    }
    case "store": {
      const i = h.items.findIndex((x) => x.uid === a.uid);
      if (i < 0) throw new Error("Item não encontrado");
      h.inv.push(h.items[i].k);
      h.items.splice(i, 1);
      return "Guardado na caixa";
    }
    case "style": {
      const list = a.kind === "wall" ? WALLS : FLOORS;
      const s = list.find((x) => x.id === a.id);
      if (!s) throw new Error("Estilo inválido");
      if (!h.styles.includes(s.id)) {
        if (h.coins < s.price) throw new Error("Corações insuficientes");
        h.coins -= s.price;
        h.styles.push(s.id);
      }
      if (a.kind === "wall") h.wall = s.id;
      else h.floor = s.id;
      return "";
    }
    case "look": {
      h.looks = { ...(h.looks ?? {}), [who]: sanitizeLook(a.look, who) };
      return "";
    }
    case "avatar": {
      if (!CHARACTERS.includes(a.model)) throw new Error("Personagem inválido");
      h.avatars[who] = a.model;
      return "";
    }
    case "adopt": {
      if (h.pets.length >= MAX_PETS) throw new Error(`Máximo de ${MAX_PETS} pets`);
      if (!PETS.some((p) => p.kind === a.kind)) throw new Error("Pet inválido");
      const nm = String(a.name || "").trim().slice(0, 16) || "Bolinha";
      h.pets = [...h.pets, { kind: a.kind, name: nm, lastFed: Date.now(), lastPet: Date.now() }];
      h.pet = h.pets[0];
      note(h, `${name(who)} adotou ${nm}`);
      return `${nm} chegou em casa`;
    }
    case "feed":
    case "pat": {
      const pet = h.pets[Math.max(0, Math.floor(Number(a.i ?? 0)))];
      if (!pet) throw new Error("Sem pet");
      if (a.t === "feed") {
        if (petStats(pet).hunger > 85) throw new Error(`${pet.name} está de barriga cheia`);
        pet.lastFed = Date.now();
      } else pet.lastPet = Date.now();
      h.pet = h.pets[0];
      if (otherOnline) h.prog.pet[who] = true;
      return "";
    }
    case "frame": {
      const i = Math.floor(Number(a.i));
      if (!(i >= 0 && i < FRAME_COUNT)) throw new Error("Quadro inválido");
      if (a.path !== null && !FRAME_PATH_RE.test(String(a.path))) throw new Error("Foto inválida");
      const f = Array.isArray(h.frames) ? [...h.frames] : [];
      while (f.length < FRAME_COUNT) f.push(null);
      f[i] = a.path;
      h.frames = f;
      if (a.path) note(h, `${name(who)} pendurou uma foto num quadro`);
      return a.path ? "Foto no quadro" : "Quadro limpo";
    }
  }
}

/** fome/alegria de 0 a 100 (100 = ótimo), calculadas pelo tempo. */
export function petStats(p: Pet, now = Date.now()) {
  const hunger = Math.max(0, Math.round(100 - ((now - p.lastFed) / 3600_000) * 6));
  const joy = Math.max(0, Math.round(100 - ((now - p.lastPet) / 3600_000) * 5));
  return { hunger, joy };
}
