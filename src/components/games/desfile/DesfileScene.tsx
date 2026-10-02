import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { Doll, type DollAnim } from "@/components/avatar/Doll";
import type { Look } from "@/lib/look";

export type ShowProps = {
  looks: Record<"gu" | "li", Look>;
  order: ("gu" | "li")[];
  winner: "gu" | "li" | null; // null = ainda não revelado
  theme: string;
  startRef: React.MutableRefObject<number>;
  poses: Record<"gu" | "li", number>;
};

export const WALK = 4.6;
export const POSE = 3.0;
export const BACK = 1.6;
export const SLOT = WALK + POSE + BACK;
export const INTRO = 2.2;
export const FINAL_AT = INTRO + SLOT * 2;
export const SHOW_LEN = FINAL_AT + 7;

const RUNWAY_LEN = 14;
const END_Z = 5.2;
const START_Z = END_Z - RUNWAY_LEN + 1.2;

function screenTex(theme: string) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 384;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 1024, 384);
  gr.addColorStop(0, "#831843");
  gr.addColorStop(0.5, "#4c1d95");
  gr.addColorStop(1, "#0f172a");
  g.fillStyle = gr;
  g.fillRect(0, 0, 1024, 384);
  g.fillStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 40; i++) g.fillRect(i * 26, 0, 2, 384);
  g.fillStyle = "#fbcfe8";
  g.font = "700 40px system-ui, sans-serif";
  g.textAlign = "center";
  g.fillText("DESFILE • TEMA", 512, 110);
  g.fillStyle = "#ffffff";
  let size = 120;
  g.font = `900 ${size}px system-ui, sans-serif`;
  while (g.measureText(theme.toUpperCase()).width > 940 && size > 40) {
    size -= 6;
    g.font = `900 ${size}px system-ui, sans-serif`;
  }
  g.shadowColor = "#f472b6";
  g.shadowBlur = 30;
  g.fillText(theme.toUpperCase(), 512, 250);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Plateia + câmeras dos paparazzi com flashes. */
function Crowd({ flashLevel }: { flashLevel: React.MutableRefObject<number> }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const flashes = useRef<THREE.InstancedMesh>(null);
  const seats = useMemo(() => {
    const out: { x: number; z: number; y: number; ph: number }[] = [];
    for (const s of [-1, 1])
      for (let row = 0; row < 3; row++)
        for (let i = 0; i < 22; i++) out.push({ x: s * (2.4 + row * 0.9), z: START_Z + 1 + i * 0.58, y: row * 0.35, ph: Math.random() * 6 });
    return out;
  }, []);
  const flashN = 36;
  const fl = useMemo(() => Array.from({ length: flashN }, (_, i) => seats[(i * 7) % seats.length]), [seats]);
  const life = useRef(new Float32Array(flashN));
  const m = useMemo(() => new THREE.Matrix4(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  const light = useRef<THREE.PointLight>(null);
  useEffect(() => {
    const b = body.current!;
    const pal = ["#1f2937", "#111827", "#374151", "#3f3f46", "#27272a"].map((c) => new THREE.Color(c));
    seats.forEach((_, i) => b.setColorAt(i, pal[i % pal.length]));
    b.instanceColor!.needsUpdate = true;
  }, [seats]);
  useFrame(({ clock, camera }, raw) => {
    const dt = Math.min(raw, 0.05);
    const t = clock.elapsedTime;
    const b = body.current;
    if (b) {
      seats.forEach((s, i) => {
        v.set(s.x, 0.5 + s.y + Math.max(0, Math.sin(t * 3 + s.ph)) * 0.02 * (1 + flashLevel.current * 3), s.z);
        q.identity();
        sc.set(1, 1, 1);
        m.compose(v, q, sc);
        b.setMatrixAt(i, m);
      });
      b.instanceMatrix.needsUpdate = true;
    }
    const f = flashes.current;
    let bright = 0;
    if (f) {
      for (let i = 0; i < flashN; i++) {
        if (life.current[i] <= 0 && Math.random() < flashLevel.current * dt * 2.2) life.current[i] = 1;
        life.current[i] = Math.max(0, life.current[i] - dt * 7);
        const s = fl[i];
        const k = life.current[i];
        bright = Math.max(bright, k);
        v.set(s.x * 0.92, 0.95 + s.y, s.z);
        q.copy(camera.quaternion);
        sc.setScalar(k * 0.9 + 0.0001);
        m.compose(v, q, sc);
        f.setMatrixAt(i, m);
      }
      f.instanceMatrix.needsUpdate = true;
    }
    if (light.current) light.current.intensity = bright * 6;
  });
  return (
    <>
      <instancedMesh ref={body} args={[undefined, undefined, seats.length]}>
        <capsuleGeometry args={[0.16, 0.4, 3, 8]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={flashes} args={[undefined, undefined, flashN]} frustumCulled={false}>
        <circleGeometry args={[0.35, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      <pointLight ref={light} position={[0, 2.5, END_Z - 1]} distance={10} color="#ffffff" />
    </>
  );
}

function Confetti({ onRef }: { onRef: React.MutableRefObject<boolean> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 220;
  const p = useMemo(() => Array.from({ length: N }, () => ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), a: 0 })), []);
  const fired = useRef(false);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    const im = ref.current!;
    const pal = ["#ec4899", "#facc15", "#a855f7", "#ffffff", "#22d3ee"].map((c) => new THREE.Color(c));
    for (let i = 0; i < N; i++) im.setColorAt(i, pal[i % pal.length]);
    im.instanceColor!.needsUpdate = true;
  }, []);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const on = onRef.current;
    if (on && !fired.current) {
      fired.current = true;
      p.forEach((x) => {
        x.pos.set((Math.random() - 0.5) * 6, 5 + Math.random() * 2, END_Z - 1 + (Math.random() - 0.5) * 3);
        x.vel.set((Math.random() - 0.5) * 2, -1 - Math.random() * 1.5, (Math.random() - 0.5) * 1);
        x.a = 1;
      });
    }
    if (!on) fired.current = false;
    const im = ref.current;
    if (!im) return;
    p.forEach((x, i) => {
      if (x.a) {
        x.pos.addScaledVector(x.vel, dt);
        x.pos.x += Math.sin(x.pos.y * 3 + i) * dt * 0.5;
        x.rot.x += dt * 5;
        x.rot.z += dt * 3;
        if (x.pos.y < 0) x.a = 0;
      }
      q.setFromEuler(x.rot);
      s.setScalar(x.a * 0.07);
      m.compose(x.pos, q, s);
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

function Model({ who, i, p, spot }: { who: "gu" | "li"; i: number; p: ShowProps; spot: React.RefObject<THREE.SpotLight | null> }) {
  const g = useRef<THREE.Group>(null);
  const anim = useRef<DollAnim>({ name: "idle" });
  useFrame(() => {
    const t = (performance.now() - p.startRef.current) / 1000;
    const st = INTRO + i * SLOT;
    const grp = g.current;
    if (!grp) return;
    const sideX = i === 0 ? -0.75 : 0.75;
    let x = 0;
    let z = START_Z - 1.5;
    let ry = 0;
    let name = "idle";
    if (t >= FINAL_AT) {
      x = sideX;
      z = END_Z - 1.2;
      const rev = p.winner && t > FINAL_AT + 2.5;
      name = rev ? (p.winner === who ? "cheer" : "wave") : `pose${p.poses[who] + 1}`;
    } else if (t < st) {
      z = START_Z - 3; // nos bastidores
    } else if (t < st + WALK) {
      const k = (t - st) / WALK;
      z = START_Z + (END_Z - START_Z) * k;
      name = "catwalk";
    } else if (t < st + WALK + POSE) {
      z = END_Z;
      name = `pose${p.poses[who]}`;
    } else if (t < st + SLOT) {
      const k = (t - st - WALK - POSE) / BACK;
      z = END_Z - k * 1.2;
      x = sideX * k;
      ry = sideX < 0 ? -0.5 * (1 - k) : 0.5 * (1 - k);
      name = "catwalk";
    } else {
      x = sideX;
      z = END_Z - 1.2;
      name = "idle";
    }
    grp.position.set(x, 0.45, z);
    grp.rotation.y = ry;
    grp.scale.setScalar(1.55);
    if (anim.current.name !== name) anim.current = { name };
    // holofote acompanha quem está desfilando
    if (spot.current && t >= st && t < st + SLOT && t < FINAL_AT) {
      spot.current.target.position.set(x, 0.8, z);
      spot.current.target.updateMatrixWorld();
    }
  });
  return (
    <group ref={g}>
      <Doll look={p.looks[who]} anim={anim} />
    </group>
  );
}

function Rig({ p, flash }: { p: ShowProps; flash: React.MutableRefObject<number> }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 1.2, 0));
  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const t = (performance.now() - p.startRef.current) / 1000;
    const want = new THREE.Vector3();
    const at = new THREE.Vector3();
    let fl = 0.15;
    if (t < INTRO) {
      const k = t / INTRO;
      want.set(Math.sin(k * 1.2) * 4, 3.2 - k, END_Z + 7 - k * 2);
      at.set(0, 1.5, 0);
    } else if (t < FINAL_AT) {
      const i = Math.floor((t - INTRO) / SLOT);
      const lt = t - INTRO - i * SLOT;
      if (lt < WALK) {
        const k = lt / WALK;
        const z = START_Z + (END_Z - START_Z) * k;
        want.set(1.6 - k * 1.2, 1.6, z + 3.6);
        at.set(0, 1.25, z);
        fl = 0.5;
      } else if (lt < WALK + POSE) {
        const k = (lt - WALK) / POSE;
        want.set(Math.sin(k * 1.6 - 0.8) * 2.2, 1.4 + k * 0.3, END_Z + 2.4);
        at.set(0, 1.3, END_Z);
        fl = 2.6;
      } else {
        want.set(0, 2, END_Z + 4.5);
        at.set(0, 1.2, END_Z - 1);
        fl = 0.3;
      }
    } else {
      const k = Math.min(1, (t - FINAL_AT) / 2);
      const wx = p.winner && t > FINAL_AT + 2.5 ? (p.order[0] === p.winner ? -0.75 : 0.75) * 0.6 : 0;
      want.set(wx + Math.sin(clock.elapsedTime * 0.3) * 0.6, 1.8 - k * 0.2, END_Z + 3.4);
      at.set(wx, 1.2, END_Z - 1.2);
      fl = p.winner && t > FINAL_AT + 2.5 ? 3 : 1.2;
    }
    flash.current = fl;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, want.x, 3, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, want.y, 3, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, want.z, 3, dt);
    look.current.lerp(at, 1 - Math.exp(-4 * dt));
    camera.lookAt(look.current);
  });
  return null;
}

function Stage({ p }: { p: ShowProps }) {
  const tex = useMemo(() => screenTex(p.theme), [p.theme]);
  const strips = useRef<THREE.MeshStandardMaterial>(null);
  const spot = useRef<THREE.SpotLight>(null);
  const flash = useRef(0.2);
  const winnerOn = useRef(false);
  useFrame(({ clock }) => {
    if (strips.current) strips.current.emissiveIntensity = 1.4 + Math.sin(clock.elapsedTime * 4) * 0.5;
    winnerOn.current = !!p.winner && (performance.now() - p.startRef.current) / 1000 > FINAL_AT + 2.5;
  });
  return (
    <>
      <Rig p={p} flash={flash} />
      {/* passarela */}
      <mesh position={[0, 0.22, (START_Z + END_Z) / 2 - 0.6]}>
        <boxGeometry args={[2.4, 0.44, RUNWAY_LEN + 1.5]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.35} roughness={0.12} envMapIntensity={1.4} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.22, 0.42, (START_Z + END_Z) / 2 - 0.6]}>
          <boxGeometry args={[0.05, 0.05, RUNWAY_LEN + 1.5]} />
          <meshStandardMaterial ref={s < 0 ? strips : undefined} color="#f472b6" emissive="#ec4899" emissiveIntensity={1.6} />
        </mesh>
      ))}
      {/* chão */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0b0b12" roughness={0.6} metalness={0.4} />
      </mesh>
      {/* telão */}
      <mesh position={[0, 3.1, START_Z - 3.2]}>
        <planeGeometry args={[8, 3]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.2, START_Z - 3.3]}>
        <boxGeometry args={[10, 2.4, 0.2]} />
        <meshStandardMaterial color="#18181b" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* arcos de luz */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[0, 0.4, START_Z + i * 3]} rotation={[0, 0, 0]}>
          <torusGeometry args={[2.6, 0.03, 6, 40, Math.PI]} />
          <meshStandardMaterial color="#ffffff" emissive={i % 2 ? "#a855f7" : "#ec4899"} emissiveIntensity={1.2} />
        </mesh>
      ))}
      <Crowd flashLevel={flash} />
      <Confetti onRef={winnerOn} />
      <spotLight ref={spot} position={[0, 7, END_Z + 2]} angle={0.35} penumbra={0.6} intensity={60} distance={20} color="#fff1f8" />
      <spotLight position={[-4, 6, END_Z]} angle={0.5} penumbra={0.8} intensity={25} distance={18} color="#c4b5fd" target-position={[0, 0.5, END_Z - 1]} />
      {p.order.map((w, i) => (
        <Model key={w} who={w} i={i} p={p} spot={spot} />
      ))}
    </>
  );
}

export default function DesfileScene(p: ShowProps) {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 3, 12], fov: 42 }} gl={{ antialias: true, powerPreference: "high-performance", stencil: false }}>
      <color attach="background" args={["#07060c"]} />
      <fog attach="fog" args={["#07060c", 12, 30]} />
      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#f5d0fe", "#0b0b12", 0.4]} />
      <Environment resolution={64}>
        <Lightformer intensity={2} position={[0, 5, 5]} scale={[10, 2, 1]} />
        <Lightformer intensity={1.5} color="#f472b6" position={[-5, 2, 0]} rotation-y={Math.PI / 2} scale={[10, 1, 1]} />
        <Lightformer intensity={1.5} color="#a78bfa" position={[5, 2, 0]} rotation-y={-Math.PI / 2} scale={[10, 1, 1]} />
      </Environment>
      <Stage p={p} />
    </Canvas>
  );
}
