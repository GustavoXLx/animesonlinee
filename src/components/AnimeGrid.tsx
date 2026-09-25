import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import type { Anime } from "@/lib/animes";

export function AnimeGrid({ items }: { items: Anime[] }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((a) => (
        <Link key={a.id} to="/anime/$animeId" params={{ animeId: String(a.id) }}>
          <div className="aspect-[2/3] overflow-hidden rounded-xl bg-white/10">
            <img src={a.cover} alt={a.title} loading="lazy" className="h-full w-full object-cover" />
          </div>
          <p className="mt-1 line-clamp-1 text-xs font-medium">{a.title}</p>
          <p className="flex items-center gap-1 text-[10px] text-white/50">
            <Star size={10} className="fill-yellow-400 text-yellow-400" /> {a.rating} · {a.genre}
          </p>
        </Link>
      ))}
    </div>
  );
}
