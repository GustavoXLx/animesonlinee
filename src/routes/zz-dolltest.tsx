import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Doll, type DollAnim } from "@/components/avatar/Doll";
import { DEFAULT_LOOKS, randomLook } from "@/lib/look";
export const Route = createFileRoute("/zz-dolltest")({ ssr: false, component: T });
function One({ i }: { i: number }) {
  const a = useRef<DollAnim>({ name: ["idle", "pose0", "catwalk", "pose2", "wave", "sit", "pose1", "pose3"][i] });
  const l = i === 0 ? DEFAULT_LOOKS.gu : i === 1 ? DEFAULT_LOOKS.li : randomLook(i * 0.137);
  return <group position={[(i % 4) * 0.8 - 1.2, 0, -Math.floor(i / 4) * 1.2]}><Doll look={l} anim={a} /></group>;
}
function T() {
  return <div style={{ position: "fixed", inset: 0, background: "#334" }}><Canvas camera={{ position: [0, 1, 3.2], fov: 45 }} onCreated={({camera})=>camera.lookAt(0,0.3,-0.6)}>
    <ambientLight intensity={0.8} /><directionalLight position={[2, 3, 2]} intensity={1.8} />
    {[0,1,2,3,4,5,6,7].map((i) => <One key={i} i={i} />)}
  </Canvas></div>;
}
