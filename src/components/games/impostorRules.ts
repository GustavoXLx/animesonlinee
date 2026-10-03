import { CLUES, THEMES } from "./impostorData";

export type Player = "gu" | "li" | "cpu1" | "cpu2" | "cpu3" | "cpu4" | "cpu5" | "cpu6" | "cpu7" | "cpu8";
export type Me = "gu" | "li";
export type Mode = 5 | 10;
export type Phase = "lobby" | "cards" | "clues" | "vote" | "result";
export type GameState = {
  phase: Phase; mode: Mode; seed: number; round: number; turn: number;
  ready: Record<Me, boolean>; seenCard: Record<Me, boolean>;
  clues: Partial<Record<Player, string[]>>; votes: Partial<Record<Player, Player>>;
};
export const PLAYERS: Player[] = ["gu", "li", "cpu1", "cpu2", "cpu3", "cpu4", "cpu5", "cpu6", "cpu7", "cpu8"];
export const NAMES: Record<Player, string> = { gu: "BB Gu", li: "BB Li", cpu1: "Alex", cpu2: "Nina", cpu3: "Theo", cpu4: "Maya", cpu5: "Luca", cpu6: "Bia", cpu7: "Davi", cpu8: "Luna" };
export function playersFor(mode: Mode): Player[] { return PLAYERS.slice(0, mode); }
export function hash(seed: number, salt: number) { let x = (seed ^ Math.imul(salt, 0x45d9f3b)) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); return (x ^ (x >>> 16)) >>> 0; }
export function impostorsFor(seed: number, mode: Mode): Player[] {
  const pool = playersFor(mode);
  const first = hash(seed, 71) % pool.length;
  if (mode === 5) return [pool[first]];
  const second = hash(seed, 72) % (pool.length - 1);
  return [pool[first], pool[second >= first ? second + 1 : second]];
}
export function themeFor(seed: number) { return THEMES[hash(seed, 113) % THEMES.length]; }
export function wordFor(seed: number) { const theme = themeFor(seed); return theme.items[hash(seed, 991) % theme.items.length]; }
export function hintFor(seed: number) {
  const theme = themeFor(seed);
  const alternatives = theme.items.filter(item => item !== wordFor(seed));
  return `É ${theme.name.toLowerCase()}. Pode ser ${alternatives[hash(seed, 301) % alternatives.length]} ou outra opção do tema.`;
}
export function freshGame(mode: Mode = 5): GameState { return { phase: "lobby", mode, seed: 0, round: 0, turn: 0, ready: { gu: false, li: false }, seenCard: { gu: false, li: false }, clues: {}, votes: {} }; }
export function turnPlayer(state: GameState): Player | null {
  if (state.phase !== "clues" && state.phase !== "vote") return null;
  const pool = playersFor(state.mode);
  return pool[state.turn % pool.length] ?? null;
}
export function submitClue(state: GameState, player: Player, text: string): GameState {
  if (state.phase !== "clues" || turnPlayer(state) !== player || !text.trim() || text.trim().length > 100) return state;
  const clues = { ...state.clues, [player]: [...(state.clues[player] ?? []), text.trim()] };
  const nextTurn = state.turn + 1;
  const finished = nextTurn >= state.mode * 3;
  return { ...state, clues, turn: finished ? 0 : nextTurn, round: finished ? 2 : Math.floor(nextTurn / state.mode), phase: finished ? "vote" : "clues" };
}
export function submitVote(state: GameState, player: Player, target: Player): GameState {
  if (state.phase !== "vote" || turnPlayer(state) !== player || player === target || !playersFor(state.mode).includes(target) || state.votes[player]) return state;
  const votes = { ...state.votes, [player]: target };
  return { ...state, votes, turn: state.turn + 1, phase: state.turn + 1 >= state.mode ? "result" : "vote" };
}
export function tally(state: GameState) {
  const pool = playersFor(state.mode);
  const counts = Object.fromEntries(pool.map(player => [player, 0])) as Record<Player, number>;
  for (const voter of pool) { const target = state.votes[voter]; if (target && target !== voter && target in counts) counts[target]++; }
  const top = Math.max(...pool.map(player => counts[player]));
  const accused = pool.filter(player => counts[player] === top);
  const impostors = impostorsFor(state.seed, state.mode);
  // A tie cannot convict anyone. In 10-player mode both impostors must be among the two highest.
  const caught = accused.length === impostors.length && accused.every(player => impostors.includes(player));
  return { counts, accused, impostors, caught };
}
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
const EXTRA = ["É algo que pode aparecer em contextos bem diferentes", "Muita gente reconheceria isso pelo contexto", "Cada pessoa pode associar isso a uma lembrança diferente", "Tem detalhes que mudam conforme a situação", "É fácil confundir com outras coisas parecidas", "Costuma chamar atenção por um detalhe específico", "Depende muito de onde você encontra", "Pensei em uma característica discreta", "Nem sempre aparece do mesmo jeito", "Pode ser familiar mesmo sem ver de perto"];
function softened(clue: string, word: string, themeItems: string[]): string {
  let result = clue;
  for (const item of [word, ...themeItems]) result = result.replace(new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "isso");
  return result.replace(/\b(Roma|Torre Eiffel|Cristo Redentor|Big Ben|Manhattan|Nilo|Pão de Açúcar)\b/gi, "um lugar conhecido")
    .replace(/\bé a capital\b/gi, "é bastante conhecido")
    .replace(/\btem formato parecido com uma bota no mapa\b/gi, "tem uma forma reconhecível")
    .replace(/\bmaior país da América do Sul\b/gi, "bem grande")
    .replace(/\bno nordeste da África\b/gi, "numa região histórica");
}
export function cpuClue(state: GameState, player: Player): string {
  const theme = themeFor(state.seed), word = wordFor(state.seed);
  const impostor = impostorsFor(state.seed, state.mode).includes(player);
  // Impostors know only the theme and one neighboring example, never the secret word.
  const example = theme.items.filter(item => item !== word)[hash(state.seed, 301) % (theme.items.length - 1)];
  const bank = impostor ? [...(CLUES[example] ?? []), ...EXTRA] : [...(CLUES[word] ?? []), ...EXTRA];
  const used = new Set(Object.values(state.clues).flat().map(normalize));
  const offset = hash(state.seed, 1600 + state.turn * 17) % bank.length;
  for (let i = 0; i < bank.length; i++) {
    const candidate = softened(bank[(offset + i) % bank.length], word, theme.items);
    if (!used.has(normalize(candidate))) return candidate;
  }
  return `Me lembrou ${theme.name.toLowerCase()} de um jeito diferente (${state.turn + 1})`;
}
export function cpuVote(state: GameState, player: Player): Player {
  const pool = playersFor(state.mode).filter(p => p !== player);
  const word = wordFor(state.seed), expected = (CLUES[word] ?? []).map(clue => normalize(softened(clue, word, themeFor(state.seed).items)));
  const scores = pool.map(target => {
    const clues = state.clues[target] ?? [];
    const generic = clues.filter(clue => EXTRA.some(line => normalize(line) === normalize(clue))).length;
    const specificity = clues.filter(clue => expected.includes(normalize(clue))).length;
    const score = generic * 2 - specificity * 2 + (hash(state.seed, 900 + PLAYERS.indexOf(player) * 31 + PLAYERS.indexOf(target)) % 5);
    return { target, score };
  });
  scores.sort((a, b) => b.score - a.score);
  return scores[0].target;
}
