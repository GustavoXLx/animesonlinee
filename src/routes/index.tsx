import { createFileRoute } from "@tanstack/react-router";
import { useState, memo, useMemo } from "react";
import {
  Search,
  Star,
  Play,
  Menu,
  Bell,
  Home as HomeIcon,
  Compass,
  Bookmark,
  User,
  TrendingUp,
  Clock,
  ShieldCheck,
  Sparkles,
  Tv,
  ChevronRight,
} from "lucide-react";
import { animes, catalog, genres, schedule, type Anime } from "@/lib/animes";
import { useSiteState } from "@/lib/siteState";
import { checkTrigger } from "@/lib/chat.functions";
import { SecretGate } from "@/components/chat/SecretGate";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AniStream — Animes online, legendados e dublados" },
      {
        name: "description",
        content:
          "Catálogo com 36 animes legendados e dublados, simulcast da temporada, cronograma semanal e episódios novos toda semana. Grátis no navegador.",
      },
      { property: "og:title", content: "AniStream — Animes online, legendados e dublados" },
      {
        property: "og:description",
        content: "Simulcast da temporada, cronograma semanal e novos episódios toda semana.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function Home() {
  const [q, setQ] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [genre, setGenre] = useState<string | null>(null);
  const [secret, setSecret] = useState(false);
  const site = useSiteState();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    try {
      const res = await checkTrigger({ data: { code: v } });
      if (res.ok && (res.master || site.chatOpen)) {
        setQ("");
        setShowSearch(false);
        setSecret(true);
      }
    } catch {
      /* silencioso */
    }
  };

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return catalog.filter(
      (a) =>
        (!genre || a.genre === genre) &&
        (!term || a.title.toLowerCase().includes(term) || a.genre.toLowerCase().includes(term)),
    );
  }, [q, genre]);

  const featured = animes[5];
  const trending = catalog.slice(18, 26);
  const newSeason = catalog.filter((a) => a.year >= 2025).slice(0, 10);
  const top10 = useMemo(() => [...catalog].sort((a, b) => b.rating - a.rating).slice(0, 10), []);
  const continueWatching = catalog.slice(2, 8);
  const today = DAYS[new Date().getDay()];

  if (secret) return <SecretGate onExit={() => setSecret(false)} />;

  return (
    <div className="min-h-screen bg-neutral-950 text-white pb-24">
      <header className="sticky top-0 z-30 bg-neutral-950/90 backdrop-blur border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-600 flex items-center justify-center font-black">
              A
            </div>
            <span className="font-bold tracking-tight">AniStream</span>
            <span
              aria-hidden
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                site.loaded && site.chatOpen ? "bg-emerald-400" : "bg-white/15"
              }`}
            />
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

      {!q && (
        <section className="px-4 pt-4">
          <div className="relative rounded-3xl overflow-hidden h-64 bg-neutral-900">
            <img
              src={featured.cover}
              alt={`Capa de ${featured.title}`}
              className="absolute inset-0 w-full h-full object-cover"
              width={512}
              height={768}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider bg-fuchsia-600 px-2 py-1 rounded-full">
              Simulcast
            </span>
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <span className="text-[10px] uppercase tracking-widest text-white/80">Em destaque</span>
              <h1 className="text-2xl font-black leading-tight mt-1">{featured.title}</h1>
              <div className="flex items-center gap-2 text-xs text-white/80 mt-1">
                <Star size={12} className="fill-yellow-400 text-yellow-400" /> {featured.rating}
                <span>·</span>
                <span>{featured.episodes} eps</span>
                <span>·</span>
                <span>{featured.genre}</span>
                <span>·</span>
                <span>Dub + Leg</span>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="inline-flex items-center gap-2 bg-white text-black text-sm font-semibold px-4 py-2 rounded-full">
                  <Play size={14} className="fill-black" /> Assistir agora
                </button>
                <button className="inline-flex items-center gap-2 bg-white/15 text-sm font-semibold px-4 py-2 rounded-full">
                  <Bookmark size={14} /> Minha lista
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Gêneros */}
      <section className="pt-5">
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
          <button
            onClick={() => setGenre(null)}
            className={`text-xs px-3 py-1.5 rounded-full shrink-0 ${
              genre === null ? "bg-white text-black font-semibold" : "bg-white/10"
            }`}
          >
            Todos
          </button>
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setGenre(genre === g ? null : g)}
              className={`text-xs px-3 py-1.5 rounded-full shrink-0 ${
                genre === g ? "bg-white text-black font-semibold" : "bg-white/10"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </section>

      {q || genre ? (
        <section className="px-4 pt-6">
          <h2 className="font-semibold mb-3">
            {genre && !q ? genre : "Resultados"} ({filtered.length})
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((a) => (
              <AnimeCard key={a.id} a={a} />
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="text-sm text-white/40 py-10 text-center">Nenhum título encontrado.</p>
          )}
        </section>
      ) : (
        <>
          <section className="pt-6">
            <h2 className="font-semibold mb-3 px-4 flex items-center gap-2">
              <Clock size={16} className="text-fuchsia-400" /> Continuar assistindo
            </h2>
            <div className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
              {continueWatching.map((a, i) => (
                <div key={a.id} className="shrink-0 w-40">
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-neutral-900">
                    <img
                      src={a.cover}
                      alt={`Capa de ${a.title}`}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Play size={22} fill="white" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                      <div
                        className="h-full bg-fuchsia-500"
                        style={{ width: `${20 + ((i * 17) % 70)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs font-semibold mt-1.5 line-clamp-1">{a.title}</p>
                  <p className="text-[10px] text-white/50">
                    Ep. {3 + i} de {a.episodes}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <Row title="Em alta agora" icon={<TrendingUp size={16} className="text-emerald-400" />} items={trending} />

          {/* Top 10 */}
          <section className="pt-6">
            <h2 className="font-semibold mb-3 px-4 flex items-center gap-2">
              <Sparkles size={16} className="text-yellow-400" /> Top 10 da semana
            </h2>
            <div className="flex gap-4 overflow-x-auto px-4 pb-1 no-scrollbar">
              {top10.map((a, i) => (
                <div key={a.id} className="shrink-0 flex items-end gap-1">
                  <span className="text-5xl font-black leading-none text-white/15">{i + 1}</span>
                  <div className="w-24">
                    <AnimeCard a={a} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Row title="Nova temporada 2025" icon={<Tv size={16} className="text-sky-400" />} items={newSeason} />

          {/* Cronograma */}
          <section className="px-4 pt-8">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Clock size={16} className="text-pink-400" /> Cronograma semanal
            </h2>
            <div className="space-y-2">
              {schedule.map((d) => (
                <div
                  key={d.day}
                  className={`rounded-2xl border p-3 ${
                    d.day === today ? "border-fuchsia-500/60 bg-fuchsia-500/10" : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold">
                      {d.day}
                      {d.day === today && <span className="ml-2 text-fuchsia-400">hoje</span>}
                    </p>
                    <ChevronRight size={14} className="text-white/30" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {d.items.map((a) => (
                      <span key={a.id} className="text-[11px] bg-white/10 rounded-full px-2.5 py-1">
                        {a.title}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Confiança */}
          <section className="px-4 pt-8">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { n: "36", l: "títulos" },
                { n: "1.2k", l: "episódios" },
                { n: "4.8", l: "nota média" },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl bg-white/5 border border-white/10 py-3">
                  <p className="text-lg font-black">{s.n}</p>
                  <p className="text-[10px] text-white/50">{s.l}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-white/5 border border-white/10 p-3">
              <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-white/60 leading-relaxed">
                Streaming licenciado, sem anúncios invasivos e com legendas oficiais em português. Sua
                lista e seu progresso ficam salvos no dispositivo.
              </p>
            </div>
          </section>

          {/* FAQ */}
          <section className="px-4 pt-8">
            <h2 className="font-semibold mb-3">Perguntas frequentes</h2>
            <div className="space-y-2">
              {[
                {
                  q: "Preciso pagar para assistir?",
                  a: "Não. O catálogo básico é gratuito e novos episódios entram semanalmente.",
                },
                {
                  q: "Tem episódios dublados?",
                  a: "Sim, a maioria dos simulcasts tem áudio dublado e legendas em português.",
                },
                {
                  q: "Funciona no celular?",
                  a: "Sim, a experiência é otimizada para celular, tablet e TV pelo navegador.",
                },
              ].map((f) => (
                <details key={f.q} className="rounded-2xl bg-white/5 border border-white/10 p-3">
                  <summary className="text-xs font-semibold cursor-pointer">{f.q}</summary>
                  <p className="text-[11px] text-white/60 mt-2">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <footer className="px-4 pt-10">
            <div className="grid grid-cols-2 gap-2 text-[11px] text-white/50">
              {["Sobre nós", "Central de ajuda", "Termos de uso", "Privacidade", "Contato", "Trabalhe conosco"].map(
                (l) => (
                  <span key={l}>{l}</span>
                ),
              )}
            </div>
          </footer>
        </>
      )}

      <p className="text-[10px] text-white/25 text-center px-6 pt-8">
        AniStream v2.4.1 · catálogo atualizado diariamente{site.note ? ` · ${site.note}` : ""}
      </p>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-neutral-950/95 backdrop-blur border-t border-white/5">
        <div className="grid grid-cols-4 py-2">
          {[
            { i: HomeIcon, l: "Início" },
            { i: Compass, l: "Explorar" },
            { i: Bookmark, l: "Minha lista" },
            { i: User, l: "Perfil" },
          ].map(({ i: Icon, l }, idx) => (
            <button
              key={l}
              className={`flex flex-col items-center gap-1 py-1 ${idx === 0 ? "text-white" : "text-white/50"}`}
            >
              <Icon size={20} />
              <span className="text-[10px]">{l}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Row({ title, items, icon }: { title: string; items: Anime[]; icon?: React.ReactNode }) {
  return (
    <section className="pt-6">
      <h2 className="font-semibold mb-3 px-4 flex items-center gap-2">
        {icon}
        {title}
      </h2>
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

const AnimeCard = memo(function AnimeCard({ a }: { a: Anime }) {
  return (
    <Link to="/anime/$animeId" params={{ animeId: String(a.id) }} className="group block">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-neutral-900">
        <img
          src={a.cover}
          alt={`Capa do anime ${a.title}`}
          loading="lazy"
          width={512}
          height={768}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute bottom-1 right-1.5 flex items-center gap-1 text-[10px] bg-black/70 px-1.5 py-0.5 rounded">
          <Star size={10} className="fill-yellow-400 text-yellow-400" />
          {a.rating}
        </div>
      </div>
      <div className="mt-1.5">
        <p className="text-xs font-semibold leading-tight line-clamp-2">{a.title}</p>
        <p className="text-[10px] text-white/50">
          {a.genre} · {a.year}
        </p>
      </div>
    </Link>
  );
});

