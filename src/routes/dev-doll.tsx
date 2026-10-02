import { createFileRoute } from "@tanstack/react-router";
import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Doll, type DollAnim } from "@/components/avatar/Doll";
import { HAIRS, TOPS, BOTTOMS, SHOES, HATS, GLASSES, ACCS, HANDS, PATTERNS, DEFAULT_LOOKS, type Look } from "@/lib/look";

export const Route = createFileRoute("/dev-doll")({
  component: Page,
  ssr: false,
});

const CATS: Record<string, { id: string; name: string }[]> = {
  hair: HAIRS, top: TOPS, bottom: BOTTOMS, shoes: SHOES, hat: HATS, glasses: GLASSES, acc: ACCS, hand: HANDS, pattern: PATTERNS,
};

function Cell({ look, close }: { look: Look; close?: boolean }) {
  const anim = useRef<DollAnim>({ name: "idle" });
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y = THREE.MathUtils.damp(g.current.rotation.y, close ? 0 : 0.4, 6, dt);
  });
  return (
    <group ref={g}>
      <Doll look={look} anim={anim} />
    </group>
  );
}

function Page() {
  const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
  const cat = url?.searchParams.get("cat") ?? "hair";
  const view = url?.searchParams.get("view") ?? "body"; // body | head | head34
  const base = DEFAULT_LOOKS.gu;
  const list = CATS[cat] ?? HAIRS;
  const looks: Look[] = useMemo(() => {
    return list.slice(Number(url?.searchParams.get("from") ?? 0), Number(url?.searchParams.get("from") ?? 0) + 12).map((o) => {
      const l = { ...base };
      if (cat === "pattern") {
        l.topP = o.id;
        l.top = "tshirt";
      } else {
        (l as any)[cat] = o.id;
      }
      return l;
    });
  }, [cat]);

  const cols = 6;
  const headY = 0.83;
  const cam: [number, number, number] = view === "body" ? [0, 0.5, 1.9] : [0, headY - 0.02, 0.85];
  const fov = view === "body" ? 30 : 26;
  const camRotY = view === "head34" ? 0.5 : 0;

  return (
    <div style={{ background: "#1a1a2e", minHeight: "100vh", padding: 8 }}>
      <div style={{ color: "#fff", fontFamily: "sans-serif", marginBottom: 6 }}>cat={cat} view={view} ({looks.length} items)</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4 }}>
        {looks.map((l, i) => (
          <div key={i} style={{ background: "#0f0f1e", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ height: 170, position: "relative" }}>
              <Canvas dpr={1} camera={{ position: cam, fov }} onCreated={({ camera }) => { camera.lookAt(0, view === "body" ? 0.45 : headY, 0); camera.rotateY(camRotY); }}>
                <ambientLight intensity={0.7} />
                <directionalLight position={[2, 3, 2]} intensity={1.6} />
                <directionalLight position={[-2, 1, -1]} intensity={0.5} />
                <Cell look={l} close={view !== "body"} />
              </Canvas>
            </div>
            <div style={{ color: "#fff", fontSize: 11, padding: "2px 4px", fontFamily: "sans-serif" }}>{list[i].id}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
