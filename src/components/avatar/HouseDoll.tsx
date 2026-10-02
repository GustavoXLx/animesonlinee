import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Look } from "@/lib/look";
import type { DollAnim } from "./Doll";

const materials = new Map<string, THREE.MeshStandardMaterial>();
function material(color: string) {
  const cached = materials.get(color);
  if (cached) return cached;
  const next = new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
  materials.set(color, next);
  return next;
}

const box = new THREE.BoxGeometry(1, 1, 1);

/** Personagem leve e quadradinho, no estilo original da Nossa Casa. */
export function HouseDoll({ look, anim }: { look: Look; anim: React.MutableRefObject<DollAnim> }) {
  const root = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const clock = useRef(0);

  const skin = useMemo(() => material(look.skin), [look.skin]);
  const hair = useMemo(() => material(look.hairC), [look.hairC]);
  const top = useMemo(() => material(look.topC), [look.topC]);
  const detail = useMemo(() => material(look.topC2), [look.topC2]);
  const bottom = useMemo(() => material(look.botC), [look.botC]);
  const shoes = useMemo(() => material(look.shoeC), [look.shoeC]);
  const hat = useMemo(() => material(look.hatC), [look.hatC]);
  const accessory = useMemo(() => material(look.accC), [look.accC]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    clock.current += dt * (anim.current.speed ?? 1);
    const t = clock.current;
    const name = anim.current.name;
    const walking = name === "walk" || name === "catwalk";
    const wave = name === "wave" || name === "emote-yes";
    const sitting = name === "sit";
    const jumping = name === "jump" || name === "cheer";
    const swing = walking ? Math.sin(t * 9) * 0.7 : 0;
    if (leftArm.current) leftArm.current.rotation.x = THREE.MathUtils.damp(leftArm.current.rotation.x, wave ? 0 : swing, 14, dt);
    if (rightArm.current) {
      rightArm.current.rotation.x = THREE.MathUtils.damp(rightArm.current.rotation.x, wave ? Math.sin(t * 12) * 0.25 : -swing, 14, dt);
      rightArm.current.rotation.z = THREE.MathUtils.damp(rightArm.current.rotation.z, wave ? -2.7 : 0, 14, dt);
    }
    if (leftLeg.current) leftLeg.current.rotation.x = THREE.MathUtils.damp(leftLeg.current.rotation.x, sitting ? -1.35 : -swing, 14, dt);
    if (rightLeg.current) rightLeg.current.rotation.x = THREE.MathUtils.damp(rightLeg.current.rotation.x, sitting ? -1.35 : swing, 14, dt);
    if (head.current) head.current.rotation.y = Math.sin(t * 0.7) * 0.12;
    if (root.current) root.current.position.y = jumping ? Math.abs(Math.sin(t * 4)) * 0.2 : walking ? Math.abs(Math.sin(t * 9)) * 0.018 : 0;
  });

  const longHair = ["long", "wavy", "ponytail", "pigtails", "braids", "mullet", "wolf"].includes(look.hair);
  const skirt = ["skirt", "longskirt", "dress", "gown", "tutu", "pleated", "kilt", "balloon"].includes(look.bottom);
  const hasHat = look.hat !== "none";
  const hasBack = look.acc !== "none";

  return (
    <group ref={root} scale={0.82}>
      <group ref={leftLeg} position={[-0.075, 0.34, 0]}>
        <mesh geometry={box} material={bottom} position={[0, -0.15, 0]} scale={[0.12, 0.3, 0.13]} />
        <mesh geometry={box} material={shoes} position={[0, -0.32, 0.035]} scale={[0.14, 0.08, 0.2]} />
      </group>
      <group ref={rightLeg} position={[0.075, 0.34, 0]}>
        <mesh geometry={box} material={bottom} position={[0, -0.15, 0]} scale={[0.12, 0.3, 0.13]} />
        <mesh geometry={box} material={shoes} position={[0, -0.32, 0.035]} scale={[0.14, 0.08, 0.2]} />
      </group>

      <mesh geometry={box} material={top} position={[0, 0.5, 0]} scale={[0.36, 0.34, 0.2]} />
      <mesh geometry={box} material={detail} position={[0, 0.5, 0.105]} scale={[0.08, 0.23, 0.018]} />
      {skirt && <mesh geometry={box} material={bottom} position={[0, 0.3, 0]} scale={[0.42, 0.18, 0.24]} />}

      <group ref={leftArm} position={[-0.24, 0.61, 0]}>
        <mesh geometry={box} material={top} position={[0, -0.12, 0]} scale={[0.11, 0.28, 0.12]} />
        <mesh geometry={box} material={skin} position={[0, -0.29, 0]} scale={[0.1, 0.1, 0.1]} />
      </group>
      <group ref={rightArm} position={[0.24, 0.61, 0]}>
        <mesh geometry={box} material={top} position={[0, -0.12, 0]} scale={[0.11, 0.28, 0.12]} />
        <mesh geometry={box} material={skin} position={[0, -0.29, 0]} scale={[0.1, 0.1, 0.1]} />
      </group>

      <group ref={head} position={[0, 0.87, 0]}>
        <mesh geometry={box} material={skin} scale={[0.34, 0.32, 0.31]} />
        {look.hair !== "none" && (
          <>
            <mesh geometry={box} material={hair} position={[0, 0.15, -0.01]} scale={[0.37, 0.09, 0.34]} />
            <mesh geometry={box} material={hair} position={[0, 0.035, -0.17]} scale={[0.37, longHair ? 0.35 : 0.15, 0.08]} />
          </>
        )}
        <mesh geometry={box} material={material(look.eyes)} position={[-0.075, 0.02, 0.16]} scale={[0.035, 0.045, 0.018]} />
        <mesh geometry={box} material={material(look.eyes)} position={[0.075, 0.02, 0.16]} scale={[0.035, 0.045, 0.018]} />
        <mesh geometry={box} material={material(look.lips)} position={[0, -0.075, 0.16]} scale={[0.07, 0.025, 0.018]} />
        {hasHat && <mesh geometry={box} material={hat} position={[0, 0.23, 0]} scale={[0.4, 0.12, 0.37]} />}
      </group>
      {hasBack && <mesh geometry={box} material={accessory} position={[0, 0.55, -0.16]} scale={[0.4, 0.38, 0.08]} />}
    </group>
  );
}