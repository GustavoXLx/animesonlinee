import { createFileRoute } from "@tanstack/react-router";
import HouseScene from "@/components/house/HouseScene";
import { starter } from "@/lib/home";
const h = { ...starter(), pet: { kind: "cat", name: "x", lastFed: Date.now(), lastPet: Date.now() } };
h.items.push({ uid: "b", k: "bedDouble", x: 0.9, z: 1.1, r: 0 });
export const Route = createFileRoute("/casa-teste")({
  ssr: false,
  component: () => (
    <div style={{ position: "fixed", inset: 0, background: "#2a1f2b" }}>
      <HouseScene home={h} me="gu" online={{ gu: true, li: true }} decor={false} selected={null} ghost={null} petAction={null}
        avatars={{ gu: { x: 1.8, z: 2, sit: null, emote: null, emoteAt: 0 }, li: { x: 3, z: 4.6, sit: "s2", emote: null, emoteAt: 0 } }}
        onFloor={() => {}} onItem={() => {}} onPet={() => {}} />
    </div>
  ),
});
