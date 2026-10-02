// Simulação determinística dos chutes: os dois aparelhos calculam exatamente o mesmo resultado.
export type Mode = "penalti" | "falta";
export type Dive = { x: -1 | 0 | 1; high: boolean };
export type Foot = "direita" | "esquerda";
export type Shot = {
  mode: Mode;
  sx: number; // posição da bola
  sz: number;
  tx: number; // mira no plano do gol (z = 0)
  ty: number;
  power: number; // 0..1
  curve: number; // -1..1 (efeito, já ajustado pelo pé)
  foot: Foot; // pé de batida (corrida e curva natural)
  seed: number;
  dive: Dive | null; // só no pênalti (goleiro humano)
};
export type Result = "goal" | "save" | "wall" | "miss" | "post";

export const GOAL_W = 7.32;
export const GOAL_H = 2.44;
export const BALL_R = 0.11;
export const RUN = 0.95; // corrida até o chute
export const SLOWMO = 0.45;

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type V3 = [number, number, number];

export function wallLayout(sx: number, sz: number) {
  const nearX = (sx >= 0 ? 1 : -1) * 1.7;
  const dx = nearX - sx;
  const dz = 0 - sz;
  const L = Math.hypot(dx, dz);
  const ux = dx / L;
  const uz = dz / L;
  const cx = sx + ux * 9.15;
  const cz = sz + uz * 9.15;
  const px = -uz;
  const pz = ux;
  // ~0.58m ombro a ombro, sem sobreposição
  const men: V3[] = [-1.5, -0.5, 0.5, 1.5].map((k) => [cx + px * k * 0.58, 0, cz + pz * k * 0.58]);
  return { cx, cz, ux, uz, px, pz, men, face: Math.atan2(-ux, -uz) };
}

/** Marcação determinística da falta: 18-30m do gol, ângulo variado, seeded por rodada. */
export function footSpot(seed: number, round: number) {
  const r = rng(seed * 31 + round * 977 + 7);
  const ang = (r() - 0.5) * 2 * 0.95; // até ~54° de cada lado
  const dist = 18 + r() * 12; // 18..30m
  const x = Math.sin(ang) * dist;
  const z = Math.cos(ang) * dist + 3; // soma um pouco de profundidade mínima
  return { x: +x.toFixed(2), z: +Math.max(18, Math.min(30, z)).toFixed(2) };
}

export type Solved = {
  result: Result;
  flight: number; // segundos do chute até o fim do voo principal
  end: number; // segundos até a bola parar (após RUN)
  ex: number;
  ey: number;
  keeper: { x: number; y: number; at: number; dur: number }; // alvo do mergulho
  keeperStart: number;
  wallJump: boolean;
  at: (t: number) => V3; // t = segundos desde o chute
  spin: number;
};

export function solve(s: Shot): Solved {
  const r = rng(s.seed);
  const spread = 0.1 + s.power * s.power * 0.55;
  let ex = s.tx + (r() - 0.5) * 2 * spread;
  let ey = s.ty + (r() - 0.5) * 1.4 * spread + Math.max(0, s.power - 0.84) * 7;
  ey = Math.max(BALL_R, ey);
  const dist = Math.hypot(ex - s.sx, s.sz);
  const speed = 12 + s.power * 20;
  const T = dist / speed;
  const h = s.mode === "falta" ? Math.max(0.4, dist * 0.05 * (1.2 - s.power * 0.7)) : dist * 0.02 * (1.1 - s.power);
  const dirx = (ex - s.sx) / dist;
  const dirz = (0 - s.sz) / dist;
  const perpx = -dirz;
  const perpz = dirx;
  // efeito realista: até ~1.5-2.5m de curva lateral numa cobrança de 20-25m
  const bend = s.curve * 1.3 * (dist / 20);
  const flightAt = (u: number): V3 => {
    const bx = s.sx + (ex - s.sx) * u;
    const bz = s.sz + (0 - s.sz) * u;
    const off = bend * Math.sin(Math.PI * Math.min(u, 1));
    const y = BALL_R + (ey - BALL_R) * u + h * 4 * u * (1 - u);
    return [bx + perpx * off, Math.max(BALL_R, y), bz + perpz * off];
  };

  // barreira
  let result: Result | null = null;
  let cutU = 1;
  let wallJump = false;
  if (s.mode === "falta") {
    wallJump = true;
    const w = wallLayout(s.sx, s.sz);
    for (let i = 1; i < 120; i++) {
      const u = i / 120;
      const p = flightAt(u);
      const along = (p[0] - s.sx) * w.ux + (p[2] - s.sz) * w.uz;
      if (along >= 9.15) {
        const lat = (p[0] - w.cx) * w.px + (p[2] - w.cz) * w.pz;
        if (Math.abs(lat) < 1.15 && p[1] < 2.32) {
          result = "wall";
          cutU = u;
        }
        break;
      }
    }
  }

  const ax = Math.abs(ex);
  const hitPost = (ax > 3.56 && ax < 3.8 && ey < 2.55) || (ey > 2.33 && ey < 2.58 && ax < 3.8);
  const inGoal = ax < 3.56 && ey < 2.33;

  // goleiro
  let kx = 0;
  let ky = 0.9;
  let keeperStart = 0.12;
  let kdur = 0.5;
  if (!result) {
    if (!inGoal) result = hitPost ? "post" : "miss";
    else if (s.mode === "penalti") {
      const zone = ex < -1.15 ? -1 : ex > 1.15 ? 1 : 0;
      const high = ey > 1.3;
      const d = s.dive ?? { x: 0, high: false };
      kx = d.x * 2.4;
      ky = d.high ? 1.6 : 0.55;
      let save = false;
      if (d.x === zone) {
        if (zone === 0) save = ey < 2.0 && (d.high ? true : ey < 1.5);
        else {
          const corner = ax > 3.0 && ey > 1.75;
          save = !corner && (d.high === high || Math.abs(ax - 2.3) < 0.8) && !(s.power > 0.93 && ax > 2.8);
        }
      }
      if (s.power < 0.25 && d.x === 0 && ax < 2.2) save = true;
      if (save) {
        kx = ex;
        ky = ey;
        result = "save";
      } else result = "goal";
    } else {
      const k0 = -(s.sx >= 0 ? 1 : -1) * 0.45;
      const reach = 2.3 - s.power * 0.95 - Math.abs(s.curve) * 0.4 + (r() - 0.5) * 0.6;
      const dx = ex - k0;
      const dy = ey - 1.0;
      const d = Math.hypot(dx, dy);
      keeperStart = 0.22 + Math.abs(s.curve) * 0.1;
      if (d < reach) {
        kx = ex;
        ky = ey;
        result = "save";
      } else {
        const k = Math.min(1, reach / d);
        kx = k0 + dx * k;
        ky = 1.0 + dy * k;
        result = "goal";
      }
    }
    kdur = Math.max(0.25, Math.min(0.6, T - keeperStart + 0.05));
  }

  const flight = T * cutU;
  const hit = flightAt(cutU);
  let post: (t: number) => V3;
  let tail = 1.4;
  if (result === "goal") {
    const back: V3 = [ex * 0.93, Math.max(0.3, ey * 0.75), -1.75];
    post = (t) => {
      const k = Math.min(1, t / 0.32);
      const e = 1 - (1 - k) * (1 - k);
      const p: V3 = [hit[0] + (back[0] - hit[0]) * e, hit[1] + (back[1] - hit[1]) * e, hit[2] + (back[2] - hit[2]) * e];
      if (t > 0.32) {
        const d = t - 0.32;
        p[1] = Math.max(BALL_R, back[1] - 4.9 * d * d);
        p[2] = back[2] + Math.min(d, 0.3) * 0.6;
      }
      return p;
    };
  } else if (result === "miss") {
    const vx = (ex - s.sx) / T;
    const vz = -s.sz / T;
    const vy = (ey - BALL_R) / T - h * 4 / T;
    post = (t) => [hit[0] + vx * t, Math.max(BALL_R, hit[1] + vy * t - 4.9 * t * t), hit[2] + vz * t];
  } else {
    // defesa, barreira ou trave: rebate
    const r2 = rng(s.seed + 99);
    const side = result === "wall" ? (r2() - 0.5) * 6 : (ex >= 0 ? 1 : -1) * (2 + r2() * 3);
    const out = result === "wall" ? 7 : 5 + r2() * 4;
    const up = result === "save" ? 5.5 : result === "post" ? 3 : 4;
    tail = 1.6;
    post = (t) => [hit[0] + side * t, Math.max(BALL_R, hit[1] + up * t - 9.8 * t * t * 0.5 * 1.4), hit[2] + out * t * Math.exp(-t * 0.6)];
  }
  return {
    result,
    flight,
    end: flight + tail,
    ex,
    ey,
    keeper: { x: kx, y: ky, at: keeperStart, dur: kdur },
    keeperStart,
    wallJump,
    spin: 10 + s.power * 25,
    at: (t) => (t <= 0 ? [s.sx, BALL_R, s.sz] : t < flight ? flightAt((t / T)) : post(t - flight)),
  };
}

/** Linha do tempo: ao vivo + replays (gol e defesas). Tempo em segundos desde o início. */
export function timeline(sol: Solved) {
  const live = RUN + sol.end;
  const showReplay = sol.result === "goal" || sol.result === "save" || sol.result === "post";
  // replays curtos: ~1.6s cada, foco no instante do impacto
  const repLen = 1.3;
  const span = repLen * SLOWMO; // janela de jogo coberta por replay
  const from = Math.max(RUN - 0.2, RUN + sol.flight - span * 0.55);
  const to = from + span;
  const reps = showReplay ? 2 : 0;
  return { live, from, to, repLen, reps, total: live + 0.6 + reps * repLen + 0.3 };
}

/** Converte o tempo real em tempo de jogo + qual câmera usar. */
export function sample(sol: Solved, real: number) {
  const tl = timeline(sol);
  if (real < tl.live + 0.6 || tl.reps === 0) return { t: Math.min(real, tl.live), cam: "live" as const, replay: -1 };
  const r = real - tl.live - 0.6;
  const idx = Math.min(tl.reps - 1, Math.floor(r / tl.repLen));
  const local = Math.min(tl.repLen, r - idx * tl.repLen);
  return { t: tl.from + local * SLOWMO, cam: (idx === 0 ? "side" : "goal") as "side" | "goal", replay: idx };
}

export type Kick = { who: "gu" | "li"; goal: boolean };

export function tally(kicks: Kick[], first: "gu" | "li") {
  const second = first === "gu" ? "li" : "gu";
  const a = kicks.filter((k) => k.who === first && k.goal).length;
  const b = kicks.filter((k) => k.who === second && k.goal).length;
  const n = kicks.length;
  let over = false;
  if (n <= 10) {
    const ka = Math.ceil(n / 2);
    const kb = Math.floor(n / 2);
    if (a + (5 - ka) < b || b + (5 - kb) < a) over = true;
  } else if (n % 2 === 0 && a !== b) over = true;
  if (n === 10 && a !== b) over = true;
  const score = { [first]: a, [second]: b } as Record<"gu" | "li", number>;
  const winner = over ? (a > b ? first : second) : null;
  return { score, over, winner, sudden: n >= 10 };
}
