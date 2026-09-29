import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Html, Lightformer, useAnimations, useGLTF, ContactShadows } from "@react-three/drei";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as skClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CAT_BY_KEY, FLOORS, ROOM, WALLS, type Home, type PlacedItem, type Who } from "@/lib/home";

export type Avatar = { x: number; z: number; sit: string | null; emote: string | null; emoteAt: number };

const TOP_ITEMS = new Set([
  "televisionModern", "televisionVintage", "lampRoundTable", "laptop", "computerScreen", "books", "plantSmall1",
  "plantSmall2", "plantSmall3", "radio", "kitchenCoffeeMachine", "kitchenMicrowave", "pillow", "pillowBlue", "bear", "speaker",
]);
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
export function footprint(k: string, r: number) {
  const g = useGLTF.cache?.get?.(furnUrl(k));
  void g;
  return null;
}

/** item "de cima" (TV, abajur...) apoia na superfície embaixo dele */
function BaseHeight({ item, items, children }: { item: PlacedItem; items: PlacedItem[]; children: (y: number) => React.ReactNode }) {
  const base = TOP_ITEMS.has(item.k)
    ? items.find((o) => o.uid !== item.uid && !TOP_ITEMS.has(o.k) && !CAT_BY_KEY[o.k]?.flat && Math.abs(o.x - item.x) < 0.35 && Math.abs(o.z - item.z) < 0.35)
    : undefined;
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
function Room({ home, onFloor, night }: { home: Home; onFloor: (x: number, z: number) => void; night: boolean }) {
  const f = FLOORS.find((x) => x.id === home.floor) ?? FLOORS[0];
  const w = WALLS.find((x) => x.id === home.wall) ?? WALLS[0];
  const floorTex = useMemo(() => woodTexture(f.a, f.b), [f.a, f.b]);
  const wallTex = useMemo(() => wallTexture(w.color), [w.color]);
  return (
    <group>
      {/* base da casa */}
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
      {/* parede do fundo (z=0) com janela */}
      <group>
        <mesh position={[ROOM / 2, WALL_H / 2, -0.08]} receiveShadow castShadow>
          <boxGeometry args={[ROOM + 0.16, WALL_H, 0.16]} />
          <meshStandardMaterial map={wallTex} roughness={0.95} />
        </mesh>
        <mesh position={[ROOM / 2, 0.06, 0.005]}>
          <boxGeometry args={[ROOM, 0.12, 0.02]} />
          <meshStandardMaterial color="#f7f1e8" />
        </mesh>
        <Window x={1.4} night={night} />
        <Window x={4.6} night={night} />
      </group>
      {/* parede esquerda (x=0) */}
      <mesh position={[-0.08, WALL_H / 2, ROOM / 2]} receiveShadow castShadow>
        <boxGeometry args={[0.16, WALL_H, ROOM]} />
        <meshStandardMaterial map={wallTex} roughness={0.95} />
      </mesh>
      <mesh position={[0.005, 0.06, ROOM / 2]}>
        <boxGeometry args={[0.02, 0.12, ROOM]} />
        <meshStandardMaterial color="#f7f1e8" />
      </mesh>
      <Frame z={2} />
      <Frame z={3.6} small />
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
function Frame({ z, small }: { z: number; small?: boolean }) {
  const s = small ? 0.45 : 0.7;
  return (
    <group position={[0.02, 1.35, z]} rotation-y={Math.PI / 2}>
      <mesh>
        <boxGeometry args={[s, s * 0.75, 0.03]} />
        <meshStandardMaterial color="#5a3d2b" />
      </mesh>
      <mesh position-z={0.017}>
        <planeGeometry args={[s * 0.85, s * 0.62]} />
        <meshStandardMaterial color={small ? "#f0b6c8" : "#e9d7a8"} />
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

  const seat = av.sit ? items.find((i) => i.uid === av.sit) : undefined;
  const target = useMemo(() => {
    if (seat) {
      const side = who === "gu" ? -0.22 : 0.22;
      const a = (seat.r * Math.PI) / 2;
      return new THREE.Vector3(seat.x + Math.cos(a) * side, 0, seat.z - Math.sin(a) * side);
    }
    return new THREE.Vector3(av.x, 0, av.z);
  }, [seat, av.x, av.z, who]);

  useLayoutEffect(() => {
    if (firstRef.current) {
      pos.current.copy(target);
      firstRef.current = false;
    }
  }, [target]);

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
        <div className="pointer-events-none select-none whitespace-nowrap rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
          {label}
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
    const tgt = new THREE.Vector3(0.8 + hash(seg) * (ROOM - 1.6), 0, 1.4 + hash(seg + 99) * (ROOM - 2.2));
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
    cam.lookAt(ROOM / 2, 0.5, ROOM / 2);
    cam.zoom = Math.min(size.width, size.height * 1.25) / (ROOM * 1.75);
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
};

export default function HouseScene(p: SceneProps) {
  const hour = new Date().getHours();
  const night = hour >= 19 || hour < 6;
  const items = p.home.items;
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
      {night && <pointLight position={[3, 1.8, 3]} intensity={6} distance={7} color="#ffcf8a" />}
      <Environment resolution={64}>
        <Lightformer intensity={1.4} position={[0, 5, 0]} scale={[10, 10, 1]} rotation-x={Math.PI / 2} />
        <Lightformer intensity={0.8} color="#ffd9c0" position={[-5, 2, 3]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
      </Environment>
      <Suspense fallback={null}>
        <Room home={p.home} onFloor={p.onFloor} night={night} />
        {items.map((it) =>
          p.ghost && p.selected === it.uid ? null : (
            <BaseHeight key={it.uid} item={it} items={items}>
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
        {p.ghost && (
          <BaseHeight item={p.ghost} items={items}>
            {(y) => <Furn item={p.ghost!} y={y} ghost />}
          </BaseHeight>
        )}
        {(["gu", "li"] as Who[]).map((w) =>
          w === p.me || p.online[w] ? (
            <Character key={w + p.home.avatars[w]} who={w} model={p.home.avatars[w]} av={p.avatars[w]} items={items} label={w === "gu" ? "bb gu" : "bb li"} />
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
