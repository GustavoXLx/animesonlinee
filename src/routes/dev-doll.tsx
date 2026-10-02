import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useRef } from "react";
import type { Look } from "@/lib/look";
import { DEFAULT_LOOKS } from "@/lib/look";

const DollPreview = lazy(() => import("@/components/avatar/DollPreview"));

export const Route = createFileRoute("/dev-doll")({
  ssr: false,
  component: DevDoll,
});

const looks: Record<string, Look> = {
  base: DEFAULT_LOOKS.gu,
  facialHair: {
    ...DEFAULT_LOOKS.gu,
    hair: "buzz",
    hairC: "#1b1310",
    face: "beard",
    glasses: "round",
    glassC: "#111111",
    hat: "cap",
    hatC: "#1e3a8a",
    top: "tux",
    topC: "#111111",
    topC2: "#ffffff",
    bottom: "pants",
    botC: "#1e3a8a",
    shoes: "boots",
  },
  mustache: {
    ...DEFAULT_LOOKS.gu,
    hair: "short",
    face: "mustache",
    glasses: "square",
    hat: "none",
    top: "leather",
    topC: "#7c2d12",
  },
  girlFancy: {
    ...DEFAULT_LOOKS.li,
    hair: "long",
    hairC: "#6b4226",
    top: "gown",
    topC: "#a855f7",
    topC2: "#facc15",
    bottom: "gown",
    botC: "#a855f7",
    shoes: "heels",
    shoeC: "#111111",
    hat: "crown",
    acc: "pearls",
    hand: "bouquet",
  },
  patterns: {
    ...DEFAULT_LOOKS.gu,
    top: "hoodie",
    topP: "stripes",
    topC: "#ef4444",
    topC2: "#ffffff",
    bottom: "jeans",
    botP: "denim",
    shoes: "sneakers",
    hat: "beanie",
    hatC: "#22c55e",
    glasses: "sun",
    acc: "chain",
  },
};

function DevDoll() {
  return (
    <div className="min-h-screen bg-neutral-900 p-4 text-white">
      <h1 className="mb-4 text-xl font-bold">Dev Doll Preview</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Object.entries(looks).map(([name, look]) => (
          <div key={name} className="flex flex-col gap-1">
            <p className="text-xs text-white/60">{name}</p>
            <div className="h-80 w-full overflow-hidden rounded-xl bg-neutral-800">
              <Suspense fallback={null}>
                <DollPreview look={look} />
              </Suspense>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
