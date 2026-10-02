import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import DesfileScene from "@/components/games/desfile/DesfileScene";
import { DEFAULT_LOOKS, randomLook } from "@/lib/look";
export const Route = createFileRoute("/zz-dolltest")({ ssr: false, component: T });
function T() {
  const off = Number(new URLSearchParams(location.search).get("t") || 0);
  const r = useRef(performance.now() - off * 1000);
  return <div style={{ position: "fixed", inset: 0 }}><DesfileScene looks={{ gu: DEFAULT_LOOKS.gu, li: randomLook(0.3) }} order={["gu", "li"]} winner="li" theme="Animais" startRef={r} poses={{ gu: 0, li: 2 }} /></div>;
}
