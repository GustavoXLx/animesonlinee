import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { catalog, genres } from "@/lib/animes";
import { AnimeGrid } from "@/components/AnimeGrid";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/explorar")({
  head: () => ({
    meta: [
      { title: "Explorar animes por gênero — AniStream" },
      { name: "description", content: "Explore o catálogo completo do AniStream por gênero, nota e ano." },
      { property: "og:title", content: "Explorar animes por gênero — AniStream" },
      { property: "og:description", content: "Catálogo completo por gênero, nota e ano." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Explorar,
});

function Explorar() {
  const [g, setG] = useState("Todos");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"nota" | "ano" | "az">("nota");
  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = catalog.filter(
      (a) => (g === "Todos" || a.genre === g) && (!t || a.title.toLowerCase().includes(t)),
    );
    return [...list].sort((a, b) =>
      sort === "nota" ? b.rating - a.rating : sort === "ano" ? b.year - a.year : a.title.localeCompare(b.title),
    );
  }, [g, q, sort]);

  return (
    <div className="min-h-screen bg-neutral-950 pb-24 text-white">
      <header className="sticky top-0 z-20 space-y-3 bg-neutral-950/95 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-bold">Explorar</h1>
        <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
          <Search size={16} className="text-white/50" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar por nome"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {["Todos", ...genres].map((x) => (
            <button
              key={x}
              onClick={() => setG(x)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs ${g === x ? "bg-fuchsia-600" : "bg-white/10 text-white/70"}`}
            >
              {x}
            </button>
          ))}
        </div>
      </header>
      <div className="px-4">
        <div className="mb-3 flex items-center justify-between text-xs text-white/50">
          <span>{items.length} títulos</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded bg-white/10 px-2 py-1 text-white"
          >
            <option value="nota">Mais bem avaliados</option>
            <option value="ano">Mais recentes</option>
            <option value="az">A–Z</option>
          </select>
        </div>
        <AnimeGrid items={items} />
      </div>
      <BottomNav />
    </div>
  );
}
