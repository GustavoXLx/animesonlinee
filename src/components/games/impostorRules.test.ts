import { describe, expect, test } from "bun:test";
import { cpuClue, freshGame, impostorsFor, playersFor, submitClue, submitVote, tally, turnPlayer, type GameState } from "./impostorRules";

describe("Impostor", () => {
  test("5 jogadores têm exatamente 1 impostor; 10 têm exatamente 2", () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(playersFor(5)).toHaveLength(5);
      expect(new Set(impostorsFor(seed, 5)).size).toBe(1);
      expect(playersFor(10)).toHaveLength(10);
      expect(new Set(impostorsFor(seed, 10)).size).toBe(2);
    }
  });
  test("cada um dá uma pista por vez em cada uma das 3 rodadas, sem repetir as CPUs", () => {
    let s: GameState = { ...freshGame(10), phase: "clues", seed: 1024 };
    const cpuLines: string[] = [];
    for (let turn = 0; turn < 30; turn++) {
      const player = turnPlayer(s);
      expect(player).not.toBeNull();
      if (!player) break;
      const text = player.startsWith("cpu") ? cpuClue(s, player) : `pista humana ${turn}`;
      if (player.startsWith("cpu")) cpuLines.push(text);
      expect(submitClue(s, player === "gu" ? "li" : "gu", text)).toBe(s);
      s = submitClue(s, player, text);
      expect(s.clues[player]).toHaveLength(Math.floor(turn / 10) + 1);
    }
    expect(new Set(cpuLines).size).toBe(cpuLines.length);
    expect(s.phase).toBe("vote");
  });
  test("todos votam exatamente uma vez, sem votar em si mesmos", () => {
    let s: GameState = { ...freshGame(5), phase: "vote", seed: 23 };
    for (let i = 0; i < 5; i++) {
      const p = turnPlayer(s);
      if (!p) break;
      expect(submitVote(s, p, p)).toBe(s);
      const target = playersFor(5).find(q => q !== p);
      if (!target) break;
      const old = s;
      s = submitVote(s, p, target);
      expect(submitVote(old, p, target)).not.toBe(old);
    }
    expect(Object.keys(s.votes)).toHaveLength(5);
    expect(s.phase).toBe("result");
  });
  test("empate não condena; no modo 10 é preciso identificar os dois", () => {
    const base = { ...freshGame(10), seed: 99, phase: "result" as const };
    const [a, b] = impostorsFor(99, 10);
    const voters = playersFor(10);
    const votes = Object.fromEntries(voters.map((p, i) => [p, p === a ? b : p === b ? a : i < 5 ? a : b]));
    expect(tally({ ...base, votes }).caught).toBe(true);
    const wrong = voters.find(p => p !== a && p !== b);
    if (!wrong) throw Error("missing innocent");
    const wrongVotes = Object.fromEntries(voters.map((p, i) => [p, p === a ? wrong : p === wrong ? a : i < 5 ? a : wrong]));
    expect(tally({ ...base, votes: wrongVotes }).caught).toBe(false);
  });
});
