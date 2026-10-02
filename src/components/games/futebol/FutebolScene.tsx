import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, Line, useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as skClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { BALL_R, GOAL_H, GOAL_W, RUN, sample, solve, wallLayout, type Mode, type Shot, type Solved } from "./sim";

export type View = "kicker" | "keeper" | "watch";
export type SceneProps = {
  mode: Mode;
  spot: { x: number; z: number };
  kickerModel: string;
  keeperModel: string;
  kickerSkin?: "default" | "neymar";
  keeperSkin?: "default" | "neymar";
  view: View;
  shot: Shot | null;
  startRef: MutableRefObject<number>;
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

/* ---------------- gramado procedural ---------------- */
function ProceduralGrass() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      varying float vWave;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 p = position;
        float wave = sin(p.x * 0.32 + uTime * 0.65) * 0.008
          + cos(p.y * 0.27 - uTime * 0.42) * 0.006
          + sin((p.x + p.y) * 0.12 + uTime * 0.25) * 0.004;
        p.z += wave;
        vWave = wave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vWave;
      uniform float uTime;
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0,0.0)), f.x),
          mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i=0; i<4; i++) { v += noise(p) * a; p *= 2.02; a *= 0.5; }
        return v;
      }
      void main() {
        vec2 p = vUv * 42.0;
        float broad = fbm(p * 0.16);
        float micro = fbm(p * 2.8);
        float blades = noise(p * 9.0 + vec2(uTime * 0.08, -uTime * 0.05));
        float stripe = 0.035 * sin(vUv.y * 22.0 * 3.14159);
        vec3 dark = vec3(0.035, 0.20, 0.055);
        vec3 mid = vec3(0.055, 0.34, 0.085);
        vec3 light = vec3(0.12, 0.43, 0.12);
        vec3 col = mix(dark, mid, smoothstep(0.18, 0.58, broad));
        col = mix(col, light, smoothstep(0.62, 0.9, micro) * 0.32);
        col += vec3(0.015, 0.045, 0.012) * blades;
        col += stripe * vec3(0.55, 0.75, 0.45);
        col += vWave * vec3(0.5, 0.9, 0.35);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.DoubleSide
  }), []);
  useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.elapsedTime; });
  return <mesh position={[0, -0.008, 28]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <planeGeometry args={[80, 80, 96, 96]} />
    <primitive object={mat} attach="material" />
  </mesh>;
}

function GrassDebris({ trigger, spot }: { trigger: MutableRefObject<number>; spot: { x: number; z: number } }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const last = useRef(0);
  const particles = useMemo(() => Array.from({ length: 42 }, () => ({
    p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, rot: Math.random() * 6.28
  })), []);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const scale = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.04);
    const mesh = ref.current;
    if (!mesh) return;
    if (trigger.current !== last.current) {
      last.current = trigger.current;
      particles.forEach((p) => {
        p.p.set(spot.x + (Math.random() - 0.5) * 0.18, 0.025, spot.z + (Math.random() - 0.5) * 0.18);
        p.v.set((Math.random() - 0.5) * 2.1, 0.35 + Math.random() * 1.4, (Math.random() - 0.5) * 2.1);
        p.life = 0.7 + Math.random() * 0.5;
        p.rot = Math.random() * 6.28;
      });
    }
    particles.forEach((p, i) => {
      if (p.life > 0) { p.v.y -= 4.8 * dt; p.p.addScaledVector(p.v, dt); p.life = Math.max(0, p.life - dt); }
      scale.setScalar(Math.max(0, p.life) * 0.045);
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot + p.life * 5);
      matrix.compose(p.p, quat, scale);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, 42]} frustumCulled={false}>
    <planeGeometry args={[1, 0.35]} />
    <meshBasicMaterial color="#8bcf4a" transparent opacity={0.82} side={THREE.DoubleSide} depthWrite={false} />
  </instancedMesh>;
}

/* ---------------- pessoas ---------------- */
function FootballKit({ model, skin = "default" }: { model: string; skin?: "default" | "neymar" }) {
  const neymar = skin === "neymar";
  const palette = neymar
    ? { shirt: "#f7c948", accent: "#087f3f", shorts: "#0b5e35", socks: "#f7f7f7", boots: "#1d4ed8" }
    : model.includes("female")
      ? { shirt: "#f5f5f5", accent: "#ec4899", shorts: "#202938", socks: "#f7f7f7", boots: "#101318" }
      : model.endsWith("c")
        ? { shirt: "#f5f5f5", accent: "#16a34a", shorts: "#172033", socks: "#f7f7f7", boots: "#101318" }
        : { shirt: "#f5f5f5", accent: "#2563eb", shorts: "#172033", socks: "#f7f7f7", boots: "#101318" };

  return (
    <group position={[0, 0.01, 0]}>
      <mesh position={[0, 0.98, 0]} castShadow>
        <capsuleGeometry args={[0.285, 0.48, 6, 16]} />
        <meshStandardMaterial color={palette.shirt} roughness={0.62} />
      </mesh>
      <mesh position={[0, 1.16, 0.22]} scale={[0.78, 0.42, 0.05]}>
        <sphereGeometry args={[0.25, 20, 12]} />
        <meshStandardMaterial color={palette.accent} roughness={0.5} />
      </mesh>
      {neymar && <mesh position={[0, 1.16, 0.275]} scale={[0.16, 0.16, 0.035]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#0b5e35" />
      </mesh>}
      <mesh position={[0, 0.62, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.2, 5, 14]} />
        <meshStandardMaterial color={palette.shorts} roughness={0.72} />
      </mesh>
      {[-0.13, 0.13].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.105, 0.09, 0.48, 14]} />
            <meshStandardMaterial color={palette.socks} roughness={0.65} />
          </mesh>
          <mesh position={[x, 0.07, 0.055]} scale={[1.25, 0.48, 1.65]} castShadow>
            <sphereGeometry args={[0.1, 16, 10]} />
            <meshStandardMaterial color={palette.boots} roughness={0.4} metalness={0.05} />
          </mesh>
        </group>
      ))}
      {neymar && <group position={[0, 1.53, -0.015]}>
        <mesh scale={[0.22, 0.13, 0.22]} rotation={[0.18, 0, 0]}>
          <sphereGeometry args={[0.72, 18, 10]} />
          <meshStandardMaterial color="#17120e" roughness={0.95} />
        </mesh>
        <mesh position={[0, -0.12, 0.48]} scale={[0.42, 0.08, 0.12]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#17120e" roughness={0.95} />
        </mesh>
      </group>}
      <mesh position={[0, 1.42, 0]} scale={[0.88, 0.045, 0.88]}>
        <torusGeometry args={[0.25, 0.025, 8, 24]} />
        <meshStandardMaterial color={palette.accent} roughness={0.48} />
      </mesh>
    </group>
  );
}

type AnimRef = MutableRefObject<{ name: string; once?: boolean; speed?: number }>;

function Person({
  model,
  groupRef,
  anim,
  height = 1.82,
  skin = "default",
}: {
  model: string;
  groupRef: MutableRefObject<THREE.Group | null>;
  anim: AnimRef;
  height?: number;
  skin?: "default" | "neymar";
}) {
  const gltf = useGLTF(charUrl(model));
  const inner = useRef<THREE.Group>(null);
  const { actions } = useAnimations(gltf.animations, inner);
  const current = useRef("");

  const rig = useMemo(() => {
    const root = skClone(gltf.scene);
    root.traverse((node) => {
      if (!(node as THREE.Mesh).isMesh) return;
      const mesh = node as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.material = mats.map((source) => {
        const mat = source.clone() as THREE.MeshStandardMaterial;
        const name = String(mat.name || "").toLowerCase();
        if (/shirt|top|body/.test(name)) {
          mat.color.lerp(new THREE.Color(skin === "neymar" ? "#f7c948" : "#e8edf5"), 0.45);
        }
        if (/pants|short/.test(name)) {
          mat.color.lerp(new THREE.Color(skin === "neymar" ? "#075d35" : "#111827"), 0.55);
        }
        if (/shoe|boot/.test(name)) {
          mat.color.lerp(new THREE.Color(skin === "neymar" ? "#2563eb" : "#111827"), 0.55);
        }
        if (skin === "neymar" && /hair/.test(name)) mat.color.set("#17120e");
        mat.roughness = Math.min(0.82, Math.max(0.38, mat.roughness || 0.58));
        return mat;
      });
    });
    const box = new THREE.Box3().setFromObject(root);
    const h = Math.max(0.001, box.max.y - box.min.y);
    const s = height / h;
    root.scale.setScalar(s);
    root.position.y = -box.min.y * s;
    return root;
  }, [gltf.scene, height, skin]);

  useFrame(() => {
    const requested = anim.current.name;
    const aliases: Record<string, string[]> = {
      idle: ["Idle", "idle", "Standing"],
      sprint: ["Run", "run", "Walk"],
      "attack-kick-right": ["Kick", "Punch", "kick", "Idle"],
      jump: ["Jump", "jump"],
      "emote-yes": ["Clapping", "Celebrate", "Idle"],
      "emote-no": ["Idle", "Standing"],
    };
    const names = aliases[requested] ?? aliases.idle;
    const clipName = names.find((name) => !!actions[name]) ?? Object.keys(actions)[0];
    if (!clipName || current.current === clipName) return;
    const next = actions[clipName];
    if (!next) return;
    const prev = current.current ? actions[current.current] : undefined;
    next.reset();
    next.timeScale = anim.current.speed ?? 1;
    next.setLoop(anim.current.once ? THREE.LoopOnce : THREE.LoopRepeat, anim.current.once ? 1 : Infinity);
    next.clampWhenFinished = !!anim.current.once;
    next.fadeIn(0.1).play();
    prev?.fadeOut(0.1);
    current.current = clipName;
  });

  return (
    <group ref={groupRef}>
      <group ref={inner}>
        <primitive object={rig} />
      </group>
    </group>
  );
}
function Vignette() {
  const { camera } = useThree();
  const ref = useRef<THREE.Mesh>(null);
  useEffect(() => {
    if (ref.current) camera.add(ref.current);
    return () => { if (ref.current) camera.remove(ref.current); };
  }, [camera]);
  return <mesh ref={ref} position={[0, 0, -0.65]} renderOrder={20}>
    <planeGeometry args={[2.2, 2.2]} />
    <shaderMaterial transparent depthWrite={false} depthTest={false}
      vertexShader={`varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`}
      fragmentShader={`varying vec2 vUv; void main(){vec2 p=vUv-0.5; float d=length(p)*1.35; float a=smoothstep(0.42,0.78,d)*0.62; gl_FragColor=vec4(0.005,0.012,0.008,a);}`}
    />
  </mesh>;
}

/* ---------------- cenário ---------------- */
function Goal({ solRef, timeRef }: { solRef: MutableRefObject<Solved | null>; timeRef: MutableRefObject<number> }) {
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

function Crowd({ excite }: { excite: MutableRefObject<number> }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const list: { x: number; y: number; z: number; ry: number; ph: number; s: number }[] = [];
    for (let row = 0; row < 9; row++) {
      for (let i = 0; i < 68; i++) {
        list.push({ x: -33.2 + i * 0.99 + (row % 2) * 0.28, y: 1.0 + row * 0.68, z: -8.2 - row * 0.82, ry: 0, ph: Math.random() * 6.28, s: 0.9 + Math.random() * 0.18 });
      }
    }
    for (const side of [-1, 1]) {
      for (let row = 0; row < 7; row++) {
        for (let i = 0; i < 44; i++) {
          list.push({ x: side * (37.2 + row * 0.92), y: 1.0 + row * 0.68, z: -2 + i * 1.05, ry: side * Math.PI / 2, ph: Math.random() * 6.28, s: 0.9 + Math.random() * 0.18 });
        }
      }
    }
    return list;
  }, []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const scale = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    const body = bodyRef.current;
    const head = headRef.current;
    if (!body || !head) return;
    const palette = ["#ec4899", "#f472b6", "#3b82f6", "#60a5fa", "#f5f5f5", "#facc15", "#7c3aed", "#111827"].map((x) => new THREE.Color(x));
    data.forEach((d, i) => {
      body.setColorAt(i, palette[(i * 7 + (i >> 2)) % palette.length]);
      head.setColorAt(i, new THREE.Color(i % 9 === 0 ? "#f1c7a8" : i % 5 === 0 ? "#8d5524" : "#d99a6c"));
    });
    body.instanceColor!.needsUpdate = true;
    head.instanceColor!.needsUpdate = true;
  }, [data]);
  useFrame(({ clock }) => {
    const body = bodyRef.current;
    const head = headRef.current;
    if (!body || !head) return;
    const ex = excite.current;
    excite.current = Math.max(0, ex - 0.004);
    data.forEach((d, i) => {
      const bob = Math.max(0, Math.sin(clock.elapsedTime * (2.2 + ex * 8) + d.ph)) * (0.025 + ex * 0.28);
      e.set(0, d.ry, 0);
      q.setFromEuler(e);
      v.set(d.x, d.y + bob, d.z);
      scale.set(d.s, d.s, d.s);
      m.compose(v, q, scale);
      body.setMatrixAt(i, m);
      v.y += 0.62 * d.s;
      scale.setScalar(d.s);
      m.compose(v, q, scale);
      head.setMatrixAt(i, m);
    });
    body.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, data.length]} frustumCulled={false}>
        <capsuleGeometry args={[0.19, 0.48, 4, 8]} />
        <meshStandardMaterial roughness={0.82} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, data.length]} frustumCulled={false}>
        <sphereGeometry args={[0.19, 10, 8]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
    </>
  );
}

function Stadium() {
  const tiers = [];
  for (let row = 0; row < 10; row++)
    tiers.push(
      <mesh key={"b" + row} position={[0, 0.28 + row * 0.68, -9 - row * 0.82]} receiveShadow>
        <boxGeometry args={[72, 0.46, 0.72]} />
        <meshStandardMaterial color={row % 2 ? "#343a46" : "#292f3a"} roughness={0.82} />
      </mesh>,
    );
  for (const s of [-1, 1])
    for (let row = 0; row < 8; row++)
      tiers.push(
        <mesh key={s + "s" + row} position={[s * (38 + row * 0.92), 0.28 + row * 0.68, 19]} receiveShadow>
          <boxGeometry args={[0.72, 0.46, 48]} />
          <meshStandardMaterial color={row % 2 ? "#343a46" : "#292f3a"} roughness={0.82} />
        </mesh>,
      );
  return (
    <group>
      {tiers}

      {/* anel superior do estádio */}
      <mesh position={[0, 7.5, -13.5]} rotation={[0.06, 0, 0]}>
        <boxGeometry args={[78, 0.5, 0.7]} />
        <meshStandardMaterial color="#151922" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 7.35, -13.1]}>
        <boxGeometry args={[70, 0.12, 0.12]} />
        <meshStandardMaterial color="#6ee7b7" emissive="#34d399" emissiveIntensity={2.4} />
      </mesh>

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

      {/* túneis laterais */}
      {[-1, 1].map((s) => (
        <mesh key={"tunnel" + s} position={[s * 30, 1.8, 7]} rotation={[0, s * Math.PI / 2, 0]}>
          <boxGeometry args={[5.2, 3.6, 4]} />
          <meshStandardMaterial color="#11151d" roughness={0.72} metalness={0.25} />
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
          <mesh position={[0, 23.2, 0]}>
            <boxGeometry args={[4.3, 0.04, 0.04]} />
            <meshBasicMaterial color="#fff7d6" transparent opacity={0.75} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -0.02, 28]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color="#1d4d22" roughness={1} />
      </mesh>
    </group>
  );
}

function KickImpact({ trigger, spot }: { trigger: MutableRefObject<number>; spot: { x: number; z: number } }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 36;
  const parts = useMemo(() => Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0 })), []);
  const last = useRef(0);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.04);
    const im = ref.current;
    if (!im) return;
    if (trigger.current !== last.current) {
      last.current = trigger.current;
      parts.forEach((p) => {
        p.p.set(spot.x + (Math.random() - 0.5) * 0.28, 0.04, spot.z + (Math.random() - 0.5) * 0.28);
        p.v.set((Math.random() - 0.5) * 2.6, 0.35 + Math.random() * 1.8, (Math.random() - 0.5) * 2.6);
        p.life = 1;
      });
    }
    parts.forEach((p, i) => {
      if (p.life > 0) {
        p.v.y -= 3.5 * dt;
        p.p.addScaledVector(p.v, dt);
        p.life = Math.max(0, p.life - dt * 2.8);
      }
      sc.setScalar(p.life * 0.045);
      m.compose(p.p, new THREE.Quaternion(), sc);
      im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false}>
    <sphereGeometry args={[1, 6, 6]} />
    <meshBasicMaterial color="#d9f99d" transparent opacity={0.9} />
  </instancedMesh>;
}

function Confetti({ trigger }: { trigger: MutableRefObject<number> }) {
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
  const ballTex = useBallTex();
  const sol = useMemo(() => (p.shot ? solve(p.shot) : null), [p.shot]);
  const solRef = useRef<Solved | null>(null);
  solRef.current = sol;
  const tRef = useRef(0);
  const excite = useRef(0);
  const confetti = useRef(0);
  const kickImpact = useRef(0);
  const firedFor = useRef<Solved | null>(null);
  const impactFiredFor = useRef<Solved | null>(null);
  const groundImpactFor = useRef<Solved | null>(null);

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
  }, [p.view, p.shot, p.mode, sx, sz, p.aim.x, p.aim.y, p.curve, p.power]);

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
    if (sol && tk >= 0.28 && tk < 0.5 && impactFiredFor.current !== sol) {
      impactFiredFor.current = sol;
      kickImpact.current++;
    }

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
    if (sol && tk > 0 && bp[1] < BALL_R + 0.07 && Math.abs(tk - sol.flight * 0.72) < 0.06 && groundImpactFor.current !== sol) {
      groundImpactFor.current = sol;
      kickImpact.current++;
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
    } else if (p.view === "watch") {
      // câmera de transmissão: lateral baixa, acompanhando a cobrança como uma TV esportiva.
      const side = sx >= 0 ? -1 : 1;
      want.set(side * 13.5, 3.15, Math.max(2.5, sz * 0.55 + 5.5));
      target.set(0, 1.05, Math.max(0, sz * 0.18));
      if (sol && tk > 0) {
        want.lerp(new THREE.Vector3(bp[0] + side * 8, 2.7, bp[2] + 7), 0.5);
        target.lerp(new THREE.Vector3(bp[0], Math.max(0.7, bp[1]), bp[2]), 0.7);
      }
      fov = 42;
    } else {
      // câmera do cobrador: próxima o bastante para dar sensação de controle, aberta o bastante para ver gol e goleiro.
      want.set(sx, 0.35, sz).addScaledVector(dir.d, -8.4).addScaledVector(dir.perp, -2.8);
      want.y = p.mode === "falta" ? 3.05 : 2.65;
      target.set(0, 1.15, 0);
      if (sol && tk > 0) {
        const k = Math.min(1, tk / (sol.flight + 0.3));
        want.lerp(new THREE.Vector3(bp[0] * 0.5, 1.9, Math.max(4, bp[2] + 6.5)), k * 0.6);
        target.lerp(new THREE.Vector3(bp[0], bp[1], bp[2]), 0.58);
      }
      fov = 48;
    }
    const snap = camMode !== "live" ? 9 : 4;
    cam.position.x = THREE.MathUtils.damp(cam.position.x, want.x, snap, dt);
    cam.position.y = THREE.MathUtils.damp(cam.position.y, want.y, snap, dt);
    cam.position.z = THREE.MathUtils.damp(cam.position.z, want.z, snap, dt);
    look.current.lerp(target, 1 - Math.exp(-snap * dt));
    if (sol && sol.result === "post" && tk >= sol.flight - 0.08 && tk <= sol.flight + 0.18) {
      const shake = 0.055 * Math.max(0, 1 - Math.abs(tk - sol.flight) * 5);
      cam.position.x += Math.sin(clock.elapsedTime * 90) * shake;
      cam.position.y += Math.cos(clock.elapsedTime * 76) * shake * 0.7;
    }
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
      <ProceduralGrass />
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={"turf-" + i} position={[0, 0.002, -8 + i * 6.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[68, 6.5]} />
          <meshBasicMaterial color={i % 2 ? "#2b7731" : "#337f38"} transparent opacity={0.16} />
        </mesh>
      ))}
      <Stadium />
      <group position={[0, 0.012, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[40.32, 33]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.025} /></mesh>
        <mesh position={[0, 0.006, 16.5]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[40.32, 0.045]} /><meshBasicMaterial color="#f8fafc" /></mesh>
        <mesh position={[-20.16, 0.006, 8.25]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}><planeGeometry args={[16.5, 0.045]} /><meshBasicMaterial color="#f8fafc" /></mesh>
        <mesh position={[20.16, 0.006, 8.25]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}><planeGeometry args={[16.5, 0.045]} /><meshBasicMaterial color="#f8fafc" /></mesh>
        <mesh position={[0, 0.008, 11]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.16, 24]} /><meshBasicMaterial color="#ffffff" /></mesh>
      </group>
      <Crowd excite={excite} />
      <GrassDebris trigger={kickImpact} spot={p.spot} />
      <ContactShadows position={[0, 0.015, 0]} opacity={0.28} scale={38} blur={2.4} far={8} resolution={512} />
      <Goal solRef={solRef} timeRef={tRef} />
      <Confetti trigger={confetti} />
      <KickImpact trigger={kickImpact} spot={p.spot} />

      <mesh ref={ball} castShadow>
        <sphereGeometry args={[BALL_R, 40, 28]} />
        <meshPhysicalMaterial map={ballTex} roughness={0.28} clearcoat={0.65} clearcoatRoughness={0.18} />
      </mesh>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.16, 20]} />
        <meshBasicMaterial color="black" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={i} ref={(m) => void (m && (trail.current[i] = m))} visible={false}>
          <sphereGeometry args={[BALL_R * 0.8, 10, 8]} />
          <meshBasicMaterial color="#bbf7d0" transparent opacity={0.26} depthWrite={false} />
        </mesh>
      ))}

      <Suspense fallback={null}>
        <Person model={p.kickerModel} groupRef={kicker} anim={kAnim} skin={p.kickerSkin} />
        <Person model={p.keeperModel} groupRef={keeper} anim={gAnim} height={1.9} skin={p.keeperSkin} />
        {wall && wallRefs.map((r, i) => <Person key={i} model={["male-b", "male-d", "male-e", "male-f"][i]} groupRef={r} anim={wAnim} />)}
      </Suspense>

      {/* plano invisível para mirar */}
      <mesh
        position={[0, 2.2, 0.22]}
        onPointerDown={(e) => {
          dragging.current = true;
          setAim(e);
        }}
        onPointerMove={(e) => dragging.current && setAim(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => (dragging.current = false)}
      >
        <planeGeometry args={[18, 7]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Vignette />
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
    useGLTF.preload(charUrl(props.kickerModel));
    useGLTF.preload(charUrl(props.keeperModel));
  }, [props.kickerModel, props.keeperModel]);
  return (
    <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance", stencil: false }} camera={{ position: [0, 2, 17], fov: 50, near: 0.1, far: 300 }}>
      <color attach="background" args={["#0d1426"]} />
      <fog attach="fog" args={["#0d1426", 45, 110]} />
      <hemisphereLight args={["#dcecff", "#102b14", 0.82]} />
      <ambientLight intensity={0.24} />
      <directionalLight
        position={[12, 26, 22]}
        intensity={2.7}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={30}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-18, 14, -8]} intensity={1.15} color="#ffe9c4" />
      <directionalLight position={[18, 10, -18]} intensity={0.75} color="#cfe1ff" />
      <Environment resolution={128}>
        <Lightformer intensity={2} position={[0, 10, 10]} scale={[20, 6, 1]} />
        <Lightformer intensity={1.2} color="#ffd6e8" position={[-10, 4, 0]} rotation-y={Math.PI / 2} scale={[20, 2, 1]} />
        <Lightformer intensity={1.2} color="#d6e4ff" position={[10, 4, 0]} rotation-y={-Math.PI / 2} scale={[20, 2, 1]} />
      </Environment>
      <Game {...props} />
    </Canvas>
  );
}
