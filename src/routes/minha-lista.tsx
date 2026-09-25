import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { catalog } from "@/lib/animes";
import { useMyList } from "@/lib/myList";
import { AnimeGrid } from "@/components/AnimeGrid";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/minha-lista")({
  head: () => ({
    meta: [
      { title: "Minha lista — AniStream" },
      { name: "description", content: "Os animes que você salvou para assistir depois no AniStream." },
      { property: "og:title", content: "Minha lista — AniStream" },
      { property: "og:description", content: "Seus animes salvos para assistir depois." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MinhaLista,
});

function MinhaLista() {
  const { ids } = useMyList();
  const items = ids.map((id) => catalog.find((a) => a.id === id)).filter((a) => a !== undefined);
  return (
    <div className="min-h-screen bg-neutral-950 px-4 pb-24 text-white">
      <h1 className="py-4 text-lg font-bold">Minha lista</h1>
      {items.length ? (
        <AnimeGrid items={items} />
      ) : (
        <div className="flex flex-col items-center py-20 text-center text-white/60">
          <Bookmark size={36} className="mb-3 text-white/30" />
          <p className="text-sm">Sua lista está vazia</p>
          <p className="mt-1 text-xs text-white/40">Toque no + na página de um anime para salvar.</p>
          <Link to="/explorar" className="mt-5 rounded-full bg-fuchsia-600 px-5 py-2 text-xs font-semibold text-white">
            Explorar catálogo
          </Link>
        </div>
      )}
      <BottomNav />
    </div>
  );
}
