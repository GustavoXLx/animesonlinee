import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer, Line, Outlines, useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as skClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { BALL_R, GOAL_H, GOAL_W, RUN, sample, solve, wallLayout, type Mode, type Shot, type Solved } from "./sim";

export type View = "kicker" | "keeper" | "watch";
export type SceneProps = {
  mode: Mode;
  spot: { x: number; z: number };
  kickerModel: string;
  keeperModel: string;
  view: View;
  shot: Shot | null;
  startRef: React.MutableRefObject<number>;
  aim: { x: number; y: number };
  curve: number;
  power: number;
  onAim: (x: number, y: number) => void;
};

const HW = GOAL_W / 2;
const DEPTH = 2;
const charUrl = (m: string) => `/house/chars/character-${m}.glb`;

/* ---------------- texturas ---------------- */
function useGrass() {
  return useMemo(() => {
    const S = 2048;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    const m = (v: number) => ((v + 40) / 80) * S; // x
    const mz = (v: number) => ((v + 12) / 80) * S; // z de -12 a 68
    for (let i = 0; i < 20; i++) {
      g.fillStyle = i % 2 ? "#2f7a34" : "#38893c";
      g.fillRect(0, (i * S) / 20, S, S / 20 + 1);
    }
    // ruído
    const img = g.getImageData(0, 0, S, S);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 18;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n * 0.5;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = "rgba(255,255,255,0.92)";
    g.lineWidth = (0.12 / 80) * S;
    const rect = (x0: number, z0: number, x1: number, z1: number) => g.strokeRect(m(x0), mz(z0), m(x1) - m(x0), mz(z1) - mz(z0));
    g.beginPath();
    g.moveTo(m(-34), mz(0));
    g.lineTo(m(34), mz(0));
    g.stroke();
    g.beginPath();
    g.moveTo(m(-34), mz(0));
    g.lineTo(m(-34), mz(68));
    g.moveTo(m(34), mz(0));
    g.lineTo(m(34), mz(68));
    g.stroke();
    rect(-9.16, 0, 9.16, 5.5);
    rect(-20.16, 0, 20.16, 16.5);
    g.fillStyle = "white";
    g.beginPath();
    g.arc(m(0), mz(11), (0.2 / 80) * S, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    const R = (9.15 / 80) * S;
    const a = Math.acos(5.5 / 9.15);
    g.arc(m(0), mz(11), R, Math.PI / 2 - a, Math.PI / 2 + a);
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);
}

function useBallTex() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#f8f8f8";
    g.fillRect(0, 0, 512, 256);
    const pent = (x: number, y: number, r: number) => {
      g.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
    };
    g.fillStyle = "#151515";
    pent(256, 22, 26);
    pent(256, 234, 26);
    for (let i = 0; i < 5; i++) {
      pent(i * 102 + 20, 100, 30);
      pent(i * 102 + 71, 160, 30);
    }
    g.strokeStyle = "#999";
    g.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      g.beginPath();
      g.moveTo(i * 51, 0);
      g.lineTo(i * 51 + 25, 256);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

/* ---------------- pessoas ---------------- */
type AnimRef = React.MutableRefObject<{ name: string; once?: boolean; speed?: number }>;

function Person({ model, groupRef, anim, height = 1.82 }: { model: string; groupRef: React.RefObject<THREE.Group | null>; anim: AnimRef; height?: number }) {
  const gltf = useGLTF(charUrl(model));
  const { obj, scale } = useMemo(() => {
    const o = skClone(gltf.scene);
    o.traverse((node) => {
      if (!(node as THREE.Mesh).isMesh) return;
      const mesh = node as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.material = materials.map((source) => {
        const material = source.clone() as THREE.MeshStandardMaterial;
        material.roughness = Math.min(0.72, Math.max(0.38, material.roughness || 0.55));
        material.metalness = Math.min(0.18, material.metalness || 0);
        material.envMapIntensity = 1.15;
        if ("clearcoat" in material) {
          (material as THREE.MeshPhysicalMaterial).clearcoat = 0.08;
          (material as THREE.MeshPhysicalMaterial).clearcoatRoughness = 0.32;
        }
        return material;
      });
    });
    const box = new THREE.Box3().setFromObject(o);
    const h = box.max.y - box.min.y || 1;
    return { obj: o, scale: height / h };
  }, [gltf.scene, height]);
  const inner = useRef<THREE.Group>(null);
  const { actions } = useAnimations(gltf.animations, inner);
  const cur = useRef("");
  useFrame(() => {
    const want = anim.current;
    if (cur.current === want.name) return;
    const next = actions[want.name];
    if (!next) return;
    const prev = cur.current ? actions[cur.current] : null;
    next.reset();
    next.timeScale = want.speed ?? 1;
    if (want.once) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    } else next.setLoop(THREE.LoopRepeat, Infinity);
    next.fadeIn(0.15).play();
    prev?.fadeOut(0.15);
    cur.current = want.name;
  });
  return (
    <group ref={groupRef}>
      <group ref={inner} scale={scale}>
        <primitive object={obj} />
        <Outlines thickness={0.012} color="#101827" screenspace opacity={0.28} />
      </group>
    </group>
  );
}

/* ---------------- cenário ---------------- */
function Goal({ solRef, timeRef }: { solRef: React.MutableRefObject<Solved | null>; timeRef: React.MutableRefObject<number> }) {
  const back = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.PlaneGeometry(GOAL_W, GOAL_H, 36, 12), []);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo]);
  const netMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#f1f1f1", wireframe: true, transparent: true, opacity: 0.55 }), []);
  useFrame(() => {
    const sol = solRef.current;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    let amp = 0;
    let hx = 0;
    let hy = 0;
    if (sol && sol.result === "goal") {
      const dt = timeRef.current - RUN - sol.flight - 0.22;
      if (dt > 0) {
        amp = 0.9 * Math.exp(-dt * 3.2) * Math.cos(dt * 14) * Math.min(1, dt * 12);
        hx = sol.ex;
        hy = sol.ey;
      }
    }
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i];
      const y = base[i + 1] + GOAL_H / 2;
      const d = Math.hypot(x - hx, y - hy);
      arr[i + 2] = -amp * Math.exp(-d * d * 0.9);
    }
    pos.needsUpdate = true;
  });
  const post = (p: [number, number, number], len: number, rot: [number, number, number]) => (
    <mesh position={p} rotation={rot} castShadow>
      <cylinderGeometry args={[0.065, 0.065, len, 14]} />
      <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.2} />
    </mesh>
  );
  return (
    <group>
      {post([-HW - 0.06, GOAL_H / 2, 0], GOAL_H + 0.12, [0, 0, 0])}
      {post([HW + 0.06, GOAL_H / 2, 0], GOAL_H + 0.12, [0, 0, 0])}
      {post([0, GOAL_H + 0.06, 0], GOAL_W + 0.25, [0, 0, Math.PI / 2])}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (HW + 0.06), 0.03, -DEPTH / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, DEPTH, 8]} />
            <meshStandardMaterial color="#ddd" />
          </mesh>
          <mesh position={[s * HW, GOAL_H / 2, -DEPTH / 2]} rotation={[0, Math.PI / 2, 0]} material={netMat}>
            <planeGeometry args={[DEPTH, GOAL_H, 8, 12]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, GOAL_H, -DEPTH / 2]} rotation={[Math.PI / 2, 0, 0]} material={netMat}>
        <planeGeometry args={[GOAL_W, DEPTH, 36, 8]} />
      </mesh>
      <mesh ref={back} geometry={geo} position={[0, GOAL_H / 2, -DEPTH]} material={netMat} />
    </group>
  );
}

function Crowd({ excite }: { excite: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const list: { x: number; y: number; z: number; ry: number; ph: number }[] = [];
    // atrás do gol
    for (let row = 0; row < 10; row++)
      for (let i = 0; i < 70; i++) list.push({ x: -34 + i * 0.98 + (row % 2) * 0.4, y: 1.1 + row * 0.7, z: -9 - row * 0.9, ry: 0, ph: Math.random() * 6 });
    // laterais
    for (const s of [-1, 1])
      for (let row = 0; row < 8; row++)
        for (let i = 0; i < 46; i++) list.push({ x: s * (38 + row * 0.9), y: 1.1 + row * 0.7, z: -4 + i * 1.0, ry: (s * -Math.PI) / 2, ph: Math.random() * 6 });
    return list;
  }, []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  useEffect(() => {
    const im = ref.current!;
    const palette = ["#ec4899", "#f472b6", "#3b82f6", "#60a5fa", "#f5f5f5", "#facc15", "#1f2937", "#a855f7"].map((c) => new THREE.Color(c));
    data.forEach((_, i) => im.setColorAt(i, palette[(i * 7 + (i >> 3)) % palette.length]));
    im.instanceColor!.needsUpdate = true;
  }, [data]);
  useFrame(({ clock }) => {
    const im = ref.current;
    if (!im) return;
    const t = clock.elapsedTime;
    const ex = excite.current;
    excite.current = Math.max(0, ex - 0.004);
    data.forEach((d, i) => {
      const bob = Math.max(0, Math.sin(t * (2 + ex * 9) + d.ph)) * (0.04 + ex * 0.45);
      e.set(0, d.ry, 0);
      q.setFromEuler(e);
      v.set(d.x, d.y + bob, d.z);
      m.compose(v, q, one);
      im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, data.length]}>
      <boxGeometry args={[0.55, 0.85, 0.35]} />
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
  );
}

function Stadium() {
  const tiers = [];
  for (let row = 0; row < 10; row++)
    tiers.push(
      <mesh key={"b" + row} position={[0, 0.35 + row * 0.7, -9 - row * 0.9]} receiveShadow>
        <boxGeometry args={[72, 0.7, 0.9]} />
        <meshStandardMaterial color={row % 2 ? "#3a3f4b" : "#2f343e"} />
      </mesh>,
    );
  for (const s of [-1, 1])
    for (let row = 0; row < 8; row++)
      tiers.push(
        <mesh key={s + "s" + row} position={[s * (38 + row * 0.9), 0.35 + row * 0.7, 19]} receiveShadow>
          <boxGeometry args={[0.9, 0.7, 48]} />
          <meshStandardMaterial color={row % 2 ? "#3a3f4b" : "#2f343e"} />
        </mesh>,
      );
  return (
    <group>
      {tiers}
      {/* placas de publicidade */}
      <mesh position={[0, 0.5, -5.5]}>
        <boxGeometry args={[60, 1, 0.1]} />
        <meshStandardMaterial color="#111827" emissive="#db2777" emissiveIntensity={0.55} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 35.5, 0.5, 20]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[46, 1, 0.1]} />
          <meshStandardMaterial color="#111827" emissive="#2563eb" emissiveIntensity={0.5} />
        </mesh>
      ))}
      {/* refletores */}
      {[
        [-36, -12],
        [36, -12],
        [-40, 40],
        [40, 40],
      ].map(([x, z]) => (
        <group key={x + ":" + z} position={[x, 0, z]}>
          <mesh position={[0, 12, 0]}>
            <cylinderGeometry args={[0.3, 0.45, 24, 10]} />
            <meshStandardMaterial color="#6b7280" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 24.5, 0]}>
            <boxGeometry args={[5, 2.2, 0.6]} />
            <meshStandardMaterial color="#fff" emissive="#fffbe8" emissiveIntensity={3} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -0.02, 28]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color="#1d4d22" />
      </mesh>
    </group>
  );
}

function Confetti({ trigger }: { trigger: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 260;
  const parts = useMemo(() => Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), s: 0 })), []);
  const last = useRef(0);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    const im = ref.current!;
    const pal = ["#ec4899", "#facc15", "#3b82f6", "#ffffff", "#22c55e"].map((c) => new THREE.Color(c));
    for (let i = 0; i < N; i++) im.setColorAt(i, pal[i % pal.length]);
    im.instanceColor!.needsUpdate = true;
  }, []);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const im = ref.current;
    if (!im) return;
    if (trigger.current !== last.current) {
      last.current = trigger.current;
      parts.forEach((p) => {
        p.p.set((Math.random() - 0.5) * 8, 0.5, -1 + Math.random() * 2);
        p.v.set((Math.random() - 0.5) * 9, 7 + Math.random() * 8, (Math.random() - 0.2) * 6);
        p.s = 1;
      });
    }
    parts.forEach((p, i) => {
      if (p.s > 0) {
        p.v.y -= 9 * dt;
        p.v.multiplyScalar(Math.exp(-1.6 * dt));
        p.p.addScaledVector(p.v, dt);
        p.r.x += dt * 6;
        p.r.y += dt * 4;
        if (p.p.y < 0) p.s = 0;
      }
      q.setFromEuler(p.r);
      sc.setScalar(p.s * 0.12);
      m.compose(p.p, q, sc);
      im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false}>
      <planeGeometry args={[1, 0.6]} />
      <meshBasicMaterial side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

/* ---------------- jogo ---------------- */
function Game(p: SceneProps) {
  const { camera } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const grass = useGrass();
  const ballTex = useBallTex();
  const sol = useMemo(() => (p.shot ? solve(p.shot) : null), [p.shot]);
  const solRef = useRef<Solved | null>(null);
  solRef.current = sol;
  const tRef = useRef(0);
  const excite = useRef(0);
  const confetti = useRef(0);
  const firedFor = useRef<Solved | null>(null);

  const ball = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const kicker = useRef<THREE.Group>(null);
  const keeper = useRef<THREE.Group>(null);
  const wallRefs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const kAnim: AnimRef = useRef({ name: "idle" });
  const gAnim: AnimRef = useRef({ name: "idle" });
  const wAnim: AnimRef = useRef({ name: "idle" });
  const reticle = useRef<THREE.Group>(null);
  const trail = useRef<THREE.Mesh[]>([]);
  const trailPts = useRef<THREE.Vector3[]>([]);

  const sx = p.shot?.sx ?? p.spot.x;
  const sz = p.shot?.sz ?? p.spot.z;
  const wall = useMemo(() => (p.mode === "falta" ? wallLayout(sx, sz) : null), [p.mode, sx, sz]);
  const dir = useMemo(() => {
    const d = new THREE.Vector3(-sx, 0, -sz).normalize();
    return { d, perp: new THREE.Vector3(-d.z, 0, d.x) };
  }, [sx, sz]);
  const k0 = p.mode === "falta" ? -(sx >= 0 ? 1 : -1) * 0.45 : 0;

  const preview = useMemo(() => {
    if (p.view !== "kicker" || p.shot || p.mode !== "falta") return null;
    const s = solve({ mode: "falta", sx, sz, tx: p.aim.x, ty: p.aim.y, power: Math.max(0.25, p.power), curve: p.curve, seed: 1, dive: null });
    const pts: THREE.Vector3[] = [];
    // sem dispersão: recalcula só a curva ideal
    for (let i = 0; i <= 18; i++) {
      const v = s.at((s.flight * i * 0.45) / 18);
      pts.push(new THREE.Vector3(v[0], v[1], v[2]));
    }
    return pts;
  }, [p.view, p.shot, p.mode, sx, sz, p.aim.x, p.aim.y, p.curve]);

  const tmp = useMemo(() => new THREE.Vector3(), []);
  const look = useRef(new THREE.Vector3(0, 1.2, 0));

  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    let t = 0;
    let camMode: "live" | "side" | "goal" = "live";
    if (sol) {
      const real = (performance.now() - p.startRef.current) / 1000;
      const s = sample(sol, real);
      t = s.t;
      camMode = s.cam;
      if (s.cam === "live" && t > RUN + sol.flight + 0.2 && firedFor.current !== sol) {
        firedFor.current = sol;
        if (sol.result === "goal") {
          excite.current = 1;
          confetti.current++;
        } else excite.current = 0.35;
      }
    }
    tRef.current = t;
    const tk = t - RUN; // tempo desde o chute

    // bola
    const bp = sol ? sol.at(tk) : [sx, BALL_R, sz];
    if (ball.current) {
      ball.current.position.set(bp[0], bp[1], bp[2]);
      if (sol && tk > 0) {
        const spin = sol.spin * Math.exp(-Math.max(0, tk - sol.flight) * 1.5);
        ball.current.rotation.x -= spin * dt * (camMode === "live" ? 1 : 0.45);
        ball.current.rotation.y += (p.shot?.curve ?? 0) * 12 * dt;
      }
    }
    if (shadow.current) {
      shadow.current.position.set(bp[0], 0.012, bp[2]);
      const s = Math.max(0.3, 1 - bp[1] * 0.18);
      shadow.current.scale.setScalar(s);
      (shadow.current.material as THREE.MeshBasicMaterial).opacity = 0.45 * s;
    }
    // rastro
    const tr = trailPts.current;
    if (sol && tk > 0 && tk < sol.flight + 0.15) tr.unshift(new THREE.Vector3(bp[0], bp[1], bp[2]));
    else if (tr.length) tr.pop();
    if (tr.length > 14) tr.length = 14;
    trail.current.forEach((m, i) => {
      const q = tr[i];
      m.visible = !!q;
      if (q) {
        m.position.copy(q);
        m.scale.setScalar(1 - i / 15);
      }
    });

    // batedor
    const kg = kicker.current;
    if (kg) {
      const start = tmp.set(sx, 0, sz).addScaledVector(dir.d, -2.3).addScaledVector(dir.perp, 1.1);
      const plant = new THREE.Vector3(sx, 0, sz).addScaledVector(dir.d, -0.42).addScaledVector(dir.perp, 0.32);
      const face = Math.atan2(dir.d.x, dir.d.z);
      if (!sol || t <= 0.05) {
        kg.position.copy(start);
        kg.rotation.y = face - 0.35;
        kAnim.current = { name: "idle" };
      } else if (t < RUN - 0.28) {
        const k = t / (RUN - 0.28);
        kg.position.lerpVectors(start, plant, k * k * (3 - 2 * k));
        kg.rotation.y = face - 0.35 * (1 - k);
        kAnim.current = { name: "sprint", speed: 1.3 };
      } else if (tk < 0.8) {
        kg.position.copy(plant);
        kg.rotation.y = face;
        kAnim.current = { name: "attack-kick-right", once: true, speed: 1.6 };
      } else if (tk > sol.flight + 0.25) {
        kAnim.current = sol.result === "goal" ? { name: "emote-yes" } : { name: "emote-no" };
      }
    }

    // goleiro
    const gg = keeper.current;
    if (gg) {
      gg.rotation.y = 0;
      const ready = !sol || tk < sol.keeper.at;
      if (ready) {
        const sway = Math.sin(clock.elapsedTime * 3) * 0.12;
        gg.position.set(k0 + (sol ? 0 : sway), 0, 0.35);
        gg.rotation.z = 0;
        gAnim.current = { name: "idle" };
      } else {
        const k = Math.min(1, (tk - sol.keeper.at) / sol.keeper.dur);
        const e = 1 - (1 - k) * (1 - k);
        const dx = sol.keeper.x - k0;
        const side = Math.abs(dx) > 0.7;
        const tilt = side ? Math.min(1.45, Math.abs(dx) * 0.55) : 0;
        const lift = side ? Math.max(0, sol.keeper.y - 0.75) : Math.max(0, sol.keeper.y - 1.5);
        const land = Math.max(0, tk - sol.keeper.at - sol.keeper.dur);
        const y = Math.max(0, lift * e + Math.sin(Math.PI * k) * 0.35 - land * land * 6);
        gg.position.set(k0 + dx * e * (side ? 0.78 : 1), y, 0.35);
        gg.rotation.z = -Math.sign(dx) * tilt * e;
        gAnim.current = { name: "jump", once: true, speed: 1.4 };
      }
    }

    // barreira
    if (wall) {
      const jt = sol ? tk - Math.max(0.05, sol.flight * 0.35) : -1;
      wallRefs.forEach((r, i) => {
        const g = r.current;
        if (!g) return;
        const m = wall.men[i];
        const y = jt > 0 && jt < 0.6 ? Math.sin((Math.PI * jt) / 0.6) * 0.5 : 0;
        g.position.set(m[0], y, m[2]);
        g.rotation.y = wall.face;
      });
      wAnim.current = jt > 0 && jt < 0.7 ? { name: "jump", once: true } : { name: "idle" };
    }

    // mira
    if (reticle.current) {
      reticle.current.visible = p.view === "kicker" && !p.shot;
      reticle.current.position.set(p.aim.x, p.aim.y, 0.04);
      reticle.current.rotation.z = clock.elapsedTime * 1.5;
    }

    // câmera
    const want = new THREE.Vector3();
    const target = new THREE.Vector3();
    let fov = 50;
    if (camMode === "side") {
      const side = sx >= 0 ? -1 : 1;
      want.set(side * 13, 2.4, Math.max(3, bp[2] * 0.6 + 2));
      target.set(bp[0], Math.max(0.8, bp[1]), bp[2]);
      fov = 38;
    } else if (camMode === "goal") {
      want.set((sol?.ex ?? 0) * 0.25, 1.4, -5.2);
      target.set(bp[0], bp[1], bp[2]);
      fov = 44;
    } else if (p.view === "keeper") {
      want.set(0, 2.05, -4.6);
      target.set(sx * 0.5, 1.0, sz * 0.5);
      fov = 55;
    } else {
      want.set(sx, 0, sz).addScaledVector(dir.d, -7.6).addScaledVector(dir.perp, -2.4);
      want.y = p.mode === "falta" ? 3.0 : 2.5;
      target.set(0, 1.25, 0);
      if (sol && tk > 0) {
        const k = Math.min(1, tk / (sol.flight + 0.3));
        want.lerp(new THREE.Vector3(bp[0] * 0.5, 1.8, Math.max(4, bp[2] + 6)), k * 0.55);
        target.lerp(new THREE.Vector3(bp[0], bp[1], bp[2]), 0.5);
      }
      fov = 50;
    }
    const snap = camMode !== "live" ? 9 : 4;
    cam.position.x = THREE.MathUtils.damp(cam.position.x, want.x, snap, dt);
    cam.position.y = THREE.MathUtils.damp(cam.position.y, want.y, snap, dt);
    cam.position.z = THREE.MathUtils.damp(cam.position.z, want.z, snap, dt);
    look.current.lerp(target, 1 - Math.exp(-snap * dt));
    if (excite.current > 0.7) {
      const sh = (excite.current - 0.7) * 0.25;
      cam.position.x += (Math.random() - 0.5) * sh;
      cam.position.y += (Math.random() - 0.5) * sh;
    }
    cam.lookAt(look.current);
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = THREE.MathUtils.damp(cam.fov, fov, 5, dt);
      cam.updateProjectionMatrix();
    }
  });

  const dragging = useRef(false);
  const setAim = (e: ThreeEvent<PointerEvent>) => {
    if (p.view !== "kicker" || p.shot) return;
    const x = THREE.MathUtils.clamp(e.point.x, -5, 5);
    const y = THREE.MathUtils.clamp(e.point.y, 0.15, 3.3);
    p.onAim(+x.toFixed(2), +y.toFixed(2));
  };

  return (
    <>
      <mesh position={[0, -0.01, 28]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial map={grass} roughness={0.95} />
      </mesh>
      <Stadium />
      <Crowd excite={excite} />
      <Goal solRef={solRef} timeRef={tRef} />
      <Confetti trigger={confetti} />

      <mesh ref={ball} castShadow>
        <sphereGeometry args={[BALL_R, 28, 20]} />
        <meshStandardMaterial map={ballTex} roughness={0.35} />
      </mesh>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.16, 20]} />
        <meshBasicMaterial color="black" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={i} ref={(m) => void (m && (trail.current[i] = m))} visible={false}>
          <sphereGeometry args={[BALL_R * 0.8, 10, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ))}

      <Suspense fallback={null}>
        <Person model={p.kickerModel} groupRef={kicker} anim={kAnim} />
        <Person model={p.keeperModel} groupRef={keeper} anim={gAnim} height={1.9} />
        {wall && wallRefs.map((r, i) => <Person key={i} model={["male-b", "male-d", "male-e", "male-f"][i]} groupRef={r} anim={wAnim} />)}
      </Suspense>

      {/* plano invisível para mirar */}
      <mesh
        position={[0, 2.2, 0.06]}
        onPointerDown={(e) => {
          dragging.current = true;
          setAim(e);
        }}
        onPointerMove={(e) => dragging.current && setAim(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => (dragging.current = false)}
      >
        <planeGeometry args={[14, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <group ref={reticle}>
        <mesh>
          <ringGeometry args={[0.2, 0.26, 32]} />
          <meshBasicMaterial color="#f472b6" transparent opacity={0.95} depthTest={false} />
        </mesh>
        <mesh>
          <ringGeometry args={[0.04, 0.07, 16]} />
          <meshBasicMaterial color="#ffffff" depthTest={false} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]} position={[Math.cos((i * Math.PI) / 2) * 0.36, Math.sin((i * Math.PI) / 2) * 0.36, 0]}>
            <planeGeometry args={[0.14, 0.035]} />
            <meshBasicMaterial color="#f472b6" depthTest={false} />
          </mesh>
        ))}
      </group>
      {p.view === "kicker" && !p.shot && p.mode === "falta" && (
        <group position={[p.aim.x, p.aim.y, 0.01]}>
          <mesh rotation={[0, 0, Math.PI / 4]}><planeGeometry args={[0.18, 0.18]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthTest={false} /></mesh>
          <mesh><ringGeometry args={[0.16, 0.2, 24]} /><meshBasicMaterial color={p.power > 0.85 ? "#f97316" : "#22c55e"} transparent opacity={0.95} depthTest={false} /></mesh>
        </group>
      )}
      {preview && <Line points={preview} color="#ffffff" lineWidth={3} dashed dashSize={0.3} gapSize={0.18} transparent opacity={0.75} />}
    </>
  );
}

export default function FutebolScene(props: SceneProps) {
  useEffect(() => {
    ["male-b", "male-d", "male-e", "male-f", props.kickerModel, props.keeperModel].forEach((m) => useGLTF.preload(charUrl(m)));
  }, [props.kickerModel, props.keeperModel]);
  return (
    <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance", stencil: false }} camera={{ position: [0, 2, 17], fov: 50, near: 0.1, far: 300 }}>
      <color attach="background" args={["#0d1426"]} />
      <fog attach="fog" args={["#0d1426", 45, 110]} />
      <hemisphereLight args={["#cfe3ff", "#2a4a2a", 0.55]} />
      <directionalLight
        position={[12, 26, 22]}
        intensity={2.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={30}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-14, 18, -10]} intensity={0.7} color="#ffe9c4" />
      <Environment resolution={128}>
        <Lightformer intensity={2} position={[0, 10, 10]} scale={[20, 6, 1]} />
        <Lightformer intensity={1.2} color="#ffd6e8" position={[-10, 4, 0]} rotation-y={Math.PI / 2} scale={[20, 2, 1]} />
        <Lightformer intensity={1.2} color="#d6e4ff" position={[10, 4, 0]} rotation-y={-Math.PI / 2} scale={[20, 2, 1]} />
      </Environment>
      <Game {...props} />
    </Canvas>
  );
}
