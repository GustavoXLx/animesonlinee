import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Star,
  Play,
  Plus,
  Share2,
  ThumbsUp,
  Clock,
  Users,
  Calendar,
  Check,
} from "lucide-react";
import { getAnime, animeDetail, episodes, similar } from "@/lib/animes";

export const Route = createFileRoute("/anime/$animeId")({
  loader: ({ params }) => {
    const anime = getAnime(Number(params.animeId));
    if (!anime) throw notFound();
    return { anime, detail: animeDetail(anime) };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.anime.title} — assistir online | AniStream` : "AniStream";
    const desc = loaderData?.detail.synopsis.slice(0, 155) ?? "Animes legendados e dublados.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "video.tv_show" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: AnimePage,
});

const REVIEWS = [
  { u: "hana_92", t: "Direção de arte impecável, trilha sonora fica na cabeça semanas depois.", s: 5 },
  { u: "kenzo.ttv", t: "Começa devagar, mas do episódio 5 em diante não dá pra parar.", s: 4 },
  { u: "mariana_r", t: "Assisti dublado com minha irmã e a adaptação ficou ótima.", s: 5 },
];

function AnimePage() {
  const { anime, detail } = Route.useLoaderData();
  const [tab, setTab] = useState<"eps" | "sobre" | "coment">("eps");
  const [saved, setSaved] = useState(false);
  const [dub, setDub] = useState<"leg" | "dub">("leg");
  const eps = useMemo(() => episodes(anime), [anime]);
  const rec = useMemo(() => similar(anime), [anime]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white pb-16">
      <div className="relative h-[46vh] min-h-72">
        <img
          src={anime.cover}
          alt={`Capa do anime ${anime.title}`}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent" />
        <Link
          to="/"
          className="absolute left-3 top-3 rounded-full bg-black/50 p-2 backdrop-blur"
          aria-label="Voltar"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {detail.tags.map((t) => (
              <span key={t} className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">
                {t}
              </span>
            ))}
          </div>
          <h1 className="text-2xl font-black leading-tight">{anime.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-white/70">
            <span className="flex items-center gap-1 font-semibold text-white">
              <Star size={12} className="fill-yellow-400 text-yellow-400" /> {anime.rating}
            </span>
            <span>·</span>
            <span>{anime.year}</span>
            <span>·</span>
            <span>{anime.episodes} eps</span>
            <span>·</span>
            <span className="rounded border border-white/30 px-1">{detail.age}</span>
            <span>·</span>
            <span>{detail.status}</span>
          </div>
        </div>
      </div>

      <div className="px-4">
        <div className="flex gap-2">
          <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-bold text-black">
            <Play size={16} className="fill-black" /> Assistir ep. 1
          </button>
          <button
            onClick={() => setSaved((v) => !v)}
            className="rounded-full bg-white/10 p-3"
            aria-label="Minha lista"
          >
            {saved ? <Check size={18} className="text-emerald-400" /> : <Plus size={18} />}
          </button>
          <button className="rounded-full bg-white/10 p-3" aria-label="Compartilhar">
            <Share2 size={18} />
          </button>
        </div>

        <div className="mt-4 flex gap-1 rounded-full bg-white/5 p-1 text-xs">
          {(["leg", "dub"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setDub(k)}
              className={`flex-1 rounded-full py-1.5 font-semibold ${
                dub === k ? "bg-white text-black" : "text-white/60"
              }`}
            >
              {k === "leg" ? "Legendado" : "Dublado"}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm leading-relaxed text-white/75">{detail.synopsis}</p>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] text-white/50">
          <div className="rounded-xl border border-white/10 bg-white/5 py-2">
            <Users size={14} className="mx-auto mb-1 text-fuchsia-400" />
            {detail.studio}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 py-2">
            <Calendar size={14} className="mx-auto mb-1 text-sky-400" />
            Temporada {anime.year}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 py-2">
            <Clock size={14} className="mx-auto mb-1 text-emerald-400" />
            ~24 min/ep
          </div>
        </div>

        <div className="mt-6 flex gap-4 border-b border-white/10 text-sm">
          {(
            [
              ["eps", "Episódios"],
              ["sobre", "Sobre"],
              ["coment", "Comentários"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 pb-2 font-semibold ${
                tab === k ? "border-fuchsia-500 text-white" : "border-transparent text-white/40"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {tab === "eps" && (
          <ul className="mt-3 space-y-2">
            {eps.map((e) => (
              <li key={e.n} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2">
                <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-neutral-900">
                  <img src={anime.cover} alt="" loading="lazy" className="h-full w-full object-cover opacity-70" />
                  <Play size={16} className="absolute inset-0 m-auto fill-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">
                    {e.n}. {e.title}
                  </p>
                  <p className="text-[10px] text-white/45">
                    {e.duration} · {e.date}
                    {e.filler && <span className="ml-1 text-amber-400">filler</span>}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === "sobre" && (
          <div className="mt-3 space-y-3 text-xs text-white/70">
            <p>
              <span className="text-white/40">Estúdio:</span> {detail.studio}
            </p>
            <p>
              <span className="text-white/40">Gênero:</span> {anime.genre}
            </p>
            <p>
              <span className="text-white/40">Status:</span> {detail.status}
            </p>
            <p>
              <span className="text-white/40">Classificação:</span> {detail.age}
            </p>
            <div>
              <p className="mb-1.5 text-white/40">Elenco de voz</p>
              <div className="flex flex-wrap gap-2">
                {detail.cast.map((c) => (
                  <span key={c} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px]">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "coment" && (
          <ul className="mt-3 space-y-2">
            {REVIEWS.map((r) => (
              <li key={r.u} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">@{r.u}</p>
                  <p className="flex items-center gap-0.5 text-[10px] text-yellow-400">
                    {"★".repeat(r.s)}
                  </p>
                </div>
                <p className="mt-1 text-[11px] text-white/65">{r.t}</p>
                <p className="mt-1.5 flex items-center gap-1 text-[10px] text-white/35">
                  <ThumbsUp size={10} /> útil
                </p>
              </li>
            ))}
          </ul>
        )}

        {rec.length > 0 && (
          <section className="pt-8">
            <h2 className="mb-3 text-sm font-semibold">Quem viu, viu também</h2>
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
              {rec.map((s) => (
                <Link
                  key={s.id}
                  to="/anime/$animeId"
                  params={{ animeId: String(s.id) }}
                  className="w-28 shrink-0"
                >
                  <div className="aspect-[2/3] overflow-hidden rounded-xl bg-neutral-900">
                    <img src={s.cover} alt={s.title} loading="lazy" className="h-full w-full object-cover" />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] font-semibold">{s.title}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
