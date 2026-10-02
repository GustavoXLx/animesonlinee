import { lazy, Suspense, useState } from "react";
import { Shuffle } from "lucide-react";
import {
  ACCS, BOTTOMS, FACES, GLASSES, HAIR_COLORS, HAIRS, HANDS, HATS, PALETTE, PATTERNS, SHOES, SKINS, TOPS, randomLook, type Look,
} from "@/lib/look";

const DollPreview = lazy(() => import("./DollPreview"));

type Tab = { id: string; label: string; list?: { id: string; name: string }[]; key?: keyof Look; color?: keyof Look; color2?: keyof Look; pattern?: keyof Look; colors?: string[] };
const TABS: Tab[] = [
  { id: "pele", label: "Pele e rosto", list: FACES, key: "face", color: "skin", colors: SKINS },
  { id: "cabelo", label: "Cabelo", list: HAIRS, key: "hair", color: "hairC", colors: HAIR_COLORS },
  { id: "blusa", label: "Blusa", list: TOPS, key: "top", color: "topC", color2: "topC2", pattern: "topP" },
  { id: "baixo", label: "Parte de baixo", list: BOTTOMS, key: "bottom", color: "botC", pattern: "botP" },
  { id: "sapatos", label: "Sapatos", list: SHOES, key: "shoes", color: "shoeC" },
  { id: "chapeu", label: "Cabeça", list: HATS, key: "hat", color: "hatC" },
  { id: "oculos", label: "Óculos", list: GLASSES, key: "glasses", color: "glassC" },
  { id: "acc", label: "Acessório", list: ACCS, key: "acc", color: "accC" },
  { id: "mao", label: "Na mão", list: HANDS, key: "hand", color: "handC" },
  { id: "olhos", label: "Olhos e boca", color: "eyes", color2: "lips", colors: ["#3b2416", "#6b4226", "#1e3a8a", "#065f46", "#111111", "#a855f7", "#ef4444", "#9ca3af", "#facc15", "#06b6d4"] },
];

function Swatches({ value, colors, onPick }: { value: string; colors: string[]; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button key={c} onClick={() => onPick(c)} style={{ background: c }} className={`h-7 w-7 rounded-full border-2 transition ${value === c ? "scale-110 border-pink-400" : "border-white/15"}`} />
      ))}
      <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-white/40 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]">
        <input type="color" value={value} onChange={(e) => onPick(e.target.value)} className="absolute inset-0 opacity-0" />
      </label>
    </div>
  );
}

export function LookEditor({ look, onChange, compact = false, animName }: { look: Look; onChange: (l: Look) => void; compact?: boolean; animName?: string }) {
  const [tab, setTab] = useState("blusa");
  const t = TABS.find((x) => x.id === tab)!;
  const set = (k: keyof Look, v: string) => onChange({ ...look, [k]: v });
  return (
    <div className={`flex h-full min-h-0 ${compact ? "flex-col" : "flex-col sm:flex-row"} gap-3`}>
      <div className={`relative shrink-0 overflow-hidden rounded-2xl bg-gradient-to-b from-pink-500/20 via-fuchsia-500/10 to-transparent ${compact ? "h-56" : "h-64 sm:h-auto sm:w-1/2"}`}>
        <Suspense fallback={null}>
          <DollPreview look={look} animName={animName} />
        </Suspense>
        <button onClick={() => onChange(randomLook())} className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-3 py-1.5 text-xs font-bold backdrop-blur">
          <Shuffle size={14} /> Aleatório
        </button>
        <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[10px] text-white/50">arraste para girar</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex shrink-0 gap-1.5 overflow-x-auto pb-1">
          {TABS.map((x) => (
            <button key={x.id} onClick={() => setTab(x.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${tab === x.id ? "bg-pink-500" : "bg-white/10"}`}>
              {x.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {t.list && t.key && (
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {t.list.map((o) => (
                <button
                  key={o.id}
                  onClick={() => set(t.key!, o.id)}
                  className={`rounded-xl px-2 py-2 text-[11px] font-semibold leading-tight transition ${look[t.key!] === o.id ? "bg-pink-500/80 ring-1 ring-pink-300" : "bg-white/5 hover:bg-white/10"}`}
                >
                  {o.name}
                </button>
              ))}
            </div>
          )}
          {t.color && (
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-wider text-white/50">{t.id === "olhos" ? "Olhos" : "Cor"}</p>
              <Swatches value={look[t.color]} colors={t.colors ?? PALETTE} onPick={(c) => set(t.color!, c)} />
            </div>
          )}
          {t.color2 && (
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-wider text-white/50">{t.id === "olhos" ? "Boca" : "Cor dos detalhes / estampa"}</p>
              <Swatches value={look[t.color2]} colors={t.id === "olhos" ? ["#c26a5a", "#e11d48", "#be185d", "#7c2d12", "#a855f7", "#111111", "#f472b6", "#fda4af"] : PALETTE} onPick={(c) => set(t.color2!, c)} />
            </div>
          )}
          {t.pattern && (
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-wider text-white/50">Estampa</p>
              <div className="grid grid-cols-4 gap-1.5">
                {PATTERNS.map((p) => (
                  <button key={p.id} onClick={() => set(t.pattern!, p.id)} className={`rounded-lg px-1.5 py-1.5 text-[10px] font-semibold ${look[t.pattern!] === p.id ? "bg-pink-500/80" : "bg-white/5"}`}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
