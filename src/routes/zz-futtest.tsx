import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import FutebolScene from "@/components/games/futebol/FutebolScene";
import type { Shot } from "@/components/games/futebol/sim";
export const Route = createFileRoute("/zz-futtest")({ ssr: false, component: T });
function T() {
  const r = useRef(performance.now());
  const mode = (new URLSearchParams(location.search).get("m") as "falta") || "penalti";
  const [shot] = useState<Shot | null>(location.search.includes("shoot") ? { mode, sx: mode==="falta"?6:0, sz: mode==="falta"?22:11, tx: -2.8, ty: 1.9, power: 0.6, curve: -0.6, seed: 5, dive: { x: 1, high: false } } : null);
  return <div style={{ position: "fixed", inset: 0 }}><FutebolScene mode={mode} spot={{ x: mode==="falta"?6:0, z: mode==="falta"?22:11 }} kickerModel="male-c" keeperModel="female-a" view="kicker" shot={shot} startRef={r} aim={{ x: -2.8, y: 1.9 }} curve={-0.6} onAim={() => {}} /></div>;
}
