import { ArrowLeft, Clock, Heart, LogOut, Play, Star, Tv } from "lucide-react";
import { animes } from "@/lib/animes";

/** Perfil comum do AniStream (tela de fachada). */
export function DecoyProfile({ onExit }: { onExit: () => void }) {
  const list: { id: string | number; title: string; cover?: string; image?: string }[] = animes;
  const favs = list.slice(0, 6);
  // datas reais, calculadas a partir de hoje (dia/mês · hora)
  const plan = [
    [0, 21, 14, 80], [0, 20, 32, 100], [1, 22, 5, 100], [1, 19, 48, 45],
    [2, 23, 10, 100], [3, 18, 27, 62], [5, 21, 40, 100], [6, 20, 3, 100],
  ];
  const fmt = (daysAgo: number, h: number, m: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const day = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    const hr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return `${daysAgo === 0 ? "Hoje" : daysAgo === 1 ? "Ontem" : day} às ${hr}`;
  };
  const history = list.slice(6, 14).map((a, i) => ({
    a,
    ep: 3 + ((i * 7) % 20),
    when: fmt(plan[i][0], plan[i][1], plan[i][2]),
    pct: plan[i][3],
  }));
  const img = (a: { cover?: string; image?: string }) => a.cover ?? a.image;
  const avatar = img(list[0] ?? {});

  return (
    <div className="fixed inset-0 z-[100] bg-neutral-950 text-white overflow-y-auto">
      <header className="sticky top-0 bg-neutral-950/95 backdrop-blur flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button onClick={onExit} className="flex items-center gap-2 text-sm text-white/70">
          <ArrowLeft size={18} /> Catálogo
        </button>
        <span className="font-bold text-pink-500">AniStream</span>
        <button onClick={onExit} className="flex items-center gap-1 text-xs text-white/60">
          <LogOut size={16} /> Sair
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-4 pb-16">
        <section className="flex items-center gap-4 py-6">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-pink-500/30 ring-2 ring-pink-500">
            {avatar && <img src={avatar} alt="Foto de perfil" className="w-full h-full object-cover" />}
          </div>
          <div>
            <h1 className="text-xl font-bold">Alice</h1>
            <p className="text-sm text-white/50">Meu Perfil · membro desde 14/03/2025 · Plano Grátis</p>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-3">
          {[
            { icon: Tv, v: "14", l: "Animes" },
            { icon: Play, v: "312", l: "Episódios" },
            { icon: Clock, v: "118h", l: "Assistido" },
          ].map((s) => (
            <div key={s.l} className="bg-white/5 rounded-2xl p-3 text-center">
              <s.icon size={18} className="mx-auto text-pink-400" />
              <div className="text-lg font-bold mt-1">{s.v}</div>
              <div className="text-xs text-white/50">{s.l}</div>
            </div>
          ))}
        </section>

        <h2 className="mt-8 mb-3 font-semibold flex items-center gap-2">
          <Heart size={16} className="text-pink-500" /> Favoritos
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {favs.map((a) => (
            <div key={a.id}>
              <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/10">
                {img(a) && <img src={img(a)} alt={a.title} className="w-full h-full object-cover" />}
              </div>
              <p className="text-xs mt-1 line-clamp-1">{a.title}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-8 mb-3 font-semibold flex items-center gap-2">
          <Clock size={16} className="text-pink-500" /> Histórico de episódios
        </h2>
        <div className="space-y-3">
          {history.map(({ a, ep, when, pct }) => (
            <div key={a.id} className="flex gap-3 bg-white/5 rounded-xl p-2">
              <div className="w-24 aspect-video rounded-lg overflow-hidden bg-white/10 shrink-0">
                {img(a) && <img src={img(a)} alt={a.title} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{a.title}</p>
                <p className="text-xs text-white/50">Episódio {ep} · {when}</p>
                <div className="h-1 bg-white/10 rounded mt-2">
                  <div className="h-1 bg-pink-500 rounded" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center gap-2 text-sm text-white/50">
          <Star size={14} /> Gênero favorito: Ação · Shounen
        </div>
      </div>
    </div>
  );
}
