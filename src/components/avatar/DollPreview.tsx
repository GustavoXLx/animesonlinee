import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { Doll, type DollAnim } from "./Doll";
import type { Look } from "@/lib/look";

function Spin({ look, anim, rot }: { look: Look; anim: React.MutableRefObject<DollAnim>; rot: React.MutableRefObject<number> }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!g.current) return;
    g.current.rotation.y = THREE.MathUtils.damp(g.current.rotation.y, rot.current, 8, dt);
  });
  return (
    <group ref={g}>
      <Doll look={look} anim={anim} />
    </group>
  );
}

/** Pré-visualização do boneco: arraste para girar. */
export default function DollPreview({ look, animName = "idle" }: { look: Look; animName?: string }) {
  const anim = useRef<DollAnim>({ name: animName });
  anim.current.name = animName;
  const rot = useRef(0.3);
  const drag = useRef<number | null>(null);
  return (
    <div
      className="h-full w-full touch-none"
      onPointerDown={(e) => (drag.current = e.clientX)}
      onPointerMove={(e) => {
        if (drag.current === null) return;
        rot.current += (e.clientX - drag.current) * 0.012;
        drag.current = e.clientX;
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
    >
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.62, 1.9], fov: 32 }} gl={{ antialias: true, alpha: true, stencil: false }} onCreated={({ camera }) => camera.lookAt(0, 0.5, 0)}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 3, 2]} intensity={1.6} />
        <directionalLight position={[-2, 1.5, -1]} intensity={0.6} color="#f9a8d4" />
        <Environment resolution={32}>
          <Lightformer intensity={1.5} position={[0, 3, 2]} scale={[4, 4, 1]} />
        </Environment>
        <Spin look={look} anim={anim} rot={rot} />
        <ContactShadows position={[0, 0.001, 0]} scale={2} opacity={0.4} blur={2.5} far={1} resolution={256} frames={1} />
      </Canvas>
    </div>
  );
}
