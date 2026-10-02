import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Look } from "@/lib/look";

/**
 * Boneco 3D articulado e procedural (sem arquivos): quadril, coluna, ombros,
 * cotovelos, joelhos, pescoço e cabeça animados por código.
 * Altura ~1 unidade. Animações: idle, walk, catwalk, sit, wave, jump, no, pose0..3, cheer.
 */
export type DollAnim = { name: string; t0?: number; speed?: number };

/* ---------------- materiais (cache global) ---------------- */
const matCache = new Map<string, THREE.Material>();
const texCache = new Map<string, THREE.Texture>();

function patternTex(p: string, c1: string, c2: string) {
  const key = `${p}|${c1}|${c2}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const S = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  g.fillStyle = c1;
  g.fillRect(0, 0, S, S);
  const rnd = (() => {
    let s = 7;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();
  g.fillStyle = c2;
  g.strokeStyle = c2;
  const star = (x: number, y: number, r: number) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.fill();
  };
  const heart = (x: number, y: number, r: number) => {
    g.beginPath();
    g.moveTo(x, y + r * 0.9);
    g.bezierCurveTo(x - r * 1.4, y - r * 0.2, x - r * 0.5, y - r * 1.2, x, y - r * 0.35);
    g.bezierCurveTo(x + r * 0.5, y - r * 1.2, x + r * 1.4, y - r * 0.2, x, y + r * 0.9);
    g.fill();
  };
  switch (p) {
    case "stripes":
      for (let i = 0; i < 8; i += 2) g.fillRect(0, (i * S) / 8, S, S / 8);
      break;
    case "dots":
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        g.beginPath();
        g.arc(x * 32 + 16 + (y % 2) * 16, y * 32 + 16, 7, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case "plaid":
      g.globalAlpha = 0.55;
      for (let i = 0; i < 4; i++) {
        g.fillRect(i * 32 + 8, 0, 10, S);
        g.fillRect(0, i * 32 + 8, S, 10);
      }
      g.globalAlpha = 1;
      g.fillStyle = "rgba(255,255,255,0.35)";
      for (let i = 0; i < 4; i++) {
        g.fillRect(i * 32 + 24, 0, 2, S);
        g.fillRect(0, i * 32 + 24, S, 2);
      }
      break;
    case "checker":
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect(x * 16, y * 16, 16, 16);
      break;
    case "leopard":
      for (let i = 0; i < 22; i++) {
        const x = rnd() * S;
        const y = rnd() * S;
        g.fillStyle = c2;
        g.beginPath();
        g.ellipse(x, y, 7, 5, rnd() * 3, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#2a1a0c";
        g.lineWidth = 2.5;
        g.strokeStyle = "#2a1a0c";
        g.beginPath();
        g.arc(x, y, 8, rnd() * 3, rnd() * 3 + 3.5);
        g.stroke();
      }
      break;
    case "zebra":
      g.lineWidth = 7;
      for (let i = 0; i < 9; i++) {
        g.beginPath();
        g.moveTo(-10, i * 16);
        g.bezierCurveTo(40, i * 16 - 14, 80, i * 16 + 14, 140, i * 16 - 4);
        g.stroke();
      }
      break;
    case "cow":
      for (let i = 0; i < 7; i++) {
        g.beginPath();
        g.ellipse(rnd() * S, rnd() * S, 10 + rnd() * 12, 8 + rnd() * 10, rnd() * 3, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case "stars":
      for (let i = 0; i < 9; i++) star((i % 3) * 44 + 20 + ((i / 3) | 0) % 2 * 10, ((i / 3) | 0) * 44 + 20, 9);
      break;
    case "hearts":
      for (let i = 0; i < 9; i++) heart((i % 3) * 44 + 22 + (((i / 3) | 0) % 2) * 10, ((i / 3) | 0) * 44 + 22, 9);
      break;
    case "camo":
      ["#4b5320", "#2f3b1c", "#7a6a40", c2].forEach((c) => {
        g.fillStyle = c;
        for (let i = 0; i < 8; i++) {
          g.beginPath();
          g.ellipse(rnd() * S, rnd() * S, 10 + rnd() * 16, 7 + rnd() * 10, rnd() * 3, 0, Math.PI * 2);
          g.fill();
        }
      });
      break;
    case "flowers":
      for (let i = 0; i < 8; i++) {
        const x = rnd() * S;
        const y = rnd() * S;
        g.fillStyle = c2;
        for (let k = 0; k < 5; k++) {
          g.beginPath();
          g.arc(x + Math.cos((k / 5) * 6.28) * 6, y + Math.sin((k / 5) * 6.28) * 6, 5, 0, 6.28);
          g.fill();
        }
        g.fillStyle = "#facc15";
        g.beginPath();
        g.arc(x, y, 3.5, 0, 6.28);
        g.fill();
      }
      break;
    case "gradient": {
      const gr = g.createLinearGradient(0, 0, 0, S);
      gr.addColorStop(0, c1);
      gr.addColorStop(1, c2);
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
      break;
    }
    case "tiedye": {
      for (let r = 90; r > 0; r -= 12) {
        g.fillStyle = (r / 12) % 2 ? c1 : c2;
        g.beginPath();
        g.arc(64, 64, r, 0, 6.28);
        g.fill();
      }
      break;
    }
    case "galaxy": {
      g.fillStyle = "#120a2a";
      g.fillRect(0, 0, S, S);
      const gr = g.createRadialGradient(50, 60, 5, 64, 64, 80);
      gr.addColorStop(0, c1);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
      g.fillStyle = "#fff";
      for (let i = 0; i < 40; i++) g.fillRect(rnd() * S, rnd() * S, 1.5, 1.5);
      break;
    }
    case "denim":
      g.strokeStyle = "rgba(255,255,255,0.12)";
      g.lineWidth = 1;
      for (let i = -S; i < S; i += 4) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + S, S);
        g.stroke();
      }
      g.strokeStyle = "rgba(250,204,21,0.6)";
      g.setLineDash([4, 3]);
      g.strokeRect(4, 4, S - 8, S - 8);
      break;
    case "scales":
      g.lineWidth = 2;
      for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
        g.beginPath();
        g.arc(x * 16 + (y % 2) * 8, y * 14, 9, 0, Math.PI);
        g.stroke();
      }
      break;
    case "glitter":
      for (let i = 0; i < 260; i++) {
        g.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.8)" : c2;
        g.fillRect(rnd() * S, rnd() * S, 2, 2);
      }
      break;
    case "fur":
      for (let i = 0; i < 500; i++) {
        g.strokeStyle = rnd() < 0.5 ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)";
        const x = rnd() * S;
        const y = rnd() * S;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + rnd() * 4 - 2, y + 5);
        g.stroke();
      }
      break;
    case "lace":
      g.lineWidth = 1.5;
      for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
        g.beginPath();
        g.arc(x * 28 + 14, y * 28 + 14, 10, 0, 6.28);
        g.stroke();
        g.beginPath();
        g.arc(x * 28 + 14, y * 28 + 14, 4, 0, 6.28);
        g.stroke();
      }
      break;
    case "neon":
      g.lineWidth = 6;
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.moveTo(0, i * 32 + 16);
        for (let x = 0; x <= S; x += 16) g.lineTo(x, i * 32 + 16 + (x / 16) % 2 * 12 - 6);
        g.stroke();
      }
      break;
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  texCache.set(key, t);
  return t;
}

function fabricNoiseTex() {
  const key = "fabricNoise";
  const hit = texCache.get(key);
  if (hit) return hit;
  const S = 64;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  const id = g.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const v = 145 + Math.random() * 100;
    id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v;
    id.data[i * 4 + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  texCache.set(key, t);
  return t;
}

export type Finish = "matte" | "satin" | "leather" | "knit";
export function mat(color: string, pattern = "solid", c2 = "#ffffff", finish: Finish = "matte"): THREE.Material {
  const key = `${color}|${pattern}|${c2}|${finish}`;
  const hit = matCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({ color: pattern === "solid" || pattern === "metal" || pattern === "neon" ? color : "#ffffff", roughness: 0.8 });
  if (pattern !== "solid" && pattern !== "metal") m.map = patternTex(pattern, color, c2);
  if (pattern !== "metal" && pattern !== "neon") m.roughnessMap = fabricNoiseTex();
  if (finish === "satin") {
    m.roughness = 0.28;
    m.metalness = 0.12;
    m.envMapIntensity = 1.3;
  } else if (finish === "leather") {
    m.roughness = 0.35;
    m.metalness = 0.08;
    m.envMapIntensity = 1.1;
  } else if (finish === "knit") {
    m.roughness = 0.95;
  }
  if (pattern === "metal") {
    m.metalness = 0.85;
    m.roughness = 0.22;
  }
  if (pattern === "glitter") {
    m.metalness = 0.55;
    m.roughness = 0.3;
  }
  if (pattern === "neon") {
    m.map = patternTex("neon", color, c2);
    m.color.set("#ffffff");
    m.emissive.set(c2);
    m.emissiveIntensity = 0.35;
  }
  if (pattern === "denim") m.roughness = 0.88;
  matCache.set(key, m);
  return m;
}
function skinMat(color: string): THREE.Material {
  const key = `skin|${color}`;
  const hit = matCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.52, metalness: 0.02 });
  matCache.set(key, m);
  return m;
}
const special = (key: string, make: () => THREE.Material) => {
  const hit = matCache.get(key);
  if (hit) return hit;
  const m = make();
  matCache.set(key, m);
  return m;
};
const glow = (c: string) => special("glow" + c, () => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2 }));
const glass = (c: string, op = 0.35) => special("glass" + c + op, () => new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: op, roughness: 0.05, metalness: 0.3, depthWrite: false }));
const gold = () => special("gold", () => new THREE.MeshStandardMaterial({ color: "#facc15", metalness: 0.9, roughness: 0.25 }));
const BLACK = () => mat("#111111");
const WHITE = () => mat("#ffffff");

/* ---------------- geometrias compartilhadas ---------------- */
const geoCache = new Map<string, THREE.BufferGeometry>();
function geo(key: string, make: () => THREE.BufferGeometry) {
  const hit = geoCache.get(key);
  if (hit) return hit;
  const g = make();
  geoCache.set(key, g);
  return g;
}
const sph = (r: number, ws = 18, hs = 14) => geo(`s${r}${ws}`, () => new THREE.SphereGeometry(r, ws, hs));
const cap = (r: number, l: number) => geo(`c${r}:${l}`, () => new THREE.CapsuleGeometry(r, l, 8, 14));
const cyl = (a: number, b: number, h: number, s = 16, open = false) => geo(`y${a}:${b}:${h}:${s}:${open}`, () => new THREE.CylinderGeometry(a, b, h, s, 1, open));
const box = (x: number, y: number, z: number) => geo(`b${x}:${y}:${z}`, () => new THREE.BoxGeometry(x, y, z));
const cone = (r: number, h: number, s = 14) => geo(`k${r}:${h}:${s}`, () => new THREE.ConeGeometry(r, h, s));
const tor = (r: number, t: number, arc = Math.PI * 2, rs = 10, ts = 24) => geo(`t${r}:${t}:${arc}:${rs}:${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));
const capSph = (r: number, theta: number) => geo(`h${r}:${theta}`, () => new THREE.SphereGeometry(r, 24, 16, 0, Math.PI * 2, 0, theta));
const shapeGeo = (key: string, draw: (s: THREE.Shape) => void, depth = 0.01) =>
  geo(`sh${key}${depth}`, () => {
    const s = new THREE.Shape();
    draw(s);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 });
    g.center();
    return g;
  });
const heartShape = (s: THREE.Shape) => {
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.9, 0.1, -0.5, 0.75, 0, 0.3);
  s.bezierCurveTo(0.5, 0.75, 0.9, 0.1, 0, -0.5);
};
const starShape = (s: THREE.Shape) => {
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.22 : 0.5;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
};
const wingShape = (kind: string) => (s: THREE.Shape) => {
  if (kind === "bat" || kind === "dragon") {
    s.moveTo(0, 0);
    s.lineTo(0.5, 0.35);
    s.lineTo(0.62, 0.05);
    s.quadraticCurveTo(0.5, 0, 0.45, -0.12);
    s.quadraticCurveTo(0.35, -0.05, 0.28, -0.18);
    s.quadraticCurveTo(0.18, -0.05, 0, -0.1);
  } else if (kind === "butterfly" || kind === "fairy") {
    s.moveTo(0, 0);
    s.bezierCurveTo(0.2, 0.55, 0.65, 0.5, 0.5, 0.1);
    s.bezierCurveTo(0.6, -0.1, 0.4, -0.45, 0, -0.08);
  } else if (kind === "bee") {
    s.ellipse?.(0.2, 0.05, 0.22, 0.12, 0, Math.PI * 2, false, 0.3);
  } else {
    // anjo
    s.moveTo(0, 0);
    s.bezierCurveTo(0.15, 0.4, 0.55, 0.45, 0.62, 0.2);
    s.bezierCurveTo(0.55, 0.05, 0.45, -0.1, 0.4, -0.25);
    s.bezierCurveTo(0.3, -0.15, 0.15, -0.2, 0, -0.08);
  }
};

/* ---------------- tabelas ---------------- */
const SLEEVES: Record<string, number> = {
  tshirt: 1, jersey: 1, sailor: 1, ruffle: 1, poncho: 1,
  long: 2, hoodie: 2, jacket: 2, blazer: 2, turtle: 2, puffer: 2, tux: 2, sweater: 2, armor: 2, lab: 2, leather: 2, kimono: 2,
};
const BARE_BELLY = new Set(["crop", "bikini", "none"]);
const FULL_PANTS = new Set(["pants", "jeans", "cargo", "leggings", "flare", "sweatpants", "overalls"]);
const SHORT_PANTS = new Set(["shorts", "bermuda"]);
const TALL_SHOES = new Set(["boots", "cowboy", "combat"]);
const SATIN_TOPS = new Set(["tux", "gown", "corset", "kimono", "ruffle", "sailor", "tube", "tank"]);
const LEATHER_TOPS = new Set(["leather", "jacket", "vest"]);
const KNIT_TOPS = new Set(["sweater", "hoodie", "poncho"]);
function topFinish(t: string): Finish {
  if (SATIN_TOPS.has(t)) return "satin";
  if (LEATHER_TOPS.has(t)) return "leather";
  if (KNIT_TOPS.has(t)) return "knit";
  return "matte";
}
const SATIN_BOTTOMS = new Set(["gown", "dress", "longskirt", "tutu", "mermaid"]);
function bottomFinish(b: string): Finish {
  if (SATIN_BOTTOMS.has(b)) return "satin";
  if (b === "sweatpants") return "knit";
  return "matte";
}
const LEATHER_SHOES = new Set(["boots", "cowboy", "combat", "heels", "platform", "clogs"]);
function shoeFinish(sh: string): Finish {
  return LEATHER_SHOES.has(sh) ? "leather" : "matte";
}

const R = 0.14; // raio da cabeça

/* ---------------- partes ---------------- */
function Hair({ l }: { l: Look }) {
  const m = mat(l.hairC, "solid");
  const base = (theta = 1.75, tilt = -0.42, rr = 1.07) => <mesh geometry={capSph(R * rr, theta)} material={m} rotation={[tilt, 0, 0]} />;
  switch (l.hair) {
    case "none":
      return null;
    case "buzz":
      return base(1.55, -0.35, 1.02);
    case "short":
      return (
        <>
          {base()}
          <mesh geometry={sph(0.05)} material={m} position={[0.05, 0.11, 0.07]} scale={[1.4, 0.6, 1]} />
        </>
      );
    case "spiky":
      return (
        <>
          {base()}
          {[...Array(8)].map((_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return <mesh key={i} geometry={cone(0.035, 0.1, 6)} material={m} position={[Math.cos(a) * 0.08, 0.12, Math.sin(a) * 0.08 - 0.01]} rotation={[Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7]} />;
          })}
        </>
      );
    case "curly":
    case "afro": {
      const big = l.hair === "afro";
      const n = big ? 34 : 26;
      return (
        <>
          {base(1.8)}
          {[...Array(n)].map((_, i) => {
            const phi = Math.acos(1 - (i + 0.5) / n * (big ? 1.25 : 1.05));
            const th = i * 2.399;
            const rr = R * (big ? 1.32 : 1.08);
            const p: [number, number, number] = [Math.sin(phi) * Math.cos(th) * rr, Math.cos(phi) * rr + (big ? 0.03 : 0), Math.sin(phi) * Math.sin(th) * rr - 0.02];
            if (p[2] > 0.08 && p[1] < 0.07) return null;
            return <mesh key={i} geometry={sph(big ? 0.06 : 0.042, 10, 8)} material={m} position={p} />;
          })}
        </>
      );
    }
    case "bun":
      return (
        <>
          {base()}
          <mesh geometry={sph(0.065)} material={m} position={[0, 0.16, -0.05]} />
        </>
      );
    case "space":
      return (
        <>
          {base()}
          <mesh geometry={sph(0.055)} material={m} position={[-0.1, 0.13, -0.02]} />
          <mesh geometry={sph(0.055)} material={m} position={[0.1, 0.13, -0.02]} />
        </>
      );
    case "ponytail":
      return (
        <>
          {base()}
          <mesh geometry={sph(0.03)} material={mat("#ec4899")} position={[0, 0.06, -0.15]} />
          <mesh geometry={cap(0.045, 0.2)} material={m} position={[0, -0.04, -0.19]} rotation={[0.35, 0, 0]} />
        </>
      );
    case "long":
    case "wavy":
      return (
        <>
          {base(1.9)}
          <mesh geometry={box(0.27, 0.34, 0.08)} material={m} position={[0, -0.1, -0.1]} />
          <mesh geometry={cap(0.035, 0.2)} material={m} position={[-0.125, -0.07, 0.02]} />
          <mesh geometry={cap(0.035, 0.2)} material={m} position={[0.125, -0.07, 0.02]} />
          {l.hair === "wavy" && [...Array(6)].map((_, i) => <mesh key={i} geometry={sph(0.04, 10, 8)} material={m} position={[-0.12 + i * 0.048, -0.27, -0.09]} />)}
        </>
      );
    case "pigtails":
      return (
        <>
          {base()}
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh geometry={sph(0.025)} material={mat("#facc15")} position={[s * 0.14, 0.03, -0.04]} />
              <mesh geometry={cap(0.045, 0.12)} material={m} position={[s * 0.18, -0.04, -0.05]} rotation={[0, 0, s * 0.4]} />
            </group>
          ))}
        </>
      );
    case "bob":
      return <mesh geometry={capSph(R * 1.12, 2.15)} material={m} rotation={[-0.38, 0, 0]} />;
    case "mohawk":
      return (
        <>
          {base(1.4, -0.3, 1.0)}
          {[...Array(6)].map((_, i) => (
            <mesh key={i} geometry={box(0.03, 0.09, 0.04)} material={m} position={[0, 0.15 + Math.sin((i / 5) * Math.PI) * 0.02, 0.09 - i * 0.04]} rotation={[-0.5 + i * 0.25, 0, 0]} />
          ))}
        </>
      );
    case "braids":
      return (
        <>
          {base()}
          {[-1, 1].map((s) => (
            <group key={s}>
              {[0, 1, 2, 3].map((i) => (
                <mesh key={i} geometry={sph(0.032, 10, 8)} material={m} position={[s * 0.12, -0.05 - i * 0.055, 0.0 - i * 0.005]} />
              ))}
            </group>
          ))}
        </>
      );
    case "fringe":
      return (
        <>
          {base(1.8, -0.1, 1.07)}
          <mesh geometry={box(0.22, 0.12, 0.08)} material={m} position={[0, -0.12, -0.1]} />
        </>
      );
    case "mullet":
      return (
        <>
          {base()}
          <mesh geometry={box(0.2, 0.18, 0.07)} material={m} position={[0, -0.07, -0.12]} />
        </>
      );
    case "sidepart":
      return (
        <>
          {base()}
          <mesh geometry={sph(0.08)} material={m} position={[-0.04, 0.12, 0.07]} scale={[1.5, 0.6, 0.9]} rotation={[0, 0, 0.3]} />
        </>
      );
    case "curtain":
      return (
        <>
          {base(1.9)}
          {[-1, 1].map((s) => <mesh key={s} geometry={cap(0.03, 0.1)} material={m} position={[s * 0.09, 0.02, 0.11]} rotation={[0, 0, s * 0.5]} />)}
          <mesh geometry={box(0.24, 0.16, 0.07)} material={m} position={[0, -0.06, -0.11]} />
        </>
      );
    case "wolf":
      return (
        <>
          {base(1.85)}
          {[...Array(7)].map((_, i) => (
            <mesh key={i} geometry={cone(0.035, 0.12, 5)} material={m} position={[-0.11 + i * 0.037, -0.1, -0.11]} rotation={[Math.PI - 0.3, 0, 0]} />
          ))}
        </>
      );
    default:
      return base();
  }
}

function Face({ l }: { l: Look }) {
  const z = R * 0.93;
  const skin = skinMat(l.skin);
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.052, 0.0, z]}>
          <mesh geometry={sph(0.026, 14, 10)} material={WHITE()} scale={[1, 1.15, 0.45]} />
          <mesh geometry={sph(0.019, 12, 10)} material={mat(l.eyes)} position={[0, -0.002, 0.008]} scale={[1, 1.15, 0.45]} />
          <mesh geometry={sph(0.007, 8, 6)} material={WHITE()} position={[0.006, 0.008, 0.016]} />
          <mesh geometry={box(0.04, 0.009, 0.01)} material={mat(l.hairC)} position={[0, 0.045, -0.005]} rotation={[0, 0, s * -0.12]} />
        </group>
      ))}
      <mesh geometry={tor(0.022, 0.006, Math.PI, 6, 12)} material={mat(l.lips)} position={[0, -0.058, z - 0.002]} rotation={[0, 0, Math.PI]} />
      <mesh geometry={sph(0.012, 8, 6)} material={skin} position={[0, -0.022, z + 0.012]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={sph(0.03, 10, 8)} material={skin} position={[s * R * 0.98, -0.01, 0]} scale={[0.5, 1, 0.8]} />
      ))}
      {l.face === "blush" && [-1, 1].map((s) => <mesh key={s} geometry={sph(0.022, 10, 8)} material={glass("#f472b6", 0.55)} position={[s * 0.075, -0.04, z - 0.01]} scale={[1, 0.6, 0.3]} />)}
      {l.face === "freckles" && [-1, 1].flatMap((s) => [0, 1, 2].map((i) => <mesh key={s + ":" + i} geometry={sph(0.004, 6, 4)} material={mat("#8d5634")} position={[s * (0.06 + i * 0.012), -0.035 + (i % 2) * 0.008, z + 0.002]} />))}
      {l.face === "stars" && <mesh geometry={shapeGeo("star", starShape)} material={glow("#facc15")} position={[0.08, -0.04, z]} scale={0.035} />}
      {l.face === "heart" && <mesh geometry={shapeGeo("heart", heartShape)} material={mat("#ef4444")} position={[-0.08, -0.04, z]} scale={0.035} />}
      {l.face === "tears" && <mesh geometry={sph(0.01, 8, 6)} material={glass("#60a5fa", 0.8)} position={[0.05, -0.035, z + 0.01]} scale={[1, 1.6, 0.6]} />}
      {l.face === "whiskers" && [-1, 1].flatMap((s) => [-1, 1].map((k) => <mesh key={s + ":" + k} geometry={box(0.05, 0.003, 0.003)} material={BLACK()} position={[s * 0.07, -0.03 + k * 0.008, z + 0.005]} rotation={[0, 0, s * k * 0.15]} />))}
      {l.face === "paint" && [-1, 1].map((s) => <mesh key={s} geometry={box(0.04, 0.008, 0.01)} material={mat("#ef4444")} position={[s * 0.07, -0.03, z]} />)}
      {l.face === "mustache" && (
        <group position={[0, -0.036, z + 0.009]}>
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={cap(0.009, 0.028)} material={mat(l.hairC)} position={[s * 0.021, -0.003, 0]} rotation={[0, 0, s * 0.55]} />
          ))}
          <mesh geometry={sph(0.009, 8, 6)} material={mat(l.hairC)} position={[0, -0.006, 0.002]} />
        </group>
      )}
      {l.face === "beard" && (
        <group>
          <mesh geometry={sph(0.08, 16, 12)} material={mat(l.hairC)} position={[0, -0.075, z - 0.058]} scale={[1, 0.82, 0.62]} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={sph(0.05, 14, 10)} material={mat(l.hairC)} position={[s * 0.088, -0.03, z - 0.07]} scale={[0.75, 1.05, 0.6]} rotation={[0, s * 0.3, 0]} />
          ))}
        </group>
      )}
    </group>
  );
}

function Hat({ l }: { l: Look }) {
  const m = mat(l.hatC);
  const top = 0.12;
  switch (l.hat) {
    case "none":
      return null;
    case "cap":
      return (
        <group position={[0, 0.02, 0]} rotation={[-0.15, 0, 0]}>
          <mesh geometry={capSph(R * 1.1, 1.5)} material={m} />
          <mesh geometry={box(0.2, 0.012, 0.12)} material={m} position={[0, 0.0, 0.16]} />
          <mesh geometry={sph(0.012)} material={m} position={[0, R * 1.1, 0]} />
        </group>
      );
    case "beanie":
      return (
        <group position={[0, 0.03, 0]}>
          <mesh geometry={capSph(R * 1.12, 1.55)} material={mat(l.hatC, "stripes", "#ffffff")} scale={[1, 1.12, 1]} />
          <mesh geometry={tor(R * 1.07, 0.02, Math.PI * 2, 8, 24)} material={m} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} />
          <mesh geometry={sph(0.04)} material={WHITE()} position={[0, R * 1.25, 0]} />
        </group>
      );
    case "tophat":
      return (
        <group position={[0, top, -0.01]} rotation={[-0.08, 0, 0.08]}>
          <mesh geometry={cyl(0.24 / 1, 0.24, 0.012, 24)} material={m} scale={[0.8, 1, 0.8]} />
          <mesh geometry={cyl(0.1, 0.1, 0.2, 20)} material={m} position={[0, 0.1, 0]} />
          <mesh geometry={cyl(0.102, 0.102, 0.03, 20)} material={mat("#ef4444")} position={[0, 0.03, 0]} />
        </group>
      );
    case "cowboy":
      return (
        <group position={[0, top - 0.01, 0]}>
          <mesh geometry={cyl(0.26, 0.26, 0.012, 28)} material={m} scale={[1, 1, 0.85]} />
          <mesh geometry={sph(0.11)} material={m} position={[0, 0.05, 0]} scale={[1, 0.8, 1.1]} />
          <mesh geometry={tor(0.105, 0.012)} material={mat("#7c2d12")} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} />
        </group>
      );
    case "crown":
      return (
        <group position={[0, top, 0]}>
          <mesh geometry={cyl(0.1, 0.1, 0.06, 16, true)} material={gold()} />
          {[...Array(6)].map((_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <group key={i} position={[Math.cos(a) * 0.1, 0.05, Math.sin(a) * 0.1]}>
                <mesh geometry={cone(0.022, 0.06, 4)} material={gold()} />
                <mesh geometry={sph(0.012)} material={glow(l.hatC)} position={[0, 0.035, 0]} />
              </group>
            );
          })}
        </group>
      );
    case "tiara":
      return (
        <group position={[0, 0.09, 0.03]} rotation={[-0.4, 0, 0]}>
          <mesh geometry={tor(0.13, 0.008, Math.PI, 8, 20)} material={special("silver", () => new THREE.MeshStandardMaterial({ color: "#e5e7eb", metalness: 0.9, roughness: 0.2 }))} />
          <mesh geometry={sph(0.025, 10, 8)} material={glow(l.hatC)} position={[0, 0.14, 0]} scale={[1, 1.3, 0.6]} />
        </group>
      );
    case "bunny":
    case "cat":
    case "bear":
    case "fox":
    case "devil":
      return (
        <group position={[0, 0.1, 0]}>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.08, 0.04, 0]} rotation={[0, 0, -s * 0.25]}>
              {l.hat === "bunny" && <mesh geometry={cap(0.03, 0.14)} material={m} position={[0, 0.1, 0]} scale={[1, 1, 0.5]} />}
              {l.hat === "bunny" && <mesh geometry={cap(0.016, 0.11)} material={mat("#fda4af")} position={[0, 0.1, 0.012]} scale={[1, 1, 0.4]} />}
              {(l.hat === "cat" || l.hat === "fox") && <mesh geometry={cone(0.045, 0.08, 4)} material={m} position={[0, 0.03, 0]} rotation={[0, Math.PI / 4, 0]} />}
              {l.hat === "fox" && <mesh geometry={cone(0.018, 0.03, 4)} material={WHITE()} position={[0, 0.065, 0]} />}
              {l.hat === "bear" && <mesh geometry={sph(0.045)} material={m} position={[0, 0.02, 0]} scale={[1, 1, 0.6]} />}
              {l.hat === "devil" && <mesh geometry={cone(0.022, 0.07, 10)} material={mat(l.hatC === "#111111" ? "#ef4444" : l.hatC)} position={[0, 0.02, 0.04]} />}
            </group>
          ))}
        </group>
      );
    case "halo":
      return <mesh geometry={tor(0.1, 0.012, Math.PI * 2, 8, 30)} material={glow("#fde68a")} position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]} />;
    case "chef":
      return (
        <group position={[0, top, 0]}>
          <mesh geometry={cyl(0.11, 0.11, 0.08, 20)} material={WHITE()} />
          <mesh geometry={sph(0.13)} material={WHITE()} position={[0, 0.12, 0]} scale={[1, 0.7, 1]} />
        </group>
      );
    case "witch":
      return (
        <group position={[0, top - 0.01, 0]} rotation={[-0.1, 0, 0.1]}>
          <mesh geometry={cyl(0.25, 0.25, 0.012, 28)} material={m} />
          <mesh geometry={cone(0.11, 0.3, 18)} material={m} position={[0, 0.15, 0]} rotation={[-0.2, 0, 0]} />
          <mesh geometry={cyl(0.105, 0.105, 0.025, 18)} material={mat("#a855f7")} position={[0, 0.02, 0]} />
        </group>
      );
    case "beret":
      return <mesh geometry={sph(0.15)} material={m} position={[0.02, 0.1, -0.01]} scale={[1, 0.3, 1]} rotation={[0, 0, 0.25]} />;
    case "viking":
      return (
        <group position={[0, 0.02, 0]}>
          <mesh geometry={capSph(R * 1.12, 1.5)} material={special("steel", () => new THREE.MeshStandardMaterial({ color: "#9ca3af", metalness: 0.85, roughness: 0.3 }))} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={cone(0.03, 0.14, 10)} material={mat("#fde68a")} position={[s * 0.15, 0.1, 0]} rotation={[0, 0, -s * 0.9]} />
          ))}
        </group>
      );
    case "flowers":
      return (
        <group position={[0, 0.1, 0]}>
          {[...Array(10)].map((_, i) => {
            const a = (i / 10) * Math.PI * 2;
            const c = ["#f472b6", "#facc15", "#ffffff", l.hatC, "#a855f7"][i % 5];
            return <mesh key={i} geometry={sph(0.028, 10, 8)} material={mat(c)} position={[Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12]} />;
          })}
        </group>
      );
    case "party":
      return <mesh geometry={cone(0.07, 0.2, 16)} material={mat(l.hatC, "stripes", "#ffffff")} position={[0.03, 0.22, 0]} rotation={[0, 0, -0.2]} />;
    case "bow":
      return (
        <group position={[0.07, 0.12, 0.02]} rotation={[0, 0, -0.3]}>
          {[-1, 1].map((s) => <mesh key={s} geometry={cone(0.04, 0.07, 4)} material={m} position={[s * 0.035, 0, 0]} rotation={[0, 0, (s * Math.PI) / 2]} />)}
          <mesh geometry={sph(0.018)} material={m} />
        </group>
      );
    case "headphones":
      return (
        <group>
          <mesh geometry={tor(0.155, 0.014, Math.PI, 8, 20)} material={m} />
          {[-1, 1].map((s) => <mesh key={s} geometry={cyl(0.05, 0.05, 0.04, 16)} material={m} position={[s * 0.155, 0, 0]} rotation={[0, 0, Math.PI / 2]} />)}
        </group>
      );
    case "unicorn":
      return <mesh geometry={cone(0.025, 0.14, 8)} material={special("uni", () => new THREE.MeshStandardMaterial({ color: "#fde68a", metalness: 0.5, roughness: 0.3, emissive: "#f9a8d4", emissiveIntensity: 0.25 }))} position={[0, 0.16, 0.08]} rotation={[0.5, 0, 0]} />;
    case "antenna":
      return (
        <group position={[0, 0.12, 0]}>
          {[-1, 1].map((s) => (
            <group key={s} rotation={[0, 0, -s * 0.35]}>
              <mesh geometry={cyl(0.005, 0.005, 0.14, 6)} material={BLACK()} position={[s * 0.04, 0.07, 0]} />
              <mesh geometry={sph(0.02)} material={glow(l.hatC)} position={[s * 0.04, 0.15, 0]} />
            </group>
          ))}
        </group>
      );
    case "santa":
      return (
        <group position={[0, 0.06, 0]}>
          <mesh geometry={cone(0.13, 0.25, 18)} material={mat("#dc2626")} position={[0, 0.12, -0.02]} rotation={[-0.5, 0, 0]} />
          <mesh geometry={tor(0.125, 0.025)} material={WHITE()} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={sph(0.035)} material={WHITE()} position={[0, 0.22, -0.13]} />
        </group>
      );
    case "pirate":
      return (
        <group position={[0, top, 0]}>
          <mesh geometry={cyl(0.2, 0.2, 0.03, 3)} material={m} rotation={[0, Math.PI, 0]} />
          <mesh geometry={sph(0.11)} material={m} position={[0, 0.03, 0]} scale={[1, 0.6, 1]} />
          <mesh geometry={sph(0.02)} material={WHITE()} position={[0, 0.05, 0.11]} />
        </group>
      );
    case "sombrero":
      return (
        <group position={[0, top - 0.01, 0]}>
          <mesh geometry={cyl(0.34, 0.36, 0.02, 30)} material={m} />
          <mesh geometry={cone(0.12, 0.17, 20)} material={m} position={[0, 0.09, 0]} />
          <mesh geometry={tor(0.33, 0.012, Math.PI * 2, 6, 40)} material={mat("#ef4444")} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      );
    case "helmet":
      return (
        <group>
          <mesh geometry={capSph(R * 1.16, 1.65)} material={mat(l.hatC, "metal")} rotation={[-0.2, 0, 0]} />
          <mesh geometry={box(0.03, 0.06, 0.3)} material={WHITE()} position={[0, R * 1.12, 0]} />
        </group>
      );
    case "bucket":
      return (
        <group position={[0, 0.07, 0]}>
          <mesh geometry={cyl(0.12, 0.14, 0.1, 20)} material={m} position={[0, 0.04, 0]} />
          <mesh geometry={cyl(0.14, 0.21, 0.04, 22, true)} material={m} position={[0, -0.02, 0]} />
        </group>
      );
    case "frog":
      return (
        <group position={[0, 0.12, 0.02]}>
          <mesh geometry={capSph(R * 1.1, 1.3)} material={mat("#22c55e")} position={[0, -0.12, -0.02]} />
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.07, 0.04, 0.04]}>
              <mesh geometry={sph(0.04)} material={mat("#22c55e")} />
              <mesh geometry={sph(0.025)} material={WHITE()} position={[0, 0.01, 0.025]} />
              <mesh geometry={sph(0.012)} material={BLACK()} position={[0, 0.01, 0.045]} />
            </group>
          ))}
        </group>
      );
    case "astronaut":
      return (
        <group>
          <mesh geometry={sph(R * 1.45, 24, 18)} material={glass("#bfdbfe", 0.22)} />
          <mesh geometry={tor(R * 1.05, 0.025)} material={WHITE()} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.14, 0]} />
        </group>
      );
    default:
      return null;
  }
}

function Glasses({ l }: { l: Look }) {
  const m = mat(l.glassC, "metal");
  const z = R * 0.98;
  const pair = (node: (s: number) => React.ReactNode) => [-1, 1].map((s) => <group key={s} position={[s * 0.052, 0, z]}>{node(s)}</group>);
  switch (l.glasses) {
    case "none":
      return null;
    case "round":
    case "sun":
    case "square":
    case "cat":
      return (
        <group>
          {pair((s) => (
            <>
              <mesh geometry={tor(0.034, 0.005, Math.PI * 2, 6, l.glasses === "square" ? 4 : l.glasses === "cat" ? 3 : 20)} material={m} rotation={[0, 0, l.glasses === "square" ? Math.PI / 4 : l.glasses === "cat" ? (s < 0 ? 0.5 : -0.5) + Math.PI : 0]} />
              {l.glasses === "sun" && <mesh geometry={cyl(0.033, 0.033, 0.004, 20)} material={glass("#111111", 0.85)} rotation={[Math.PI / 2, 0, 0]} />}
            </>
          ))}
          <mesh geometry={box(0.035, 0.006, 0.006)} material={m} position={[0, 0.004, z]} />
        </group>
      );
    case "heart":
    case "star":
      return (
        <group>
          {pair(() => <mesh geometry={shapeGeo(l.glasses, l.glasses === "heart" ? heartShape : starShape)} material={glass(l.glassC, 0.75)} scale={0.08} />)}
          <mesh geometry={box(0.03, 0.006, 0.006)} material={m} position={[0, 0.004, z]} />
        </group>
      );
    case "visor":
      return <mesh geometry={geo("visor", () => new THREE.CylinderGeometry(R * 1.05, R * 1.05, 0.05, 24, 1, true, -1.1, 2.2))} material={special("visor" + l.glassC, () => new THREE.MeshStandardMaterial({ color: l.glassC, emissive: l.glassC, emissiveIntensity: 0.8, transparent: true, opacity: 0.8, side: THREE.DoubleSide }))} rotation={[0, 0, 0]} position={[0, 0.005, 0.005]} />;
    case "monocle":
      return (
        <group position={[0.052, 0, z]}>
          <mesh geometry={tor(0.034, 0.005)} material={gold()} />
          <mesh geometry={cyl(0.002, 0.002, 0.12, 4)} material={gold()} position={[0.03, -0.06, -0.01]} rotation={[0, 0, 0.4]} />
        </group>
      );
    case "mask":
      return <mesh geometry={shapeGeo("mask", (s) => { s.ellipse?.(0, 0, 0.5, 0.2, 0, Math.PI * 2, false, 0); }, 0.02)} material={mat(l.glassC, "glitter", "#facc15")} position={[0, 0.005, z]} scale={[0.26, 0.26, 0.4]} />;
    case "ski":
      return (
        <group>
          <mesh geometry={box(0.17, 0.055, 0.03)} material={special("ski" + l.glassC, () => new THREE.MeshStandardMaterial({ color: l.glassC, metalness: 0.9, roughness: 0.05, emissive: l.glassC, emissiveIntensity: 0.2 }))} position={[0, 0.005, z]} />
          <mesh geometry={tor(R * 1.02, 0.01, Math.PI * 2, 6, 24)} material={BLACK()} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      );
    default:
      return null;
  }
}

/** Itens nas costas / pescoço. `flap` é animado de fora. */
function Back({ l, flap }: { l: Look; flap: React.RefObject<THREE.Group[]> }) {
  const m = mat(l.accC);
  const reg = (i: number) => (g: THREE.Group | null) => {
    if (g && flap.current) flap.current[i] = g;
  };
  const wings = (kind: string, size: number, material: THREE.Material) =>
    [-1, 1].map((s) => (
      <group key={s} ref={reg(s < 0 ? 0 : 1)} position={[s * 0.03, 0.07, -0.08]}>
        <mesh geometry={shapeGeo("w" + kind, wingShape(kind), 0.02)} material={material} scale={[s * size, size, 1]} position={[s * size * 0.31, 0, 0]} />
      </group>
    ));
  switch (l.acc) {
    case "angel":
      return <>{wings("angel", 0.5, WHITE())}</>;
    case "bat":
      return <>{wings("bat", 0.45, mat(l.accC === "#ffffff" ? "#1f2937" : l.accC))}</>;
    case "dragon":
      return <>{wings("dragon", 0.65, mat(l.accC, "scales", "#111111"))}</>;
    case "butterfly":
      return <>{wings("butterfly", 0.5, mat(l.accC, "gradient", "#facc15"))}</>;
    case "fairy":
      return <>{wings("fairy", 0.45, glass(l.accC, 0.5))}</>;
    case "bee":
      return <>{wings("butterfly", 0.28, glass("#e0f2fe", 0.55))}</>;
    case "cape":
      return (
        <group ref={reg(0)} position={[0, 0.14, -0.075]}>
          <mesh geometry={geo("cape", () => new THREE.CylinderGeometry(0.13, 0.22, 0.5, 16, 1, true, Math.PI * 0.6, Math.PI * 0.8))} material={special("cape" + l.accC, () => new THREE.MeshStandardMaterial({ color: l.accC, side: THREE.DoubleSide, roughness: 0.6 }))} position={[0, -0.25, 0.06]} />
        </group>
      );
    case "cattail":
    case "foxtail":
      return (
        <group ref={reg(0)} position={[0, -0.1, -0.07]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} geometry={sph(l.acc === "foxtail" ? 0.035 + i * 0.006 : 0.022, 10, 8)} material={l.acc === "foxtail" && i === 4 ? WHITE() : m} position={[0, -0.02 + i * 0.035, -0.03 - i * 0.03 + i * i * 0.004]} />
          ))}
        </group>
      );
    case "dino":
      return (
        <group>
          {[0, 1, 2, 3, 4].map((i) => <mesh key={i} geometry={cone(0.025, 0.06, 4)} material={m} position={[0, 0.2 - i * 0.07, -0.08]} rotation={[-0.4, 0, 0]} />)}
          <group ref={reg(0)} position={[0, -0.12, -0.07]}>
            <mesh geometry={cone(0.05, 0.25, 10)} material={m} position={[0, -0.02, -0.12]} rotation={[-1.9, 0, 0]} />
          </group>
        </group>
      );
    case "backpack":
      return (
        <group position={[0, 0.06, -0.11]}>
          <mesh geometry={box(0.17, 0.2, 0.08)} material={m} />
          <mesh geometry={box(0.13, 0.08, 0.02)} material={mat(l.accC, "solid")} position={[0, -0.04, -0.045]} />
        </group>
      );
    case "jetpack":
      return (
        <group position={[0, 0.06, -0.11]}>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.045, 0, 0]}>
              <mesh geometry={cyl(0.035, 0.035, 0.2, 14)} material={mat(l.accC, "metal")} />
              <mesh geometry={cone(0.03, 0.08, 10)} material={glow("#f97316")} position={[0, -0.14, 0]} rotation={[Math.PI, 0, 0]} />
            </group>
          ))}
        </group>
      );
    case "shell":
      return <mesh geometry={capSph(0.16, 1.5)} material={mat(l.accC === "#ffffff" ? "#16a34a" : l.accC, "scales", "#14532d")} position={[0, 0.06, -0.06]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.6, 1.2]} />;
    case "scarf":
      return (
        <group>
          <mesh geometry={tor(0.075, 0.028)} material={mat(l.accC, "stripes", "#ffffff")} position={[0, 0.16, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={box(0.05, 0.16, 0.025)} material={mat(l.accC, "stripes", "#ffffff")} position={[0.04, 0.07, 0.08]} />
        </group>
      );
    case "boa":
      return (
        <group position={[0, 0.15, 0]}>
          {[...Array(14)].map((_, i) => {
            const a = (i / 14) * Math.PI * 2;
            return <mesh key={i} geometry={sph(0.035, 8, 6)} material={mat(l.accC, "fur")} position={[Math.cos(a) * 0.1, Math.sin(a * 2) * 0.01, Math.sin(a) * 0.08]} />;
          })}
        </group>
      );
    case "pearls":
      return (
        <group position={[0, 0.14, 0.01]}>
          {[...Array(13)].map((_, i) => {
            const a = Math.PI * 0.1 + (i / 12) * Math.PI * 0.8;
            return <mesh key={i} geometry={sph(0.012, 8, 6)} material={special("pearl", () => new THREE.MeshStandardMaterial({ color: "#fff7ed", roughness: 0.15, metalness: 0.3 }))} position={[Math.cos(a) * 0.085, -Math.sin(a) * 0.05, Math.sin(a) * 0.075]} />;
          })}
        </group>
      );
    case "chain":
      return <mesh geometry={tor(0.08, 0.008, Math.PI * 2, 6, 24)} material={gold()} position={[0, 0.11, 0.035]} rotation={[1.2, 0, 0]} />;
    case "bowtie":
      return (
        <group position={[0, 0.14, 0.075]}>
          {[-1, 1].map((s) => <mesh key={s} geometry={cone(0.025, 0.045, 4)} material={m} position={[s * 0.022, 0, 0]} rotation={[0, 0, (s * Math.PI) / 2]} />)}
        </group>
      );
    case "tie":
      return (
        <group position={[0, 0.06, 0.075]}>
          <mesh geometry={box(0.03, 0.15, 0.01)} material={m} />
          <mesh geometry={cone(0.022, 0.03, 4)} material={m} position={[0, -0.085, 0]} rotation={[Math.PI, 0, 0]} />
        </group>
      );
    case "sash":
      return <mesh geometry={box(0.04, 0.32, 0.01)} material={mat(l.accC, "glitter", "#facc15")} position={[0, 0.03, 0.073]} rotation={[0, 0, 0.6]} />;
    case "belt":
      return (
        <group position={[0, -0.12, 0]}>
          <mesh geometry={tor(0.105, 0.012, Math.PI * 2, 6, 24)} material={m} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.65, 1]} />
          <mesh geometry={box(0.035, 0.03, 0.01)} material={gold()} position={[0, 0, 0.07]} />
        </group>
      );
    default:
      return null;
  }
}

function HandItem({ l }: { l: Look }) {
  const m = mat(l.handC);
  switch (l.hand) {
    case "none":
      return null;
    case "wand":
      return (
        <group rotation={[1.2, 0, 0]}>
          <mesh geometry={cyl(0.006, 0.006, 0.18, 6)} material={BLACK()} position={[0, 0.06, 0]} />
          <mesh geometry={shapeGeo("star", starShape)} material={glow(l.handC)} position={[0, 0.16, 0]} scale={0.06} />
        </group>
      );
    case "bag":
      return (
        <group position={[0, -0.06, 0]}>
          <mesh geometry={box(0.09, 0.07, 0.035)} material={mat(l.handC, "glitter", "#ffffff")} />
          <mesh geometry={tor(0.03, 0.004, Math.PI)} material={gold()} position={[0, 0.035, 0]} />
        </group>
      );
    case "umbrella":
      return (
        <group>
          <mesh geometry={cyl(0.005, 0.005, 0.5, 6)} material={BLACK()} position={[0, 0.2, 0]} />
          <mesh geometry={geo("umb", () => new THREE.SphereGeometry(0.28, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4))} material={special("umb" + l.handC, () => new THREE.MeshStandardMaterial({ color: l.handC, side: THREE.DoubleSide }))} position={[0, 0.38, 0]} />
        </group>
      );
    case "bouquet":
      return (
        <group rotation={[0.9, 0, 0]}>
          <mesh geometry={cone(0.04, 0.12, 10)} material={mat("#22c55e")} position={[0, 0.02, 0]} rotation={[Math.PI, 0, 0]} />
          {[...Array(6)].map((_, i) => <mesh key={i} geometry={sph(0.025, 8, 6)} material={mat(i % 2 ? l.handC : "#f472b6")} position={[Math.cos(i) * 0.03, 0.09 + (i % 3) * 0.01, Math.sin(i) * 0.03]} />)}
        </group>
      );
    case "sword":
      return (
        <group rotation={[1.3, 0, 0]}>
          <mesh geometry={box(0.025, 0.3, 0.008)} material={special("steel", () => new THREE.MeshStandardMaterial({ color: "#9ca3af", metalness: 0.85, roughness: 0.3 }))} position={[0, 0.18, 0]} />
          <mesh geometry={box(0.08, 0.015, 0.02)} material={gold()} position={[0, 0.03, 0]} />
        </group>
      );
    case "balloon":
      return (
        <group>
          <mesh geometry={cyl(0.002, 0.002, 0.5, 4)} material={WHITE()} position={[0, 0.25, 0]} />
          <mesh geometry={shapeGeo("heart", heartShape, 0.25)} material={special("bal" + l.handC, () => new THREE.MeshStandardMaterial({ color: l.handC, roughness: 0.2, metalness: 0.3 }))} position={[0, 0.55, 0]} scale={[0.2, 0.2, 0.3]} />
        </group>
      );
    case "fan":
      return <mesh geometry={geo("fan", () => new THREE.CircleGeometry(0.12, 16, 0, Math.PI))} material={special("fan" + l.handC, () => new THREE.MeshStandardMaterial({ color: l.handC, side: THREE.DoubleSide }))} position={[0, 0.02, 0.03]} rotation={[0, 0, 0]} />;
    case "mic":
      return (
        <group rotation={[1.0, 0, 0]}>
          <mesh geometry={cyl(0.012, 0.009, 0.1, 10)} material={BLACK()} position={[0, 0.03, 0]} />
          <mesh geometry={sph(0.025)} material={special("steel", () => new THREE.MeshStandardMaterial({ color: "#9ca3af", metalness: 0.85, roughness: 0.3 }))} position={[0, 0.09, 0]} />
        </group>
      );
    case "staff":
    case "trident":
      return (
        <group>
          <mesh geometry={cyl(0.008, 0.008, 0.7, 6)} material={l.hand === "trident" ? gold() : mat("#7c2d12")} position={[0, 0.15, 0]} />
          {l.hand === "staff" ? (
            <mesh geometry={sph(0.04)} material={glow(l.handC)} position={[0, 0.52, 0]} />
          ) : (
            [-1, 0, 1].map((s) => <mesh key={s} geometry={cone(0.012, 0.08, 6)} material={gold()} position={[s * 0.035, 0.53, 0]} />)
          )}
        </group>
      );
    case "guitar":
      return (
        <group position={[0.05, 0.05, 0.08]} rotation={[0, 0, 1.0]}>
          <mesh geometry={sph(0.08)} material={m} scale={[1, 1.2, 0.3]} />
          <mesh geometry={box(0.025, 0.25, 0.015)} material={mat("#7c2d12")} position={[0, 0.18, 0]} />
        </group>
      );
    case "icecream":
      return (
        <group rotation={[0.6, 0, 0]}>
          <mesh geometry={cone(0.025, 0.08, 10)} material={mat("#d6b98c")} position={[0, 0.02, 0]} rotation={[Math.PI, 0, 0]} />
          <mesh geometry={sph(0.03)} material={m} position={[0, 0.07, 0]} />
          <mesh geometry={sph(0.026)} material={mat("#fda4af")} position={[0, 0.11, 0]} />
        </group>
      );
    case "flag":
      return (
        <group>
          <mesh geometry={cyl(0.005, 0.005, 0.45, 6)} material={WHITE()} position={[0, 0.18, 0]} />
          <mesh geometry={box(0.18, 0.11, 0.005)} material={mat(l.handC, "stripes", "#ffffff")} position={[0.09, 0.35, 0]} />
        </group>
      );
    case "lantern":
      return (
        <group position={[0, -0.08, 0]}>
          <mesh geometry={cyl(0.035, 0.035, 0.07, 6)} material={glow(l.handC)} />
          <mesh geometry={cone(0.045, 0.03, 6)} material={BLACK()} position={[0, 0.05, 0]} />
        </group>
      );
    case "shield":
      return <mesh geometry={cyl(0.12, 0.12, 0.02, 20)} material={mat(l.handC, "metal")} position={[0.03, 0, 0.04]} rotation={[0, 0, Math.PI / 2]} />;
    case "phone":
      return <mesh geometry={box(0.04, 0.075, 0.008)} material={mat(l.handC, "glitter", "#ffffff")} position={[0, 0.02, 0.02]} rotation={[0.4, 0, 0]} />;
    case "bone":
      return (
        <group rotation={[0, 0, Math.PI / 2]}>
          <mesh geometry={cyl(0.012, 0.012, 0.12, 8)} material={WHITE()} />
          {[-1, 1].flatMap((s) => [-1, 1].map((k) => <mesh key={s + ":" + k} geometry={sph(0.018)} material={WHITE()} position={[k * 0.012, s * 0.06, 0]} />))}
        </group>
      );
    default:
      return null;
  }
}

/* ---------------- corpo ---------------- */
export function Doll({ look: l, anim, scale = 1 }: { look: Look; anim: React.MutableRefObject<DollAnim>; scale?: number }) {
  const hips = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const sh = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const el = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const th = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const kn = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const flap = useRef<THREE.Group[]>([]);
  const clock = useRef(0);
  const lastName = useRef("");

  const skin = skinMat(l.skin);
  const topM = mat(l.topC, l.topP, l.topC2, topFinish(l.top));
  const botM = mat(l.botC, l.botP, l.topC2, bottomFinish(l.bottom));
  const shoeM = mat(l.shoeC, "solid", "#ffffff", shoeFinish(l.shoes));
  const sleeves = SLEEVES[l.top] ?? 0;
  const dressy = l.bottom === "dress" || l.bottom === "gown" || l.bottom === "overalls";
  const chestM = l.top !== "none" ? topM : dressy ? botM : skin;
  const bellyM = l.bottom === "overalls" || ((l.bottom === "dress" || l.bottom === "gown") && (l.top === "none" || BARE_BELLY.has(l.top))) ? botM : BARE_BELLY.has(l.top) ? skin : topM;
  const upperM = sleeves >= 1 ? topM : skin;
  const foreM = sleeves >= 2 ? topM : skin;
  const thighM = FULL_PANTS.has(l.bottom) || SHORT_PANTS.has(l.bottom) ? botM : skin;
  const shinM = TALL_SHOES.has(l.shoes) ? shoeM : FULL_PANTS.has(l.bottom) ? botM : l.bottom === "tutu" ? mat("#fde2e4") : skin;
  const puff = l.top === "puffer" ? 1.16 : l.top === "armor" ? 1.08 : 1;
  const mermaid = l.bottom === "mermaid";
  const heel = l.shoes === "heels" ? 0.03 : l.shoes === "platform" ? 0.04 : l.shoes === "rollers" ? 0.04 : 0;
  const holding = l.hand !== "none";

  const footGeo = useMemo(() => geo("foot", () => new THREE.CapsuleGeometry(0.032, 0.07, 4, 10).rotateX(Math.PI / 2)), []);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const a = anim.current;
    if (a.name !== lastName.current) {
      lastName.current = a.name;
      clock.current = 0;
    }
    clock.current += dt * (a.speed ?? 1);
    const t = clock.current;
    const k = 1 - Math.exp(-14 * dt); // suavização
    const set = (g: THREE.Group | null, x: number, y: number, z: number) => {
      if (!g) return;
      g.rotation.x += (x - g.rotation.x) * k;
      g.rotation.y += (y - g.rotation.y) * k;
      g.rotation.z += (z - g.rotation.z) * k;
    };
    let hipY = 0.43 + heel;
    let hipRot: [number, number, number] = [0, 0, 0];
    let spineR: [number, number, number] = [0, 0, 0];
    let headR: [number, number, number] = [0, 0, 0];
    const S: [number, number, number][] = [[0, 0, -0.12], [0, 0, 0.12]]; // ombros [L, R]
    const E: [number, number, number][] = [[-0.15, 0, 0], [-0.15, 0, 0]];
    const T: [number, number, number][] = [[0, 0, 0], [0, 0, 0]];
    const K: [number, number, number][] = [[0, 0, 0], [0, 0, 0]];
    const breathe = Math.sin(t * 2.2) * 0.02;
    const n = a.name;
    if (n === "walk" || n === "catwalk") {
      const cw = n === "catwalk";
      const w = t * (cw ? 6.2 : 9);
      const s = Math.sin(w);
      hipY += Math.abs(Math.cos(w)) * (cw ? 0.012 : 0.018) - 0.008;
      hipRot = [0, s * (cw ? 0.22 : 0.08), s * (cw ? 0.09 : 0.03)];
      spineR = [cw ? -0.05 : 0.06, -s * (cw ? 0.28 : 0.1), -s * (cw ? 0.08 : 0.02)];
      headR = [cw ? -0.12 : 0, s * (cw ? 0.06 : 0.04), 0];
      for (const i of [0, 1]) {
        const ph = i === 0 ? s : -s;
        T[i] = [-ph * (cw ? 0.45 : 0.6), 0, (i === 0 ? 1 : -1) * (cw ? 0.06 : 0)];
        K[i] = [Math.max(0, Math.sin(w + (i === 0 ? -1.6 : Math.PI - 1.6))) * (cw ? 0.6 : 0.95), 0, 0];
        S[i] = [ph * (cw ? 0.35 : 0.55) * -1, 0, (i === 0 ? -1 : 1) * (cw ? 0.18 : 0.1)];
        E[i] = [-0.25 - Math.max(0, ph) * 0.3, 0, 0];
      }
    } else if (n === "sit") {
      hipY = 0.3 + heel;
      for (const i of [0, 1]) {
        T[i] = [-1.5, 0, (i ? -1 : 1) * 0.08];
        K[i] = [1.5, 0, 0];
        S[i] = [-0.3, 0, (i ? 1 : -1) * 0.12];
        E[i] = [-0.6, 0, 0];
      }
      spineR = [breathe, 0, 0];
    } else if (n === "wave" || n === "emote-yes") {
      S[1] = [0, 0, 2.6];
      E[1] = [0, 0, 0.4 + Math.sin(t * 12) * 0.45];
      headR = [0, 0, Math.sin(t * 3) * 0.1];
      spineR = [0, 0, -0.05];
    } else if (n === "no" || n === "emote-no") {
      headR = [0, Math.sin(t * 14) * 0.45 * Math.max(0, 1 - t / 1.4), 0];
      S[0] = [0, 0, -0.4];
      S[1] = [0, 0, 0.4];
      E[0] = [0, 0, 0.9];
      E[1] = [0, 0, -0.9];
    } else if (n === "jump" || n === "cheer") {
      const j = (t * 1.6) % 1;
      const up = Math.sin(Math.PI * j);
      hipY += up * 0.18;
      S[0] = [0, 0, -2.6 - up * 0.3];
      S[1] = [0, 0, 2.6 + up * 0.3];
      E[0] = [0, 0, -0.2];
      E[1] = [0, 0, 0.2];
      for (const i of [0, 1]) {
        T[i] = [-up * 0.5, 0, 0];
        K[i] = [up * 0.9, 0, 0];
      }
    } else if (n.startsWith("pose")) {
      const p = +n.slice(4) % 4;
      const sway = Math.sin(t * 1.5) * 0.03;
      if (p === 0) {
        // mão na cintura + aceno
        S[0] = [0, 0, -0.9];
        E[0] = [0, 0, 1.9];
        S[1] = [0, 0, 2.5];
        E[1] = [0, 0, 0.3];
        hipRot = [0, 0, 0.08 + sway];
        spineR = [0, 0, -0.1];
        headR = [-0.1, 0.2, 0.15];
        T[1] = [-0.15, 0, -0.1];
        K[1] = [0.3, 0, 0];
      } else if (p === 1) {
        // as duas mãos na cintura
        S[0] = [0, 0, -0.9];
        E[0] = [0, 0, 1.9];
        S[1] = [0, 0, 0.9];
        E[1] = [0, 0, -1.9];
        hipRot = [0, 0.3, -0.06 + sway];
        headR = [-0.15, -0.3, -0.05];
        T[0] = [-0.25, 0, 0.12];
        K[0] = [0.45, 0, 0];
      } else if (p === 2) {
        // mão no queixo, pose de capa de revista
        S[1] = [-1.4, 0, 0.35];
        E[1] = [-1.7, 0, 0];
        S[0] = [0, 0, -0.25];
        hipRot = [0, -0.35, 0.05 + sway];
        headR = [0.05, 0.35, 0.12];
        T[1] = [-0.1, 0, -0.18];
      } else {
        // braços abertos, estrela
        S[0] = [0, 0, -1.9];
        S[1] = [0, 0, 1.9];
        E[0] = [0, 0, -0.3];
        E[1] = [0, 0, 0.3];
        headR = [-0.25, 0, Math.sin(t * 2) * 0.1];
        T[0] = [0, 0, 0.2];
        T[1] = [0, 0, -0.2];
      }
    } else {
      // idle
      spineR = [breathe, 0, 0];
      headR = [Math.sin(t * 0.7) * 0.05, Math.sin(t * 0.45) * 0.25, 0];
      S[0] = [Math.sin(t * 1.1) * 0.04, 0, -0.12 - breathe];
      S[1] = [-Math.sin(t * 1.1) * 0.04, 0, 0.12 + breathe];
    }
    if (holding && (n === "idle" || n === "walk" || n === "catwalk")) {
      S[1] = [-0.35, 0, 0.12];
      E[1] = [-0.9, 0, 0];
    }
    if (hips.current) {
      hips.current.position.y += (hipY - hips.current.position.y) * k;
      set(hips.current, ...hipRot);
    }
    set(spine.current, ...spineR);
    set(head.current, ...headR);
    for (const i of [0, 1]) {
      set(sh[i].current, ...S[i]);
      set(el[i].current, ...E[i]);
      set(th[i].current, ...T[i]);
      set(kn[i].current, ...K[i]);
    }
    if (chest.current) chest.current.scale.setScalar(1 + breathe * 0.5);
    // asas / capa / rabo
    const f = flap.current;
    const fl = Math.sin(t * (n === "catwalk" ? 7 : 3)) * 0.35;
    if (l.acc === "cape" || l.acc === "cattail" || l.acc === "foxtail" || l.acc === "dino") {
      if (f[0]) f[0].rotation.set(l.acc === "cape" ? -0.15 - Math.abs(fl) * 0.4 : fl * 0.3, fl * 0.6, 0);
    } else {
      if (f[0]) f[0].rotation.y = 0.35 + fl;
      if (f[1]) f[1].rotation.y = -0.35 - fl;
    }
  });

  const arm = (i: number) => {
    const s = i === 0 ? -1 : 1;
    return (
      <group ref={sh[i]} position={[s * 0.135 * puff, 0.115, 0]}>
        <mesh geometry={sph(0.04)} material={upperM} />
        <mesh geometry={cap(0.032 * (sleeves >= 1 ? puff : 1), 0.1)} material={upperM} position={[0, -0.07, 0]} castShadow />
        {l.top === "kimono" && <mesh geometry={cone(0.07, 0.14, 12)} material={topM} position={[0, -0.16, 0]} />}
        {l.top === "ruffle" && <mesh geometry={tor(0.04, 0.015)} material={topM} position={[0, -0.1, 0]} rotation={[Math.PI / 2, 0, 0]} />}
        {l.top === "armor" && <mesh geometry={sph(0.055)} material={topM} position={[0, 0.01, 0]} scale={[1.1, 0.7, 1]} />}
        <group ref={el[i]} position={[0, -0.14, 0]}>
          <mesh geometry={cap(0.029, 0.09)} material={foreM} position={[0, -0.065, 0]} castShadow />
          <mesh geometry={sph(0.034)} material={skin} position={[0, -0.135, 0]} />
          {i === 1 && (
            <group position={[0, -0.14, 0.01]}>
              <HandItem l={l} />
            </group>
          )}
        </group>
      </group>
    );
  };

  const leg = (i: number) => {
    const s = i === 0 ? -1 : 1;
    return (
      <group ref={th[i]} position={[s * 0.056, 0, 0]}>
        <mesh geometry={cap(0.042, 0.13)} material={thighM} position={[0, -0.1, 0]} castShadow />
        {l.bottom === "cargo" && <mesh geometry={box(0.03, 0.05, 0.05)} material={botM} position={[s * 0.04, -0.1, 0]} />}
        <group ref={kn[i]} position={[0, -0.2, 0]}>
          <mesh geometry={cap(0.036, 0.13)} material={shinM} position={[0, -0.1, 0]} castShadow />
          {l.bottom === "flare" && <mesh geometry={cone(0.06, 0.1, 12)} material={botM} position={[0, -0.16, 0]} rotation={[Math.PI, 0, 0]} />}
          {l.shoes === "cowboy" && <mesh geometry={cyl(0.05, 0.045, 0.04, 12)} material={shoeM} position={[0, -0.08, 0]} />}
          <group position={[0, -0.2 - heel, 0.025]}>
            {l.shoes === "barefoot" ? (
              <mesh geometry={footGeo} material={skin} position={[0, 0.015, 0]} scale={[0.85, 0.7, 0.9]} />
            ) : l.shoes === "slippers" ? (
              <mesh geometry={sph(0.055)} material={mat(l.shoeC, "fur")} position={[0, 0.02, 0.01]} scale={[0.9, 0.6, 1.3]} />
            ) : (
              <>
                <mesh geometry={footGeo} material={l.shoes === "sandals" ? skin : shoeM} position={[0, 0.02, 0]} castShadow />
                {(l.shoes === "sneakers" || l.shoes === "combat" || l.shoes === "platform" || l.shoes === "clogs") && (
                  <mesh geometry={box(0.068, l.shoes === "platform" ? 0.05 : 0.018, 0.14)} material={l.shoes === "clogs" ? mat("#a16207") : WHITE()} position={[0, l.shoes === "platform" ? -0.02 : -0.005, 0]} />
                )}
                {l.shoes === "sandals" && <mesh geometry={box(0.07, 0.01, 0.13)} material={shoeM} position={[0, -0.01, 0]} />}
                {l.shoes === "heels" && <mesh geometry={cyl(0.008, 0.006, 0.05, 6)} material={shoeM} position={[0, -0.01, -0.05]} />}
                {l.shoes === "rollers" &&
                  [-1, 1].map((k) => (
                    <mesh key={k} geometry={cyl(0.018, 0.018, 0.04, 10)} material={mat("#facc15")} position={[0, -0.03, k * 0.045]} rotation={[0, 0, Math.PI / 2]} />
                  ))}
                {l.shoes === "ballet" && <mesh geometry={tor(0.03, 0.004)} material={shoeM} position={[0, 0.04, -0.01]} rotation={[Math.PI / 2, 0, 0]} />}
              </>
            )}
          </group>
        </group>
      </group>
    );
  };

  return (
    <group scale={scale}>
      <group ref={hips} position={[0, 0.43, 0]}>
        {/* pernas */}
        {!mermaid && leg(0)}
        {!mermaid && leg(1)}
        {mermaid && (
          <group>
            <mesh geometry={cyl(0.1, 0.035, 0.42, 16)} material={botM} position={[0, -0.21, 0]} />
            <mesh geometry={cone(0.09, 0.09, 4)} material={botM} position={[0, -0.43, 0.01]} rotation={[Math.PI, 0, 0]} scale={[1.6, 1, 0.3]} />
          </group>
        )}
        {/* saias */}
        {l.bottom === "skirt" && <mesh geometry={cyl(0.105, 0.155, 0.14, 20, true)} material={botM} position={[0, -0.05, 0]} />}
        {l.bottom === "pleated" && <mesh geometry={cyl(0.105, 0.16, 0.14, 10, true)} material={botM} position={[0, -0.05, 0]} />}
        {l.bottom === "kilt" && <mesh geometry={cyl(0.105, 0.15, 0.17, 12, true)} material={mat(l.botC, l.botP === "solid" ? "plaid" : l.botP, "#111111")} position={[0, -0.07, 0]} />}
        {l.bottom === "longskirt" && <mesh geometry={cyl(0.105, 0.2, 0.38, 22, true)} material={botM} position={[0, -0.17, 0]} />}
        {l.bottom === "dress" && <mesh geometry={cyl(0.105, 0.19, 0.24, 22, true)} material={botM} position={[0, -0.1, 0]} />}
        {l.bottom === "gown" && (
          <>
            <mesh geometry={cyl(0.105, 0.3, 0.42, 26, true)} material={botM} position={[0, -0.19, 0]} />
            <mesh geometry={tor(0.29, 0.015, Math.PI * 2, 6, 32)} material={mat(l.topC2, "glitter", "#ffffff")} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.39, 0]} />
          </>
        )}
        {l.bottom === "tutu" && (
          <>
            <mesh geometry={cyl(0.11, 0.26, 0.05, 24)} material={glass(l.botC, 0.85)} position={[0, -0.05, 0]} />
            <mesh geometry={cyl(0.11, 0.22, 0.05, 24)} material={glass(l.botC, 0.7)} position={[0, -0.02, 0]} />
          </>
        )}
        {l.bottom === "balloon" && <mesh geometry={sph(0.15)} material={botM} position={[0, -0.06, 0]} scale={[1, 0.6, 1]} />}
        {/* tronco */}
        <group ref={spine}>
          <mesh geometry={cap(0.1, 0.05)} material={bellyM} position={[0, 0.04, 0]} scale={[1.05 * puff, 1, 0.68 * puff]} castShadow />
          <group ref={chest} position={[0, 0.12, 0]}>
            <mesh geometry={cap(0.11, 0.06)} material={chestM} position={[0, 0.03, 0]} scale={[1.08 * puff, 1, 0.7 * puff]} castShadow />
            {/* detalhes da blusa */}
            {(l.top === "jacket" || l.top === "blazer" || l.top === "lab" || l.top === "leather") && (
              <mesh geometry={box(0.06, 0.17, 0.02)} material={mat(l.topC2)} position={[0, 0.0, 0.07 * puff]} />
            )}
            {l.top === "tux" && (
              <>
                <mesh geometry={box(0.06, 0.17, 0.02)} material={WHITE()} position={[0, 0.0, 0.075]} />
                <mesh geometry={box(0.04, 0.02, 0.02)} material={BLACK()} position={[0, 0.07, 0.085]} />
              </>
            )}
            {l.top === "hoodie" && (
              <>
                <mesh geometry={tor(0.08, 0.03)} material={topM} position={[0, 0.1, -0.05]} rotation={[Math.PI / 2 + 0.5, 0, 0]} />
                <mesh geometry={box(0.12, 0.05, 0.02)} material={topM} position={[0, -0.07, 0.075]} />
              </>
            )}
            {l.top === "turtle" && <mesh geometry={cyl(0.055, 0.06, 0.06, 14)} material={topM} position={[0, 0.12, 0]} />}
            {l.top === "sailor" && <mesh geometry={box(0.2, 0.01, 0.1)} material={mat(l.topC2)} position={[0, 0.1, -0.03]} rotation={[0.3, 0, 0]} />}
            {l.top === "jersey" && <mesh geometry={box(0.06, 0.06, 0.02)} material={mat(l.topC2)} position={[0, 0.0, 0.075]} />}
            {l.top === "vest" && <mesh geometry={cap(0.112, 0.06)} material={mat(l.topC2)} position={[0, 0.03, -0.004]} scale={[1.1, 0.95, 0.66]} />}
            {l.top === "corset" && [-1, 0, 1].map((k) => <mesh key={k} geometry={box(0.09, 0.005, 0.005)} material={mat(l.topC2)} position={[0, -0.03 + k * 0.04, 0.076]} />)}
            {l.top === "poncho" && <mesh geometry={cone(0.24, 0.22, 16, )} material={topM} position={[0, 0.0, 0]} />}
            {l.top === "ruffle" && <mesh geometry={tor(0.07, 0.02)} material={topM} position={[0, 0.06, 0.04]} rotation={[Math.PI / 2 + 0.3, 0, 0]} />}
            {l.top === "armor" && <mesh geometry={box(0.05, 0.05, 0.02)} material={gold()} position={[0, 0.02, 0.085]} rotation={[0, 0, Math.PI / 4]} />}
            {l.top === "kimono" && <mesh geometry={cyl(0.112, 0.112, 0.05, 16)} material={mat(l.topC2)} position={[0, -0.13, 0]} scale={[1.05, 1, 0.7]} />}
            {l.top === "bikini" && [-1, 1].map((s) => <mesh key={s} geometry={sph(0.04)} material={topM} position={[s * 0.04, 0.02, 0.06]} scale={[1, 0.8, 0.5]} />)}
            {l.bottom === "overalls" && [-1, 1].map((s) => <mesh key={s} geometry={box(0.025, 0.17, 0.01)} material={botM} position={[s * 0.05, 0.0, 0.077]} />)}
            <Back l={l} flap={flap} />
            {arm(0)}
            {arm(1)}
            {/* pescoço e cabeça */}
            <mesh geometry={cyl(0.035, 0.04, 0.06, 10)} material={skin} position={[0, 0.12, 0]} />
            <group ref={head} position={[0, 0.27, 0]}>
              <mesh geometry={sph(R, 28, 22)} material={skin} scale={[1, 0.97, 0.95]} castShadow />
              <Face l={l} />
              <Hair l={l} />
              <Hat l={l} />
              <Glasses l={l} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
