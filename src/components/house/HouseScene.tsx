import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Html, Lightformer, useAnimations, useGLTF, ContactShadows } from "@react-three/drei";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clone as skClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CAT_BY_KEY, FLOORS, HOUSE, ROOM, ROOM_NAMES, WALLS, type Home, type PlacedItem, type Who } from "@/lib/home";

export type Avatar = { x: number; z: number; room?: number; sit: string | null; emote: string | null; emoteAt: number; say?: string; sayAt?: number };

/** deslocamento (x,z) do canto do cômodo no mundo */
const roomOff = (r = 0): [number, number] => [(r % 2) * ROOM, Math.floor(r / 2) * ROOM];

const isTop = (k: string) => !!CAT_BY_KEY[k]?.top;
const furnUrl = (k: string) => `/house/furn/${k}.glb`;

const sizeCache = new WeakMap<object, { w: number; d: number; h: number; off: THREE.Vector3 }>();
function measure(scene: THREE.Object3D) {
  let s = sizeCache.get(scene);
  if (!s) {
    const b = new THREE.Box3().setFromObject(scene);
    const c = b.getCenter(new THREE.Vector3());
    s = { w: b.max.x - b.min.x, d: b.max.z - b.min.z, h: b.max.y - b.min.y, off: new THREE.Vector3(-c.x, -b.min.y, -c.z) };
    sizeCache.set(scene, s);
  }
  return s;
}
function useFurn(k: string) {
  const { scene } = useGLTF(furnUrl(k));
  return { scene, size: measure(scene) };
}
/** item "de cima" (TV, abajur...) apoia na superfície embaixo dele */
function BaseHeight({ item, items, children }: { item: PlacedItem; items: PlacedItem[]; children: (y: number) => React.ReactNode }) {
  // apoia na superfície mais próxima (mesa, balcão, rack, cama...)
  let base: PlacedItem | undefined;
  if (isTop(item.k)) {
    let best = 0.62;
    for (const o of items) {
      if (o.uid === item.uid || isTop(o.k) || CAT_BY_KEY[o.k]?.flat) continue;
      const d = Math.max(Math.abs(o.x - item.x), Math.abs(o.z - item.z));
      if (d < best) {
        best = d;
        base = o;
      }
    }
  }
  return base ? <BaseH k={base.k}>{children}</BaseH> : <>{children(0)}</>;
}
function BaseH({ k, children }: { k: string; children: (y: number) => React.ReactNode }) {
  const { size } = useFurn(k);
  return <>{children(size.h - 0.01)}</>;
}

function Furn({
  item, y, ghost, selected, onPick,
}: { item: PlacedItem; y: number; ghost?: boolean; selected?: boolean; onPick?: (e: ThreeEvent<MouseEvent>) => void }) {
  const { scene, size } = useFurn(item.k);
  const obj = useMemo(() => {
    const o = scene.clone(true);
    o.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (ghost) {
          const mat = (mesh.material as THREE.Material).clone() as THREE.MeshStandardMaterial;
          mat.transparent = true;
          mat.opacity = 0.55;
          mesh.material = mat;
        }
      }
    });
    return o;
  }, [scene, ghost]);
  const long = Math.max(size.w, size.d);
  return (
    <group position={[item.x, y, item.z]} rotation-y={(item.r * Math.PI) / 2} onClick={onPick}>
      <primitive object={obj} position={size.off} />
      {(selected || ghost) && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.012 - y}>
          <ringGeometry args={[long * 0.55, long * 0.55 + 0.05, 48]} />
          <meshBasicMaterial color={ghost ? "#ffffff" : "#ff5fa2"} transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
}

function woodTexture(a: string, b: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const rows = 8;
  for (let i = 0; i < rows; i++) {
    const off = (i % 2) * 128;
    for (let j = -1; j < 3; j++) {
      g.fillStyle = (i + j) % 2 ? a : b;
      g.fillRect(off + j * 256, i * 64, 256, 64);
      for (let s = 0; s < 14; s++) {
        g.strokeStyle = `rgba(60,30,10,${0.04 + Math.random() * 0.05})`;
        g.beginPath();
        const yy = i * 64 + Math.random() * 64;
        g.moveTo(off + j * 256, yy);
        g.bezierCurveTo(off + j * 256 + 80, yy + 3, off + j * 256 + 170, yy - 3, off + j * 256 + 256, yy);
        g.stroke();
      }
      g.fillStyle = "rgba(40,20,5,0.35)";
      g.fillRect(off + j * 256, i * 64, 2, 64);
    }
    g.fillStyle = "rgba(40,20,5,0.3)";
    g.fillRect(0, i * 64, 512, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function wallTexture(color: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 32) {
    g.fillStyle = "rgba(255,255,255,0.10)";
    g.fillRect(x, 0, 14, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const WALL_H = 2.2;
const FRAMES: { room: number; pos: [number, number, number]; rot: number; small?: boolean }[] = [
  { room: 0, pos: [0.02, 1.35, 1.5], rot: Math.PI / 2 },
  { room: 0, pos: [0.02, 1.35, 3.0], rot: Math.PI / 2, small: true },
  { room: 2, pos: [0.02, 1.35, 1.5], rot: Math.PI / 2 },
  { room: 2, pos: [0.02, 1.35, 3.0], rot: Math.PI / 2, small: true },
  { room: 0, pos: [2.25, 1.4, 0.02], rot: 0, small: true },
  { room: 1, pos: [2.25, 1.4, 0.02], rot: 0, small: true },
];
export type Door = { side: "left" | "back" | "right" | "front"; to: number; x: number; z: number };
/** portas do cômodo (coordenadas locais) */
export function roomDoors(r: number): Door[] {
  const col = r % 2;
  const row = Math.floor(r / 2);
  const d: Door[] = [];
  if (col === 1) d.push({ side: "left", to: r - 1, x: 0, z: ROOM / 2 });
  if (col === 0) d.push({ side: "right", to: r + 1, x: ROOM, z: ROOM / 2 });
  if (row === 1) d.push({ side: "back", to: r - 2, x: ROOM / 2, z: 0 });
  if (row === 0) d.push({ side: "front", to: r + 2, x: ROOM / 2, z: ROOM });
  return d;
}
const GAP = 0.8;
/** parede com vão de porta opcional; along = eixo da parede */
function WallSeg({ axis, at, h, door, map, color }: { axis: "x" | "z"; at: number; h: number; door: boolean; map?: THREE.Texture; color?: string }) {
  const parts: [number, number][] = door ? [[0, ROOM / 2 - GAP / 2], [ROOM / 2 + GAP / 2, ROOM]] : [[0, ROOM]];
  return (
    <group>
      {parts.map(([a, b], i) => {
        const len = b - a;
        const mid = (a + b) / 2;
        const pos: [number, number, number] = axis === "x" ? [mid, h / 2, at] : [at, h / 2, mid];
        const size: [number, number, number] = axis === "x" ? [len + 0.16, h, 0.16] : [0.16, h, len + 0.16];
        return (
          <mesh key={i} position={pos} receiveShadow castShadow>
            <boxGeometry args={size} />
            {map ? <meshStandardMaterial map={map} roughness={0.95} /> : <meshStandardMaterial color={color} roughness={0.9} />}
          </mesh>
        );
      })}
    </group>
  );
}
function Room({ home, room, onFloor, onDoor, night, frameUrls, onFrame }: { home: Home; room: number; onFloor: (x: number, z: number) => void; onDoor: (d: Door) => void; night: boolean; frameUrls: (string | null)[]; onFrame: (i: number) => void }) {
  const f = FLOORS.find((x) => x.id === home.floor) ?? FLOORS[0];
  const w = WALLS.find((x) => x.id === home.wall) ?? WALLS[0];
  const floorTex = useMemo(() => {
    const t = woodTexture(f.a, f.b);
    t.repeat.set(1, 1);
    return t;
  }, [f.a, f.b]);
  const wallTex = useMemo(() => wallTexture(w.color), [w.color]);
  const doors = roomDoors(room);
  const has = (s: Door["side"]) => doors.some((d) => d.side === s);
  const outerBack = Math.floor(room / 2) === 0;
  const outerLeft = room % 2 === 0;
  return (
    <group>
      <mesh position={[ROOM / 2, -0.16, ROOM / 2]} receiveShadow>
        <boxGeometry args={[ROOM + 0.3, 0.3, ROOM + 0.3]} />
        <meshStandardMaterial color="#6b5446" roughness={0.9} />
      </mesh>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[ROOM / 2, 0, ROOM / 2]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onFloor(e.point.x, e.point.z);
        }}
      >
        <planeGeometry args={[ROOM, ROOM]} />
        <meshStandardMaterial map={floorTex} roughness={0.75} />
      </mesh>
      {/* paredes do fundo e da esquerda: altas */}
      <WallSeg axis="x" at={-0.08} h={WALL_H} door={has("back")} map={wallTex} />
      <WallSeg axis="z" at={-0.08} h={WALL_H} door={has("left")} map={wallTex} />
      {/* paredes da frente: baixinhas pra dar pra ver dentro */}
      <WallSeg axis="x" at={ROOM + 0.08} h={0.35} door={has("front")} color={w.color} />
      <WallSeg axis="z" at={ROOM + 0.08} h={0.35} door={has("right")} color={w.color} />
      {outerBack && (
        <>
          <Window x={1.0} night={night} />
          <Window x={3.5} night={night} />
        </>
      )}
      {!outerBack && outerLeft && <Window x={1.0} night={night} />}
      {FRAMES.map((fr, i) =>
        fr.room === room ? <Frame key={i} pos={fr.pos} rot={fr.rot} small={fr.small} url={frameUrls[i] ?? null} onTap={() => onFrame(i)} /> : null,
      )}
      {doors.map((d) => {
        const inX = d.side === "left" ? 0.35 : d.side === "right" ? ROOM - 0.35 : d.x;
        const inZ = d.side === "back" ? 0.35 : d.side === "front" ? ROOM - 0.35 : d.z;
        const rotY = d.side === "left" || d.side === "right" ? Math.PI / 2 : 0;
        return (
          <group key={d.side} position={[inX, 0.011, inZ]}>
            <mesh
              rotation-x={-Math.PI / 2}
              rotation-z={rotY}
              onClick={(e) => {
                e.stopPropagation();
                onDoor(d);
              }}
            >
              <planeGeometry args={[GAP, 0.6]} />
              <meshStandardMaterial color="#ff8fbf" emissive="#ff5fa2" emissiveIntensity={0.35} transparent opacity={0.75} />
            </mesh>
            <Html position={[0, 0.25, 0]} center zIndexRange={[5, 0]}>
              <button
                onClick={() => onDoor(d)}
                className="whitespace-nowrap rounded-full bg-pink-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow"
              >
                {ROOM_NAMES[d.to]}
              </button>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function Window({ x, night }: { x: number; night: boolean }) {
  return (
    <group position={[x, 1.25, 0.01]}>
      <mesh>
        <boxGeometry args={[1.0, 0.9, 0.04]} />
        <meshStandardMaterial color="#fbf7f0" />
      </mesh>
      <mesh position-z={0.022}>
        <planeGeometry args={[0.86, 0.76]} />
        <meshStandardMaterial
          color={night ? "#1f2a55" : "#a9d6f5"}
          emissive={night ? "#2a3a7a" : "#bfe4ff"}
          emissiveIntensity={night ? 0.5 : 0.6}
        />
      </mesh>
      <mesh position-z={0.03}>
        <boxGeometry args={[0.03, 0.76, 0.01]} />
        <meshStandardMaterial color="#fbf7f0" />
      </mesh>
      <mesh position-z={0.03}>
        <boxGeometry args={[0.86, 0.03, 0.01]} />
        <meshStandardMaterial color="#fbf7f0" />
      </mesh>
      <mesh position={[0, -0.48, 0.06]}>
        <boxGeometry args={[1.1, 0.05, 0.12]} />
        <meshStandardMaterial color="#fbf7f0" />
      </mesh>
    </group>
  );
}
function Frame({ pos, rot, small, url, onTap }: { pos: [number, number, number]; rot: number; small?: boolean; url: string | null; onTap: () => void }) {
  const s = small ? 0.5 : 0.75;
  const pw = s * 0.85;
  const ph = s * 0.62;
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    let alive = true;
    const l = new THREE.TextureLoader();
    l.setCrossOrigin("anonymous");
    l.load(url, (t) => {
      if (!alive) return t.dispose();
      t.colorSpace = THREE.SRGBColorSpace;
      // recorte tipo "cover"
      const img = t.image as { width: number; height: number };
      const ia = img.width / img.height;
      const fa = pw / ph;
      if (ia > fa) {
        t.repeat.set(fa / ia, 1);
        t.offset.set((1 - fa / ia) / 2, 0);
      } else {
        t.repeat.set(1, ia / fa);
        t.offset.set(0, (1 - ia / fa) / 2);
      }
      setTex(t);
    });
    return () => {
      alive = false;
    };
  }, [url, pw, ph]);
  return (
    <group
      position={pos}
      rotation-y={rot}
      onClick={(e) => {
        e.stopPropagation();
        onTap();
      }}
    >
      <mesh>
        <boxGeometry args={[s, s * 0.75, 0.03]} />
        <meshStandardMaterial color="#5a3d2b" />
      </mesh>
      <mesh position-z={0.017}>
        <planeGeometry args={[pw, ph]} />
        {tex ? <meshBasicMaterial map={tex} toneMapped={false} /> : <meshStandardMaterial color={small ? "#f0b6c8" : "#e9d7a8"} />}
      </mesh>
    </group>
  );
}

// ---------- personagens ----------
function Character({
  model, who, av, items, label, speed = 1.8,
}: { model: string; who: Who; av: Avatar; items: PlacedItem[]; label: string; speed?: number }) {
  const gltf = useGLTF(`/house/chars/character-${model}.glb`);
  const obj = useMemo(() => {
    const o = skClone(gltf.scene);
    o.traverse((m) => ((m as THREE.Mesh).isMesh ? (((m as THREE.Mesh).castShadow = true), undefined) : undefined));
    return o;
  }, [gltf.scene]);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(gltf.animations, group);
  const cur = useRef<string>("");
  const pos = useRef(new THREE.Vector3(av.x, 0, av.z));
  const firstRef = useRef(true);
  const [bubble, setBubble] = useState<string | null>(null);
  useEffect(() => {
    if (!av.say || !av.sayAt) return;
    const left = 6000 - (Date.now() - av.sayAt);
    if (left <= 0) return;
    setBubble(av.say);
    const t = window.setTimeout(() => setBubble(null), left);
    return () => window.clearTimeout(t);
  }, [av.say, av.sayAt]);

  const seat = av.sit ? items.find((i) => i.uid === av.sit) : undefined;
  const target = useMemo(() => {
    if (seat) {
      const side = who === "gu" ? -0.22 : 0.22;
      const a = (seat.r * Math.PI) / 2;
      return new THREE.Vector3(seat.x + Math.cos(a) * side, 0, seat.z - Math.sin(a) * side);
    }
    return new THREE.Vector3(av.x, 0, av.z);
  }, [seat, av.x, av.z, who]);

  const roomRef = useRef(av.room ?? 0);
  useLayoutEffect(() => {
    if (firstRef.current || roomRef.current !== (av.room ?? 0)) {
      pos.current.copy(target);
      firstRef.current = false;
      roomRef.current = av.room ?? 0;
    }
  }, [target, av.room]);

  const play = (name: string, once = false) => {
    if (cur.current === name) return;
    const next = actions[name];
    if (!next) return;
    const prev = cur.current ? actions[cur.current] : null;
    next.reset();
    if (once) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    } else next.setLoop(THREE.LoopRepeat, Infinity);
    next.fadeIn(0.18).play();
    prev?.fadeOut(0.18);
    cur.current = name;
  };

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const g = group.current;
    if (!g) return;
    const d = target.clone().sub(pos.current);
    d.y = 0;
    const dist = d.length();
    const emoting = av.emote && Date.now() - av.emoteAt < 1600;
    if (dist > 0.03) {
      const step = Math.min(dist, speed * dt);
      pos.current.addScaledVector(d.normalize(), step);
      const want = Math.atan2(d.x, d.z);
      let diff = want - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * (1 - Math.exp(-14 * dt));
      play("walk");
    } else if (seat) {
      const want = (seat.r * Math.PI) / 2;
      let diff = want - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * (1 - Math.exp(-12 * dt));
      play("sit");
    } else if (emoting) {
      play(av.emote!, true);
    } else play("idle");
    const seatY = seat && dist < 0.05 ? (CAT_BY_KEY[seat.k]?.key.startsWith("bed") ? 0.2 : 0.14) : 0;
    g.position.set(pos.current.x, THREE.MathUtils.damp(g.position.y, seatY, 10, dt), pos.current.z);
  });

  return (
    <group ref={group}>
      <primitive object={obj} scale={0.95} />
      <Html position={[0, 0.95, 0]} center distanceFactor={undefined} zIndexRange={[10, 0]}>
        <div className="pointer-events-none flex select-none flex-col items-center gap-1">
          {bubble && (
            <div className="relative mb-1 max-w-[180px] whitespace-normal break-words rounded-2xl bg-white px-2.5 py-1.5 text-center text-[11px] font-medium leading-snug text-neutral-900 shadow-lg">
              {bubble}
              <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-white" />
            </div>
          )}
          <div className="whitespace-nowrap rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">{label}</div>
        </div>
      </Html>
    </group>
  );
}

function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}
function PetModel({ kind, sad, onTap, action }: { kind: string; sad: boolean; onTap: () => void; action: { name: string; at: number } | null }) {
  const gltf = useGLTF(`/house/pets/animal-${kind}.glb`);
  const obj = useMemo(() => {
    const o = skClone(gltf.scene);
    o.traverse((m) => ((m as THREE.Mesh).isMesh ? (((m as THREE.Mesh).castShadow = true), undefined) : undefined));
    return o;
  }, [gltf.scene]);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(gltf.animations, group);
  const cur = useRef("");
  const pos = useRef(new THREE.Vector3(2, 0, 2));
  const play = (n: string) => {
    if (cur.current === n || !actions[n]) return;
    actions[n]!.reset().fadeIn(0.2).play();
    if (cur.current) actions[cur.current]?.fadeOut(0.2);
    cur.current = n;
  };
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const g = group.current;
    if (!g) return;
    // passeio igual nos dois aparelhos: posição derivada do relógio
    const seg = Math.floor(Date.now() / 7000);
    const tgt = new THREE.Vector3(0.8 + hash(seg) * (ROOM - 1.6), 0, 0.8 + hash(seg + 99) * (ROOM - 1.6));
    const d = tgt.sub(pos.current);
    const dist = d.length();
    const acting = action && Date.now() - action.at < 2200;
    if (acting) play(action!.name);
    else if (dist > 0.05 && !sad) {
      pos.current.addScaledVector(d.normalize(), Math.min(dist, 0.7 * dt));
      const want = Math.atan2(d.x, d.z);
      let diff = want - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * (1 - Math.exp(-8 * dt));
      play("walk");
    } else play(sad ? "gesture-negative" : "idle");
    g.position.set(pos.current.x, 0.06, pos.current.z);
  });
  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation();
        onTap();
      }}
    >
      <primitive object={obj} scale={0.2} />
    </group>
  );
}

function CameraRig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.position.set(ROOM / 2 + 10, 9.5, ROOM / 2 + 10);
    cam.lookAt(ROOM / 2, 0.6, ROOM / 2);
    cam.zoom = Math.min(size.width * 1.05, size.height * 1.2) / (ROOM * 1.5);
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

export type SceneProps = {
  home: Home;
  me: Who;
  avatars: Record<Who, Avatar>;
  online: Record<Who, boolean>;
  decor: boolean;
  selected: string | null;
  ghost: PlacedItem | null;
  petAction: { name: string; at: number } | null;
  onFloor: (x: number, z: number) => void;
  onItem: (it: PlacedItem) => void;
  onPet: () => void;
  frameUrls: (string | null)[];
  onFrame: (i: number) => void;
  room: number;
  onDoor: (d: Door) => void;
};

export default function HouseScene(p: SceneProps) {
  const hour = new Date().getHours();
  const night = hour >= 19 || hour < 6;
  const items = p.home.items;
  // posições no mundo = posição local + deslocamento do cômodo
  // só o cômodo atual aparece (coordenadas locais)
  const wItems = useMemo(() => items.filter((it) => (it.room ?? 0) === p.room), [items, p.room]);
  const wGhost = p.ghost;
  const petSad = p.home.pet ? Date.now() - p.home.pet.lastFed > 14 * 3600_000 : false;
  return (
    <Canvas shadows orthographic dpr={[1, 1.75]} camera={{ near: 0.1, far: 100 }} gl={{ antialias: true, alpha: true }}>
      <CameraRig />
      <ambientLight intensity={night ? 0.35 : 0.55} color={night ? "#9fb0ff" : "#fff4e6"} />
      <hemisphereLight args={[night ? "#8090ff" : "#fff1dc", "#6b4a3a", night ? 0.35 : 0.6]} />
      <directionalLight
        position={[9, 12, 5]}
        intensity={night ? 0.5 : 1.6}
        color={night ? "#aab8ff" : "#ffe8c7"}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0008}
      />
      {night && <pointLight position={[ROOM / 2, 1.8, ROOM / 2]} intensity={8} distance={8} color="#ffcf8a" />}
      <Environment resolution={64}>
        <Lightformer intensity={1.4} position={[0, 5, 0]} scale={[10, 10, 1]} rotation-x={Math.PI / 2} />
        <Lightformer intensity={0.8} color="#ffd9c0" position={[-5, 2, 3]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
      </Environment>
      <Suspense fallback={null}>
        <Room home={p.home} room={p.room} onFloor={p.onFloor} onDoor={p.onDoor} night={night} frameUrls={p.frameUrls} onFrame={p.onFrame} />
        {wItems.map((it) =>
          p.ghost && p.selected === it.uid ? null : (
            <BaseHeight key={it.uid} item={it} items={wItems}>
              {(y) => (
                <Furn
                  item={it}
                  y={y}
                  selected={p.decor && p.selected === it.uid}
                  onPick={(e) => {
                    e.stopPropagation();
                    p.onItem(it);
                  }}
                />
              )}
            </BaseHeight>
          ),
        )}
        {wGhost && (
          <BaseHeight item={wGhost} items={wItems}>
            {(y) => <Furn item={wGhost} y={y} ghost />}
          </BaseHeight>
        )}
        {(["gu", "li"] as Who[]).map((w) =>
          w === p.me || (p.online[w] && (p.avatars[w].room ?? 0) === p.room) ? (
            <Character key={w + p.home.avatars[w]} who={w} model={p.home.avatars[w]} av={p.avatars[w]} items={wItems} label={w === "gu" ? "bb gu" : "bb li"} />
          ) : null,
        )}
        {p.home.pet && <PetModel kind={p.home.pet.kind} sad={petSad} onTap={p.onPet} action={p.petAction} />}
        <ContactShadows position={[ROOM / 2, 0.005, ROOM / 2]} scale={ROOM} opacity={0.35} blur={2.4} far={1.5} resolution={512} />
      </Suspense>
    </Canvas>
  );
}

export function preloadHouse(home: Home) {
  home.items.forEach((i) => useGLTF.preload(furnUrl(i.k)));
  useGLTF.preload(`/house/chars/character-${home.avatars.gu}.glb`);
  useGLTF.preload(`/house/chars/character-${home.avatars.li}.glb`);
}
