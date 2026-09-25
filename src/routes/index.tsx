import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, memo, useMemo, useEffect } from "react";
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
  Newspaper,
  MessageSquare,
} from "lucide-react";
import { catalog, genres, schedule, animeDetail, type Anime } from "@/lib/animes";
import { useMyList } from "@/lib/myList";
import { useSiteState } from "@/lib/siteState";
import { checkTrigger } from "@/lib/chat.functions";
import { SecretGate } from "@/components/chat/SecretGate";
import { useChatNotifier } from "@/lib/chatNotify";
import { BottomNav } from "@/components/BottomNav";

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
  useChatNotifier(!secret);

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
      <UpdatePopup />
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

      {!q && <Hero />}

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
          <section className="pt-7">
            <SectionTitle
              icon={<Clock size={16} className="text-fuchsia-400" />}
              title="Continuar assistindo"
              more={false}
            />
            <div className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
              {continueWatching.map((a, i) => (
                <Link
                  key={a.id}
                  to="/anime/$animeId"
                  params={{ animeId: String(a.id) }}
                  className="shrink-0 w-44"
                >
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-neutral-900 ring-1 ring-white/5">
                    <img
                      src={a.cover}
                      alt={`Capa de ${a.title}`}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                      <span className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center">
                        <Play size={15} className="fill-black text-black ml-0.5" />
                      </span>
                    </div>
                    <span className="absolute bottom-2 right-1.5 text-[9px] bg-black/70 px-1 rounded">
                      {8 + ((i * 5) % 14)} min restantes
                    </span>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                      <div
                        className="h-full bg-fuchsia-500"
                        style={{ width: `${20 + ((i * 17) % 70)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs font-semibold mt-1.5 line-clamp-1">{a.title}</p>
                  <p className="text-[10px] text-white/50">
                    T1 · Ep. {3 + i} de {a.episodes}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          <Row
            title="Em alta agora"
            icon={<TrendingUp size={16} className="text-emerald-400" />}
            items={trending}
          />

          {/* Top 10 */}
          <section className="pt-7">
            <SectionTitle
              icon={<Sparkles size={16} className="text-yellow-400" />}
              title="Top 10 da semana"
            />
            <div className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
              {top10.map((a, i) => (
                <div key={a.id} className="shrink-0 flex items-end">
                  <span
                    className="text-7xl font-black leading-none -mr-3 z-10 text-neutral-950"
                    style={{ WebkitTextStroke: "2px rgba(255,255,255,0.35)" }}
                  >
                    {i + 1}
                  </span>
                  <div className="w-24">
                    <AnimeCard a={a} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Row
            title="Nova temporada 2025"
            icon={<Tv size={16} className="text-sky-400" />}
            items={newSeason}
          />

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
                    d.day === today
                      ? "border-fuchsia-500/60 bg-fuchsia-500/10"
                      : "border-white/10 bg-white/5"
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
                Streaming licenciado, sem anúncios invasivos e com legendas oficiais em português.
                Sua lista e seu progresso ficam salvos no dispositivo.
              </p>
            </div>
          </section>

          {/* Notícias / editorial */}
          <section className="px-4 pt-8">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Newspaper size={16} className="text-indigo-400" /> Notícias do mundo dos animes
            </h2>
            <div className="space-y-2">
              {[
                {
                  t: "2ª temporada de Dragon Heart Saga confirmada para outubro",
                  d: "O estúdio divulgou o primeiro teaser com o novo elenco de dubladores.",
                  tag: "Anúncio",
                },
                {
                  t: "Guia da temporada: os 8 títulos mais esperados",
                  d: "Nossa redação assistiu aos episódios de estreia e montou o ranking.",
                  tag: "Guia",
                },
                {
                  t: "Entrevista: como Kokoro no Melody gravou a trilha ao vivo",
                  d: "A diretora musical conta o processo dos 42 minutos de orquestra.",
                  tag: "Entrevista",
                },
              ].map((n) => (
                <article key={n.t} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-fuchsia-400">
                    {n.tag}
                  </span>
                  <h3 className="text-xs font-semibold leading-snug mt-0.5">{n.t}</h3>
                  <p className="text-[11px] text-white/50 mt-1">{n.d}</p>
                </article>
              ))}
            </div>
          </section>


          {/* Newsletter + apps */}
          <section className="px-4 pt-8">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-600/20 to-indigo-600/10 p-4">
              <h2 className="font-semibold text-sm">Receba os lançamentos por e-mail</h2>
              <p className="text-[11px] text-white/55 mt-1">
                Um resumo semanal com os episódios novos e as estreias da temporada.
              </p>
              <form onSubmit={(e) => e.preventDefault()} className="mt-3 flex gap-2">
                <input
                  type="email"
                  placeholder="seu@email.com"
                  className="flex-1 bg-white/10 rounded-full px-4 py-2 text-xs outline-none placeholder:text-white/40"
                />
                <button className="bg-white text-black text-xs font-bold px-4 rounded-full">
                  Assinar
                </button>
              </form>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-white/50">
                {["App Android", "App iOS", "Smart TV", "Chromecast"].map((p) => (
                  <span key={p} className="rounded-full border border-white/15 px-2.5 py-1">
                    {p}
                  </span>
                ))}
              </div>
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

          {/* Avaliações da comunidade */}
          <section className="px-4 pt-8">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Star size={16} className="text-yellow-400" /> O que a comunidade diz
            </h2>
            <div className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 p-3 mb-3">
              <p className="text-3xl font-black">4.8</p>
              <div>
                <div className="flex text-yellow-400">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="text-[11px] text-white/50">baseado em 18.420 avaliações</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { n: "Mariana S.", t: "Melhor lugar pra acompanhar os lançamentos, as legendas saem rapidinho.", d: "há 2 dias" },
                { n: "Rafael T.", t: "Uso todo dia no ônibus, carrega rápido até no 4G. O cronograma ajuda muito.", d: "há 5 dias" },
                { n: "Júlia M.", t: "Minha lista fica organizada e nunca perco em que episódio parei.", d: "há 1 semana" },
              ].map((r) => (
                <div key={r.n} className="rounded-2xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">{r.n}</p>
                    <span className="text-[10px] text-white/40">{r.d}</span>
                  </div>
                  <div className="flex text-yellow-400 mt-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} size={10} fill="currentColor" />
                    ))}
                  </div>
                  <p className="text-[11px] text-white/60 mt-1.5">{r.t}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Qualidade e dispositivos */}
          <section className="px-4 pt-8">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Tv size={16} className="text-sky-400" /> Assista onde quiser
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { t: "Full HD 1080p", s: "qualidade ajustável" },
                { t: "Legendado e dublado", s: "áudio original ou PT-BR" },
                { t: "Celular e tablet", s: "Android e iPhone" },
                { t: "Smart TV e PC", s: "direto no navegador" },
              ].map((f) => (
                <div key={f.t} className="rounded-2xl bg-white/5 border border-white/10 p-3">
                  <p className="text-xs font-semibold">{f.t}</p>
                  <p className="text-[10px] text-white/50">{f.s}</p>
                </div>
              ))}
            </div>
          </section>

          <footer className="px-4 pt-10 border-t border-white/5 mt-10">
            <p className="font-black text-lg pt-6">
              Ani<span className="text-fuchsia-500">Stream</span>
            </p>
            <p className="text-[11px] text-white/50 mt-1 leading-relaxed">
              Sua plataforma para acompanhar animes da temporada, clássicos e lançamentos com
              legendas em português.
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-white/50 mt-5">
              {[
                "Sobre nós",
                "Central de ajuda",
                "Termos de uso",
                "Privacidade",
                "Política de cookies",
                "Contato",
                "Trabalhe conosco",
                "Imprensa",
              ].map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
            <div className="flex gap-2 mt-5 text-[10px] text-white/60">
              {["Instagram", "TikTok", "X", "Discord"].map((s) => (
                <span key={s} className="rounded-full border border-white/10 px-3 py-1">
                  {s}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-white/30 mt-5">
              © 2026 AniStream. Todos os direitos reservados. Nomes e imagens pertencem aos
              seus respectivos detentores.
            </p>
          </footer>
        </>
      )}

      <p className="text-[10px] text-white/25 text-center px-6 pt-8">
        AniStream v2.4.1 · catálogo atualizado diariamente{site.note ? ` · ${site.note}` : ""}
      </p>

      <BottomNav />
    </div>
  );
}

function UpdatePopup() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, []);
  if (!open) return null;
  const close = () => setOpen(false);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-900 p-5 shadow-2xl">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
              Tudo funcionando de novo
            </p>
            <p className="text-sm font-bold">AniStream v2.5 chegou</p>
          </div>
        </div>
        <h2 className="text-lg font-black mt-4 leading-snug">
          Voltamos! Volte a assistir seus animes favoritos.
        </h2>
        <p className="text-xs text-white/60 mt-2 leading-relaxed">
          Terminamos a manutenção dos servidores. Os episódios, a busca e todas as funções do site
          voltaram a funcionar normalmente — do jeitinho que você deixou.
        </p>
        <ul className="mt-3 space-y-1.5 text-[11px] text-white/70">
          <li>• Busca por nome funcionando de novo</li>
          <li>• Sua lista e seu progresso continuam salvos</li>
          <li>• Player mais rápido e sem travar</li>
        </ul>
        <button
          onClick={close}
          className="mt-5 w-full bg-white text-black text-sm font-bold py-2.5 rounded-full"
        >
          Voltar a assistir
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, more = true }: { icon?: React.ReactNode; title: string; more?: boolean }) {
  return (
    <div className="mb-3 px-4 flex items-center justify-between">
      <h2 className="font-bold tracking-tight flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {more && (
        <Link to="/explorar" className="text-[11px] font-semibold text-white/50 flex items-center gap-0.5 hover:text-white">
          Ver tudo <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}

function Row({ title, items, icon }: { title: string; items: Anime[]; icon?: React.ReactNode }) {
  return (
    <section className="pt-7">
      <SectionTitle icon={icon} title={title} />
      <div className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar snap-x">
        {items.map((a) => (
          <div key={a.id} className="shrink-0 w-32 snap-start">
            <AnimeCard a={a} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Hero() {
  const slides = useMemo(
    () => [...catalog].sort((a, b) => b.rating - a.rating).slice(0, 5),
    [],
  );
  const [i, setI] = useState(0);
  const { has, toggle } = useMyList();
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);
  const a = slides[i];
  const d = animeDetail(a);
  return (
    <section className="px-4 pt-4">
      <div className="relative rounded-3xl overflow-hidden h-[26rem] bg-neutral-900 shadow-2xl shadow-black/60">
        {slides.map((s, idx) => (
          <img
            key={s.id}
            src={s.cover}
            alt={`Capa de ${s.title}`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
              idx === i ? "opacity-100" : "opacity-0"
            }`}
            width={512}
            height={768}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/50 to-transparent" />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider bg-fuchsia-600 px-2 py-1 rounded-md">
            {d.status === "Em exibição" ? "Simulcast" : "Destaque"}
          </span>
          <span className="text-[10px] font-bold bg-black/60 backdrop-blur px-2 py-1 rounded-md border border-white/10">
            {d.age}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-fuchsia-300 font-semibold">
            #{i + 1} em destaque hoje
          </p>
          <h1 className="text-3xl font-black leading-tight mt-1">{a.title}</h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/75 mt-1.5">
            <span className="flex items-center gap-1 text-yellow-400 font-bold">
              <Star size={11} className="fill-yellow-400" /> {a.rating}
            </span>
            <span>·</span>
            <span>{a.year}</span>
            <span>·</span>
            <span>{a.episodes} episódios</span>
            <span>·</span>
            <span>{a.genre}</span>
            <span className="border border-white/30 rounded px-1 text-[9px] font-bold">HD</span>
          </div>
          <p className="text-xs text-white/65 mt-2 line-clamp-2 leading-relaxed">{d.synopsis}</p>
          <div className="flex gap-2 mt-4">
            <Link
              to="/anime/$animeId"
              params={{ animeId: String(a.id) }}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-white text-black text-sm font-bold py-2.5 rounded-xl"
            >
              <Play size={15} className="fill-black" /> Assistir ep. 1
            </Link>
            <button
              onClick={() => toggle(a.id)}
              className="inline-flex items-center gap-2 bg-white/15 backdrop-blur text-sm font-semibold px-4 py-2.5 rounded-xl"
            >
              <Bookmark size={15} className={has(a.id) ? "fill-white" : ""} />
              {has(a.id) ? "Na lista" : "Minha lista"}
            </button>
          </div>
          <div className="flex justify-center gap-1.5 mt-4">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                aria-label={`Destaque ${idx + 1}`}
                onClick={() => setI(idx)}
                className={`h-1 rounded-full transition-all ${idx === i ? "w-6 bg-white" : "w-2 bg-white/30"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const AnimeCard = memo(function AnimeCard({ a }: { a: Anime }) {
  return (
    <Link to="/anime/$animeId" params={{ animeId: String(a.id) }} className="group block">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-neutral-900 ring-1 ring-white/5">
        <img
          src={a.cover}
          alt={`Capa do anime ${a.title}`}
          loading="lazy"
          width={512}
          height={768}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute top-1.5 left-1.5 flex gap-1">
          {a.year >= 2025 && (
            <span className="text-[8px] font-black uppercase bg-fuchsia-600 px-1.5 py-0.5 rounded">Novo</span>
          )}
          <span className="text-[8px] font-bold uppercase bg-black/70 px-1.5 py-0.5 rounded">Dub</span>
        </div>
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
