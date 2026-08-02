import { createFileRoute } from "@tanstack/react-router";
import { useState, memo } from "react";
import { Search, Star, Play, Menu, Bell, Home as HomeIcon, Compass, Bookmark, User } from "lucide-react";
import { animes } from "@/lib/animes";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AniStream — Descubra seu próximo anime" },
      { name: "description", content: "Assista aos melhores animes online. Novos episódios toda semana." },
      { property: "og:title", content: "AniStream — Descubra seu próximo anime" },
      { property: "og:description", content: "Catálogo de animes com novos episódios toda semana." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const [q, setQ] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };



  const filtered = animes.filter((a) =>
    a.title.toLowerCase().includes(q.toLowerCase()) || a.genre.toLowerCase().includes(q.toLowerCase())
  );

  const featured = animes[5];
  const trending = animes.slice(0, 8);
  const newSeason = animes.slice(8, 16);

  return (
    <div className="min-h-screen bg-neutral-950 text-white pb-24">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-neutral-950/90 backdrop-blur border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-600 flex items-center justify-center font-black">A</div>
            <span className="font-bold tracking-tight">AniStream</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              aria-label="Buscar"
              onClick={() => setShowSearch((v) => !v)}
              className="p-2 rounded-full hover:bg-white/10"
            >
              <Search size={20} />
            </button>
            <button aria-label="Notificações" className="p-2 rounded-full hover:bg-white/10">
              <Bell size={20} />
            </button>
            <button aria-label="Menu" className="p-2 rounded-full hover:bg-white/10">
              <Menu size={20} />
            </button>
          </div>
        </div>
        {showSearch && (
          <form onSubmit={onSubmit} className="px-4 pb-3">
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
              <Search size={18} className="text-white/60" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar animes, gêneros..."
                className="bg-transparent outline-none flex-1 text-sm placeholder:text-white/40"
              />
            </div>
          </form>
        )}
      </header>

      {/* Hero */}
      {!q && (
        <section className="px-4 pt-4">
          <div className="relative rounded-3xl overflow-hidden h-64 bg-neutral-900">
            <img src={featured.cover} alt={featured.title} className="absolute inset-0 w-full h-full object-cover" width={512} height={768} />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <span className="text-[10px] uppercase tracking-widest text-white/80">Em destaque</span>
              <h2 className="text-2xl font-black leading-tight mt-1">{featured.title}</h2>
              <div className="flex items-center gap-2 text-xs text-white/80 mt-1">
                <Star size={12} className="fill-yellow-400 text-yellow-400" /> {featured.rating}
                <span>·</span>
                <span>{featured.episodes} eps</span>
                <span>·</span>
                <span>{featured.genre}</span>
              </div>
              <button className="mt-3 inline-flex items-center gap-2 bg-white text-black text-sm font-semibold px-4 py-2 rounded-full">
                <Play size={14} className="fill-black" /> Assistir agora
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Sections */}
      {q ? (
        <section className="px-4 pt-6">
          <h3 className="font-semibold mb-3">Resultados ({filtered.length})</h3>
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((a) => (
              <AnimeCard key={a.id} a={a} />
            ))}
          </div>
        </section>
      ) : (
        <>
          <Row title="Em alta agora" items={trending} />
          <Row title="Nova temporada" items={newSeason} />
          <section className="px-4 pt-6">
            <h3 className="font-semibold mb-3">Explore por gênero</h3>
            <div className="flex flex-wrap gap-2">
              {["Ação", "Romance", "Fantasia", "Sci-Fi", "Slice of Life", "Mecha", "Drama", "Musical"].map((g) => (
                <span key={g} className="text-xs px-3 py-1.5 rounded-full bg-white/10">{g}</span>
              ))}
            </div>
          </section>
        </>
      )}

      <p className="text-[10px] text-white/25 text-center px-6 pt-8">
        AniStream v2.4.1 · catálogo atualizado diariamente{site.note ? ` · ${site.note}` : ""}
      </p>



      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-neutral-950/95 backdrop-blur border-t border-white/5">
        <div className="grid grid-cols-4 py-2">
          {[
            { i: HomeIcon, l: "Início" },
            { i: Compass, l: "Explorar" },
            { i: Bookmark, l: "Minha lista" },
            { i: User, l: "Perfil" },
          ].map(({ i: Icon, l }, idx) => (
            <button key={l} className={`flex flex-col items-center gap-1 py-1 ${idx === 0 ? "text-white" : "text-white/50"}`}>
              <Icon size={20} />
              <span className="text-[10px]">{l}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Row({ title, items }: { title: string; items: typeof animes }) {
  return (
    <section className="pt-6">
      <h3 className="font-semibold mb-3 px-4">{title}</h3>
      <div className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
        {items.map((a) => (
          <div key={a.id} className="shrink-0 w-32">
            <AnimeCard a={a} />
          </div>
        ))}
      </div>
    </section>
  );
}

const AnimeCard = memo(function AnimeCard({ a }: { a: (typeof animes)[number] }) {
  return (
    <div className="group">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-neutral-900">
        <img src={a.cover} alt={a.title} loading="lazy" width={512} height={768} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute bottom-1 right-1.5 flex items-center gap-1 text-[10px] bg-black/70 px-1.5 py-0.5 rounded">
          <Star size={10} className="fill-yellow-400 text-yellow-400" />
          {a.rating}
        </div>
      </div>
      <div className="mt-1.5">
        <p className="text-xs font-semibold leading-tight line-clamp-2">{a.title}</p>
        <p className="text-[10px] text-white/50">{a.genre} · {a.year}</p>
      </div>
    </div>
  );
});

