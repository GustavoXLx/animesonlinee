import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Loader2, RotateCw, X } from "lucide-react";

const SERVERS = ["Player 1 (FHD)", "Player 2 (HD)", "Servidor Alternativo"];

type Phase = "ad" | "buffer" | "error";

export function EpisodePlayer({
  title,
  ep,
  epTitle,
  cover,
  onClose,
}: {
  title: string;
  ep: number;
  epTitle: string;
  cover: string;
  onClose: () => void;
}) {
  const [server, setServer] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState<Phase>("ad");
  const [left, setLeft] = useState(5);

  useEffect(() => {
    setPhase("ad");
    setLeft(5);
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [server, cycle]);

  useEffect(() => {
    if (phase !== "buffer") return;
    const t = setTimeout(() => setPhase("error"), 3500 + Math.random() * 1500);
    return () => clearTimeout(t);
  }, [phase]);

  const skipAd = () => setPhase("buffer");

  return (
    <div className="fixed inset-0 z-50 bg-black text-white overflow-y-auto">
      <div className="flex items-center gap-3 px-3 py-3 border-b border-white/10">
        <button onClick={onClose} aria-label="Voltar">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{title}</p>
          <p className="text-[11px] text-white/50 truncate">
            Episódio {ep} · {epTitle}
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto px-3 py-2">
        {SERVERS.map((s, i) => (
          <button
            key={s}
            onClick={() => (i === server ? setCycle((c) => c + 1) : setServer(i))}
            className={`shrink-0 rounded-md px-3 py-1.5 text-[11px] font-semibold ${
              i === server ? "bg-fuchsia-600" : "bg-white/10 text-white/70"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="relative aspect-video w-full bg-neutral-900">
        <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />

        {phase === "ad" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4 text-center">
            <span className="absolute left-2 top-2 rounded bg-yellow-500 px-1.5 text-[9px] font-bold text-black">
              ANÚNCIO
            </span>
            <button
              onClick={skipAd}
              disabled={left > 0}
              className="absolute right-2 top-2 flex items-center gap-1 rounded bg-white/15 px-2 py-1 text-[10px] disabled:opacity-60"
            >
              {left > 0 ? `Fechar em ${left}s` : "Fechar anúncio"} <X size={12} />
            </button>
            <p className="text-sm font-semibold">
              {left > 0 ? `Aguarde ${left} segundos para iniciar o player...` : "Feche o anúncio para iniciar o player"}
            </p>
            <div className="mt-3 h-1 w-48 overflow-hidden rounded bg-white/10">
              <div className="h-full bg-yellow-500 transition-all duration-1000" style={{ width: `${((5 - left) / 5) * 100}%` }} />
            </div>
            <p className="mt-3 text-[10px] text-white/40">Os anúncios mantêm o site gratuito</p>
          </div>
        )}

        {phase === "buffer" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 size={40} className="animate-spin text-fuchsia-500" />
            <p className="text-xs text-white/60">Carregando vídeo...</p>
          </div>
        )}

        {phase === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-5 text-center">
            <AlertTriangle size={30} className="text-amber-400" />
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-white/80">
              Servidor {server + 1} temporariamente indisponível devido a alta demanda de tráfego.
              Por favor, selecione outro servidor ou recarregue a página.
            </p>
            <button
              onClick={() => setCycle((c) => c + 1)}
              className="mt-4 flex items-center gap-1 rounded-full bg-white/10 px-4 py-1.5 text-[11px]"
            >
              <RotateCw size={12} /> Recarregar
            </button>
            <p className="mt-2 text-[9px] text-white/30">Código de erro: 503 · edge-{(server + 1) * 17}</p>
          </div>
        )}
      </div>

      <div className="px-3 py-3 text-[11px] text-white/50 space-y-1">
        <p>Se o vídeo não carregar, troque de player acima.</p>
        <p>Qualidade: automática · Legendado PT-BR</p>
      </div>
    </div>
  );
}
