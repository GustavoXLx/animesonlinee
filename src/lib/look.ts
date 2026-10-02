// Catálogo de personalização dos bonecos 3D (Nossa Casa + Desfile).
export type Look = {
  skin: string;
  hair: string;
  hairC: string;
  eyes: string;
  lips: string;
  face: string;
  top: string;
  topC: string;
  topC2: string;
  topP: string;
  bottom: string;
  botC: string;
  botP: string;
  shoes: string;
  shoeC: string;
  hat: string;
  hatC: string;
  glasses: string;
  glassC: string;
  acc: string;
  accC: string;
  hand: string;
  handC: string;
};

type Opt = { id: string; name: string };
const o = (s: string): Opt[] =>
  s.split("|").map((x) => {
    const [id, name] = x.split(":");
    return { id, name };
  });

export const HAIRS = o(
  "none:Careca|short:Curtinho|buzz:Raspado|spiky:Espetado|curly:Cacheado|bun:Coque|ponytail:Rabo de cavalo|long:Comprido|pigtails:Maria-chiquinha|afro:Black power|bob:Chanel|mohawk:Moicano|braids:Tranças|wavy:Ondulado|fringe:Franja|mullet:Mullet|space:Dois coques|sidepart:Topete|curtain:Cortina|wolf:Wolf cut",
);
export const TOPS = o(
  "none:Sem blusa|tshirt:Camiseta|long:Manga longa|tank:Regata|hoodie:Moletom|jacket:Jaqueta|crop:Cropped|blazer:Blazer|kimono:Quimono|jersey:Camisa de time|turtle:Gola alta|puffer:Puffer|corset:Corselet|tux:Smoking|sweater:Suéter|vest:Colete|bikini:Top de praia|armor:Armadura|lab:Jaleco|poncho:Poncho|leather:Jaqueta de couro|ruffle:Babados|sailor:Marinheiro|tube:Tomara que caia",
);
export const BOTTOMS = o(
  "pants:Calça|jeans:Jeans|shorts:Shorts|skirt:Saia curta|longskirt:Saia longa|dress:Vestido|gown:Vestido de gala|tutu:Tutu|mermaid:Cauda de sereia|cargo:Calça cargo|leggings:Legging|bermuda:Bermuda|flare:Boca de sino|pleated:Saia pregueada|overalls:Macacão|kilt:Kilt|balloon:Saia balonê|sweatpants:Moletom",
);
export const SHOES = o(
  "sneakers:Tênis|boots:Botas|heels:Salto alto|sandals:Sandália|slippers:Pantufas|cowboy:Bota de cowboy|platform:Plataforma|barefoot:Descalço|rollers:Patins|ballet:Sapatilha|combat:Coturno|clogs:Tamanco",
);
export const HATS = o(
  "none:Nada|cap:Boné|beanie:Gorro|tophat:Cartola|cowboy:Chapéu de cowboy|crown:Coroa|tiara:Tiara|bunny:Orelhas de coelho|cat:Orelhas de gato|bear:Orelhas de urso|devil:Chifrinhos|halo:Auréola|chef:Chapéu de chef|witch:Chapéu de bruxa|beret:Boina|viking:Elmo viking|flowers:Coroa de flores|party:Chapéu de festa|bow:Laço|headphones:Fone|unicorn:Chifre de unicórnio|antenna:Antenas|santa:Gorro de Natal|pirate:Chapéu pirata|sombrero:Sombreiro|helmet:Capacete|bucket:Bucket hat|fox:Orelhas de raposa|frog:Sapinho|astronaut:Capacete espacial",
);
export const GLASSES = o("none:Nada|round:Redondo|square:Quadrado|sun:Óculos escuros|heart:Coração|star:Estrela|visor:Viseira futurista|monocle:Monóculo|mask:Máscara de baile|ski:Óculos de esqui|cat:Gatinho");
export const ACCS = o(
  "none:Nada|angel:Asas de anjo|bat:Asas de morcego|butterfly:Asas de borboleta|fairy:Asas de fada|cape:Capa|cattail:Rabo de gato|foxtail:Rabo de raposa|dino:Espinhos de dino|backpack:Mochila|scarf:Cachecol|pearls:Colar de pérolas|bowtie:Gravata borboleta|tie:Gravata|chain:Corrente|jetpack:Jetpack|shell:Casco de tartaruga|bee:Asas de abelha|dragon:Asas de dragão|boa:Boá de plumas|sash:Faixa de miss|belt:Cinto",
);
export const HANDS = o("none:Nada|wand:Varinha|bag:Bolsa|umbrella:Guarda-chuva|bouquet:Buquê|sword:Espada|balloon:Balão de coração|fan:Leque|mic:Microfone|staff:Cajado|trident:Tridente|guitar:Guitarra|icecream:Sorvete|flag:Bandeira|lantern:Lanterna|shield:Escudo|phone:Celular|bone:Osso");
export const PATTERNS = o(
  "solid:Liso|stripes:Listras|dots:Bolinhas|plaid:Xadrez|leopard:Oncinha|zebra:Zebra|stars:Estrelas|hearts:Corações|camo:Camuflado|flowers:Flores|gradient:Degradê|glitter:Brilho|denim:Jeans|checker:Quadriculado|scales:Escamas|metal:Metálico|fur:Pelúcia|neon:Neon|tiedye:Tie-dye|cow:Vaquinha|galaxy:Galáxia|lace:Renda",
);
export const FACES = o("none:Nada|blush:Bochechas|freckles:Sardas|stars:Estrelinhas|heart:Coraçãozinho|tears:Lágrima|whiskers:Bigodinho de gato|paint:Pintura de guerra|mustache:Bigode|beard:Barba");

export const SKINS = ["#ffe0c7", "#f5d0a9", "#e8b88f", "#d39a6a", "#b5774b", "#8d5634", "#5e3a22", "#3f2616", "#c8f0c4", "#cfd8ff", "#ffd1ec", "#bfe9ff"];
export const PALETTE = [
  "#111111", "#ffffff", "#9ca3af", "#ef4444", "#f97316", "#facc15", "#84cc16", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1",
  "#a855f7", "#ec4899", "#f472b6", "#fda4af", "#7c2d12", "#a16207", "#d6b98c", "#1e3a8a", "#065f46", "#7f1d1d", "#fde68a", "#c0c0c0",
];
export const HAIR_COLORS = ["#1b1310", "#3b2416", "#6b4226", "#a0682f", "#d9a75d", "#f3d58a", "#f6f1e7", "#9ca3af", "#e11d48", "#f472b6", "#a855f7", "#3b82f6", "#22c55e", "#f97316", "#14b8a6", "#ffffff"];

export const DEFAULT_LOOKS: Record<"gu" | "li", Look> = {
  gu: {
    skin: "#f5d0a9", hair: "short", hairC: "#3b2416", eyes: "#3b2416", lips: "#c26a5a", face: "none",
    top: "hoodie", topC: "#3b82f6", topC2: "#ffffff", topP: "solid", bottom: "jeans", botC: "#1e3a8a", botP: "denim",
    shoes: "sneakers", shoeC: "#ffffff", hat: "none", hatC: "#111111", glasses: "none", glassC: "#111111", acc: "none", accC: "#ffffff", hand: "none", handC: "#f472b6",
  },
  li: {
    skin: "#f5d0a9", hair: "long", hairC: "#6b4226", eyes: "#3b2416", lips: "#e11d48", face: "blush",
    top: "crop", topC: "#f472b6", topC2: "#ffffff", topP: "solid", bottom: "skirt", botC: "#ffffff", botP: "solid",
    shoes: "sneakers", shoeC: "#ffffff", hat: "bow", hatC: "#ec4899", glasses: "none", glassC: "#111111", acc: "none", accC: "#ffffff", hand: "none", handC: "#f472b6",
  },
};

const HEX = /^#[0-9a-f]{6}$/i;
const LISTS: Partial<Record<keyof Look, Opt[]>> = {
  hair: HAIRS, top: TOPS, bottom: BOTTOMS, shoes: SHOES, hat: HATS, glasses: GLASSES, acc: ACCS, hand: HANDS, topP: PATTERNS, botP: PATTERNS, face: FACES,
};

export function sanitizeLook(raw: unknown, who: "gu" | "li" = "gu"): Look {
  const base = DEFAULT_LOOKS[who];
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...base };
  (Object.keys(base) as (keyof Look)[]).forEach((k) => {
    const v = r[k];
    if (typeof v !== "string") return;
    const list = LISTS[k];
    if (list) {
      if (list.some((x) => x.id === v)) out[k] = v;
    } else if (HEX.test(v)) out[k] = v.toLowerCase();
  });
  return out;
}

export function randomLook(seed = Math.random()): Look {
  let s = Math.floor(seed * 1e9) || 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  return {
    skin: pick(SKINS.slice(0, 8)), hair: pick(HAIRS).id, hairC: pick(HAIR_COLORS), eyes: pick(["#3b2416", "#1e3a8a", "#065f46", "#111111"]), lips: pick(["#c26a5a", "#e11d48", "#be185d", "#7c2d12"]),
    face: rnd() < 0.6 ? "none" : pick(FACES).id, top: pick(TOPS.slice(1)).id, topC: pick(PALETTE), topC2: pick(PALETTE), topP: rnd() < 0.5 ? "solid" : pick(PATTERNS).id,
    bottom: pick(BOTTOMS).id, botC: pick(PALETTE), botP: rnd() < 0.6 ? "solid" : pick(PATTERNS).id, shoes: pick(SHOES).id, shoeC: pick(PALETTE),
    hat: rnd() < 0.5 ? "none" : pick(HATS).id, hatC: pick(PALETTE), glasses: rnd() < 0.7 ? "none" : pick(GLASSES).id, glassC: pick(PALETTE),
    acc: rnd() < 0.5 ? "none" : pick(ACCS).id, accC: pick(PALETTE), hand: rnd() < 0.6 ? "none" : pick(HANDS).id, handC: pick(PALETTE),
  };
}

const nm = (list: Opt[], id: string) => list.find((x) => x.id === id)?.name ?? id;
const COLOR_NAMES: [string, string][] = [
  ["#111111", "preto"], ["#ffffff", "branco"], ["#9ca3af", "cinza"], ["#ef4444", "vermelho"], ["#f97316", "laranja"], ["#facc15", "amarelo"], ["#84cc16", "verde-limão"],
  ["#22c55e", "verde"], ["#14b8a6", "verde-água"], ["#06b6d4", "ciano"], ["#3b82f6", "azul"], ["#6366f1", "anil"], ["#a855f7", "roxo"], ["#ec4899", "pink"],
  ["#f472b6", "rosa"], ["#fda4af", "rosa-claro"], ["#7c2d12", "marrom"], ["#a16207", "caramelo"], ["#d6b98c", "bege"], ["#1e3a8a", "azul-marinho"],
  ["#065f46", "verde-musgo"], ["#7f1d1d", "vinho"], ["#fde68a", "creme"], ["#c0c0c0", "prata"], ["#3b2416", "castanho"], ["#6b4226", "castanho-claro"],
  ["#1b1310", "preto"], ["#d9a75d", "loiro escuro"], ["#f3d58a", "loiro"], ["#f6f1e7", "platinado"], ["#e11d48", "carmim"],
];
export function colorName(hex: string) {
  const h = hex.toLowerCase();
  const p = (x: string) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
  const [r, g, b] = p(h);
  let best = "colorido";
  let bd = 1e9;
  COLOR_NAMES.forEach(([c, n]) => {
    const [R, G, B] = p(c);
    const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2;
    if (d < bd) {
      bd = d;
      best = n;
    }
  });
  return best;
}

/** Descrição em texto para a IA julgar. */
export function describeLook(l: Look) {
  const parts: string[] = [];
  const pat = (p: string) => (p === "solid" ? "" : ` estampa ${nm(PATTERNS, p).toLowerCase()}`);
  if (l.top !== "none") parts.push(`${nm(TOPS, l.top)} ${colorName(l.topC)}${pat(l.topP)} com detalhes ${colorName(l.topC2)}`);
  parts.push(`${nm(BOTTOMS, l.bottom)} ${colorName(l.botC)}${pat(l.botP)}`);
  if (l.bottom !== "mermaid") parts.push(`${nm(SHOES, l.shoes)} ${colorName(l.shoeC)}`);
  parts.push(`cabelo ${nm(HAIRS, l.hair).toLowerCase()} ${colorName(l.hairC)}`);
  if (l.hat !== "none") parts.push(`${nm(HATS, l.hat)} ${colorName(l.hatC)}`);
  if (l.glasses !== "none") parts.push(`óculos ${nm(GLASSES, l.glasses).toLowerCase()} ${colorName(l.glassC)}`);
  if (l.acc !== "none") parts.push(`${nm(ACCS, l.acc)} ${colorName(l.accC)}`);
  if (l.hand !== "none") parts.push(`segurando ${nm(HANDS, l.hand).toLowerCase()} ${colorName(l.handC)}`);
  if (l.face !== "none") parts.push(`rosto: ${nm(FACES, l.face).toLowerCase()}`);
  parts.push(`pele ${colorName(l.skin)}`);
  return parts.join("; ");
}
